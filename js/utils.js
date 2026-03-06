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
// Source unique pour les vérifications de type : à mettre à jour ici si de
// nouveaux types walk-like ou bathroom-like sont ajoutés.

/** @param {BaseEntry} e @returns {boolean} */
export const isWalk     = e => e.type === 'walk';
/** @param {BaseEntry} e @returns {boolean} */
export const isBathroom = e => e.type === 'pipi' || e.type === 'caca';
/** @param {BaseEntry} e @returns {boolean} */
export const isMeal = e => e.type === 'meal';

// ── Labels de valeur pipi / caca ───────────────────────────────────────────

/**
 * Retourne le label textuel pour une valeur pipi (0–100).
 * @param {number} val
 * @returns {string}
 */
export function pipiLabel(val) {
  if (val === undefined || val === null) return 'Normal';
  if (val < 10) return 'Gouttes';
  if (val < 30) return 'Petit';
  if (val < 60) return 'Normal';
  if (val < 85) return 'Gros';
  return 'Énorme';
}

/**
 * Retourne le label textuel pour une valeur caca (0–100).
 * @param {number} val
 * @returns {string}
 */
export function cacaLabel(val) {
  if (val === undefined || val === null) return 'Mou';
  if (val < 10) return 'Liquide';
  if (val < 30) return 'Mou';
  if (val < 50) return 'Pateux';
  if (val < 85) return 'Ferme';
  return 'Solide';
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
  if (e.type === 'pipi' || e.type === 'caca') return e;  // déjà BaseEntry
  if (e.type === 'walk') {
    return { ...e, timestamp: e.timestamp || e.start_time };
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
 *   label      {string}   - Libellé affiché (historique, toast)
 *   icon       {string}   - Emoji
 *   textLabel  {fn}       - Transforme text_val → label lisible (ex: 'outside' → 'Dehors')
 *
 * Champs optionnels (types avec jauge) :
 *   gauge.title    {string}         - Titre de la section jauge
 *   gauge.color    {string}         - Gradient CSS du track
 *   gauge.ends     {[string,string]}- Labels extrémités [gauche, droite]
 *   gauge.getLabel {fn}             - (val: 0-100) → label courant
 *   gauge.def      {number}         - Valeur par défaut (0-100)
 *
 * @type {Record<string, object>}
 */
export const TYPE_DEF = {
  pipi: {
    label:     'Pipi',
    icon:      '💧',
    textLabel: v => v === 'outside' ? 'Dehors' : 'Dedans',
    gauge: {
      title:    'Quantité',
      color:    'linear-gradient(to right, rgba(76,201,240,.25), #4cc9f0)',
      ends:     ['Gouttes', 'Énorme'],
      getLabel: pipiLabel,
      def:      50,
    },
  },
  caca: {
    label:     'Caca',
    icon:      '💩',
    textLabel: v => v === 'outside' ? 'Dehors' : 'Dedans',
    gauge: {
      title:    'Fermeté',
      color:    'linear-gradient(to right, #e94560, #ffcc80, #4caf50)',
      ends:     ['Liquide', 'Solide'],
      getLabel: cacaLabel,
      def:      25,
    },
  },
  walk: {
    label: 'Balade',
    icon:  '🐾',
  },
  meal: {
    label: 'Repas',
    icon:  '🍽️',
  },
};

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
