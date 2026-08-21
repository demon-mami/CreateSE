import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('index.html');
const app = read('app-v4.js');
const grid = read('hitsound-grid.js');
const controller = read('hitsound-controller.js');
const favorites = read('hitsound-favorites.js');
const workbench = read('workbench-ui.js');
const css = read('workbench.css');

test('required workbench controls have unique IDs', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    'roleDonButton','roleKatButton','currentDonTarget','currentKatTarget','playButton',
    'backButton','forwardButton','startMarkButton','endMarkButton','loopToggleButton',
    'favSetButton','deleteCandidateButton','favoriteOpenButton','customHitsoundInput',
  ]) assert.ok(ids.includes(id), `${id} is missing`);
});

test('transport and A-B bounds match approved requirements', () => {
  assert.match(app, /const SKIP_SEC = 4;/);
  assert.match(app, /const LOOP_MIN_MS = 500;/);
  assert.match(app, /const LOOP_MAX_MS = 30000;/);
  assert.match(app, /audiblePosition\(\) - SKIP_SEC/);
  assert.match(app, /audiblePosition\(\) \+ SKIP_SEC/);
});

test('candidate tap toggles selection and previews once only when selecting', () => {
  assert.doesNotMatch(grid, /LONG_PRESS|togglePin|navigator\.vibrate/);
  assert.match(grid, /function chooseSound\(id, \{ preview = true \} = \{\}\)/);
  assert.match(grid, /const deselecting = current === id;/);
  assert.match(grid, /const nextId = deselecting \? null : id;/);
  assert.match(grid, /preview: preview && !deselecting/);
});

test('audio levels are fixed and preview ducking is fully removed', () => {
  assert.match(app, /const MUSIC_GAIN = 0\.85;/);
  assert.match(app, /const EFFECT_GAIN = 1\.00;/);
  assert.doesNotMatch(controller, /DuckingBridge|setPreviewDucking/);
  assert.doesNotMatch(html, /audio-ducking-bridge\.js/);
  assert.equal(existsSync(new URL('../audio-ducking-bridge.js', import.meta.url)), false);
});

test('Favorite excludes mute and verifies My Sound fingerprints', () => {
  assert.match(favorites, /don === SILENT_ID \|\| kat === SILENT_ID/);
  assert.match(favorites, /source\.fingerprint !== side\.fingerprint/);
  assert.match(favorites, /hitsound-favorite-applied/);
});

test('responsive split and touch target tokens are present', () => {
  assert.match(css, /--tap-size:44px/);
  assert.match(css, /\.seek-bar\{width:100%;height:44px/);
  assert.match(html, /id="seekBar"[^>]*aria-label="曲の位置"/);
  assert.match(css, /\.loop-controls\{display:grid;grid-template-columns:44px/);
  assert.doesNotMatch(css, /\.seek-bar\{height:(?:28|30)px/);
  assert.match(css, /\.mini-play\{[^}]*white-space:nowrap/);
  assert.match(css, /grid-template-columns:minmax\(0,1\.62fr\) minmax\(390px,1fr\)/);
  assert.match(css, /@media\(max-width:899px\), \(orientation:portrait\)/);
  assert.doesNotMatch(css, /幅375px以上で利用してください/);
});

test('active Don or Kat has a slow persistent border loop with reduced-motion fallback', () => {
  assert.match(css, /--active-border-loop:5\.6s/);
  assert.match(css, /animation:active-border-orbit var\(--active-border-loop\) linear infinite/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.current-sound-card\.active::before/);
  assert.match(css, /\.mini-current\[aria-pressed="true"\]::before/);
});

test('iPhone Dock morphs between mini and expanded states without hiding controls abruptly', () => {
  assert.match(css, /height 480ms cubic-bezier/);
  assert.match(css, /\.audition-panel\.is-expanded \.dock-expanded\{opacity:1;visibility:visible/);
  assert.match(workbench, /const DOCK_TRANSITION_MS = 480;/);
  assert.match(workbench, /classList\.add\('is-transitioning'\)/);
});

test('iPad judgment actions remain reachable and timeline avoids repeated style reads', () => {
  assert.match(css, /\.dock-expanded\{[^}]*overflow-y:auto/);
  assert.match(css, /\.judgment-panel\{position:sticky/);
  assert.match(app, /const cssTokenCache = new Map\(\);/);
  assert.match(app, /const timelineResizeObserver = new ResizeObserver\(redraw\);/);
});

test('Don and Kat preserve independent candidate scroll positions', () => {
  assert.match(workbench, /scrollTop: Math\.max\(0, sourcePanel\.scrollTop\)/);
  assert.match(workbench, /sourcePanel\.scrollTop = Math\.max\(0, saved\.scrollTop\)/);
  assert.match(workbench, /clearTimeout\(savePositionTimer\);\s+saveCandidatePosition\(activeSide\);/);
  assert.match(workbench, /activeSide = nextSide;\s+syncActiveSide\(\);[\s\S]*?restoreCandidatePosition\(\);/);
});
