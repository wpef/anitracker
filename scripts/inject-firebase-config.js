/**
 * inject-firebase-config.js — Build-time bake of the Firebase config.
 *
 * Reads the FIREBASE_CONFIG env var (a GitHub Actions secret) and writes it
 * into js/firebase-config.default.js so store/test builds skip the "paste
 * config" setup screen. NEVER commit the resulting file with real values.
 *
 * Accepts either strict JSON or the JS-object snippet copied straight from the
 * Firebase console — unquoted keys, single quotes, trailing commas, an optional
 * `const firebaseConfig = {…}` wrapper and // comments. The tolerant parsing
 * mirrors parseConfigInput() in js/firebase-config.js (the proven version that
 * preserves https:// in URLs — see commit f766d0f); keep the two in sync.
 *
 * Exit codes: 0 = injected or nothing to do (empty secret); 1 = unparseable.
 */
const fs = require('fs');

const DEST = 'js/firebase-config.default.js';
const raw = process.env.FIREBASE_CONFIG;

if (!raw || !raw.trim()) {
  console.log('No FIREBASE_CONFIG provided — leaving the paste-config setup screen enabled.');
  process.exit(0);
}

function parseConfig(text) {
  // 1. Strict JSON
  try {
    const cfg = JSON.parse(text.trim());
    if (cfg && cfg.apiKey && cfg.databaseURL) return cfg;
  } catch {}

  // 2. JS-object snippet → JSON (Firebase console format)
  try {
    const block = text.match(/\{[\s\S]*\}/);
    if (block) {
      const json = block[0]
        .replace(/^\s*\/\/[^\n]*/gm, '')            // strip // comments
        .replace(/, (\s*[\}\]])/g, '$1')            // drop trailing comma before } ]
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')  // quote bare keys
        .replace(/:\s*'([^']*)'/g, ':"$1"');        // single → double quotes
      const cfg = JSON.parse(json);
      if (cfg && cfg.apiKey && cfg.databaseURL) return cfg;
    }
  } catch {}

  return null;
}

const cfg = parseConfig(raw);
if (!cfg) {
  console.error('FIREBASE_CONFIG could not be parsed, or is missing apiKey / databaseURL.');
  console.error('Provide the Firebase console config object (JSON or JS snippet) with at least apiKey and databaseURL.');
  process.exit(1);
}

fs.writeFileSync(DEST, 'export const DEFAULT_FIREBASE_CONFIG = ' + JSON.stringify(cfg, null, 2) + ';\n');
console.log('Firebase config baked into build (keys: ' + Object.keys(cfg).join(', ') + '). Setup screen skipped.');
