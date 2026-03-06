/**
 * ui-edit.js – Page d'édition d'une entrée existante.
 *
 * Entièrement piloté par TYPE_DEF : le formulaire est construit
 * dynamiquement selon le type de l'entrée (gauge, textOptions, hasDuration).
 */

import { $, buildSegment, toLocalISO, formatDuration, formatWalkTime, TYPE_DEF, getTextLabel, gaugeLabel } from './utils.js';
import { initGauge } from './ui-gauge.js';
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

  const def   = TYPE_DEF[entry.type];
  const body  = $('edit-page-body');
  let updated = {};

  if (def?.hasDuration) {
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
    const activeLoc = body.querySelector('[data-loc].active')?.dataset.loc || entry.text_val;
    const gaugeEl   = $('edit-gauge');
    updated = {
      type:      entry.type,
      timestamp: new Date($('edit-time').value).toISOString(),
      note:      $('edit-note').value.trim(),
    };
    if (activeLoc !== undefined) updated.text_val = activeLoc;
    if (gaugeEl)                 updated.num_val  = parseInt(gaugeEl.value, 10);
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

export function openEditPage(id) {
  const entry = db.getAllEntries().find(e => e.id === id);
  if (!entry) return;
  editingId = id;

  const def  = TYPE_DEF[entry.type];
  const body = $('edit-page-body');
  body.innerHTML = def?.hasDuration
    ? _buildDurationForm(entry, def)
    : _buildPointForm(entry, def);

  showPage('edit');
  _attachEditListeners(entry, def);
}

// ── Construction des formulaires ───────────────────────────────────────────

function _buildDurationForm(entry, def) {
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

function _buildPointForm(entry, def) {
  const timeVal = toLocalISO(entry.timestamp);
  let html = '';

  // Options textuelles (lieu, etc.)
  if (def?.textOptions?.length) {
    html += `<div class="card">
      <div class="card-title">Lieu</div>
      ${buildSegment('loc',
        def.textOptions.map(o => ({ value: o.value, label: (o.icon || '') + ' ' + o.label })),
        entry.text_val
      )}
    </div>`;
  }

  // Jauge
  if (def?.gauge) {
    const cfg    = def.gauge;
    const numVal = entry.num_val ?? cfg.def;
    html += `<div class="card">
      <div class="card-title">${def.icon} ${cfg.title}</div>
      <div class="gauge-current-label" id="edit-gauge-value">${gaugeLabel(cfg.steps, numVal)}</div>
      <input type="range" id="edit-gauge" min="0" max="100" value="${numVal}" step="1" />
      <div class="gauge-ends-row">
        <span>${cfg.ends[0]}</span>
        <span>${cfg.ends[1]}</span>
      </div>
    </div>`;
  }

  // Date & heure
  html += `<div class="card">
    <div class="card-title">🕐 Date &amp; heure</div>
    <input type="datetime-local" id="edit-time" value="${timeVal}" class="modal-input" />
  </div>`;

  // Note
  html += `<div class="card">
    <div class="card-title">📝 Note</div>
    <input type="text" id="edit-note" value="${entry.note || ''}" class="modal-input" placeholder="Note…" />
  </div>`;

  return html;
}

// ── Listeners dynamiques (recréés à chaque ouverture) ─────────────────────

function _attachEditListeners(entry, def) {
  if (def?.hasDuration) {
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
    // Délégation click pour les options textuelles
    body.addEventListener('click', ev => {
      const lBtn = ev.target.closest('[data-loc]');
      if (lBtn) {
        body.querySelectorAll('[data-loc]').forEach(b => b.classList.remove('active'));
        lBtn.classList.add('active');
      }
    });
    // Jauge
    if ($('edit-gauge')) initGauge($('edit-gauge'), $('edit-gauge-value'), entry.type);
  }
}
