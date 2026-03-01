/**
 * navigation.js – Gestion de la navigation entre pages.
 *
 * Utilise un registre de renderers pour déclencher le rendu de la page active
 * sans créer de dépendances circulaires avec les modules UI.
 * Les renderers sont enregistrés par app.js via onShowPage().
 */

import { $ } from './utils.js';

// ── Registre de renderers ──────────────────────────────────────────────────

/** @type {Record<string, () => void>} */
const _renderers = {};

/**
 * Enregistre une fonction de rendu à appeler à chaque affichage d'une page.
 *
 * @param {string}   pageId  Identifiant de page ('stats', 'history', …)
 * @param {() => void} fn    Fonction de rendu
 */
export function onShowPage(pageId, fn) {
  _renderers[pageId] = fn;
}

// ── Navigation ─────────────────────────────────────────────────────────────

/**
 * Affiche la page donnée, met à jour la nav bar et déclenche son renderer.
 *
 * @param {string} id  Identifiant de page ('new', 'history', 'stats', 'edit')
 */
export function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(`page-${id}`).classList.add('active');

  // La page 'edit' est une sous-page de 'history' : on garde la nav active
  if (id !== 'edit') {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const navBtn = $(`nav-${id}`);
    if (navBtn) navBtn.classList.add('active');
  }

  // Le bouton flottant "+" n'est visible que sur la page de saisie
  $('btn-add').style.display = id === 'new' ? 'block' : 'none';

  if (_renderers[id]) _renderers[id]();
}

// ── Nav bar listeners ──────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});
