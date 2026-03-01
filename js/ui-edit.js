/**
 * ui-edit.js – Page d'édition d'une entrée existante.
 *
 * openEditPage(id) construit le formulaire d'édition dans #edit-page-body
 * et navigue vers la page 'edit'. Les boutons persistants (retour, supprimer,
 * enregistrer) sont enregistrés une seule fois au chargement du module.
 */

import { $, toLocalISO, formatDuration, formatWalkTime } from './utils.js';
import { initGauge, GAUGE_CONFIG } from './ui-gauge.js';
import { showToast, setSyncState } from './toast.js';
import { showPage } from './navigation.js';
import { db } from './db-context.js';

// ── État local ─────────────────────────────────────────────────────────────

let editingId = null;

// ── Boutons persistants (enregistrés une fois à l'import) ─────────────────

$('edit-back-btn')?.addEventListener('click', () => {
  editingId = null;
  showPage('history');
});

$('edit-delete-btn')?.addEventListener('click', async () => {
  if (!editingId) return;
  if (!confirm('Supprimer cette entrée ?')) return;
  setSyncState('pending');
  try {
    await db.deleteEntry(editingId);
    setSyncState('ok');
  } catch {
    setSyncState('error');
  }
  editingId = null;
  showPage('history');
  showToast('Entrée supprimée');
});

$('edit-page-save-btn')?.addEventListener('click', async () => {
  if (!editingId) return;
  const entry = db.getAllEntries().find(e => e.id === editingId);
  if (!entry) return;

  const body    = $('edit-page-body');
  let updated   = {};

  if (entry.type === 'walk') {
    const startVal = $('edit-walk-start').value;
    const endVal   = $('edit-walk-end').value;
    const dur      = endVal
      ? Math.round((new Date(endVal) - new Date(startVal)) / 60000)
      : (entry.duration_min || 0);
    updated = {
      timestamp:    new Date(startVal).toISOString(),
      end_time:     endVal ? new Date(endVal).toISOString() : null,
      duration_min: dur,
      note:         $('edit-note').value.trim(),
    };
  } else {
    const activeAction = body.querySelector('[data-action].active')?.dataset.action || entry.type;
    const activeLoc    = body.querySelector('[data-loc].active')?.dataset.loc       || entry.text_val;
    const firmInput    = $('edit-firmness');
    const tailleInput  = $('edit-taille');
    const numVal = activeAction === 'caca'
      ? (firmInput  ? parseInt(firmInput.value,  10) : undefined)
      : (tailleInput ? parseInt(tailleInput.value, 10) : undefined);
    updated = {
      type:      activeAction,
      text_val:  activeLoc,
      timestamp: new Date($('edit-time').value).toISOString(),
      note:      $('edit-note').value.trim(),
      ...(numVal !== undefined ? { num_val: numVal } : {}),
    };
  }

  setSyncState('pending');
  try {
    await db.updateEntry(editingId, updated);
    setSyncState('ok');
  } catch {
    setSyncState('error');
  }
  editingId = null;
  showPage('history');
  showToast('Entrée modifiée ✓');
});

// ── Ouverture de la page d'édition ────────────────────────────────────────

/**
 * Construit le formulaire d'édition pour l'entrée donnée et affiche la page.
 *
 * @param {string} id  Identifiant de l'entrée à éditer
 */
export function openEditPage(id) {
  const entry = db.getAllEntries().find(e => e.id === id);
  if (!entry) return;
  editingId = id;

  const body = $('edit-page-body');
  body.innerHTML = entry.type === 'walk'
    ? _buildWalkForm(entry)
    : _buildBathroomForm(entry);

  showPage('edit');
  _attachEditListeners(entry);
}

// ── Construction des formulaires ───────────────────────────────────────────

function _buildWalkForm(entry) {
  const startVal = toLocalISO(entry.timestamp);
  const endVal   = entry.end_time ? toLocalISO(entry.end_time) : '';
  const dur      = entry.duration_min || 0;
  return `
    <div class="card">
      <div class="card-title">🚶 Début</div>
      <input type="datetime-local" id="edit-walk-start" value="${startVal}" class="modal-input" />
    </div>
    <div class="card">
      <div class="card-title">🏠 Fin</div>
      <input type="datetime-local" id="edit-walk-end" value="${endVal}" class="modal-input" />
    </div>
    <div id="edit-dur-display" class="walk-duration-display">${dur > 0 ? formatDuration(dur) : '—'}</div>
    <div class="card">
      <div class="card-title">📝 Note</div>
      <input type="text" id="edit-note" value="${entry.note || ''}" class="modal-input" placeholder="Note…" />
    </div>`;
}

