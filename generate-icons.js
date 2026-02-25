/**
 * Script Node.js pour générer les icônes PNG à partir du SVG.
 * Usage : node generate-icons.js
 * Nécessite : npm install sharp
 */
const fs   = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'icons', 'icon.svg');
const svgData = fs.readFileSync(svgPath);

try {
  const sharp = require('sharp');
  for (const size of [192, 512]) {
    sharp(svgData)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, 'icons', `icon-${size}.png`))
      .then(() => console.log(`icon-${size}.png généré`));
  }
} catch {
  // Fallback : copie le SVG en tant que PNG (navigateurs modernes acceptent SVG dans manifest)
  console.log('sharp non disponible – icônes SVG utilisées comme fallback');
  fs.copyFileSync(svgPath, path.join(__dirname, 'icons', 'icon-192.png'));
  fs.copyFileSync(svgPath, path.join(__dirname, 'icons', 'icon-512.png'));
}
