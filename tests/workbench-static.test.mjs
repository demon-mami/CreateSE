import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('index.html');
const app = read('app-v4.js');
const timeline = read('object-timeline-v2.js');
const controller = read('hitsound-controller.js');
const favorites = read('hitsound-favorites.js');
const favoriteSlot = read('favorite-slot-ui.js');
const candidates = read('candidates.js');
const grid = read('hitsound-grid.js');
const workbench = read('workbench-ui.js');
const pages = read('.github/workflows/pages.yml');
const orientation = read('orientation-guard.js');

test('current playback UI is range-free, skip-free and time-display-free', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    'roleDonButton','roleKatButton','playButton','seekBar','timelineViewport','overviewViewport',
    'favoriteOneButton','favoriteOneListButton','favoriteTwoButton','favoriteTwoListButton','favoriteOpenButton',
    'customHitsoundInput','orientationGuard',
  ]) assert.ok(ids.includes(id), `${id} is missing`);
  for (const id of [
    'backButton','forwardButton','seekTimeFeedback','timeDisplay','durationDisplay','copyTimeButton',
    'timelineStaticCanvas','timelineCursorCanvas','donHitsoundInput','kaHitsoundInput',
    'startMarkButton','endMarkButton','jumpStartButton','jumpEndButton','loopToggleButton','clearLoopButton',
    'startMarkButton2','endMarkButton2','jumpStartButton2','jumpEndButton2','loopToggleButton2','clearLoopButton2',
    'rangeLength','rangeLength2','loopStatus','loopStatus2','miniLoopState','favoriteCount',
    'favoriteSheet','savedSetsPanel','favoriteSheetTitle','favoriteCloseButton','exportFavoritesButton','savedSetsList',
  ]) assert.equal(ids.includes(id), false, `${id} must be absent`);
  assert.doesNotMatch(html, /4秒戻る|4秒進む|00:00:000|aria-valuetext=/);
});

