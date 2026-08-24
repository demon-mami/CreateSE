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

test('required workbench controls have unique IDs and A-B controls are absent', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [
    'roleDonButton','roleKatButton','playButton','backButton','forwardButton','seekBar','seekTimeFeedback',
    'favoriteOneButton','favoriteTwoButton','favoriteOpenButton','customHitsoundInput',
  ]) assert.ok(ids.includes(id), `${id} is missing`);
  for (const id of [
    'startMarkButton','endMarkButton','jumpStartButton','jumpEndButton','loopToggleButton','clearLoopButton',
    'startMarkButton2','endMarkButton2','jumpStartButton2','jumpEndButton2','loopToggleButton2','clearLoopButton2',
    'rangeLength','rangeLength2','loopStatus','loopStatus2','miniLoopState',
    'currentDonTarget','currentKatTarget','previewDonButton','previewKatButton','muteDonButton','muteKatButton',
    'deleteCandidateButton','timeDisplay','durationDisplay','zoomOutButton','zoomInButton','zoomLabel',
  ]) assert.equal(ids.includes(id), false, `${id} must be removed`);
});

test('transport is range-free and keeps four-second seek', () => {
  assert.match(app, /const SKIP_SEC = 4;/);
  assert.match(app, /audiblePosition\(\) - SKIP_SEC/);
  assert.match(app, /audiblePosition\(\) \+ SKIP_SEC/);
  assert.match(app, /const OBJECT_TIMELINE_SPAN_MS = 1000;/);
  assert.doesNotMatch(app, /LOOP_MIN_MS|LOOP_MAX_MS|activeLoopIndex|loopSeekPending|rangeElements|const ranges =/);
  assert.doesNotMatch(app, /function (?:updateRanges|resetRange|toggleMark|toggleLoop|jumpToRangeMark|activeRange|validRange|rangeDurationMs)/);
  assert.doesNotMatch(app, /viewer-loop-change|loopState:/);
  assert.doesNotMatch(workbench, /viewer-loop-change|miniLoopState/);
  assert.doesNotMatch(timeline, /drawRegisteredRanges|loopState\?\.|viewer-loop-change/);
});

