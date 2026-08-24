(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const SILENT_ID = '__SILENT__';
  const CUSTOM_ID_PATTERN = /^__CUSTOM_[1-4]__$/;
  const SELECTION_STORAGE_KEY = 'osutaiko-hitsound-lab:selection:current111-abc-v5';
  const previewAudio = document.getElementById('samplePreviewAudio');
  if (!CANDIDATES.length) return;

  const builtInById = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const customSources = new Map();
  const byId = id => customSources.get(id) || builtInById(id);
  const available = candidate => candidate && !candidate.excluded;
  const validSideId = id => id === null || id === SILENT_ID || customSources.has(id) || available(builtInById(id));
  const initialDon = CANDIDATES.find(candidate => available(candidate) && candidate.id === 'SRC093')?.id
    || CANDIDATES.find(available)?.id
    || SILENT_ID;
  const initialKat = CANDIDATES.find(candidate => available(candidate) && candidate.id === 'SRC097')?.id
    || CANDIDATES.find(available)?.id
    || SILENT_ID;

  function readPersistedSelection() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  const persistedSelection = readPersistedSelection();
  const restoreBuiltIn = (id, fallback) => id === SILENT_ID || available(builtInById(id)) ? id : fallback;
  const selection = {
    don: restoreBuiltIn(persistedSelection.don, initialDon),
    kat: restoreBuiltIn(persistedSelection.kat, initialKat),
  };

  let packPromise = null;
  const bytesCache = new Map();
  const bytesPromises = new Map();
  let applySerial = 0;
  let selectionSerial = 0;
  let previewSerial = 0;
  let previewUrl = '';
  let previewActive = false;
  const pendingSides = new Set();
  const silentBytes = makeSilentWav();

  function persistSelection() {
    persistedSelection.don = selection.don;
    persistedSelection.kat = selection.kat;
    try { localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection)); } catch {}
  }

  async function hitsoundPack() {
    if (!packPromise) {
      packPromise = (async () => {
        if (!window.JSZip) throw new Error('JSZipを読み込めません。');
        const response = await fetch('./hitsounds-current111-abc-v5.zip?v=64eb7144', { cache: 'force-cache' });
        if (!response.ok) throw new Error('Current111音パックを読み込めません。');
        return JSZip.loadAsync(await response.arrayBuffer());
      })().catch(error => {
        packPromise = null;
        throw error;
      });
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
    if (id === null || id === SILENT_ID) return silentBytes;
    const custom = customSources.get(id);
    if (custom) return custom.bytes;
    if (bytesCache.has(id)) return bytesCache.get(id);
    if (bytesPromises.has(id)) return bytesPromises.get(id);

    const candidate = builtInById(id);
    if (!available(candidate)) throw new Error('候補音源が見つかりません。');
    const promise = (async () => {
      const pack = await hitsoundPack();
      const entry = pack.file(candidate.entry);
      if (!entry) throw new Error(`Current111音パック内にありません: ${candidate.entry}`);
      const bytes = await entry.async('arraybuffer');
      bytesCache.set(id, bytes);
      return bytes;
    })().finally(() => bytesPromises.delete(id));
    bytesPromises.set(id, promise);
    return promise;
  }

  function audioCacheKey(id) {
    if (id === null || id === SILENT_ID) return 'silent';
    const source = byId(id);
    if (!customSources.has(id)) return `builtin:${id}`;
    return [
      'custom', id, source?.fingerprint || '', source?.lastModified || 0,
      source?.size || source?.bytes?.byteLength || 0,
    ].join(':');
  }

  function registerCustomSource(id, source) {
    if (!CUSTOM_ID_PATTERN.test(String(id))) throw new Error('ユーザー音源スロットが不正です。');
    const rawBytes = source?.bytes;
    let bytes = null;
    if (rawBytes instanceof ArrayBuffer) bytes = rawBytes;
    else if (ArrayBuffer.isView(rawBytes)) bytes = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength);
    if (!bytes?.byteLength) throw new Error('空の音源ファイルは追加できません。');

    const slot = Number(source?.slot);
    const safeName = String(source?.name || 'custom-sound.wav').split(/[\\/]/).pop().slice(0, 240);
    const entry = {
      id,
      name: safeName || 'custom-sound.wav',
      originalName: safeName || 'custom-sound.wav',
      sourceNumber: String(source?.sourceNumber || (Number.isInteger(slot) ? `M${slot}` : 'My')),
      family: 'My Sound',
      originalFamily: 'My Sound',
      type: String(source?.type || ''),
      lastModified: Number(source?.lastModified) || Date.now(),
      size: Number(source?.size) || bytes.byteLength,
      fingerprint: String(source?.fingerprint || ''),
      slot: Number.isInteger(slot) ? slot : null,
      custom: true,
      bytes,
    };
    customSources.set(id, entry);

    let restored = false;
    for (const side of ['don', 'kat']) {
      if (persistedSelection[side] === id && selection[side] !== id) {
        selection[side] = id;
        pendingSides.add(side);
        restored = true;
      }
    }
    if (restored) {
      persistSelection();
      emitSelection();
    }
    return { ...entry };
  }

  async function unregisterCustomSource(id) {
    if (!customSources.has(id)) return false;
    const affectedSides = ['don', 'kat'].filter(side => selection[side] === id);
    stopPreview();
    customSources.delete(id);

    if (affectedSides.length) {
      const serial = ++selectionSerial;
      affectedSides.forEach(side => {
        selection[side] = side === 'don' ? initialDon : initialKat;
        pendingSides.add(side);
      });
      persistSelection();
      emitSelection();
      await applyPendingSelection(serial);
    }
    return true;
  }

  function directViewerReady() {
    return typeof window.CreateSEViewer?.applyHitsoundBytes === 'function'
      && typeof window.CreateSEViewer?.applyHitsoundPairBytes === 'function';
  }

  async function applyOne(side, id) {
    if (!directViewerReady()) return false;
    const serial = ++applySerial;
    const bytes = await candidateBytes(id);
    if (serial !== applySerial) return false;
    return window.CreateSEViewer.applyHitsoundBytes(side, bytes, audioCacheKey(id));
  }

  async function applyPair() {
    if (!directViewerReady()) return false;
    const serial = ++applySerial;
    const donId = selection.don;
    const katId = selection.kat;
    const [donBytes, katBytes] = await Promise.all([
      candidateBytes(donId),
      candidateBytes(katId),
    ]);
    if (serial !== applySerial) return false;
    return window.CreateSEViewer.applyHitsoundPairBytes({
      don: { bytes: donBytes, cacheKey: audioCacheKey(donId) },
      kat: { bytes: katBytes, cacheKey: audioCacheKey(katId) },
    });
  }

  function emitSelection() {
    window.dispatchEvent(new CustomEvent('hitsound-selection-change', { detail: { ...selection } }));
  }

  function clearPreview({ reset = true } = {}) {
    if (!previewAudio) return;
    previewAudio.pause();
    if (reset) {
      try { previewAudio.currentTime = 0; } catch {}
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      previewAudio.removeAttribute('src');
    }
  }

  function stopPreview({ reset = true } = {}) {
    previewSerial++;
    window.CreateSEViewer?.stopHitsoundPreview?.();
    clearPreview({ reset });
  }

  async function previewCandidate(id, { waitUntilEnded = false, meta = null } = {}) {
    const directPreview = typeof window.CreateSEViewer?.previewHitsoundBytes === 'function';
    if ((!previewAudio && !directPreview) || id === null || id === SILENT_ID || !validSideId(id)) return false;

    const serial = ++previewSerial;
    const preparePromise = directPreview
      ? Promise.resolve(window.CreateSEViewer.prepareHitsoundAudio?.()).catch(() => null)
      : Promise.resolve();
    window.CreateSEViewer?.stopHitsoundPreview?.({ notify: false });
    clearPreview();
    const bytes = await candidateBytes(id);
    if (serial !== previewSerial) return false;

    if (directPreview) {
      await preparePromise;
      if (serial !== previewSerial) return false;
      const cacheKey = audioCacheKey(id);
      const started = await window.CreateSEViewer.previewHitsoundBytes(bytes, cacheKey, meta);
      if (!started || !waitUntilEnded) return !!started;
      await new Promise(resolve => {
        let timer = 0;
        const finish = event => {
          const detail = event?.detail || {};
          if (detail.playing || (detail.cacheKey && detail.cacheKey !== cacheKey)) return;
          clearTimeout(timer);
          window.removeEventListener('hitsound-preview-state', finish);
          resolve();
        };
        window.addEventListener('hitsound-preview-state', finish);
        timer = window.setTimeout(() => {
          window.removeEventListener('hitsound-preview-state', finish);
          resolve();
        }, 6000);
      });
      return true;
    }

    const source = byId(id);
    const type = customSources.has(id) ? (source?.type || '') : 'audio/wav';
    previewUrl = URL.createObjectURL(new Blob([bytes], { type }));
    previewAudio.src = previewUrl;
    previewAudio.currentTime = 0;
    await previewAudio.play();
    if (waitUntilEnded && serial === previewSerial && !previewAudio.ended) {
      await new Promise(resolve => {
        const finish = () => {
          previewAudio.removeEventListener('ended', finish);
          previewAudio.removeEventListener('pause', finish);
          previewAudio.removeEventListener('error', finish);
          resolve();
        };
        previewAudio.addEventListener('ended', finish, { once: true });
        previewAudio.addEventListener('pause', finish, { once: true });
        previewAudio.addEventListener('error', finish, { once: true });
        if (previewAudio.ended || previewAudio.paused || serial !== previewSerial) finish();
      });
    }
    return true;
  }

  async function togglePreview(side) {
    if (side !== 'don' && side !== 'kat') return false;
    return previewCandidate(selection[side], { meta: { origin: 'manual', side } });
  }

  async function applyPendingSelection(serial) {
    if (serial !== selectionSerial || !pendingSides.size || !directViewerReady()) return false;
    const sides = Array.from(pendingSides);
    sides.forEach(side => pendingSides.delete(side));
    if (sides.length === 1) await applyOne(sides[0], selection[sides[0]]);
    else await applyPair();
    return serial === selectionSerial;
  }

  async function setSide(side, id, { preview = false } = {}) {
    if (side !== 'don' && side !== 'kat') return false;
    if (!validSideId(id)) return false;

    if (selection[side] === id) {
      if (preview && id !== null && id !== SILENT_ID) await previewCandidate(id);
      return true;
    }

    const previousId = selection[side];
    const serial = ++selectionSerial;
    pendingSides.add(side);
    stopPreview();
    selection[side] = id;
    persistSelection();
    emitSelection();

    try {
      let previewTask = Promise.resolve(false);
      if (preview && id !== null && id !== SILENT_ID) {
        previewTask = previewCandidate(id, { meta: { origin: 'candidate', side } }).catch(previewError => {
          if (serial === selectionSerial) stopPreview();
          console.warn('音源の試聴は開始できませんでしたが、選択は反映します。', previewError);
          return false;
        });
      }
      if (serial === selectionSerial) await applyPendingSelection(serial);
      await previewTask;
      return true;
    } catch (error) {
      if (serial === selectionSerial) {
        pendingSides.delete(side);
        stopPreview();
        selection[side] = previousId;
        persistSelection();
        emitSelection();
      }
      throw error;
    }
  }

  async function setPair(donId, katId) {
    if (!validSideId(donId) || !validSideId(katId)) return false;
    if (selection.don === donId && selection.kat === katId) return true;

    const serial = ++selectionSerial;
    pendingSides.add('don');
    pendingSides.add('kat');
    selection.don = donId;
    selection.kat = katId;
    persistSelection();
    stopPreview();
    emitSelection();
    await applyPendingSelection(serial);
    return true;
  }

  previewAudio?.addEventListener('ended', () => {
    previewActive = false;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    previewAudio.removeAttribute('src');
  });
  previewAudio?.addEventListener('play', () => { previewActive = true; });
  previewAudio?.addEventListener('pause', () => {
    if (!window.CreateSEViewer?.previewHitsoundBytes) previewActive = false;
  });
  window.addEventListener('hitsound-preview-state', event => {
    previewActive = !!event.detail?.playing;
  });

  window.addEventListener('viewer-ready', () => {
    applyPair().then(() => pendingSides.clear()).catch(error => console.warn(error));
  });

  window.addEventListener('beforeunload', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  function warmCurrentSelection() {
    hitsoundPack()
      .then(() => Promise.allSettled([
        candidateBytes(selection.don),
        candidateBytes(selection.kat),
      ]))
      .catch(() => {});
  }

  window.HitsoundController = {
    SILENT_ID,
    SELECTION_STORAGE_KEY,
    byId,
    isValidSideId: validSideId,
    getSelection: () => ({ ...selection }),
    registerCustomSource,
    unregisterCustomSource,
    setSide,
    setPair,
    applyPair,
    previewCandidate,
    togglePreview,
    stopPreview,
    isPreviewing: () => previewActive,
  };

  emitSelection();
  if (document.readyState === 'complete') window.setTimeout(warmCurrentSelection, 0);
  else window.addEventListener('load', () => window.setTimeout(warmCurrentSelection, 0), { once: true });
})();