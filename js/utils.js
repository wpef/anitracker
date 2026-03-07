/**
 * utils.js – Utilitaires partagés : typedefs Entry, helpers DOM, formatage.
 */

// ── Schéma de données Entry ────────────────────────────────────────────────

/**
 * Structure cible pour tout nouveau type d'entrée.
 *
 * Les champs `text_val` / `num_val` remplacent les champs nommés spécifiques
 * afin de rester extensible sans migration de données ni modification des modules
 * génériques (historique, stats, édition).
 *
 * Correspondances avec les types legacy :
 *  - text_val ≈ location ('outside'|'inside') pour BathroomEntry
 *  - num_val  ≈ firmness ou taille (0–100)    pour BathroomEntry
 *
 * @typedef {object} BaseEntry
 * @property {string}  type           Discriminant du type d'entrée (extensible)
 * @property {string}  timestamp      Date-heure de début ISO 8601 — clé de tri universelle
 * @property {string}  [end_time]     Date-heure de fin ISO 8601
 * @property {number}  [duration_min] Durée pré-calculée en minutes (évite le recalcul)
 * @property {string}  [text_val]     Valeur textuelle propre au type
 *                                    (ex: lieu 'outside'|'inside', catégorie…)
 * @property {number}  [num_val]      Valeur numérique 0–100 propre au type
 *                                    (ex: fermeté, quantité, intensité…)
 * @property {string}  [note]         Note libre de l'utilisateur
 * @property {string}  [id]           Identifiant unique assigné par la DB
 */

/** @typedef {BaseEntry} Entry */

// ── Prédicats de type ──────────────────────────────────────────────────────
// Déduits de TYPE_DEF — plus aucun type n'est hardcodé ici.

/** @param {BaseEntry} e @returns {boolean} */
export const isWalk     = e => TYPE_DEF[e.type]?.hasDuration === true;
/** @param {BaseEntry} e @returns {boolean} */
export const isBathroom = e => TYPE_DEF[e.type]?.category === 'need';
/** @param {BaseEntry} e @returns {boolean} */
export const isNeed     = e => TYPE_DEF[e.type]?.category === 'need';
/** @param {BaseEntry} e @returns {boolean} */
export const hasDuration = e => TYPE_DEF[e.type]?.hasDuration === true;

// ── Label générique de jauge ────────────────────────────────────────────────

/**
 * Retourne le label textuel d'une valeur de jauge en se basant sur les
 * paliers (steps) définis dans gauge.steps.
 *
 * Chaque palier est un tuple [seuil, label]. La fonction retourne le label
 * du dernier palier dont le seuil est ≤ val.
 *
 * @param {Array<[number, string]>} steps  Paliers triés par seuil croissant
 * @param {number} val                     Valeur 0–100
 * @returns {string}
 */
export function gaugeLabel(steps, val) {
  if (!steps?.length) return '?';
  if (val === undefined || val === null) return steps[0][1];
  let label = steps[0][1];
  for (const [threshold, lbl] of steps) {
    if (val >= threshold) label = lbl;
    else break;
  }
  return label;
}

// ── Normalisation des entrées legacy ───────────────────────────────────────

/**
 * Normalise une entrée depuis le format legacy vers BaseEntry.
 * Appelée dans app.js pour wrapper db.getAllEntries().
 *
 * Correspondances legacy :
 *  {type:'bathroom', action:'pipi', location:'outside', taille:50}
 *    → {type:'pipi', text_val:'outside', num_val:50}
 *  walk + action='end' → null  (format v1 obsolète, deux docs par balade)
 *
 * @param {object} e
 * @returns {BaseEntry|null}
 */