test('object timeline is driven by the app frame with the exact same position', () => {
  assert.match(app, /function renderTimelineAt\(positionSec\)/);
  assert.match(app, /renderer\.renderAt\(positionSec\)/);
  assert.match(app, /function frame\(now\) \{[\s\S]*?const p = audiblePosition\(\);[\s\S]*?renderTimelineAt\(p\);[\s\S]*?raf = requestAnimationFrame\(frame\);/);
  assert.match(timeline, /window\.CreateSEObjectTimeline = Object\.freeze\(\{/);
  assert.match(timeline, /renderAt: positionSec => render\(positionSec\)/);
  assert.doesNotMatch(timeline, /function frame\(|requestAnimationFrame\(frame\)/);
  assert.doesNotMatch(timeline, /MIN_RENDER_INTERVAL_MS|lastAnimationPaint/);
  assert.match(html, /app-v4\.js\?v=4\.1-single-raf-no-ranges/);
  assert.match(html, /object-timeline-v2\.js\?v=4\.0-app-frame-sync/);
});

test('timeline keeps the current lightweight renderer protections', () => {
  assert.match(timeline, /document\.visibilityState === 'hidden'/);
  assert.match(timeline, /new IntersectionObserver\(entries =>/);
  assert.match(timeline, /const measureLines = \[\];/);
  assert.match(timeline, /strokeLines\(beatLines/);
  assert.match(timeline, /Math\.min\(MAX_CANVAS_DPR, window\.devicePixelRatio/);
  assert.match(timeline, /new ResizeObserver\(measureViewport\)/);
  assert.match(timeline, /lowerHit\(map\.hits, visibleLeftTime\)/);
  assert.match(timeline, /const FIXED_SPAN_MS = 1000;/);
  assert.doesNotMatch(timeline, /ctx\.save\(\)/);
});

test('timeline notes retain the approved compact sizes', () => {
  assert.match(app, /const OBJECT_NOTE_RADIUS = 14;/);
  assert.match(timeline, /const normalRadius = 14;/);
  assert.match(timeline, /const bigRadius = 17;/);
  assert.match(timeline, /const targetRadius = 19\.5;/);
});

test('audio levels stay fixed at Music 0.70 and Effect 1.00', () => {
  assert.match(app, /const MUSIC_GAIN = 0\.70;/);
  assert.match(app, /const EFFECT_GAIN = 1\.00;/);
  assert.doesNotMatch(controller, /DuckingBridge|setPreviewDucking/);
  assert.doesNotMatch(html, /audio-ducking-bridge\.js/);
  assert.doesNotMatch(pages, /audio-ducking-bridge\.js/);
  assert.equal(existsSync(new URL('../audio-ducking-bridge.js', import.meta.url)), false);
});

test('Pages publishes all current runtime assets', () => {
  for (const asset of [
    'workbench.css','workbench-ui.js','favorite-slot-ui.js','favorite-pager-v4.js',
    'object-timeline-v2.js','hitsounds-current111-abc-v5.zip','qa-iphone.html',
  ]) assert.match(pages, new RegExp(`cp ${asset.replaceAll('.', '\\.')} _site\\/`));
  assert.doesNotMatch(pages, /hitsounds-single-base-116\.zip/);
});

test('candidate tap toggles selection and previews only when selecting', () => {
  assert.doesNotMatch(grid, /LONG_PRESS|togglePin|navigator\.vibrate/);
  assert.match(grid, /function chooseSound\(id, \{ preview = true \} = \{\}\)/);
  assert.match(grid, /const deselecting = current === id;/);
  assert.match(grid, /const nextId = deselecting \? null : id;/);
  assert.match(grid, /preview: preview && !deselecting/);
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
  assert.doesNotMatch(workbench, /hitsound-preview-state/);
  assert.match(html, /hitsound-controller\.js\?v=4\.1-latest-switch-wins/);
});

test('Favorite excludes mute and verifies My Sound fingerprints', () => {
  assert.match(favorites, /!don \|\| !kat \|\| don === SILENT_ID \|\| kat === SILENT_ID/);
  assert.match(favorites, /source\.fingerprint !== side\.fingerprint/);
  assert.match(favorites, /hitsound-preset-applied/);
  assert.match(favorites, /pair-favorite-slots:v1/);
  assert.doesNotMatch(html, /muteDonButton|muteKatButton|previewDonButton|previewKatButton/);
});

test('fixed Pair-12 presets remain immutable', () => {
  const expected = [
    ['P01', 'SRC070', 'SRC084'], ['P02', 'SRC015', 'SRC019'], ['P03', 'SRC098', 'SRC101'],
    ['P04', 'SRC098', 'SRC064'], ['P05', 'SRC056', 'SRC084'], ['P06', 'SRC070', 'SRC019'],
    ['P07', 'SRC089', 'SRC064'], ['P08', 'SRC089', 'SRC088'], ['P09', 'SRC101', 'SRC090'],
    ['P10', 'SRC056', 'SRC077'], ['P11', 'SRC084', 'SRC090'], ['P12', 'SRC079', 'SRC100'],
  ];
  for (const pair of expected) {
    assert.ok(favorites.includes(`['${pair[0]}', '${pair[1]}', '${pair[2]}']`), `${pair[0]} is missing`);
  }
  assert.match(favorites, /const PRESET_PAIRS = Object\.freeze\(/);
  assert.match(html, /hitsound-favorites\.js\?v=5\.0-preset-slots/);
});

test('responsive split and seek touch targets remain present', () => {
  assert.match(css, /--tap-size:44px/);
  assert.match(css, /\.seek-bar\{width:100%;height:44px/);
  assert.match(html, /id="seekBar"[^>]*aria-label="曲の位置"/);
  assert.match(css, /\.mini-play\{[^}]*white-space:nowrap/);
  assert.match(css, /grid-template-columns:minmax\(0,1\.62fr\) minmax\(390px,1fr\)/);
  assert.match(css, /@media\(max-width:899px\), \(orientation:portrait\)/);
  assert.doesNotMatch(css, /幅375px以上で利用してください/);
});

test('compact visible copy keeps accessible labels and dock icons', () => {
  assert.doesNotMatch(html, />試聴・判断</);
  assert.doesNotMatch(html, /<span>収納<\/span>|<span>展開<\/span>/);
  assert.match(html, /id="dockToggleButton"[^>]*aria-label="再生パネルを展開"/);
  assert.match(html, /id="dockCollapseButton"[^>]*aria-label="再生パネルを収納"/);
  assert.match(html, /id="statusBadge" class="status-badge sr-only"/);
  assert.match(html, /id="recommendationLine" class="hs-recommendation sr-only"/);
  assert.doesNotMatch(html, /deleteCandidateLine|currentDonMeta|currentKatMeta/);
  assert.doesNotMatch(workbench, /current\$\{cap\}Meta/);
  assert.doesNotMatch(html, /id="timeDisplay"|id="durationDisplay"/);
  assert.match(html, /id="seekTimeFeedback"[^>]*hidden/);
  assert.match(css, /\.dock-toggle \.dock-icon\{[^}]*border:2px solid currentColor/);
  assert.match(css, /\.dock-collapse \.dock-icon\{[^}]*height:2px/);
});

test('transport spacing and Dock transitions remain intact', () => {
  assert.match(css, /\.transport-row\{gap:16px;padding-inline:10px\}/);
  assert.match(css, /\.transport-row\{grid-template-columns:minmax\(0,1fr\) 96px minmax\(0,1fr\);gap:14px/);
  assert.doesNotMatch(css, /\.audition-panel\.is-transitioning\{pointer-events:none\}/);
  assert.match(css, /\.audition-panel\.is-transitioning \.dock-mini,\.audition-panel\.is-transitioning \.dock-expanded\{pointer-events:none!important\}/);
  assert.match(workbench, /const DOCK_TRANSITION_MS = 480;/);
  assert.match(workbench, /classList\.add\('is-transitioning'\)/);
});

test('quick favorite states stay compact and centered', () => {
  assert.doesNotMatch(html, /current-sound-card|mini-current/);
  assert.doesNotMatch(css, /active-border-orbit|--active-glow-angle|--active-border-loop/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.judgment-actions\{[\s\S]*?grid-template-columns:repeat\(3,52px\);[\s\S]*?justify-content:center/);
  assert.match(css, /\.quick-favorite\[aria-pressed="true"\]/);
  assert.match(css, /\.favorite-two\[aria-pressed="true"\]/);
});

test('candidate and playback panes keep distinct static gradients', () => {
  assert.match(css, /--source-pane-base:#071721/);
  assert.match(css, /--playback-pane-base:#1a1023/);
  assert.match(css, /\.source-panel\{[\s\S]*?radial-gradient\(circle at 10% -8%,rgba\(75,232,255,.18\)/);
  assert.match(css, /\.audition-panel\{[\s\S]*?radial-gradient\(circle at 90% -10%,rgba\(255,112,200,.17\)/);
});

test('Current111 data and ABC dots remain current', () => {
  assert.match(candidates, /Current111 ABC Sorted v5/);
  assert.match(candidates, /abcGrade/);
  assert.match(candidates, /dataset: 'current111-abc-v5'/);
  assert.match(controller, /hitsounds-current111-abc-v5\.zip/);
  assert.doesNotMatch(controller, /hitsounds-single-base-116\.zip/);
  assert.match(grid, /data-abc="\$\{abcGrade\}"/);
  assert.match(gridCss, /\.hs-key\[data-abc="A"\]\{--abc-dot:#d86a70\}/);
  assert.match(gridCss, /\.hs-key\[data-abc="B"\]\{--abc-dot:#79ad83\}/);
  assert.match(gridCss, /\.hs-key\[data-abc="C"\]\{--abc-dot:rgba\(245,247,248,.88\)\}/);
  assert.doesNotMatch(gridCss, /--abc-line|--abc-halo|content:attr\(data-abc\)/);
  assert.equal(existsSync(new URL('../hitsounds-current111-abc-v5.zip', import.meta.url)), true);
  assert.equal(existsSync(new URL('../hitsounds-single-base-116.zip', import.meta.url)), false);
});

test('candidate rows keep fixed six-slot modules and stable family placement', () => {
  assert.match(grid, /const FAMILY_ROW_PLAN = \[/);
  assert.match(grid, /\['Doom Pulse', 'Taiko'\]/);
  assert.match(grid, /\['Bass Drum \/ Kick', 'Snare'\]/);
  assert.match(grid, /\['Forest Perc C', 'Forest Perc D'\]/);
  assert.match(grid, /const moduleLayout = capacity >= 12;/);
  assert.match(grid, /columns = fullWidth \? 12 : 6;/);
  assert.match(grid, /class="hs-family-spacer"/);
  assert.match(gridCss, /\.hs-family-row\[data-layout="modules"\]\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(grid, /new ResizeObserver\(\(\) => buildGrid\(\)\)/);
  assert.match(html, /hitsound-grid\.js\?v=4\.2-no-delete-rating/);
});

test('Don and Kat preserve independent candidate scroll positions', () => {
  assert.match(workbench, /scrollTop: Math\.max\(0, sourcePanel\.scrollTop\)/);
  assert.match(workbench, /sourcePanel\.scrollTop = Math\.max\(0, saved\.scrollTop\)/);
  assert.match(workbench, /clearTimeout\(savePositionTimer\);\s+saveCandidatePosition\(activeSide\);/);
  assert.match(workbench, /activeSide = nextSide;[\s\S]*?restoreCandidatePosition\(\);/);
});

test('playback-side audition and explicit mute controls remain removed', () => {
  assert.doesNotMatch(html, /current-pair|current-sound-card|currentDonTarget|currentKatTarget/);
  assert.doesNotMatch(html, /previewDonButton|previewKatButton|muteDonButton|muteKatButton/);
  assert.doesNotMatch(workbench, /syncCurrentPair|previewDon|previewKat|muteDon|muteKat/);
  assert.match(grid, /preview: preview && !deselecting/);
});

test('seek time remains transient and manual-only', () => {
  assert.match(app, /function showSeekFeedback\(positionSec/);
  assert.match(app, /showSeekFeedback\(pausedOffset, \{ linger: false \}\)/);
  assert.match(app, /seekTo\(audiblePosition\(\) - SKIP_SEC, \{ showFeedback: true \}\)/);
  assert.match(app, /seekTo\(audiblePosition\(\) \+ SKIP_SEC, \{ showFeedback: true \}\)/);
  assert.doesNotMatch(html, /class="time-row"|class="song-time"/);
});
