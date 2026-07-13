#!/usr/bin/env node
/**
 * Forge Atlas · scripts/validate.js
 * Checks: script/CSS references exist, nav consistency, no bare console.log in prod JS.
 * Usage: node scripts/validate.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PAGES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
const PUBLIC_JS  = path.join(ROOT, 'public', 'js');
const PUBLIC_CSS = path.join(ROOT, 'public', 'css');

let errors = 0;
let warnings = 0;

function fail(msg)  { console.error('  FAIL  ' + msg); errors++; }
function warn(msg)  { console.warn ('  WARN  ' + msg); warnings++; }
function ok(msg)    { console.log  ('  OK    ' + msg); }

/* ── 1. Script/CSS references exist ─────────────────────── */
console.log('\n[1] Checking script/CSS references in HTML pages...');
const SRC_RE  = /<script[^>]+src="([^"]+)"/g;
const HREF_RE = /<link[^>]+href="([^"]+\.css[^"]*)"/g;

HTML_PAGES.forEach(page => {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');

  let m;
  const re1 = new RegExp(SRC_RE.source, 'g');
  while ((m = re1.exec(src)) !== null) {
    const ref = m[1];
    if (ref.startsWith('http') || ref.startsWith('//')) continue;
    const abs = path.resolve(ROOT, ref);
    if (!fs.existsSync(abs)) fail(page + ' → missing script: ' + ref);
  }

  const re2 = new RegExp(HREF_RE.source, 'g');
  while ((m = re2.exec(src)) !== null) {
    const ref = m[1].split('?')[0];
    if (ref.startsWith('http') || ref.startsWith('//')) continue;
    const abs = path.resolve(ROOT, ref);
    if (!fs.existsSync(abs)) fail(page + ' → missing stylesheet: ' + ref);
  }
});
if (!errors) ok('All script/CSS references resolve.');

/* ── 2. Nav consistency ──────────────────────────────────── */
console.log('\n[2] Checking nav consistency...');
const NAV_LINKS = ['arena.html', 'swarm.html', 'forum.html', 'market.html', 'atlas-id.html', 'access.html'];
HTML_PAGES.forEach(page => {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  if (!src.includes('class="nav-links"')) {
    fail(page + ' → missing .nav-links nav');
    return;
  }
  NAV_LINKS.forEach(link => {
    if (!src.includes('href="' + link + '"') && !src.includes("href='" + link + "'")) {
      warn(page + ' → nav missing link to ' + link);
    }
  });
});

/* ── 3. Footer ───────────────────────────────────────────── */
console.log('\n[3] Checking footers...');
HTML_PAGES.forEach(page => {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  if (!src.includes('<footer')) fail(page + ' → missing <footer>');
  if (!src.includes('For Emery')) warn(page + ' → missing Emery dedication in footer');
});

/* ── 4. Atlas AI orb ─────────────────────────────────────── */
console.log('\n[4] Checking Atlas AI orb...');
HTML_PAGES.forEach(page => {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  if (!src.includes('atlas-ai')) warn(page + ' → missing Atlas AI orb (.atlas-ai)');
});

/* ── 5. forge-api.js wired in ────────────────────────────── */
console.log('\n[5] Checking forge-api.js is loaded...');
HTML_PAGES.forEach(page => {
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  if (!src.includes('forge-api.js')) warn(page + ' → forge-api.js not loaded');
});

/* ── 6. No bare console.log in public JS ─────────────────── */
console.log('\n[6] Checking for console.log in public JS...');
function checkDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    if (!f.endsWith('.js')) return;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const matches = src.match(/\bconsole\.log\b/g);
    if (matches) warn(f + ' → ' + matches.length + ' console.log call(s)');
  });
}
checkDir(PUBLIC_JS);
checkDir(path.join(ROOT, 'workers'));

/* ── 7. Honesty notices on simulation pages ──────────────── */
console.log('\n[7] Checking honesty notices on simulation pages...');
const SIM_PAGES = ['arena.html', 'swarm.html', 'forum.html'];
SIM_PAGES.forEach(page => {
  const full = path.join(ROOT, page);
  if (!fs.existsSync(full)) return;
  const src = fs.readFileSync(full, 'utf8');
  if (!src.includes('honesty') && !src.includes('static demo') && !src.includes('simulation') && !src.includes('demo')) {
    warn(page + ' → no honesty/simulation notice found');
  }
});

/* ── SUMMARY ─────────────────────────────────────────────── */
console.log('\n' + '─'.repeat(50));
console.log('Pages checked: ' + HTML_PAGES.length);
if (errors)   console.error('Errors:   ' + errors);
if (warnings) console.warn ('Warnings: ' + warnings);
if (!errors && !warnings) console.log('All checks passed.');
console.log('─'.repeat(50) + '\n');

process.exit(errors > 0 ? 1 : 0);