export function normalizeEntry(e) {
  if (!e) return null;
  if (e.type === 'walk' && e.action === 'end') return null;
  // Types connus dans TYPE_DEF → déjà au format BaseEntry (+ fix timestamp legacy walk)
  if (TYPE_DEF[e.type]) {
    if (TYPE_DEF[e.type].hasDuration && !e.timestamp && e.start_time) {
      return { ...e, timestamp: e.start_time };
    }
    return e;
  }
  // Entrées legacy type:'bathroom' ET entrées sans type (type absent/null/undefined)
  if (e.type === 'bathroom' || !e.type) {
    // Si action manquante, on l'infère : firmness → caca, taille → pipi, sinon pipi par défaut
    const action = e.action || (e.firmness !== undefined ? 'caca' : 'pipi');
    return { ...e,
      type:     action,
      text_val: e.text_val ?? e.location,
      num_val:  e.num_val  ?? e.firmness ?? e.taille,
    };
  }
  return e; // types futurs passent sans modification
}

// ── Registre des types d'entrée ────────────────────────────────────────────

/**
 * Source de vérité unique pour tous les types d'entrée.
 * Pour ajouter un nouveau type : une seule entrée ici, aucun autre fichier à toucher.
 *
 * Champs communs :
 *   label          {string}   - Libellé affiché (historique, toast)
 *   icon           {string}   - Emoji
 *   category       {string}   - 'need' (besoin, entre dans le score propreté) | 'activity'
 *   color          {string}   - Couleur CSS principale du type
 *
 * Champs optionnels :
 *   hasDuration    {boolean}  - true = type avec début/fin (balade)
 *   textTitle      {string}   - Titre de la section text_val ("Lieu", "Appétit"…)
 *   textOptions    {Array<{value,label,icon,color}>} - Options pour text_val
 *   defaultTextVal {string}   - Valeur par défaut de text_val
 *   insideValue    {string}   - Valeur de text_val comptée comme "dedans" pour le score propreté
 *   gauge          {object}   - Config de la jauge (titre, couleur, paliers, défaut)
 *     gauge.steps  {Array<[number,string]>}  - Paliers [seuil, label] triés croissant
 *
 * @type {Record<string, object>}
 */
export const TYPE_DEF = {
  pipi: {
    label:          'Pipi',
    icon:           '💧',
    category:       'need',
    color:          '#4cc9f0',
    textTitle:      'Lieu',
    textOptions:    [
      { value: 'outside', label: 'Dehors', icon: '🌿', color: '#4caf50' },
      { value: 'inside',  label: 'Dedans', icon: '🏠', color: '#e94560' },
    ],
    defaultTextVal: 'outside',
    insideValue:    'inside',
    gauge: {
      title: 'Quantité',
      color: 'linear-gradient(to right, rgba(76,201,240,.25), #4cc9f0)',
      ends:  ['Gouttes', 'Énorme'],
      steps: [[0, 'Gouttes'], [10, 'Petit'], [30, 'Normal'], [60, 'Gros'], [85, 'Énorme']],
      def:   50,
    },
  },
  caca: {
    label:          'Caca',
    icon:           '💩',
    category:       'need',
    color:          '#f77f00',
    textTitle:      'Lieu',
    textOptions:    [
      { value: 'outside', label: 'Dehors', icon: '🌿', color: '#4caf50' },
      { value: 'inside',  label: 'Dedans', icon: '🏠', color: '#e94560' },
    ],
    defaultTextVal: 'outside',
    insideValue:    'inside',
    gauge: {
      title: 'Fermeté',
      color: 'linear-gradient(to right, #e94560, #ffcc80, #4caf50)',
      ends:  ['Liquide', 'Solide'],
      steps: [[0, 'Liquide'], [10, 'Mou'], [30, 'Pateux'], [50, 'Ferme'], [85, 'Solide']],
      def:   25,
    },
  },
  walk: {
    label:       'Balade',
    icon:        '🐾',
    category:    'activity',
    color:       '#4cc9f0',
    hasDuration: true,
  },
};

// ── Helpers TYPE_DEF ─────────────────────────────────────────────────────

