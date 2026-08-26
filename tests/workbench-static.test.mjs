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
const charts = read('charts.js');
const chartLoader = read('chart-loader.js');
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
  assert.match(html, /favorite-slot-ui\.js\?v=5\.0-max30-seed15/);
  assert.doesNotMatch(html, /favorite-pager-v4\.js|aria-haspopup="dialog"/);

  assert.match(favoriteSlot, /const MAX_ITEMS = 30;/);
  assert.match(favoriteSlot, /'㉙','㉚'/);
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

test('favorite2 receives the approved fifteen pairs once in listed order', () => {
  const expected = [
    ['006','007'], ['025','026'], ['043','047'], ['050','046'], ['051','050'],
    ['050','052'], ['051','052'], ['066','069'], ['071','073'], ['072','073'],
    ['115','069'], ['093','092'], ['098','099'], ['107','101'], ['006','003'],
  ];
  assert.match(favoriteSlot, /const FAVORITE2_SEED_KEY = 'osutaiko-hitsound-lab:favorite2-seed:20260826-15-v1';/);
  assert.match(favoriteSlot, /function seedFavorite2Once\(\)/);
  assert.match(favoriteSlot, /collections\.favorite2 = \[\.\.\.seeded, \.\.\.existing\];/);
  assert.match(favoriteSlot, /localStorage\.setItem\(FAVORITE2_SEED_KEY, '1'\)/);
  assert.match(favoriteSlot, /seedFavorite2Once\(\);/);
  for (const [don, kat] of expected) {
    assert.ok(favoriteSlot.includes(`['${don}','${kat}']`), `${don}+${kat} seed is missing`);
  }
  assert.equal(expected.length, 15);
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
});

test('favorite toggle glow reflects only the current pair', () => {
  assert.match(favoriteSlot, /const currentSaved = currentSavedIndex\(slotName, current, collections\) >= 0;/);
  assert.match(favoriteSlot, /button\.textContent = isOne \? \(currentSaved \? '♥' : '♡'\) : \(currentSaved \? '★' : '☆'\);/);
  assert.doesNotMatch(favoriteSlot, /items\.length \? '♥'|items\.length \? '★'/);
  assert.doesNotMatch(favoriteSlot, /classList\.toggle\('has-saved-pair'/);
});

test('chart rotation removes four old maps and adds four verified replacement maps', () => {
  const blocks = [...charts.matchAll(/\{[\s\S]*?\}/g)].map(match => match[0]);
  assert.equal(blocks.length, 15);
  for (const removed of ['what-hurts-the-most','navi-98','monochrome-asterisk-makina-remix','pacific-girls']) {
    assert.doesNotMatch(charts, new RegExp(`"id": "${removed}"`));
  }
  const expected = [
    ['if', 'イフ', "arc & Hivie's Cold Truths under the Radiant Sunlight", 'maps/if.osz'],
    ['shuuten-no-saki', '終点の先が在るとするならば。(あ? edit)', 'Finale Oni', 'maps/shuuten-no-saki.osz'],
    ['1208', '#1208', 'Inner Oni', 'maps/1208.osz'],
    ['trancing-pulse-brz', 'Trancing Pulse (brz_bootleg_remix)', 'Taiko Master', 'maps/trancing-pulse-brz.osz'],
  ];
  for (const [id, title, difficulty, file] of expected) {
    assert.ok(charts.includes(`"id": "${id}"`), `${id} is missing`);
    assert.ok(charts.includes(`"title": "${title}"`), `${title} is missing`);
    assert.ok(charts.includes(`"difficulty": "${difficulty}"`), `${difficulty} is missing`);
    assert.ok(charts.includes(`"file": "${file}"`), `${file} is missing`);
  }
  assert.match(charts, /"revision": "20260826-shuuten-audiofix-v2"/);
  assert.match(html, /charts\.js\?v=0\.5-shuuten-cache-bust/);
  assert.match(html, /chart-loader\.js\?v=0\.7-no-force-cache/);
  assert.match(chartLoader, /function chartFileUrl\(chart\)/);
  assert.match(chartLoader, /encodeURIComponent\(chart\.revision\)/);
  assert.match(chartLoader, /fetch\(url, \{ cache: 'no-cache' \}\)/);
  assert.doesNotMatch(chartLoader, /fetch\(`\.\/\$\{chart\.file\}`, \{ cache: 'force-cache' \}\)/);
  assert.match(pages, /cat \.map-assets\/maps-wave-20260826-\*\.part > \/tmp\/maps-wave-20260826\.zip/);
  assert.match(pages, /maps-wave-20260826\.sha256/);
  assert.match(pages, /unzip -q \/tmp\/maps-wave-20260826\.zip -d _site\/maps/);
  assert.match(pages, /cat \.map-assets\/maps-shuuten-fix-20260826-\*\.part > \/tmp\/maps-shuuten-fix-20260826\.zip/);
  assert.match(pages, /maps-shuuten-fix-20260826\.sha256/);
  assert.match(pages, /unzip -oq \/tmp\/maps-shuuten-fix-20260826\.zip -d _site\/maps/);
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
  assert.match(html, /hitsound-favorites\.js\?v=5\.1-set30-favorite-union/);
  assert.match(html, /favorite-slot-ui\.js\?v=5\.0-max30-seed15/);
  assert.match(html, /charts\.js\?v=0\.5-shuuten-cache-bust/);
  assert.match(html, /chart-loader\.js\?v=0\.7-no-force-cache/);
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

test('Current111 and favorite-derived fixed sets remain intact', () => {
  assert.match(candidates, /Current111 ABC Sorted v5/);
  assert.match(candidates, /dataset: 'current111-abc-v5'/);
  assert.match(grid, /data-abc="\$\{abcGrade\}"/);
  assert.match(favorites, /const PRESET_MAX_ITEMS = 30;/);
  assert.match(favorites, /PRESET_PAIRS\.slice\(0, PRESET_MAX_ITEMS\)/);
  const expected = [
    ['P01','SRC051','SRC052'], ['P02','SRC116','SRC092'], ['P03','SRC072','SRC073'],
    ['P04','SRC071','SRC073'], ['P05','SRC066','SRC069'], ['P06','SRC069','SRC107'],
    ['P07','SRC070','SRC101'], ['P08','SRC006','SRC007'], ['P09','SRC025','SRC026'],
    ['P10','SRC043','SRC047'], ['P11','SRC107','SRC101'], ['P12','SRC006','SRC003'],
  ];
  for (const [label, don, kat] of expected) {
    assert.ok(favorites.includes(`['${label}', '${don}', '${kat}']`), `${label} is missing`);
  }
  assert.equal(existsSync(new URL('../hitsounds-current111-abc-v5.zip', import.meta.url)), true);
});