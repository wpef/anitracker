/**
 * ui-custom-type.js – Custom type creation form (premium only).
 *
 * Allows users to create their own entry types with configurable
 * icon, color, gauge, text options, and duration.
 */

import { $, TYPE_DEF } from './utils.js';
import { showToast } from './toast.js';
import { showPage } from './navigation.js';
import { isPremium } from './permissions.js';
import { showPremiumCTA } from './ui-premium.js';

let _getHouseholdId = null;
let _householdModule = null;

// ── Predefined colors & emojis ──────────────────────────────────────────────

const COLORS = [
  '#e94560', '#f77f00', '#ff9800', '#4caf50',
  '#4cc9f0', '#2196f3', '#ab47bc', '#9c27b0',
  '#78909c', '#795548', '#607d8b', '#00bcd4',
];

const EMOJIS = [
  '💊', '💉', '🩺', '🧴', '🪥', '🧹',
  '🛁', '✂️', '🎾', '🦴', '🧸', '🎵',
  '📸', '🚗', '🏥', '🌡️', '⚖️', '🧪',
  '🐕', '🐾', '🦮', '🐶', '🍖', '🥩',
  '💤', '😴', '🌙', '☀️', '🌧️', '❤️',
];

let _selectedColor = COLORS[0];
let _selectedEmoji = EMOJIS[0];
let _textOptions = [];

// ── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialize the custom type creation UI.
 * @param {() => string} getHouseholdId
 * @param {object} householdModule
 */
export function initCustomType(getHouseholdId, householdModule) {
  _getHouseholdId = getHouseholdId;
  _householdModule = householdModule;

  _buildColorPicker();
  _buildEmojiPicker();

  // Toggle sections
  $('ct-gauge-toggle')?.addEventListener('change', () => {
    $('ct-gauge-config').style.display = $('ct-gauge-toggle').checked ? 'block' : 'none';
  });
  $('ct-text-toggle')?.addEventListener('change', () => {
    $('ct-text-config').style.display = $('ct-text-toggle').checked ? 'block' : 'none';
  });

  // Add text option
  $('ct-add-text-opt')?.addEventListener('click', _addTextOption);

  // Back button
  $('ct-back-btn')?.addEventListener('click', () => showPage('new'));

  // Submit
  $('ct-save-btn')?.addEventListener('click', _handleSave);
}

/**
 * Open the custom type creation page.
 * Called when user taps the "+" button on the type selector.
 */
export function openCustomTypePage() {
  if (!isPremium()) {
    showPremiumCTA('Creez vos propres types avec Premium');
    return;
  }
  _resetForm();
  showPage('custom-type');
}

// ── Build UI ─────────────────────────────────────────────────────────────────

function _buildColorPicker() {
  const container = $('ct-color-grid');
  if (!container) return;
  container.innerHTML = COLORS.map(c =>
    `<button class="ct-color-swatch${c === _selectedColor ? ' active' : ''}" data-color="${c}" style="background:${c}"></button>`
  ).join('');
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;
    _selectedColor = btn.dataset.color;
    container.querySelectorAll('.ct-color-swatch').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
}

function _buildEmojiPicker() {
  const container = $('ct-emoji-grid');
  if (!container) return;
  container.innerHTML = EMOJIS.map(em =>
    `<button class="ct-emoji-btn${em === _selectedEmoji ? ' active' : ''}" data-emoji="${em}">${em}</button>`
  ).join('');
  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-emoji]');
    if (!btn) return;
    _selectedEmoji = btn.dataset.emoji;
    container.querySelectorAll('.ct-emoji-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
}

function _addTextOption() {
  const list = $('ct-text-list');
  if (!list) return;
  const idx = list.children.length;
  const row = document.createElement('div');
  row.className = 'ct-text-opt-row';
  row.innerHTML = `
    <input type="text" class="ct-input ct-opt-label" placeholder="Label (ex: Vermifuge)" />
    <button class="ct-remove-opt" title="Supprimer">✕</button>
  `;
  row.querySelector('.ct-remove-opt').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function _resetForm() {
  $('ct-name').value = '';
  _selectedColor = COLORS[0];
  _selectedEmoji = EMOJIS[0];
  _buildColorPicker();
  _buildEmojiPicker();
  $('ct-gauge-toggle').checked = false;
  $('ct-gauge-config').style.display = 'none';
  $('ct-gauge-title').value = '';
  $('ct-text-toggle').checked = false;
  $('ct-text-config').style.display = 'none';
  $('ct-text-list').innerHTML = '';
  $('ct-duration-toggle').checked = false;
  $('ct-category').value = 'activity';
}

// ── Save ─────────────────────────────────────────────────────────────────────

async function _handleSave() {
  const name = $('ct-name').value.trim();
  if (!name) {
    showToast('Entrez un nom pour le type');
    return;
  }

  // Generate a safe key from the name
  const key = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!key) {
    showToast('Nom invalide');
    return;
  }

  // Check for collisions with built-in types
  if (TYPE_DEF[key]) {
    showToast('Ce nom est deja utilise par un type existant');
    return;
  }

  const hasDuration = $('ct-duration-toggle').checked;
  const hasGauge = $('ct-gauge-toggle').checked;
  const hasText = $('ct-text-toggle').checked;
  const category = $('ct-category').value;

  const typeDef = {
    key,
    label: name,
    icon: _selectedEmoji,
    color: _selectedColor,
    category,
    hasDuration,
    createdAt: new Date().toISOString(),
  };

  if (hasGauge) {
    const gaugeTitle = $('ct-gauge-title').value.trim() || name;
    typeDef.gauge = {
      title: gaugeTitle,
      color: `linear-gradient(to right, ${_selectedColor}40, ${_selectedColor})`,
      ends: ['Min', 'Max'],
      steps: [[0, 'Faible'], [25, 'Leger'], [50, 'Moyen'], [75, 'Fort'], [100, 'Max']],
      def: 50,
    };
  }

  if (hasText) {
    const optRows = $('ct-text-list').querySelectorAll('.ct-text-opt-row');
    const textOptions = [];
    for (const row of optRows) {
      const label = row.querySelector('.ct-opt-label').value.trim();
      if (label) {
        const value = label.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '_');
        textOptions.push({ label, value });
      }
    }
    if (textOptions.length > 0) {
      typeDef.textTitle = 'Options';
      typeDef.textOptions = textOptions;
      typeDef.defaultTextVal = textOptions[0].value;
    }
  }

  const householdId = _getHouseholdId();
  if (!householdId) {
    showToast('Erreur : foyer non trouve');
    return;
  }

  const btn = $('ct-save-btn');
  btn.disabled = true;

  try {
    await _householdModule.saveCustomType(householdId, key, typeDef);
    showToast(`${_selectedEmoji} ${name} cree !`);
    showPage('new');
  } catch {
    showToast('Erreur lors de la creation');
  } finally {
    btn.disabled = false;
  }
}
