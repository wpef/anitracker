/**
 * ui-gauge.js – Composant jauge configurable.
 *
 * La configuration (couleur, labels, fn) vit dans TYPE_DEF (utils.js).
 * Pour ajouter un nouveau type : ajouter l'entrée dans TYPE_DEF, c'est tout.
 *
 * Usage :
 *   const g = initGauge(inputEl, labelEl, 'pipi');
 *   const g = initGauge(inputEl, labelEl, TYPE_DEF.pipi.gauge); // config custom
 *   g.getValue() / g.setValue(42) / g.setType('caca') / g.setConfig(cfg)
 */

import { TYPE_DEF } from './utils.js';

// ── Initialisation ──────────────────────────────────────────────────────────

/**
 * Attache le comportement de jauge à un <input type="range"> existant.
 *
 * @param {HTMLInputElement}       input
 * @param {HTMLElement}            valueEl      - Élément affichant le label courant
 * @param {string|object}          typeOrConfig - Clé TYPE_DEF ('pipi'|'caca') ou objet gauge config
 * @returns {{ getValue, setValue, setType, setConfig, config }}
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
    getValue:  ()     => parseInt(input.value, 10),
    setValue:  (v)    => { input.value = String(v); _apply(); },
    setType:   (type) => { _cfg = _resolve(type); _apply(); },
    setConfig: (cfg)  => { _cfg = _resolve(cfg);  _apply(); },
    get config() { return _cfg; },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _resolve(typeOrConfig) {
  if (typeof typeOrConfig === 'string') {
    return TYPE_DEF[typeOrConfig]?.gauge ?? TYPE_DEF.pipi.gauge;
  }
  return typeOrConfig;
}
