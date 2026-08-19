(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const controller = window.HitsoundController;
  const favorites = window.HitsoundFavorites;
  const $ = id => document.getElementById(id);
  const grid = $('hitsoundGrid');
  const sources = $('hitsoundSources');
  const roleDonButton = $('roleDonButton');
  const roleKatButton = $('roleKatButton');
  const silentButton = $('silentButton');
  const previewButton = $('previewButton');
  const songPlayButton = $('playButton');
  const recommendationLine = $('recommendationLine');

  if (!CANDIDATES.length || !controller || !favorites || !grid || !sources || !roleDonButton || !roleKatButton) return;

  const SILENT_ID = controller.SILENT_ID;
  const PIN_STORAGE_KEY = 'osutaiko-hitsound-lab:pinned-sources:v1';
  const LONG_PRESS_MS = 520;
  const MOVE_TOLERANCE_PX = 11;
  const validCandidateIds = new Set(CANDIDATES.filter(candidate => !candidate.excluded).map(candidate => candidate.id));
  let activeSide = 'don';
  let pressState = null;
  let suppressClickFor = null;

  const familyOf = candidate => candidate?.originalFamily || candidate?.family || 'Other';
  const displayFamily = candidate => familyOf(candidate) === '808 / Sub' ? 'Bass Drum / Kick' : familyOf(candidate);
  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;

  function readPinnedIds() {
    try {
      const saved = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) || '[]');
      return new Set(Array.isArray(saved) ? saved.filter(id => validCandidateIds.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  const pinnedIds = readPinnedIds();

  function savePinnedIds() {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(Array.from(pinnedIds)));
    } catch {}
  }

  const preferredOrder = [
    'Bass Drum / Kick',
    'Tom',
    'Timbale',
    'Rimshot',
    'Cowbell',
    'Agogo',
    'Woodblock',
    'Clave / Claves',
    'Hi-Hat',
  ];

  function groupedCandidates() {
    const groups = new Map();
    for (const candidate of CANDIDATES) {
      if (candidate.excluded) continue;
      const family = displayFamily(candidate);
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family).push(candidate);
    }

    for (const list of groups.values()) {
      list.sort((a, b) =>
        Number(a.sourceNumber) - Number(b.sourceNumber) ||
        (a.pitch ?? Number.POSITIVE_INFINITY) - (b.pitch ?? Number.POSITIVE_INFINITY)
      );
    }

    const orderIndex = family => {
      const preferred = preferredOrder.indexOf(family);
      return preferred >= 0 ? preferred : preferredOrder.length + 1;
    };

    return Array.from(groups.entries()).sort((a, b) => {
      const ao = orderIndex(a[0]), bo = orderIndex(b[0]);
      if (ao !== bo) return ao - bo;
      const ap = Math.min(...a[1].map(candidate => candidate.pitch ?? Number.POSITIVE_INFINITY));
      const bp = Math.min(...b[1].map(candidate => candidate.pitch ?? Number.POSITIVE_INFINITY));
      return ap - bp || a[0].localeCompare(b[0]);
    });
  }

  function candidateLabel(candidate) {
    return `${candidate.sourceNumber} ${candidate.originalName || candidate.name || ''}`.trim();
  }

  function pinHint(candidate) {
    return `${candidateLabel(candidate)} · 長押しでピン留め${pinnedIds.has(candidate.id) ? '解除' : ''}`;
  }

  function keyMarkup(candidate) {
    const source = String(candidate.originalName || candidate.name || '');
    const pitch = Number.isFinite(candidate.pitch) ? `${candidate.pitch.toFixed(1)} Hz` : '';
    const pinned = pinnedIds.has(candidate.id);
    return `<button class="hs-key${pinned ? ' pinned' : ''}" type="button" data-hs-id="${candidate.id}" title="${source}${pitch ? ` · ${pitch}` : ''} · 長押しでピン留め${pinned ? '解除' : ''}" aria-label="${pinHint(candidate)}" data-base-label="${candidateLabel(candidate)}"><span>${candidate.sourceNumber}</span></button>`;
  }

  function buildGrid() {
    const groups = groupedCandidates();
    sources.innerHTML = groups.map(([family, candidates]) => `
      <section class="hs-family" data-family="${family}">
        <div class="hs-family-title">${family}</div>
        <div class="hs-family-grid">${candidates.map(keyMarkup).join('')}</div>
      </section>
    `).join('');
  }

  function paintPinnedButton(button) {
    const id = button?.dataset.hsId;
    const candidate = byId(id);
    if (!button || !candidate) return;
    const pinned = pinnedIds.has(id);
    const source = String(candidate.originalName || candidate.name || '');
    const pitch = Number.isFinite(candidate.pitch) ? `${candidate.pitch.toFixed(1)} Hz` : '';
    button.classList.toggle('pinned', pinned);
    button.setAttribute('aria-label', pinHint(candidate));
    button.setAttribute('aria-description', pinned ? 'ピン留め中。長押しで解除できます。' : '長押しでピン留めできます。');
    button.title = `${source}${pitch ? ` · ${pitch}` : ''} · 長押しでピン留め${pinned ? '解除' : ''}`;
  }

  function togglePin(button) {
    const id = button?.dataset.hsId;
    if (!validCandidateIds.has(id)) return;
    if (pinnedIds.has(id)) pinnedIds.delete(id);
    else pinnedIds.add(id);
    savePinnedIds();
    paintPinnedButton(button);
    button.classList.remove('pin-pulse');
    void button.offsetWidth;
    button.classList.add('pin-pulse');
    setTimeout(() => button.classList.remove('pin-pulse'), 360);
  }

  function paintRecommendation() {
    if (!recommendationLine) return;
    const ids = favorites.recommendedFor(activeSide, controller.getSelection());
    const numbers = ids
      .map(byId)
      .filter(candidate => candidate && !candidate.excluded)
      .sort((a, b) => Number(a.sourceNumber) - Number(b.sourceNumber))
      .map(candidate => candidate.sourceNumber);
    recommendationLine.textContent = `推奨：${numbers.length ? numbers.join(' ') : '—'}`;
  }

  function paint() {
    const selection = controller.getSelection();

    roleDonButton.classList.toggle('target', activeSide === 'don');
    roleKatButton.classList.toggle('target', activeSide === 'kat');
    roleDonButton.setAttribute('aria-pressed', activeSide === 'don' ? 'true' : 'false');
    roleKatButton.setAttribute('aria-pressed', activeSide === 'kat' ? 'true' : 'false');
    roleDonButton.title = selection.don === SILENT_ID ? 'Don: 無音' : `Don: ${byId(selection.don)?.sourceNumber || '—'}`;
    roleKatButton.title = selection.kat === SILENT_ID ? 'Kat: 無音' : `Kat: ${byId(selection.kat)?.sourceNumber || '—'}`;

    grid.dataset.activeSide = activeSide;
    sources.querySelectorAll('.hs-key[data-hs-id]').forEach(button => {
      const id = button.dataset.hsId;
      button.classList.toggle('selected-don', id === selection.don);
      button.classList.toggle('selected-kat', id === selection.kat);
      paintPinnedButton(button);
    });

    if (silentButton) {
      silentButton.classList.toggle('selected-don', activeSide === 'don' && selection.don === SILENT_ID);
      silentButton.classList.toggle('selected-kat', activeSide === 'kat' && selection.kat === SILENT_ID);
    }

    paintRecommendation();
  }

  function syncSongTransportButton() {
    if (!previewButton) return;
    const face = previewButton.querySelector('span') || previewButton;
    const playing = !!songPlayButton && !songPlayButton.disabled && songPlayButton.textContent.trim() !== '▶';
    face.textContent = playing ? 'Ⅱ' : '▶';
    previewButton.disabled = !songPlayButton || songPlayButton.disabled;
    previewButton.setAttribute('aria-pressed', playing ? 'true' : 'false');
    previewButton.setAttribute('aria-label', playing ? '曲を一時停止' : '曲を再生');
  }

  async function chooseSound(id) {
    const current = controller.getSelection()[activeSide];
    const deselecting = current === id;
    const nextId = deselecting ? null : id;
    try {
      await controller.setSide(activeSide, nextId, { preview: !deselecting });
    } finally {
      paint();
    }
  }

  async function chooseSilent() {
    try {
      await controller.setSide(activeSide, SILENT_ID);
    } finally {
      paint();
    }
  }

  function setActiveSide(side) {
    if (side !== 'don' && side !== 'kat') return;
    controller.stopPreview();
    activeSide = side;
    paint();
  }

  function clearPressTimer() {
    if (pressState?.timer) clearTimeout(pressState.timer);
    if (pressState) pressState.timer = 0;
  }

  function finishPress(event, cancelled = false) {
    if (!pressState || (event?.pointerId != null && event.pointerId !== pressState.pointerId)) return;
    const releasedButton = pressState.button;
    const wasLongPress = pressState.longPressed;
    clearPressTimer();
    if (cancelled) pressState.cancelled = true;
    if (wasLongPress) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      setTimeout(() => {
        if (suppressClickFor === releasedButton) suppressClickFor = null;
      }, 900);
    }
    pressState = null;
  }

  roleDonButton.addEventListener('click', () => setActiveSide('don'));
  roleKatButton.addEventListener('click', () => setActiveSide('kat'));
  silentButton?.addEventListener('click', () => chooseSilent().catch(error => alert(error.message)));
  previewButton?.addEventListener('click', () => {
    if (!songPlayButton?.disabled) songPlayButton.click();
  });

  if (songPlayButton && previewButton) {
    new MutationObserver(syncSongTransportButton).observe(songPlayButton, {
      attributes: true,
      attributeFilter: ['disabled'],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  sources.addEventListener('pointerdown', event => {
    const button = event.target.closest('.hs-key[data-hs-id]');
    if (!button || sources.classList.contains('busy')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    finishPress(null, true);
    pressState = {
      button,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      longPressed: false,
      cancelled: false,
      timer: 0,
    };
    button.setPointerCapture?.(event.pointerId);
    pressState.timer = setTimeout(() => {
      if (!pressState || pressState.button !== button || pressState.cancelled) return;
      pressState.longPressed = true;
      suppressClickFor = button;
      togglePin(button);
      if (navigator.vibrate) navigator.vibrate(12);
    }, LONG_PRESS_MS);
  });

  sources.addEventListener('pointermove', event => {
    if (!pressState || event.pointerId !== pressState.pointerId || pressState.longPressed) return;
    const dx = event.clientX - pressState.startX;
    const dy = event.clientY - pressState.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
      pressState.cancelled = true;
      clearPressTimer();
    }
  });

  sources.addEventListener('pointerup', event => finishPress(event));
  sources.addEventListener('pointercancel', event => finishPress(event, true));
  sources.addEventListener('lostpointercapture', event => finishPress(event, true));
  sources.addEventListener('contextmenu', event => {
    if (event.target.closest('.hs-key[data-hs-id]')) event.preventDefault();
  });

  sources.addEventListener('click', event => {
    const button = event.target.closest('.hs-key[data-hs-id]');
    if (!button || sources.classList.contains('busy')) return;
    if (suppressClickFor === button) {
      suppressClickFor = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    chooseSound(button.dataset.hsId).catch(error => alert(error.message));
  });

  window.addEventListener('hitsound-selection-change', paint);

  buildGrid();
  paint();
  syncSongTransportButton();
})();
