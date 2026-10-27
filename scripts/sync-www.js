#!/usr/bin/env node
/**
 * Ensures www/ has the store-app assets before `npx cap sync`,
 * and mirrors customer UI files into public/ (admin.html / admin.js stay).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const pub = path.join(root, 'public');

const required = [
  'index.html',
  'app.js',
  'config.js',
  'styles.css',
  'logo.png',
  'logo-v2.png',
  'manifest.webmanifest',
  'privacy.html'
];

for (const file of required) {
  const p = path.join(www, file);
  if (!fs.existsSync(p)) {
    console.error(`[sync-www] Missing required file: www/${file}`);
    process.exit(1);
  }
}

if (!fs.existsSync(pub)) {
  fs.mkdirSync(pub, { recursive: true });
}

/** Customer UI files mirrored www → public (keeps admin.html / admin.js). */
const mirror = [
  'index.html',
  'app.js',
  'config.js',
  'styles.css',
  'logo.png',
  'logo-v2.png',
  'logo-transparent.png',
  'logo.jpg',
  'manifest.webmanifest',
  'sw.js',
  'privacy.html'
];

for (const file of mirror) {
  const src = path.join(www, file);
  if (!fs.existsSync(src)) {
    console.warn(`[sync-www] skip missing www/${file}`);
    continue;
  }
  fs.copyFileSync(src, path.join(pub, file));
  console.log(`[sync-www] mirrored www/${file} → public/${file}`);
}

for (const keep of ['admin.html', 'admin.js']) {
  const p = path.join(pub, keep);
  if (!fs.existsSync(p)) {
    console.warn(`[sync-www] warning: public/${keep} missing (admin UI)`);
  }
}

console.log('[sync-www] www/ ready for Capacitor sync; public/ customer UI synced');
console.log('[sync-www] Reminder: set www/config.js API_BASE_URL to your hosted HTTPS API before store builds.');
