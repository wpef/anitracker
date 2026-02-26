/**
 * firebase-config.js
 * La configuration Firebase est stockée dans localStorage.
 * Elle peut être saisie directement depuis l'app (pas besoin d'éditer ce fichier).
 */

const CONFIG_KEY = 'anitracker_firebase_config';

export function getFirebaseConfig() {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const cfg = JSON.parse(stored);
      if (cfg.apiKey && cfg.databaseURL) return cfg;
    }
  } catch {}
  return null;
}

export function saveFirebaseConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearFirebaseConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

/**
 * Tente de parser la config collée par l'utilisateur.
 * Accepte le JSON strict OU le format JS objet donné par Firebase console.
 */
export function parseConfigInput(text) {
  if (!text || !text.trim()) return null;

  // 1. Essai JSON direct
  try {
    const cfg = JSON.parse(text.trim());
    if (cfg.apiKey && cfg.databaseURL) return cfg;
  } catch {}

  // 2. Format JS objet : extrait le bloc { ... }, convertit en JSON
  try {
    const block = text.match(/\{[\s\S]*\}/);
    if (block) {
      const json = block[0]
        .replace(/\/\/.*$/gm, '')        // retire les commentaires //
        .replace(/,(\s*[\}\]])/g, '$1')  // supprime les virgules traînantes
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')  // cite les clés non citées
        .replace(/:\s*'([^']*)'/g, ':"$1"');         // remplace ' par "
      const cfg = JSON.parse(json);
      if (cfg.apiKey && cfg.databaseURL) return cfg;
    }
  } catch {}

  return null;
}