/** Types de la catégorie 'need' (besoins — entrent dans le score propreté). */
export const needTypes     = () => Object.entries(TYPE_DEF).filter(([, d]) => d.category === 'need');
/** Types de la catégorie 'activity' (hasDuration). */
export const activityTypes = () => Object.entries(TYPE_DEF).filter(([, d]) => d.category === 'activity');
/** Tous les types sous forme [key, def]. */
export const allTypes      = () => Object.entries(TYPE_DEF);

/**
 * Retourne le label lisible d'une text_val pour un type donné.
 * @param {string} type   Clé du type (ex: 'pipi')
 * @param {string} value  Valeur (ex: 'outside')
 * @returns {string}
 */
export function getTextLabel(type, value) {
  const opt = TYPE_DEF[type]?.textOptions?.find(o => o.value === value);
  return opt ? opt.label : (value || '');
}

// ── Helpers DOM ────────────────────────────────────────────────────────────

/** Raccourci getElementById */
export const $ = id => document.getElementById(id);

/**
 * Active l'élément dont l'attribut `data-<group>` correspond à `value`,
 * désactive tous les autres du même groupe.
 *
 * @param {string} group  Nom de l'attribut data (ex: 'type', 'action', 'loc')
 * @param {string} value  Valeur à activer
 */
export const setActive = (group, value) => {
  document.querySelectorAll(`[data-${group}]`).forEach(el => {
    el.classList.toggle('active', el.dataset[group] === value);
  });
};

/**
 * Affiche ou masque un élément identifié par son id.
 * Remplace les appels directs à style.display éparpillés dans les modules UI.
 *
 * @param {string}  id    getElementById target
 * @param {boolean} show
 */
export function setVisible(id, show) {
  $(id).style.display = show ? 'block' : 'none';
}

/**
 * Génère le HTML d'un groupe de boutons segment (`.segment` / `.seg-btn`).
 * Utilisé pour construire les toggles action (pipi/caca) et lieu (dehors/dedans)
 * dans les formulaires dynamiques (nouvelle entrée, édition).
 *
 * @param {string}   dataAttr    Nom de l'attribut data (ex: 'action', 'loc')
 * @param {Array<{value: string, label: string}>} options
 * @param {string}   activeValue Valeur à marquer active
 * @returns {string} HTML string
 */
export function buildSegment(dataAttr, options, activeValue) {
  const buttons = options.map(({ value, label }) =>
    `<button class="seg-btn${value === activeValue ? ' active' : ''}" data-${dataAttr}="${value}">${label}</button>`
  ).join('');
  return `<div class="segment">${buttons}</div>`;
}

// ── Formatage ──────────────────────────────────────────────────────────────

/**
 * Formate une Date en label court localisé : ex "lun. 3".
 * Utilisé pour les labels de graphiques (stats.js) et l'affichage
 * de l'heure de balade hors du jour courant (formatWalkTime).
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatDayShort(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

/**
 * Formate une durée en minutes → "30min", "1h", "1h30".
 *
 * @param {number|null} totalMin
 * @returns {string}
 */
export function formatDuration(totalMin) {
  if (totalMin === null || totalMin === undefined || isNaN(totalMin)) return '';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Formate un timestamp ISO pour affichage dans le sélecteur de balade.
 * Retourne l'heure si c'est aujourd'hui, sinon "lun. 3 " + heure.
 *
 * @param {string} isoStr
 * @returns {string}
 */
export function formatWalkTime(isoStr) {
  if (!isoStr) return '—';
  const d     = new Date(isoStr);
  const today = new Date();
  const time  = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return time;
  return formatDayShort(d) + ' ' + time;
}

/**
 * Convertit une Date en chaîne ISO locale tronquée à la minute
 * (format attendu par <input type="datetime-local">).
 *
 * @param {Date|string} date
 * @returns {string}  ex: "2025-06-15T14:30"
 */
export function toLocalISO(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Retourne l'heure locale courante au format datetime-local. */
export function localNow() {
  return toLocalISO(new Date());
}
