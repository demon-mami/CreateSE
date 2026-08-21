import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('index.html');
const app = read('app-v4.js');
const grid = read('hitsound-grid.js');
const favorites = read('hitsound-favorites.js');
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

test('candidate tap assigns without long-press pin or automatic preview', () => {
  assert.doesNotMatch(grid, /LONG_PRESS|togglePin|navigator\.vibrate/);
  assert.match(grid, /function chooseSound\(id, \{ preview = false \} = \{\}\)/);
});

test('Favorite excludes mute and verifies My Sound fingerprints', () => {
  assert.match(favorites, /don === SILENT_ID \|\| kat === SILENT_ID/);
  assert.match(favorites, /source\.fingerprint !== side\.fingerprint/);
  assert.match(favorites, /hitsound-favorite-applied/);
});

test('responsive split and touch target tokens are present', () => {
  assert.match(css, /--tap-size:44px/);
  assert.match(css, /grid-template-columns:minmax\(0,1\.62fr\) minmax\(390px,1fr\)/);
  assert.match(css, /@media\(max-width:899px\), \(orientation:portrait\)/);
  assert.doesNotMatch(css, /幅375px以上で利用してください/);
});
