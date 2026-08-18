(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const SILENT_ID = '__SILENT__';
  const $ = id => document.getElementById(id);

  const el = {
    donInput: $('donHitsoundInput'),
    katInput: $('kaHitsoundInput'),
    previewAudio: $('samplePreviewAudio'),
    previewButton: $('previewButton'),
    status: $('statusBadge'),
    play: $('playButton'),
    oszInput: $('oszInput'),
  };

  if (!CANDIDATES.length || !el.donInput || !el.katInput) return;

  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const available = candidate => candidate && !candidate.excluded;
  const initialDon = CANDIDATES.find(candidate => available(candidate) && candidate.originalName === 'RnT_Timbale-02.wav')?.id
    || CANDIDATES.find(available)?.id
    || SILENT_ID;
  const initialKat = CANDIDATES.find(candidate => available(candidate) && candidate.originalName === 'RnT_Timbale-06.wav')?.id
    || CANDIDATES.find(available)?.id
    || SILENT_ID;

  const selection = { don: initialDon, kat: initialKat };
  let packPromise = null;
  const bytesCache = new Map();
  let applySerial = 0;
  let previewUrl = '';
  let previewSide = null;

  async function hitsoundPack() {
    if (!packPromise) {
      packPromise = (async () => {
        if (!window.JSZip) throw new Error('JSZipを読み込めません。');
        const response = await fetch('./hitsounds.zip', { cache: 'force-cache' });
        if (!response.ok) throw new Error('hitsounds.zip を読み込めません。');
        return JSZip.loadAsync(await response.arrayBuffer());
      })();
    }
    return packPromise;
  }

  function makeSilentWav() {
    const sampleRate = 48000;
    const frames = 480;
    const channels = 1;
    const bits = 16;
    const blockAlign = channels * bits / 8;
    const byteRate = sampleRate * blockAlign;
    const dataBytes = frames * blockAlign;
    const buffer = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buffer);
    const writeText = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };

    writeText(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bits, true);
    writeText(36, 'data');
    view.setUint32(40, dataBytes, true);
    return buffer;
  }

  async function candidateBytes(id) {
    if (id === SILENT_ID) return makeSilentWav();
    if (bytesCache.has(id)) return bytesCache.get(id).slice(0);

    const candidate = byId(id);
    if (!available(candidate)) throw new Error('候補音源が見つかりません。');
    const pack = await hitsoundPack();
    const entry = pack.file(candidate.entry);
    if (!entry) throw new Error(`hitsounds.zip 内にありません: ${candidate.entry}`);
    const bytes = await entry.async('arraybuffer');
    bytesCache.set(id, bytes);
    return bytes.slice(0);
  }

  function fileFor(id, bytes) {
    const candidate = byId(id);
    const name = id === SILENT_ID ? 'silent.wav' : (candidate?.name || 'hitsound.wav');
    return new File([bytes], name, { type: 'audio/wav', lastModified: Date.now() });
  }

  function setInputFile(input, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  }

  function viewerReady() {
    return (el.status?.textContent || '') === '準備完了' && !!el.play && !el.play.disabled;
  }

  function wasPlaying() {
    return !!el.play && !el.play.disabled && el.play.textContent.trim() !== '▶';
  }

  async function waitForViewerReady(timeoutMs = 30000) {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (viewerReady()) return true;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return false;
  }

  async function waitForRebuild(serial, timeoutMs = 15000) {
    const start = performance.now();
    while (serial === applySerial && performance.now() - start < timeoutMs) {
      const elapsed = performance.now() - start;
      if (elapsed >= 120 && viewerReady()) return true;
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    return false;
  }

  async function applyOne(side, id, { resume = true } = {}) {
    if (!viewerReady()) return false;

    const input = side === 'don' ? el.donInput : el.katInput;
    const serial = ++applySerial;
    const resumeAfter = resume && wasPlaying();
    const bytes = await candidateBytes(id);
    if (serial !== applySerial) return false;

    setInputFile(input, fileFor(id, bytes));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    if (resumeAfter) {
      const ready = await waitForRebuild(serial);
      if (ready && serial === applySerial && el.play?.textContent.trim() === '▶') el.play.click();
    }
    return true;
  }

  async function applyPair({ resume = false } = {}) {
    if (!viewerReady()) return false;

    const serial = ++applySerial;
    const resumeAfter = resume && wasPlaying();
    const [donBytes, katBytes] = await Promise.all([
      candidateBytes(selection.don),
      candidateBytes(selection.kat),
    ]);
    if (serial !== applySerial) return false;

    setInputFile(el.donInput, fileFor(selection.don, donBytes));
    el.donInput.dispatchEvent(new Event('change', { bubbles: true }));
    if (!(await waitForRebuild(serial))) return false;

    setInputFile(el.katInput, fileFor(selection.kat, katBytes));
    el.katInput.dispatchEvent(new Event('change', { bubbles: true }));
    if (!(await waitForRebuild(serial))) return false;

    if (resumeAfter && serial === applySerial && el.play?.textContent.trim() === '▶') el.play.click();
    return true;
  }

  function emitSelection() {
    window.dispatchEvent(new CustomEvent('hitsound-selection-change', { detail: { ...selection } }));
  }

  function previewFace() {
    return el.previewButton?.querySelector('span') || el.previewButton;
  }

  function paintPreview() {
    const playing = !!el.previewAudio && !el.previewAudio.paused && !el.previewAudio.ended;
    const face = previewFace();
    if (face) face.textContent = playing ? 'Ⅱ' : '▶';
  }

  function stopPreview({ reset = true } = {}) {
    if (!el.previewAudio) return;
    el.previewAudio.pause();
    if (reset) {
      try { el.previewAudio.currentTime = 0; } catch {}
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      previewSide = null;
      el.previewAudio.removeAttribute('src');
    }
    paintPreview();
  }

  async function togglePreview(side) {
    if (!el.previewAudio || (side !== 'don' && side !== 'kat')) return;

    if (previewSide === side && el.previewAudio.src) {
      if (!el.previewAudio.paused && !el.previewAudio.ended) {
        el.previewAudio.pause();
        paintPreview();
        return;
      }
      if (!el.previewAudio.ended) {
        await el.previewAudio.play();
        paintPreview();
        return;
      }
    }

    stopPreview();
    const id = selection[side];
    const bytes = await candidateBytes(id);
    previewUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    previewSide = side;
    el.previewAudio.src = previewUrl;
    el.previewAudio.currentTime = 0;
    await el.previewAudio.play();
    paintPreview();
  }

  async function setSide(side, id) {
    if (side !== 'don' && side !== 'kat') return false;
    const candidate = id === SILENT_ID ? null : byId(id);
    if (id !== SILENT_ID && !available(candidate)) return false;
    if (selection[side] === id) return true;

    selection[side] = id;
    if (previewSide === side) stopPreview();
    emitSelection();

    if (viewerReady()) await applyOne(side, id, { resume: true });
    return true;
  }

  el.previewAudio?.addEventListener('play', paintPreview);
  el.previewAudio?.addEventListener('pause', paintPreview);
  el.previewAudio?.addEventListener('ended', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    previewSide = null;
    paintPreview();
  });

  el.oszInput?.addEventListener('change', async () => {
    if (!(await waitForViewerReady())) return;
    try {
      await applyPair({ resume: false });
    } catch (error) {
      console.warn(error);
      if (el.status) el.status.textContent = 'hitsounds.zip待ち';
    }
  });

  window.addEventListener('beforeunload', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  window.HitsoundController = {
    SILENT_ID,
    byId,
    getSelection: () => ({ ...selection }),
    setSide,
    applyPair,
    togglePreview,
    stopPreview,
  };

  emitSelection();
  paintPreview();
})();
