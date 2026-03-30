/**
 * Script Node.js pour générer les icônes PNG à partir des SVG.
 * Usage : node generate-icons.js
 * Nécessite : npm install sharp
 */
const fs   = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');

const variants = [
  { svg: 'icon.svg',          sizes: [48, 72, 96, 128, 144, 152, 192, 256, 384, 512], prefix: 'icon' },
  { svg: 'icon-maskable.svg', sizes: [512],                                            prefix: 'icon', suffix: '-maskable' },
];

try {
  const sharp = require('sharp');

  for (const { svg, sizes, prefix, suffix } of variants) {
    const svgData = fs.readFileSync(path.join(iconsDir, svg));

    for (const size of sizes) {
      const name = `${prefix}-${size}${suffix || ''}.png`;
      sharp(svgData)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsDir, name))
        .then(() => console.log(`✓ ${name}`));
    }
  }
} catch {
  // Fallback : copie le SVG en PNG (navigateurs modernes acceptent le SVG dans manifest)
  console.log('sharp non disponible – copie SVG comme fallback');
  const svgData = fs.readFileSync(path.join(iconsDir, 'icon.svg'));
  for (const size of [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]) {
    fs.copyFileSync(path.join(iconsDir, 'icon.svg'), path.join(iconsDir, `icon-${size}.png`));
  }
  fs.copyFileSync(path.join(iconsDir, 'icon-maskable.svg'), path.join(iconsDir, 'icon-512-maskable.png'));
}
