/**
 * build.js – Copies web assets into www/ for Capacitor.
 * No framework, no bundler — just a file copy.
 */

const fs   = require('fs');
const path = require('path');

const DEST    = 'www';
const INCLUDE = ['index.html', 'quick.html', 'showcase.html', 'css', 'js', 'icons', 'manifest.json', 'sw.js'];

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true });
fs.mkdirSync(DEST);

function copy(from, to) {
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) copy(path.join(from, f), path.join(to, f));
  } else {
    fs.copyFileSync(from, to);
  }
}

for (const item of INCLUDE) copy(item, path.join(DEST, item));

console.log(`✓ www/ built (${INCLUDE.length} items)`);
