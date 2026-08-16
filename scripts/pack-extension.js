const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'extension');
const distDir = path.join(rootDir, 'dist-extension');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const zipOutPath = path.join(distDir, 'Next-Videos-Chrome-Extension-v1.0.0.zip');
const crxOutPath = path.join(distDir, 'Next-Videos-Chrome-Extension-v1.0.0.crx');
const pemKeyPath = path.join(distDir, 'Next-Videos-Extension-Key.pem');

console.log('===================================================');
console.log('📦 Next-Videos Chrome Extension Packager (ZIP & CRX)');
console.log('===================================================');

// 1. Create Clean ZIP File
console.log('\n[*] Creating ZIP package...');
try {
  // Using PowerShell Compress-Archive for reliable standard Windows zip
  if (fs.existsSync(zipOutPath)) fs.unlinkSync(zipOutPath);
  
  // Files to include in zip: manifest.json, background.js, popup.html, popup.js, popup.css, icons/*, README.md
  const psCmd = `powershell -Command "Compress-Archive -Path '${extensionDir}\\*' -DestinationPath '${zipOutPath}' -Force"`;
  execSync(psCmd, { stdio: 'inherit' });
  console.log(`[OK] ZIP Package created: ${zipOutPath} (${(fs.statSync(zipOutPath).size / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('[ERROR] Failed to create ZIP archive:', err.message);
}

// 2. Package CRX via Google Chrome if installed
console.log('\n[*] Packaging CRX via Google Chrome...');
const chromeLocations = [
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
];

let chromePath = null;
for (const loc of chromeLocations) {
  if (fs.existsSync(loc)) {
    chromePath = loc;
    break;
  }
}

if (chromePath) {
  try {
    let packCmd = `"${chromePath}" --pack-extension="${extensionDir}" --no-message-box`;
    if (fs.existsSync(pemKeyPath)) {
      packCmd += ` --pack-extension-key="${pemKeyPath}"`;
    }
    execSync(packCmd);

    // Chrome outputs .crx and .pem in the parent directory of extension
    const generatedCrx = path.join(rootDir, 'extension.crx');
    const generatedPem = path.join(rootDir, 'extension.pem');

    if (fs.existsSync(generatedCrx)) {
      fs.copyFileSync(generatedCrx, crxOutPath);
      fs.unlinkSync(generatedCrx);
      console.log(`[OK] CRX Package generated: ${crxOutPath}`);
    }

    if (fs.existsSync(generatedPem)) {
      fs.copyFileSync(generatedPem, pemKeyPath);
      fs.unlinkSync(generatedPem);
      console.log(`[OK] Private Key generated: ${pemKeyPath}`);
    }
  } catch (err) {
    console.log('[!] Chrome auto-packing error:', err.message);
  }
} else {
  console.log('[!] Chrome executable not detected at standard locations for auto-pack.');
}

console.log('\n===================================================');
console.log('🎉 Packaging Complete!');
console.log(`- Dist Folder: ${distDir}`);
if (fs.existsSync(zipOutPath)) console.log(`- ZIP File:    ${path.basename(zipOutPath)}`);
if (fs.existsSync(crxOutPath)) console.log(`- CRX File:    ${path.basename(crxOutPath)}`);
console.log('===================================================');
