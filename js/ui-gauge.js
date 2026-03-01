/**
 * ui-gauge.js – Composant jauge configurable via props.
 *
 * Toute la logique de rendu/comportement est centralisée ici.
 * Utilisé par ui-new-entry.js, ui-edit.js et quick.js.
 *
 * Pour ajouter un nouveau type de jauge : une entrée dans GAUGE_CONFIG suffit.
 * Pour une jauge totalement custom : passer un objet GaugeConfig directement.
 *
 * @typedef {object} GaugeConfig
 * @property {string}               title     - Libellé de la section (ex: 'Quantité')
 * @property {string}               color     - Gradient CSS du track (background)
 * @property {[string, string]}     ends      - Labels extrémités [gauche, droite]
 * @property {(v: number) => string} getLabel  - Fn qui retourne le label pour une valeur 0–100
 * @property {number}               [def=50]  - Valeur par défaut
 */

import { pipiLabel, cacaLabel } from './utils.js';

// ── Configurations prédéfinies ──────────────────────────────────────────────

export const GAUGE_CONFIG = {
  pipi: {
    title:    'Quantité',
    color:    'linear-gradient(to right, rgba(76,201,240,.25), #4cc9f0)',
    ends:     ['Gouttes', 'Énorme'],
    getLabel: pipiLabel,
    def:      50,
  },
  caca: {
    title:    'Fermeté',
    color:    'linear-gradient(to right, #e94560, #ffcc80, #4caf50)',
    ends:     ['Liquide', 'Solide'],
    getLabel: cacaLabel,
    def:      25,
  },
};

// ── Initialisation ──────────────────────────────────────────────────────────

/**
 * Attache le comportement de jauge à un <input type="range"> existant.
 * Gère le label courant + la couleur du track en temps réel.
 *
 * @param {HTMLInputElement}       input
 * @param {HTMLElement}            valueEl      - Élément affichant le label courant
 * @param {string|GaugeConfig}     typeOrConfig - Clé prédéfinie ('pipi'|'caca') ou objet custom
 * @returns {{ getValue, setValue, setType, setConfig }}
 */
export function initGauge(input, valueEl, typeOrConfig) {
  let _cfg = _resolve(typeOrConfig);

  function _apply() {
    input.style.background = _cfg.color;
    valueEl.textContent    = _cfg.getLabel(parseInt(input.value, 10));
  }

  input.addEventListener('input', () => {
    valueEl.textContent = _cfg.getLabel(parseInt(input.value, 10));
  });

  _apply();

  return {
    /** Valeur courante (0–100). */
    getValue: () => parseInt(input.value, 10),

    /** Met à jour la valeur et rafraîchit le label. */
    setValue: (v) => { input.value = String(v); _apply(); },

    /** Bascule vers un type prédéfini ('pipi' | 'caca'). */
    setType: (type) => { _cfg = _resolve(type); _apply(); },

    /** Reconfigure entièrement la jauge avec un objet GaugeConfig ou une clé. */
    setConfig: (cfg) => { _cfg = _resolve(cfg); _apply(); },

    /** Config courante (lecture seule). */
    get config() { return _cfg; },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _resolve(typeOrConfig) {
  if (typeof typeOrConfig === 'string') {
    return GAUGE_CONFIG[typeOrConfig] ?? GAUGE_CONFIG.pipi;
  }
  return typeOrConfig;
}
