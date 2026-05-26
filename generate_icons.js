const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, 'package', 'icons');
const svgPath = path.join(__dirname, 'src', 'icon.svg');

if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

const svg = fs.readFileSync(svgPath);

const sizes = [16, 48, 128];
Promise.all(sizes.map(size => 
  sharp(svg)
    .resize(size, size)
    .toFile(path.join(iconDir, `icon${size}.png`))
)).then(() => console.log('Icons generated successfully in package/icons/'))
  .catch(err => console.error('Error generating icons:', err));
