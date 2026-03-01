/**
 * utils.js – Utilitaires partagés : helpers DOM et formatage de dates/durées.
 */

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
