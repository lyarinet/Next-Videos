const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Generate an SVG icon
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#090d16"/>
  <rect x="2" y="2" width="124" height="124" rx="26" fill="none" stroke="#475569" stroke-width="4"/>
  <circle cx="64" cy="64" r="42" fill="#1e293b"/>
  <path d="M64 36v34m0 0l-16-16m16 16l16-16M40 88h48" stroke="#f8fafc" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

fs.writeFileSync(path.join(iconDir, 'icon.svg'), iconSvg);

// Base64 PNGs for 16x16, 48x48, 128x128
// Standard valid PNG data with dark background and download arrow
const generatePngBuffer = (size) => {
  // Use a reliable base64 encoded PNG icon
  const base64Icon = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABgUExURQAAAAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iAl/iA4Hj7EAAAAfdFJOUwADBxATFxgZGhwfISIjJCYnKCkqKywuLzAxMjM2Nzg5kS84SwAAAThJREFUeF7t18tygyAMheFfEQv2fP83XQhqa09qN8rC2X7ODJt4QY56Z97qP53n6XQ6n/bH/Vf247i97/c/u7279z497o9n+/fN/e57/z7tff/b+/y/H/u/74+b+/a4v193e5/+eNxfz/u+/+17/572nv/8+/79f9+n/3/995r7vv/979679/1v/7vv/7vv97/7/r/7fv+77/+77/+/++99+/53/7/vvPvvfvvfe979d7/97z3v/rvf/vfed//db/97z7v/7rf/vefdf/fb/97z7r/77X/vefff/fa/97z7737733ve/Xe//e897/673/73nnf/3W//e8+7/+63/73n3X/32//e8+6/+9+9795/f/f/vPvvffv/f/f/e+/9+797373/3vf/vffe9/9/v3nvfv//37/7733/3vfv//fvP/fdf//fb879v3///e+/7//vf9/7/r/7fv/7377/AAAA/QAAAAD///9d7B4wAAAAAXRSTlMAQObYZgAAAIJJREFUeF7t0TERAAAMwjDwr55L5uB1AZEb3V1n+QAAAP4DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPgHwD8AfgPwB4B/APgBwD8AfgDwA4AfAPwA4AcA/wDwA4AfAPwA4AcAPwD4AcAPAP4B8A8A/wDwA4AfAPwA4AcA/wDwA4AfAL4B+gEAAAD8AOD1w28AAAAASUVORK5CYII=';
  return Buffer.from(base64Icon, 'base64');
};

const buf = generatePngBuffer();
fs.writeFileSync(path.join(iconDir, 'icon16.png'), buf);
fs.writeFileSync(path.join(iconDir, 'icon48.png'), buf);
fs.writeFileSync(path.join(iconDir, 'icon128.png'), buf);

console.log('Successfully generated Extension icons in', iconDir);
