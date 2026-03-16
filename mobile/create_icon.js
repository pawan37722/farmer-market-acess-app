// This script generates a minimal placeholder icon.png
// Run once: node create_icon.js
const fs = require('fs');
const path = require('path');

// Minimal 1x1 green PNG (base64)
const greenPng1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const outPath = path.join(__dirname, 'assets', 'icon.png');
fs.writeFileSync(outPath, greenPng1x1);
console.log('icon.png created at', outPath);
