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
    'roleDonButton','roleKatButton','playButton','backButton','forwardButton','seekBar','seekTimeFeedback',
    'startMarkButton','endMarkButton','jumpStartButton','jumpEndButton','loopToggleButton','clearLoopButton',
    'startMarkButton2','endMarkButton2','jumpStartButton2','jumpEndButton2','loopToggleButton2','clearLoopButton2',
    'favoriteOneButton','favoriteTwoButton','favoriteOpenButton','customHitsoundInput',
  ]) assert.ok(ids.includes(id), `${id} is missing`);
  for (const id of [
    'currentDonTarget','currentKatTarget','previewDonButton','previewKatButton','muteDonButton','muteKatButton',
    'deleteCandidateButton','timeDisplay','durationDisplay','zoomOutButton','zoomInButton','zoomLabel',
  ]) assert.equal(ids.includes(id), false, `${id} must be removed`);
});

test('transport and dual A-B ranges match approved requirements', () => {
  assert.match(app, /const SKIP_SEC = 4;/);
  assert.match(app, /const LOOP_MIN_MS = 500;/);
  assert.doesNotMatch(app, /LOOP_MAX_MS/);
  assert.match(app, /const ranges = \[\s*\{ start: null, end: null \},\s*\{ start: null, end: null \}/);
  assert.match(app, /let activeLoopIndex = -1;/);
  assert.match(app, /activeLoopIndex = activeLoopIndex === index \? -1 : index;/);
  assert.match(app, /function jumpToRangeMark\(index, which\)/);
  assert.match(app, /audiblePosition\(\) - SKIP_SEC/);
  assert.match(app, /audiblePosition\(\) \+ SKIP_SEC/);
  assert.match(app, /const OBJECT_TIMELINE_SPAN_MS = 1000;/);
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
  assert.doesNotMatch(workbench, /hitsound-preview-state/);
  assert.match(html, /app-v4\.js\?v=4\.0-dual-ranges/);
  assert.match(html, /hitsound-controller\.js\?v=4\.1-latest-switch-wins/);
});

test('Favorite excludes mute and verifies My Sound fingerprints', () => {
  assert.match(favorites, /!don \|\| !kat \|\| don === SILENT_ID \|\| kat === SILENT_ID/);
  assert.match(favorites, /source\.fingerprint !== side\.fingerprint/);
  assert.match(favorites, /hitsound-preset-applied/);
  assert.match(favorites, /pair-favorite-slots:v1/);
  assert.doesNotMatch(html, /muteDonButton|muteKatButton|previewDonButton|previewKatButton/);
});

test('fixed Pair-12 presets are immutable and separated from two quick favorites', () => {
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
  assert.match(favorites, /const PRESET_PAIRS = Object\.freeze\(/);
  assert.match(favorites, /const SLOT_STORAGE_KEY = 'osutaiko-hitsound-lab:pair-favorite-slots:v1'/);
  assert.match(favorites, /localStorage\.removeItem\(LEGACY_STORAGE_KEY\)/);
  assert.match(favorites, /localStorage\.removeItem\(LEGACY_SEED_KEY\)/);
  assert.match(favorites, /slotButtons\.favorite1\?\.addEventListener/);
  assert.match(favorites, /slotButtons\.favorite2\?\.addEventListener/);
  assert.doesNotMatch(favorites, /mergeSeedFavoritePairs|data-delete-set|favorite-set-delete/);
  assert.match(html, /hitsound-favorites\.js\?v=5\.0-preset-slots/);
});

test('responsive split and touch target tokens are present', () => {
  assert.match(css, /--tap-size:44px/);
  assert.match(css, /\.seek-wrap\{position:relative;min-height:48px/);
  assert.match(css, /\.seek-bar\{height:44px;margin:0/);
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
  assert.match(html, /id="dockToggleButton"[^>]*aria-label="再生パネルを展開"/);
  assert.match(html, /id="dockCollapseButton"[^>]*aria-label="再生パネルを収納"/);
  assert.match(html, /id="statusBadge" class="status-badge sr-only"/);
  assert.match(html, /id="recommendationLine" class="hs-recommendation sr-only"/);
  assert.doesNotMatch(html, /deleteCandidateLine/);
  assert.doesNotMatch(html, /currentDonMeta|currentKatMeta/);
  assert.doesNotMatch(workbench, /current\$\{cap\}Meta/);
  assert.doesNotMatch(workbench, /\$\{activeSide === 'don' \? 'Don' : 'Kat'\} 操作中/);
  assert.doesNotMatch(workbench, /A–B \$\{detail\.enabled \? '反復中' : '設定済み'\}/);
  assert.doesNotMatch(html, /id="timeDisplay"|id="durationDisplay"/);
  assert.match(html, /id="seekTimeFeedback"[^>]*hidden/);
  assert.match(css, /\.dock-toggle \.dock-icon\{[^}]*border:2px solid currentColor/);
  assert.match(css, /\.dock-collapse \.dock-icon\{[^}]*height:2px/);
});

test('transport spacing is relaxed and Dock transitions shield the candidate layer', () => {
  assert.match(css, /\.transport-row\{gap:16px;padding-inline:10px\}/);
  assert.match(css, /\.transport-row\{grid-template-columns:minmax\(0,1fr\) 96px minmax\(0,1fr\);gap:14px/);
  assert.doesNotMatch(css, /\.audition-panel\.is-transitioning\{pointer-events:none\}/);
  assert.match(css, /\.audition-panel\.is-transitioning \.dock-mini,\.audition-panel\.is-transitioning \.dock-expanded\{pointer-events:none!important\}/);
  assert.match(css, /\.seek-bar\{height:44px;margin:0/);
});

test('quick favorite states are compact, centered, and static', () => {
  assert.doesNotMatch(html, /current-sound-card|mini-current/);
  assert.doesNotMatch(css, /active-border-orbit|--active-glow-angle|--active-border-loop/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.judgment-actions\{[\s\S]*?grid-template-columns:repeat\(3,52px\);[\s\S]*?justify-content:center/);
  assert.match(css, /\.quick-favorite\[aria-pressed="true"\]/);
  assert.match(css, /\.favorite-two\[aria-pressed="true"\]/);
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
  assert.match(favorites, /LEGACY_STORAGE_KEY = 'osutaiko-hitsound-lab-favorites-current111-abc-v5'/);
  assert.match(grid, /LEGACY_DELETE_CANDIDATE_STORAGE_KEY = 'osutaiko-hitsound-lab:deletion-candidates:current111-abc-v5'/);
  assert.match(grid, /localStorage\.removeItem\(LEGACY_DELETE_CANDIDATE_STORAGE_KEY\)/);
  assert.doesNotMatch(grid, /toggleDeleteCandidate|renderDeleteCandidate|deleteCandidateIds/);
  assert.match(grid, /data-abc="\$\{abcGrade\}"/);
  assert.match(gridCss, /\.hs-key\[data-abc="A"\]/);
  assert.doesNotMatch(gridCss, /content:attr\(data-abc\)/);
  assert.equal(existsSync(new URL('../hitsounds-current111-abc-v5.zip', import.meta.url)), true);
  assert.equal(existsSync(new URL('../hitsounds-single-base-116.zip', import.meta.url)), false);
});

test('candidate keys use restrained numbers and subtle red-green-white ABC dots', () => {
  assert.doesNotMatch(grid, /<span data-abc=/);
  assert.match(gridCss, /\.hs-key\[data-abc="A"\]\{--abc-dot:#d86a70\}/);
  assert.match(gridCss, /\.hs-key\[data-abc="B"\]\{--abc-dot:#79ad83\}/);
  assert.match(gridCss, /\.hs-key\[data-abc="C"\]\{--abc-dot:rgba\(245,247,248,.88\)\}/);
  assert.match(gridCss, /\.hs-key\[data-abc\]>span::before\{[\s\S]*?top:6px;[\s\S]*?left:7px;[\s\S]*?width:5px;[\s\S]*?height:5px;[\s\S]*?border-radius:50%/);
  assert.doesNotMatch(gridCss, /--abc-line|--abc-halo|content:attr\(data-abc\)/);
  assert.doesNotMatch(gridCss, /delete-candidate/);
  assert.doesNotMatch(grid, /delete-candidate/);
  assert.match(css, /#hitsoundSources \.hs-key>span\{[\s\S]*?font-size:11px!important;[\s\S]*?font-weight:520!important/);
  assert.doesNotMatch(css, /selected-don::after\{content:"D"\}|selected-kat::after\{content:"K"\}|content:"D\/K"/);
  assert.match(css, /selected-don\.selected-kat::after\{[\s\S]*?radial-gradient\(circle at 3\.5px[\s\S]*?radial-gradient\(circle at calc\(100% - 3\.5px\)/);
  assert.doesNotMatch(gridCss, /abc-line[^\n]*animation|@keyframes[^\{]*abc/i);
  assert.match(html, /hitsound-grid\.css\?v=4\.3-pair-presets/);
  assert.match(html, /workbench\.css\?v=2\.0-pair-ranges/);
});

test('candidate rows use fixed six-slot modules and stable family placement', () => {
  assert.match(grid, /const FAMILY_ROW_PLAN = \[/);
  assert.match(grid, /\['Doom Pulse', 'Taiko'\]/);
  assert.match(grid, /\['Bass Drum \/ Kick', 'Snare'\]/);
  assert.match(grid, /\['Forest Perc C', 'Forest Perc D'\]/);
  assert.match(grid, /Math\.max\(4, Math\.min\(12,/);
  assert.match(grid, /\(width \+ 7\) \/ 51/);
  assert.match(grid, /const moduleLayout = capacity >= 12;/);
  assert.match(grid, /columns = fullWidth \? 12 : 6;/);
  assert.match(grid, /data-layout="\$\{moduleLayout \? 'modules' : 'slots'\}"/);
  assert.match(grid, /requiredSlots > capacity/);
  assert.doesNotMatch(grid, /\.sort\(\(a, b\) => b\.count - a\.count/);
  assert.match(grid, /class="hs-family-spacer"/);
  assert.match(gridCss, /\.hs-family-row\[data-layout="modules"\]\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[\s\S]*?column-gap:10px/);
  assert.match(css, /#hitsoundSources \.hs-family-row\[data-layout="modules"\]\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[\s\S]*?column-gap:10px!important/);
  assert.match(grid, /new ResizeObserver\(\(\) => buildGrid\(\)\)/);
  assert.match(html, /hitsound-grid\.js\?v=4\.2-no-delete-rating/);
});

test('timeline notes are reduced in both visible and fallback renderers', () => {
  assert.match(app, /const OBJECT_NOTE_RADIUS = 14;/);
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
  assert.match(timeline, /const FIXED_SPAN_MS = 1000;/);
  assert.match(timeline, /drawRegisteredRanges\(ctx, leftTime, rightTime/);
  assert.match(html, /object-timeline-v2\.js\?v=3\.2-fixed-span/);
});

test('Don and Kat preserve independent candidate scroll positions', () => {
  assert.match(workbench, /scrollTop: Math\.max\(0, sourcePanel\.scrollTop\)/);
  assert.match(workbench, /sourcePanel\.scrollTop = Math\.max\(0, saved\.scrollTop\)/);
  assert.match(workbench, /clearTimeout\(savePositionTimer\);\s+saveCandidatePosition\(activeSide\);/);
  assert.match(workbench, /activeSide = nextSide;[\s\S]*?restoreCandidatePosition\(\);/);
});

test('playback-side Don/Kat audition and explicit mute controls are fully removed', () => {
  assert.doesNotMatch(html, /current-pair|current-sound-card|currentDonTarget|currentKatTarget/);
  assert.doesNotMatch(html, /previewDonButton|previewKatButton|muteDonButton|muteKatButton/);
  assert.doesNotMatch(workbench, /syncCurrentPair|previewDon|previewKat|muteDon|muteKat/);
  assert.match(grid, /preview: preview && !deselecting/);
});

test('seek time is transient and shown only by manual movement paths', () => {
  assert.match(app, /function showSeekFeedback\(positionSec/);
  assert.match(app, /showSeekFeedback\(pausedOffset, \{ linger: false \}\)/);
  assert.match(app, /seekTo\(audiblePosition\(\) - SKIP_SEC, \{ showFeedback: true \}\)/);
  assert.match(app, /seekTo\(audiblePosition\(\) \+ SKIP_SEC, \{ showFeedback: true \}\)/);
  assert.doesNotMatch(app, /el\.time\.|el\.duration\./);
  assert.doesNotMatch(html, /class="time-row"|class="song-time"/);
});

test('only one of two stored ranges loops at once and both survive loop switching', () => {
  assert.match(app, /function toggleLoop\(index\) \{\s+if \(!validRange\(index\)\) return;\s+activeLoopIndex = activeLoopIndex === index \? -1 : index;/);
  assert.match(app, /const indexes = index == null \? \[0, 1\] : \[index\]/);
  assert.match(app, /resetRange\(\);\s+setControls\(false\);/);
  assert.match(app, /ranges: ranges\.map\(\(range, index\) =>/);
});
