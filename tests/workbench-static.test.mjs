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
const gridCss = read('hitsound-grid.css');
const candidates = read('candidates.js');
const timeline = read('object-timeline-v2.js');
const pages = read('.github/workflows/pages.yml');

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

test('audio levels are fixed at Music 0.70 and Effect 1.00 with preview ducking removed', () => {
  assert.match(app, /const MUSIC_GAIN = 0\.70;/);
  assert.match(app, /const EFFECT_GAIN = 1\.00;/);
  assert.doesNotMatch(controller, /DuckingBridge|setPreviewDucking/);
  assert.doesNotMatch(html, /audio-ducking-bridge\.js/);
  assert.doesNotMatch(pages, /audio-ducking-bridge\.js/);
  assert.match(pages, /cp workbench\.css _site\//);
  assert.match(pages, /cp workbench-ui\.js _site\//);
  assert.match(pages, /cp qa-iphone\.html _site\//);
  assert.match(pages, /cp hitsounds-current111-abc-v5\.zip _site\//);
  assert.doesNotMatch(pages, /hitsounds-single-base-116\.zip/);
  assert.equal(existsSync(new URL('../audio-ducking-bridge.js', import.meta.url)), false);
});

test('candidate switching shares decoded audio and keeps only the latest rapid tap', () => {
  assert.match(app, /const MAX_DECODED_HITSOUND_CACHE = 32;/);
  assert.match(app, /const decodedHitsoundPromises = new Map\(\);/);
  assert.match(app, /async function decodeHitsoundBytes\(value, cacheKey\)/);
  assert.match(app, /if \(decodedHitsoundPromises\.has\(key\)\) return decodedHitsoundPromises\.get\(key\);/);
  assert.match(app, /previewHitsoundBytes,/);
  assert.match(app, /applyHitsoundBytes,/);
  assert.match(app, /applyHitsoundPairBytes,/);
  assert.match(controller, /const bytesPromises = new Map\(\);/);
  assert.match(controller, /if \(bytesPromises\.has\(id\)\) return bytesPromises\.get\(id\);/);
  assert.match(controller, /let previewTask = Promise\.resolve\(false\);/);
  assert.match(controller, /if \(serial === selectionSerial\) await applyPendingSelection\(serial\);\s+await previewTask;/);
  assert.match(controller, /function warmCurrentSelection\(\)/);
  assert.match(workbench, /window\.addEventListener\('hitsound-preview-state'/);
  assert.match(html, /app-v4\.js\?v=3\.7-music-070/);
  assert.match(html, /hitsound-controller\.js\?v=4\.1-latest-switch-wins/);
});

test('Favorite excludes mute and verifies My Sound fingerprints', () => {
  assert.match(favorites, /don === SILENT_ID \|\| kat === SILENT_ID/);
  assert.match(favorites, /source\.fingerprint !== side\.fingerprint/);
  assert.match(favorites, /hitsound-favorite-applied/);
});

test('Phase7A Pair-12 is merged into existing Favorites exactly once', () => {
  const expected = [
    ['P01', 'SRC070', 'SRC084'],
    ['P02', 'SRC015', 'SRC019'],
    ['P03', 'SRC098', 'SRC101'],
    ['P04', 'SRC098', 'SRC064'],
    ['P05', 'SRC056', 'SRC084'],
    ['P06', 'SRC070', 'SRC019'],
    ['P07', 'SRC089', 'SRC064'],
    ['P08', 'SRC089', 'SRC088'],
    ['P09', 'SRC101', 'SRC090'],
    ['P10', 'SRC056', 'SRC077'],
    ['P11', 'SRC084', 'SRC090'],
    ['P12', 'SRC079', 'SRC100'],
  ];
  for (const pair of expected) {
    assert.ok(favorites.includes(`['${pair[0]}', '${pair[1]}', '${pair[2]}']`), `${pair[0]} is missing`);
  }
  assert.match(favorites, /FAVORITE_SEED_KEY = `\$\{STORAGE_KEY\}:seed:phase7a-pair12-v5`/);
  assert.match(favorites, /if \(localStorage\.getItem\(FAVORITE_SEED_KEY\) === '1'\) return 0/);
  assert.match(favorites, /const known = new Set\(sets\.map\(entryKey\)\)/);
  assert.match(favorites, /mergeSeedFavoritePairs\(\);\s+renderSavedSets\(\);/);
  assert.match(html, /hitsound-favorites\.js\?v=4\.1-phase7a-pair12-v5/);
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

test('compact visible copy keeps accessible labels and CSS-only dock icons', () => {
  assert.doesNotMatch(html, />試聴・判断</);
  assert.doesNotMatch(html, /<span>収納<\/span>|<span>展開<\/span>/);
  assert.match(html, /id="dockToggleButton"[^>]*aria-label="試聴パネルを展開"/);
  assert.match(html, /id="dockCollapseButton"[^>]*aria-label="試聴パネルを収納"/);
  assert.match(html, /id="statusBadge" class="status-badge sr-only"/);
  assert.match(html, /id="recommendationLine" class="hs-recommendation sr-only"/);
  assert.match(html, /id="deleteCandidateLine" class="hs-delete-candidate-line sr-only"/);
  assert.doesNotMatch(html, /currentDonMeta|currentKatMeta/);
  assert.doesNotMatch(workbench, /current\$\{cap\}Meta/);
  assert.doesNotMatch(workbench, /\$\{activeSide === 'don' \? 'Don' : 'Kat'\} 操作中/);
  assert.doesNotMatch(workbench, /A–B \$\{detail\.enabled \? '反復中' : '設定済み'\}/);
  assert.match(css, /\.dock-toggle \.dock-icon\{[^}]*border:2px solid currentColor/);
  assert.match(css, /\.dock-collapse \.dock-icon\{[^}]*height:2px/);
});

test('transport spacing is relaxed and Dock transitions shield the candidate layer', () => {
  assert.match(css, /\.transport-row\{display:grid;grid-template-columns:minmax\(0,1fr\) 92px minmax\(0,1fr\);gap:10px/);
  assert.match(css, /\.transport-row\{grid-template-columns:minmax\(0,1fr\) 96px minmax\(0,1fr\);gap:10px/);
  assert.doesNotMatch(css, /\.audition-panel\.is-transitioning\{pointer-events:none\}/);
  assert.match(css, /\.audition-panel\.is-transitioning \.dock-mini,\.audition-panel\.is-transitioning \.dock-expanded\{pointer-events:none!important\}/);
  assert.match(css, /\.seek-bar\{width:100%;height:44px;margin:2px 0 10px/);
});

test('active Don or Kat has a static neon gradient without a continuous animation', () => {
  assert.match(css, /background:conic-gradient\(from 215deg/);
  assert.doesNotMatch(css, /active-border-orbit|--active-glow-angle|--active-border-loop/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.current-sound-card\.active::before/);
  assert.match(css, /\.mini-current\[aria-pressed="true"\]::before/);
});

test('iPhone Dock morphs between mini and expanded states without hiding controls abruptly', () => {
  assert.match(css, /height 480ms cubic-bezier/);
  assert.match(css, /\.audition-panel\.is-expanded \.dock-expanded\{opacity:1;visibility:visible/);
  assert.match(workbench, /const DOCK_TRANSITION_MS = 480;/);
  assert.match(workbench, /classList\.add\('is-transitioning'\)/);
  assert.match(workbench, /addEventListener\('transitionend', dockTransitionHandler\)/);
});

test('judgment actions live with candidate selection and timeline avoids repeated style reads', () => {
  const toolbarIndex = html.indexOf('<div class="hs-toolbar">');
  const judgmentIndex = html.indexOf('<section class="judgment-panel"');
  const gridIndex = html.indexOf('<div id="hitsoundGrid"');
  const auditionIndex = html.indexOf('<aside id="auditionPanel"');
  assert.ok(toolbarIndex >= 0 && toolbarIndex < judgmentIndex);
  assert.ok(judgmentIndex < gridIndex && gridIndex < auditionIndex);
  assert.match(css, /\.dock-expanded\{[^}]*overflow-y:auto/);
  assert.match(css, /\.judgment-panel\{position:static/);
  assert.match(app, /const cssTokenCache = new Map\(\);/);
  assert.match(app, /const timelineResizeObserver = new ResizeObserver\(redraw\);/);
});

test('candidate and playback panes use distinct static cyber gradients', () => {
  assert.match(css, /--source-pane-base:#071721/);
  assert.match(css, /--playback-pane-base:#1a1023/);
  assert.match(css, /\.source-panel\{[\s\S]*?radial-gradient\(circle at 10% -8%,rgba\(75,232,255,\.18\)/);
  assert.match(css, /\.audition-panel\{[\s\S]*?radial-gradient\(circle at 90% -10%,rgba\(255,112,200,\.17\)/);
  assert.doesNotMatch(css, /--source-pane-base:#0ac6d7|--playback-pane-base:#ed7855/);
});

test('Current111 replaces the old pack and keeps ABC visible without source filenames', () => {
  assert.match(candidates, /Current111 ABC Sorted v5/);
  assert.match(candidates, /abcGrade/);
  assert.match(candidates, /dataset: 'current111-abc-v5'/);
  assert.doesNotMatch(candidates, /Annihilator 1\.wav|RnT_Timbale-02\.wav/);
  assert.match(controller, /hitsounds-current111-abc-v5\.zip/);
  assert.doesNotMatch(controller, /hitsounds-single-base-116\.zip/);
  assert.match(controller, /selection:current111-abc-v5/);
  assert.match(favorites, /favorites-current111-abc-v5/);
  assert.match(grid, /deletion-candidates:current111-abc-v5/);
  assert.match(grid, /data-abc="\$\{abcGrade\}"/);
  assert.match(gridCss, /\.hs-key\[data-abc="A"\]/);
  assert.doesNotMatch(gridCss, /content:attr\(data-abc\)/);
  assert.equal(existsSync(new URL('../hitsounds-current111-abc-v5.zip', import.meta.url)), true);
  assert.equal(existsSync(new URL('../hitsounds-single-base-116.zip', import.meta.url)), false);
});

test('candidate keys use restrained numbers and static heat colors instead of ABC or D-K text', () => {
  assert.doesNotMatch(grid, /<span data-abc=/);
  assert.match(gridCss, /\.hs-key\[data-abc="A"\]\{[\s\S]*?linear-gradient\(90deg,#ef687d/);
  assert.match(gridCss, /\.hs-key\[data-abc="B"\]\{[\s\S]*?linear-gradient\(90deg,#b88122/);
  assert.match(gridCss, /\.hs-key\[data-abc="C"\]\{[\s\S]*?linear-gradient\(90deg,#9d2f3d/);
  assert.match(gridCss, /\.hs-key\[data-abc\]>span::before\{[\s\S]*?content:"";[\s\S]*?height:2px/);
  assert.match(css, /#hitsoundSources \.hs-key>span\{[\s\S]*?font-size:11px!important;[\s\S]*?font-weight:520!important/);
  assert.doesNotMatch(css, /selected-don::after\{content:"D"\}|selected-kat::after\{content:"K"\}|content:"D\/K"/);
  assert.match(css, /selected-don\.selected-kat::after\{[\s\S]*?radial-gradient\(circle at 3\.5px[\s\S]*?radial-gradient\(circle at calc\(100% - 3\.5px\)/);
  assert.doesNotMatch(gridCss, /abc-line[^\n]*animation|@keyframes[^\{]*abc/i);
  assert.match(html, /hitsound-grid\.css\?v=4\.1-static-heat-strip/);
  assert.match(html, /workbench\.css\?v=1\.7-minimal-source-keys/);
});

test('candidate rows use twelve slots with one category boundary slot', () => {
  assert.match(grid, /Math\.max\(4, Math\.min\(12,/);
  assert.match(grid, /\(width \+ 7\) \/ 51/);
  assert.match(grid, /first\.count \+ candidate\.count \+ 1 > capacity/);
  assert.match(grid, /class="hs-family-spacer"/);
  assert.match(gridCss, /grid-template-columns:repeat\(var\(--source-row-slots,12\),minmax\(0,1fr\)\)/);
  assert.match(gridCss, /\.hs-family-spacer\{[\s\S]*?grid-column:span 1/);
  assert.match(grid, /new ResizeObserver\(\(\) => buildGrid\(\)\)/);
});

test('timeline notes are reduced in both visible and fallback renderers', () => {
  assert.match(app, /const OBJECT_NOTE_RADIUS = \[14, 14, 13\.5\];/);
  assert.match(timeline, /const normalRadius = 14;/);
  assert.match(timeline, /const bigRadius = 17;/);
  assert.match(timeline, /const targetRadius = 19\.5;/);
});

test('timeline playback stays audio-synchronous while iPad canvas and DOM paint work are bounded', () => {
  assert.match(app, /const TRANSPORT_UI_INTERVAL_MS = 33;/);
  assert.match(app, /now - lastTransportUiPaint >= TRANSPORT_UI_INTERVAL_MS/);
  assert.match(app, /if \(el\.seek\.value !== position\) el\.seek\.value = position;/);
  assert.match(app, /drawSongCursor\(p\);\s+lastTransportUiPaint = now;/);
  assert.doesNotMatch(app, /if \(canSyncSeek\) el\.seek\.value = String\(p\);/);
  assert.match(app, /copyTimeButtonWidth = Math\.max\(58, el\.copyTime\.offsetWidth \|\| 70\)/);
  assert.match(app, /positionSec: audiblePosition/);
  assert.match(app, /if \(externalTimelineRenderer\) return;/);
  assert.match(timeline, /const MIN_RENDER_INTERVAL_MS = 15;/);
  assert.match(timeline, /now - lastAnimationPaint >= MIN_RENDER_INTERVAL_MS/);
  assert.match(timeline, /document\.visibilityState !== 'hidden'/);
  assert.match(timeline, /new IntersectionObserver\(entries =>/);
  assert.match(timeline, /const measureLines = \[\];/);
  assert.match(timeline, /strokeLines\(beatLines/);
  assert.doesNotMatch(timeline, /ctx\.save\(\)/);
  assert.match(timeline, /CreateSEViewer\?\.positionSec\?\.\(\)/);
  assert.match(timeline, /Math\.min\(MAX_CANVAS_DPR, window\.devicePixelRatio/);
  assert.match(timeline, /new ResizeObserver\(measureViewport\)/);
  assert.match(timeline, /lowerHit\(map\.hits, visibleLeftTime\)/);
  assert.doesNotMatch(timeline, /const nowMs = Number\(seek\.value\) \* 1000/);
  assert.match(html, /object-timeline-v2\.js\?v=3\.1-ipad-frame-budget/);
});

test('Don and Kat preserve independent candidate scroll positions', () => {
  assert.match(workbench, /scrollTop: Math\.max\(0, sourcePanel\.scrollTop\)/);
  assert.match(workbench, /sourcePanel\.scrollTop = Math\.max\(0, saved\.scrollTop\)/);
  assert.match(workbench, /clearTimeout\(savePositionTimer\);\s+saveCandidatePosition\(activeSide\);/);
  assert.match(workbench, /activeSide = nextSide;\s+syncActiveSide\(\);[\s\S]*?restoreCandidatePosition\(\);/);
});
