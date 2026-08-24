(() => {
  'use strict';

  const input = document.getElementById('oszInput');
  const diff = document.getElementById('difficultySelect');
  const viewport = document.getElementById('timelineViewport');
  const seek = document.getElementById('seekBar');
  if (!input || !diff || !viewport || !seek || !window.JSZip) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'objectTimelineV2Canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:block',
    'pointer-events:none',
    'z-index:7',
    'background:transparent'
  ].join(';');
  viewport.appendChild(canvas);

  const FIXED_SPAN_MS = 1000;
  const MAX_CANVAS_DPR = 2;
  const DON = 'rgb(235,69,44)';
  const KA = 'rgb(68,141,171)';
  const LANE = '#121214';
  const LANE_HEIGHT = 80;

  let maps = [];
  let generation = 0;
  let renderInvalidated = true;
  let lastRenderedPositionMs = NaN;
  let lastRenderedMap = null;
  let lockedGeometry = null;
  let ctx = null;
  const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#0f1014';

  function parseMap(text) {
    const map = { mode: -1, hits: [] };
    let section = '';
    text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach(raw => {
      const line = raw.trim();
      if (!line || line.startsWith('//')) return;
      if (line[0] === '[' && line.endsWith(']')) { section = line; return; }

      if (section === '[General]' && line.startsWith('Mode:')) {
        map.mode = Number.parseInt(line.slice(5).trim(), 10);
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
          big: (sound & 4) !== 0,
        });
      }
    });
    map.hits.sort((a, b) => a.time - b.time);
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

  function lockGeometry() {
    if (lockedGeometry) return lockedGeometry;
    const rect = viewport.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;

    const width = Math.round(rect.width * 1000) / 1000;
    const height = Math.round(rect.height * 1000) / 1000;
    const dpr = Math.max(1, Math.min(MAX_CANVAS_DPR, window.devicePixelRatio || 1));

    lockedGeometry = { width, height, dpr };
    viewport.style.width = `${width}px`;
    viewport.style.height = `${height}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return lockedGeometry;
  }

  function currentPositionSec() {
    const value = Number(seek.value);
    return Number.isFinite(value) ? value : 0;
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

  function render(positionSec) {
    if (document.visibilityState === 'hidden') return;
    if (document.documentElement.classList.contains('orientation-blocked')) return;

    const geometry = lockGeometry();
    if (!geometry || !ctx) return;

    const map = activeMap();
    const durationMs = Number(seek.max) > 0 ? Number(seek.max) * 1000 : 0;
    const nowMs = Math.max(0, Number(positionSec) || 0) * 1000;
    if (!renderInvalidated && map === lastRenderedMap && Math.abs(nowMs - lastRenderedPositionMs) < 0.01) return;
    renderInvalidated = false;
    lastRenderedMap = map;
    lastRenderedPositionMs = nowMs;

    const { width, height } = geometry;
    ctx.clearRect(0, 0, width, height);
    if (!map || !map.hits.length || !(durationMs > 0)) return;

    const hitX = Math.max(50, Math.min(76, width * 0.16));
    const pxPerMs = width / FIXED_SPAN_MS;
    const rightTime = nowMs + (width - hitX) / pxPerMs;
    const xForTime = time => hitX + (time - nowMs) * pxPerMs;

    const laneHeight = Math.min(LANE_HEIGHT, Math.max(54, height - 24));
    const laneTop = Math.round((height - laneHeight) / 2);
    const laneBottom = laneTop + laneHeight;
    const noteY = laneTop + laneHeight * 0.50;
    const normalRadius = 14;
    const bigRadius = 17;

    ctx.fillStyle = surfaceColor;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = LANE;
    ctx.fillRect(0, laneTop, width, laneHeight);

    ctx.strokeStyle = 'rgba(255,255,255,.48)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, laneTop + 0.5);
    ctx.lineTo(width, laneTop + 0.5);
    ctx.moveTo(0, laneBottom + 0.5);
    ctx.lineTo(width, laneBottom + 0.5);
    ctx.stroke();

    const startIndex = lowerHit(map.hits, nowMs);
    for (let index = startIndex; index < map.hits.length; index++) {
      const hit = map.hits[index];
      if (hit.time > rightTime + 50) break;
      if (hit.time < nowMs) continue;

      const x = xForTime(hit.time);
      const radius = hit.big ? bigRadius : normalRadius;
      ctx.globalAlpha = 1;
      ctx.fillStyle = hit.kind === 'ka' ? KA : DON;
      ctx.strokeStyle = 'rgba(255,255,255,.96)';
      ctx.lineWidth = hit.big ? 2.6 : 2.1;
      ctx.beginPath();
      ctx.arc(x, noteY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (hit.big) {
        ctx.strokeStyle = 'rgba(255,255,255,.28)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(x, noteY, radius + 2.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

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
    render(currentPositionSec());
  });

  window.CreateSEObjectTimeline = Object.freeze({
    renderAt: positionSec => render(positionSec),
    invalidate: () => { renderInvalidated = true; },
    geometry: () => lockedGeometry ? { ...lockedGeometry } : null,
  });

  render(currentPositionSec());
})();