function _buildBathroomForm(entry) {
  const timeVal  = toLocalISO(entry.timestamp);
  const isCaca   = entry.type === 'caca';
  const isIn     = entry.text_val === 'inside';
  const numVal   = entry.num_val ?? (isCaca ? GAUGE_CONFIG.caca.def : GAUGE_CONFIG.pipi.def);
  const cfgF     = GAUGE_CONFIG.caca;
  const cfgT     = GAUGE_CONFIG.pipi;
  return `
    <div class="card">
      <div class="card-title">Action</div>
      <div class="segment">
        <button class="seg-btn ${!isCaca ? 'active' : ''}" data-action="pipi">💧 Pipi</button>
        <button class="seg-btn ${isCaca  ? 'active' : ''}" data-action="caca">💩 Caca</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Lieu</div>
      <div class="segment">
        <button class="seg-btn ${!isIn ? 'active' : ''}" data-loc="outside">🌿 Dehors</button>
        <button class="seg-btn ${isIn  ? 'active' : ''}" data-loc="inside">🏠 Dedans</button>
      </div>
    </div>
    <div class="card" id="edit-firmness-section" style="display:${isCaca ? 'block' : 'none'}">
      <div class="card-title">💩 ${cfgF.title}</div>
      <div class="gauge-current-label" id="edit-firmness-value">${cfgF.getLabel(numVal)}</div>
      <input type="range" id="edit-firmness" min="0" max="100" value="${numVal}" step="1" />
      <div class="gauge-ends-row">
        <span>${cfgF.ends[0]}</span>
        <span>${cfgF.ends[1]}</span>
      </div>
    </div>
    <div class="card" id="edit-taille-section" style="display:${!isCaca ? 'block' : 'none'}">
      <div class="card-title">💧 ${cfgT.title}</div>
      <div class="gauge-current-label" id="edit-taille-value">${cfgT.getLabel(numVal)}</div>
      <input type="range" id="edit-taille" min="0" max="100" value="${numVal}" step="1" />
      <div class="gauge-ends-row">
        <span>${cfgT.ends[0]}</span>
        <span>${cfgT.ends[1]}</span>
      </div>
    </div>
    <div class="card">
      <div class="card-title">🕐 Date &amp; heure</div>
      <input type="datetime-local" id="edit-time" value="${timeVal}" class="modal-input" />
    </div>
    <div class="card">
      <div class="card-title">📝 Note</div>
      <input type="text" id="edit-note" value="${entry.note || ''}" class="modal-input" placeholder="Note…" />
    </div>`;
}

// ── Listeners dynamiques (recréés à chaque ouverture) ─────────────────────

function _attachEditListeners(entry) {
  if (entry.type === 'walk') {
    const recalc = () => {
      const dur = Math.round(
        (new Date($('edit-walk-end').value) - new Date($('edit-walk-start').value)) / 60000
      );
      $('edit-dur-display').textContent =
        (dur > 0 && $('edit-walk-end').value) ? formatDuration(dur) : '—';
    };
    $('edit-walk-start').addEventListener('change', recalc);
    $('edit-walk-end').addEventListener('change',   recalc);
  } else {
    const body = $('edit-page-body');
    body.addEventListener('click', ev => {
      const aBtn = ev.target.closest('[data-action]');
      if (aBtn) {
        body.querySelectorAll('[data-action]').forEach(b => b.classList.remove('active'));
        aBtn.classList.add('active');
        const isCaca = aBtn.dataset.action === 'caca';
        $('edit-firmness-section').style.display = isCaca  ? 'block' : 'none';
        $('edit-taille-section').style.display   = !isCaca ? 'block' : 'none';
      }
      const lBtn = ev.target.closest('[data-loc]');
      if (lBtn) {
        body.querySelectorAll('[data-loc]').forEach(b => b.classList.remove('active'));
        lBtn.classList.add('active');
      }
    });
    if ($('edit-firmness'))  initGauge($('edit-firmness'),  $('edit-firmness-value'), 'caca');
    if ($('edit-taille'))   initGauge($('edit-taille'),    $('edit-taille-value'),   'pipi');
  }
}