test('favorite and fixed-set controls share one compact dropdown model', () => {
  assert.match(html, /id="favoriteOneButton"[^>]*>♡<\/button>/);
  assert.match(html, /id="favoriteOneListButton"[^>]*aria-haspopup="menu"[^>]*>お気に入り①<\/button>/);
  assert.match(html, /id="favoriteTwoButton"[^>]*>☆<\/button>/);
  assert.match(html, /id="favoriteTwoListButton"[^>]*aria-haspopup="menu"[^>]*>お気に入り②<\/button>/);
  assert.match(html, /id="favoriteOpenButton"[^>]*aria-haspopup="menu"[^>]*aria-controls="favoriteQuickDropdown"[^>]*>[\s\S]*?::<\/span><span>セット<\/span>/);
  assert.match(html, /favorite-slot-ui\.js\?v=4\.0-unified-dropdown/);
  assert.doesNotMatch(html, /favorite-pager-v4\.js|aria-haspopup="dialog"/);

  assert.match(favoriteSlot, /const MAX_ITEMS = 12;/);
  assert.match(favoriteSlot, /const CIRCLED = \['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫'\];/);
  assert.match(favoriteSlot, /function toggleCurrent\(slotName\)/);
  assert.match(favoriteSlot, /items\.findIndex\(entry => entryKey\(entry\) === entryKey\(current\)\)/);
  assert.match(favoriteSlot, /if \(index >= 0\) \{\s*items\.splice\(index, 1\)/);
  assert.match(favoriteSlot, /items\.unshift\(current\)/);
  assert.match(favoriteSlot, /out\.sort\(\(a, b\) => createdTime\(b\) - createdTime\(a\)\)/);
  assert.match(favoriteSlot, /function dropdownItems\(source\)/);
  assert.match(favoriteSlot, /if \(source === 'preset'\) return getPresets\(\);/);
  assert.match(favoriteSlot, /openDropdown\('preset'\)/);
  assert.match(favoriteSlot, /favorite-quick-dropdown/);
});

test('dropdown cards expose only rank and Don Kat source numbers with current selection highlight', () => {
  assert.match(favoriteSlot, /rank\.className = 'favorite-card-rank';/);
  assert.match(favoriteSlot, /don\.className = 'favorite-card-source don';/);
  assert.match(favoriteSlot, /kat\.className = 'favorite-card-source kat';/);
  assert.match(favoriteSlot, /return \/\^\\d\+\$\/.test\(text\) \? text\.padStart\(3, '0'\) : text;/);
  assert.match(favoriteSlot, /const selected = !!currentKey && entryKey\(entry\) === currentKey;/);
  assert.match(favoriteSlot, /row\.classList\.toggle\('is-current-selection', selected\);/);
  assert.match(favoriteSlot, /apply\.setAttribute\('aria-current', 'true'\)/);
  assert.match(favoriteSlot, /\.favorite-dropdown-row\.is-current-selection/);
  assert.doesNotMatch(favoriteSlot, /apply\.textContent = `\$\{index \+ 1\}\. \$\{pairText\(entry\)\}`/);
});

test('favorite toggle glow reflects only the current pair', () => {
  assert.match(favoriteSlot, /const currentSaved = currentSavedIndex\(slotName, current, collections\) >= 0;/);
  assert.match(favoriteSlot, /button\.textContent = isOne \? \(currentSaved \? '♥' : '♡'\) : \(currentSaved \? '★' : '☆'\);/);
  assert.doesNotMatch(favoriteSlot, /items\.length \? '♥'|items\.length \? '★'/);
  assert.doesNotMatch(favoriteSlot, /classList\.toggle\('has-saved-pair'/);
});

test('app frame uses only the AudioContext engine clock for the lane', () => {
  assert.match(app, /function enginePosition\(\) \{[\s\S]*?ac\.currentTime - transportStartCtx/);
  assert.match(app, /function frame\(now\) \{\s*const p = enginePosition\(\);\s*renderTimelineAt\(p\);[\s\S]*?requestAnimationFrame\(frame\)/);
  assert.match(app, /positionSec: enginePosition/);
  assert.doesNotMatch(app, /audiblePosition|getOutputTimestamp|outputLatency|visualOutputContextTime/);
  assert.doesNotMatch(app, /SKIP_SEC|TRANSPORT_UI_INTERVAL_MS|backButton|forwardButton|seekTimeFeedback|copyTimeButton/);
  assert.doesNotMatch(app, /renderObjectAt|drawObjectTicks|timelineStaticCanvas|timelineCursorCanvas|setExternalTimelineRenderer/);
});

test('40ms hitsound scheduler is intentionally retained for this isolation pass', () => {
  assert.match(app, /const EFFECT_SCHEDULER_INTERVAL_MS = 40;/);
  assert.match(app, /setInterval\(scheduleUpcomingHits, EFFECT_SCHEDULER_INTERVAL_MS\)/);
  assert.match(app, /function refreshScheduledHitsounds\(\)/);
});

test('object timeline has fixed geometry, no beat lines and instant hit removal', () => {
  assert.match(timeline, /const FIXED_SPAN_MS = 1000;/);
  assert.match(timeline, /let lockedGeometry = null;/);
  assert.match(timeline, /function lockGeometry\(\)/);
  assert.match(timeline, /const startIndex = lowerHit\(map\.hits, nowMs\);/);
  assert.match(timeline, /const normalRadius = 14;/);
  assert.match(timeline, /const bigRadius = 17;/);
  assert.match(timeline, /const targetRadius = 19\.5;/);
  assert.doesNotMatch(timeline, /drawBeatLines|measureLines|beatLines|POST_HIT_FADE_MS|postHit|progress|EJECT/);
  assert.doesNotMatch(timeline, /ResizeObserver|IntersectionObserver|addEventListener\('resize'|addEventListener\('orientationchange'/);
  assert.doesNotMatch(timeline, /requestAnimationFrame/);
  assert.match(timeline, /renderAt: positionSec => render\(positionSec\)/);
});

test('hitsound switching uses only direct viewer APIs and never rebuilds transport', () => {
  assert.match(controller, /function directViewerReady\(\)/);
  assert.match(controller, /CreateSEViewer\.applyHitsoundBytes/);
  assert.match(controller, /CreateSEViewer\.applyHitsoundPairBytes/);
  assert.match(controller, /window\.addEventListener\('viewer-ready'/);
  assert.doesNotMatch(controller, /DataTransfer|setInputFile|waitForViewerReady|waitForRebuild|viewerRebuilding|resumeAfter/);
  assert.doesNotMatch(controller, /dispatchEvent\(new Event\('change'/);
  assert.doesNotMatch(controller, /\.play\.click\(\)/);
});

test('Don Kat switching never restores or rewrites candidate scroll position', () => {
  assert.match(workbench, /window\.addEventListener\('hitsound-active-side-change',[\s\S]*?activeSide = event\.detail\?\.side === 'kat' \? 'kat' : 'don';/);
  assert.doesNotMatch(workbench, /POSITION_KEY|saveCandidatePosition|restoreCandidatePosition|schedulePositionSave|readPositions|layoutKey/);
  assert.doesNotMatch(workbench, /sourcePanel\.scrollTop|scrollIntoView/);
  assert.match(html, /workbench-ui\.js\?v=2\.2-no-scroll-restore/);
});

test('supported device orientation is fixed to iPhone portrait and iPad landscape', () => {
  assert.match(orientation, /isIPhone && landscape/);
  assert.match(orientation, /isIPad && !landscape/);
  assert.match(orientation, /orientation-blocked/);
  assert.match(html, /orientation-guard\.js\?v=1\.0-fixed-device-orientation/);
  assert.match(html, /id="orientationGuard"/);
});

test('runtime cache keys point at the stripped implementation', () => {
  assert.match(html, /app-v4\.js\?v=4\.2-engine-clock-fixed-ui/);
  assert.match(html, /object-timeline-v2\.js\?v=4\.1-fixed-geometry-no-fade/);
  assert.match(html, /hitsound-controller\.js\?v=4\.2-direct-only/);
  assert.match(html, /favorite-slot-ui\.js\?v=4\.0-unified-dropdown/);
});

test('Pages publishes every runtime asset needed by the fixed timeline', () => {
  for (const asset of [
    'orientation-guard.js','app-v4.js','object-timeline-v2.js','hitsound-controller.js',
    'favorite-slot-ui.js','workbench-ui.js','hitsounds-current111-abc-v5.zip',
  ]) assert.match(pages, new RegExp(`cp ${asset.replaceAll('.', '\\.')} _site\\/`));
});

test('audio levels remain Music 0.70 and Effect 1.00', () => {
  assert.match(app, /const MUSIC_GAIN = 0\.70;/);
  assert.match(app, /const EFFECT_GAIN = 1\.00;/);
});

test('Current111 and fixed Pair-12 presets remain intact', () => {
  assert.match(candidates, /Current111 ABC Sorted v5/);
  assert.match(candidates, /dataset: 'current111-abc-v5'/);
  assert.match(grid, /data-abc="\$\{abcGrade\}"/);
  const expected = [
    ['P01','SRC070','SRC084'], ['P02','SRC015','SRC019'], ['P03','SRC098','SRC101'],
    ['P04','SRC098','SRC064'], ['P05','SRC056','SRC084'], ['P06','SRC070','SRC019'],
    ['P07','SRC089','SRC064'], ['P08','SRC089','SRC088'], ['P09','SRC101','SRC090'],
    ['P10','SRC056','SRC077'], ['P11','SRC084','SRC090'], ['P12','SRC079','SRC100'],
  ];
  for (const [label, don, kat] of expected) {
    assert.ok(favorites.includes(`['${label}', '${don}', '${kat}']`), `${label} is missing`);
  }
  assert.equal(existsSync(new URL('../hitsounds-current111-abc-v5.zip', import.meta.url)), true);
});
