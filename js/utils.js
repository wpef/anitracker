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
  if (e.type === 'bathroom') {
    return { ...e,
      type:     e.action,
      text_val: e.text_val ?? e.location,
      num_val:  e.num_val  ?? e.firmness ?? e.taille,
    };
  }
  if (e.type === 'walk') {
    return { ...e, timestamp: e.timestamp || e.start_time };
  }
  return e; // types futurs passent sans modification
}

// ── Registre des types d'entrée ────────────────────────────────────────────

/**
 * Registre des types d'entrée connus.
 * Pour ajouter un type : une entrée ici suffit — pas de modification des modules génériques.
 *
 * @type {Record<string, {label:string, icon:string, numLabel?:string,
 *                        textLabel?:(v:string)=>string}>}
 */
export const TYPE_DEF = {
  pipi: {
    label:     'Pipi',
    icon:      '💧',
    numLabel:  'Quantité',
    textLabel: v => v === 'outside' ? 'Dehors' : 'Dedans',
  },
  caca: {
    label:     'Caca',
    icon:      '💩',
    numLabel:  'Fermeté',
    textLabel: v => v === 'outside' ? 'Dehors' : 'Dedans',
  },
  walk: {
    label: 'Balade',
    icon:  '🐾',
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

// ── Formatage ──────────────────────────────────────────────────────────────

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
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) + ' ' + time;
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
