(() => {
  'use strict';

  const input = document.getElementById('oszInput');
  const diff = document.getElementById('difficultySelect');
  const viewport = document.getElementById('timelineViewport');
  const zoomLabel = document.getElementById('zoomLabel');
  const seek = document.getElementById('seekBar');
  if (!input || !diff || !viewport || !zoomLabel || !seek || !window.JSZip) return;

  const oldOverlay = document.getElementById('objectHitLaneCanvas');
  if (oldOverlay) oldOverlay.style.visibility = 'hidden';

  const canvas = document.createElement('canvas');
  canvas.id = 'objectTimelineV2Canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:block',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    'z-index:7',
    'background:transparent'
  ].join(';');
  viewport.appendChild(canvas);
  window.CreateSEViewer?.setExternalTimelineRenderer?.(true);

  const POST_HIT_FADE_MS = 110;
  const MAX_CANVAS_DPR = 2;
  const DON = 'rgb(235,69,44)';
  const KA = 'rgb(68,141,171)';
  const LANE = '#121214';
  const LANE_HEIGHT = 80;
  let maps = [];
  let generation = 0;
  let renderInvalidated = true;
  let lastRenderedPositionMs = NaN;
  let lastRenderedSpanMs = NaN;
  let lastRenderedMap = null;
  const viewportSize = { width: 0, height: 0 };
  const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#0f1014';

  function parseMap(text) {
    const map = { mode: -1, hits: [], timing: [], redTiming: [] };
    let section = '';
    text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw, order) => {
      const line = raw.trim();
      if (!line || line.startsWith('//')) return;
      if (line[0] === '[' && line.endsWith(']')) { section = line; return; }

      if (section === '[General]' && line.startsWith('Mode:')) {
        map.mode = Number.parseInt(line.slice(5).trim(), 10);
        return;
      }

      if (section === '[TimingPoints]') {
        const f = line.split(',');
        if (f.length < 8) return;
        const time = Number(f[0]);
        const beat = Number(f[1]);
        const meter = Number.parseInt(f[2], 10) || 4;
        const uninherited = Number.parseInt(f[6], 10) || 0;
        const effects = Number.parseInt(f[7], 10) || 0;
        if (!Number.isFinite(time)) return;
        const point = { time, beat, meter, uninherited, effects, order };
        map.timing.push(point);
        if (uninherited === 1 && beat > 0 && Number.isFinite(beat)) map.redTiming.push(point);
        return;
      }

      if (section === '[HitObjects]') {
        const f = line.split(',');
        if (f.length < 5) return;
        const time = Number.parseInt(f[2], 10);
        const type = Number.parseInt(f[3], 10) || 0;
        const sound = Number.parseInt(f[4], 10) || 0;
        if (!Number.isFinite(time) || (type & 1) === 0) return;
        map.hits.push({
          time,
          kind: (sound & (2 | 8)) !== 0 ? 'ka' : 'don',
          big: (sound & 4) !== 0
        });
      }
    });
    map.hits.sort((a, b) => a.time - b.time);
    map.timing.sort((a, b) => a.time - b.time || a.order - b.order);
    map.redTiming.sort((a, b) => a.time - b.time || a.order - b.order);
    return map;
  }

  async function readOsz(file) {
    const localGeneration = ++generation;
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter(entry => !entry.dir && /\.osu$/i.test(entry.name));
      const parsed = [];
      for (const entry of entries) parsed.push(parseMap(await entry.async('string')));
      if (localGeneration !== generation) return;
      maps = parsed.filter(map => map.mode === 1);
      renderInvalidated = true;
    } catch {
      if (localGeneration !== generation) return;
      maps = [];
      renderInvalidated = true;
    }
  }

  input.addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (file && /\.osz$/i.test(file.name || '')) readOsz(file);
  });

  function activeMap() {
    return maps[Number(diff.value) || 0] || null;
  }

  function zoomSpanMs() {
    const text = zoomLabel.textContent || '±0.5s';
    if (text.includes('0.3')) return 600;
    if (text.includes('0.4')) return 800;
    return 1000;
  }

  function measureViewport() {
    const rect = viewport.getBoundingClientRect();
    viewportSize.width = Math.max(0, rect.width);
    viewportSize.height = Math.max(0, rect.height);
    renderInvalidated = true;
  }

  function sizeCanvas(rect) {
    const dpr = Math.max(1, Math.min(MAX_CANVAS_DPR, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const styleWidth = `${rect.width}px`;
    const styleHeight = `${rect.height}px`;
    if (canvas.style.width !== styleWidth) canvas.style.width = styleWidth;
    if (canvas.style.height !== styleHeight) canvas.style.height = styleHeight;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function currentPositionSec() {
    const viewerPosition = Number(window.CreateSEViewer?.positionSec?.());
    if (Number.isFinite(viewerPosition)) return viewerPosition;
    const seekPosition = Number(seek.value);
    return Number.isFinite(seekPosition) ? seekPosition : 0;
  }

  function lowerHit(hits, time) {
    let lo = 0;
    let hi = hits.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (hits[mid].time < time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function drawBeatLines(ctx, map, leftTime, rightTime, xForTime, laneTop, laneBottom) {
    let safety = 0;
    const red = map.redTiming;
    for (let r = 0; r < red.length; r++) {
      const tp = red[r];
      const sectionEnd = r + 1 < red.length ? red[r + 1].time : rightTime;
      const a = Math.max(leftTime, tp.time);
      const b = Math.min(rightTime, sectionEnd);
      if (b < a || !(tp.beat > 0)) continue;
      let n = Math.ceil((a - tp.time) / tp.beat);
      if (!Number.isFinite(n)) continue;
      for (let time = tp.time + n * tp.beat; time <= b + 0.01; time += tp.beat, n++) {
        if (++safety > 2500) return;
        const meter = Math.max(1, tp.meter || 4);
        const measure = ((n % meter) + meter) % meter === 0;
        const x = Math.round(xForTime(time)) + 0.5;
        ctx.strokeStyle = measure ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, laneTop);
        ctx.lineTo(x, laneBottom);
        ctx.stroke();
      }
    }
  }

  function render() {
    const rect = viewportSize;
    if (!(rect.width > 0 && rect.height > 0)) measureViewport();
    if (rect.width <= 0 || rect.height <= 0) return;

    const map = activeMap();
    const durationMs = Number(seek.max) > 0 ? Number(seek.max) * 1000 : 0;
    const nowMs = currentPositionSec() * 1000;
    const span = zoomSpanMs();
    if (!renderInvalidated && map === lastRenderedMap && span === lastRenderedSpanMs && Math.abs(nowMs - lastRenderedPositionMs) < 0.01) return;
    renderInvalidated = false;
    lastRenderedMap = map;
    lastRenderedSpanMs = span;
    lastRenderedPositionMs = nowMs;

    const ctx = sizeCanvas(rect);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!map || !map.hits.length || !(durationMs > 0)) return;

    const hitX = Math.max(50, Math.min(76, rect.width * 0.16));
    const pxPerMs = rect.width / span;
    const xForTime = time => hitX + (time - nowMs) * pxPerMs;
    const leftTime = nowMs - hitX / pxPerMs;
    const rightTime = nowMs + (rect.width - hitX) / pxPerMs;

    // The lane keeps its previous ~80px height. Only top/bottom breathing room grows.
    const laneHeight = Math.min(LANE_HEIGHT, Math.max(54, rect.height - 24));
    const laneTop = Math.round((rect.height - laneHeight) / 2);
    const laneBottom = laneTop + laneHeight;
    const noteY = laneTop + laneHeight * 0.50;
    const normalRadius = 14;
    const bigRadius = 17;

    // Fully mask the legacy OBJECT canvas, including every Kiai yellow region.
    ctx.fillStyle = surfaceColor;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Back: lane.
    ctx.fillStyle = LANE;
    ctx.fillRect(0, laneTop, rect.width, laneHeight);

    // Lane borders: 1px white lines edge-to-edge.
    ctx.strokeStyle = 'rgba(255,255,255,.48)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, laneTop + 0.5);
    ctx.lineTo(rect.width, laneTop + 0.5);
    ctx.moveTo(0, laneBottom + 0.5);
    ctx.lineTo(rect.width, laneBottom + 0.5);
    ctx.stroke();

    // Behind notes: beat / measure lines, 1px wide and full lane height.
    drawBeatLines(ctx, map, leftTime, rightTime, xForTime, laneTop, laneBottom);

    // Notes.
    const visibleLeftTime = nowMs - POST_HIT_FADE_MS;
    const visibleRightTime = rightTime + 50;
    for (let index = lowerHit(map.hits, visibleLeftTime); index < map.hits.length; index++) {
      const hit = map.hits[index];
      if (hit.time > visibleRightTime) break;

      const ageMs = nowMs - hit.time;
      const postHit = ageMs > 0;
      const progress = postHit ? Math.min(1, ageMs / POST_HIT_FADE_MS) : 0;
      if (postHit && progress >= 1) continue;

      const baseRadius = hit.big ? bigRadius : normalRadius;
      const scale = postHit ? 1 - 0.65 * progress : 1;
      const alpha = postHit ? 1 - progress : 1;
      const x = postHit ? hitX - 12 * progress : xForTime(hit.time);
      const y = postHit ? noteY - 12 * progress : noteY;
      const radius = baseRadius * scale;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = hit.kind === 'ka' ? KA : DON;
      ctx.strokeStyle = 'rgba(255,255,255,.96)';
      ctx.lineWidth = hit.big ? 2.6 : 2.1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (hit.big) {
        ctx.strokeStyle = 'rgba(255,255,255,.28)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(x, y, radius + 2.6 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Front: keep the target compact while remaining distinct from the moving notes.
    const targetRadius = 19.5;
    ctx.strokeStyle = 'rgba(235,235,238,.82)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hitX, noteY, targetRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(235,235,238,.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hitX, noteY, targetRadius - 3.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,.40)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(hitX) + 0.5, laneTop);
    ctx.lineTo(Math.round(hitX) + 0.5, laneBottom);
    ctx.stroke();
  }

  diff.addEventListener('change', () => {
    renderInvalidated = true;
    setTimeout(render, 0);
  });
  window.addEventListener('resize', measureViewport);
  window.addEventListener('orientationchange', measureViewport);
  const timelineResizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(measureViewport) : null;
  timelineResizeObserver?.observe(viewport);
  measureViewport();

  function frame() {
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
