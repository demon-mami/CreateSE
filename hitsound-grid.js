(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const controller = window.HitsoundController;
  const favorites = window.HitsoundFavorites;
  const $ = id => document.getElementById(id);
  const grid = $('hitsoundGrid');
  const sources = $('hitsoundSources');
  const categorySelect = $('hitsoundCategorySelect');
  const pinnedPanel = $('pinnedSourcesPanel');
  const pinnedList = $('pinnedSourcesList');
  const roleDonButton = $('roleDonButton');
  const roleKatButton = $('roleKatButton');
  const silentButton = $('silentButton');
  const previewButton = $('previewButton');
  const songPlayButton = $('playButton');
  const recommendationLine = $('recommendationLine');

  if (
    !CANDIDATES.length || !controller || !favorites || !grid || !sources || !categorySelect ||
    !pinnedPanel || !pinnedList || !roleDonButton || !roleKatButton
  ) return;

  const SILENT_ID = controller.SILENT_ID;
  const PIN_STORAGE_KEY = 'osutaiko-hitsound-lab:pinned-sources:v1';
  const CATEGORY_STORAGE_KEY = 'osutaiko-hitsound-lab:source-category:v1';
  const RECOMMENDED_CATEGORY = '__RECOMMENDED__';
  const ALL_CATEGORY = '__ALL__';
  const LONG_PRESS_MS = 520;
  const MOVE_TOLERANCE_PX = 11;
  const validCandidateIds = new Set(CANDIDATES.filter(candidate => !candidate.excluded).map(candidate => candidate.id));
  let activeSide = 'don';
  let activeCategory = '';
  let pressState = null;
  let suppressClickFor = null;

  const familyOf = candidate => candidate?.originalFamily || candidate?.family || 'Other';
  const displayFamily = candidate => familyOf(candidate) === '808 / Sub' ? 'Bass Drum / Kick' : familyOf(candidate);
  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);

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

  function saveActiveCategory() {
    try {
      localStorage.setItem(CATEGORY_STORAGE_KEY, activeCategory);
    } catch {}
  }

  const preferredOrder = [
    'Bass Drum / Kick',
    'Tom',
    'Timbale',
    'Rimshot',
    'Snare',
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

  function recommendedIds(selection = controller.getSelection()) {
    return new Set(
      favorites.recommendedFor(activeSide, selection)
        .filter(id => validCandidateIds.has(id))
    );
  }

  function candidateLabel(candidate) {
    return `${candidate.sourceNumber} ${candidate.originalName || candidate.name || ''}`.trim();
  }

  function pinHint(candidate, recommended = false) {
    const state = pinnedIds.has(candidate.id) ? '解除' : '';
    return `${candidateLabel(candidate)}${recommended ? ' · 推奨' : ''} · 長押しでピン留め${state}`;
  }

  function keyMarkup(candidate, recommended = recommendedIds().has(candidate.id)) {
    const source = String(candidate.originalName || candidate.name || '');
    const pitch = Number.isFinite(candidate.pitch) ? `${candidate.pitch.toFixed(1)} Hz` : '';
    const pinned = pinnedIds.has(candidate.id);
    const title = `${source}${pitch ? ` · ${pitch}` : ''} · 長押しでピン留め${pinned ? '解除' : ''}`;
    return `<button class="hs-key${pinned ? ' pinned' : ''}${recommended ? ' recommended' : ''}" type="button" data-hs-id="${escapeHtml(candidate.id)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(pinHint(candidate, recommended))}" data-base-label="${escapeHtml(candidateLabel(candidate))}"><span><span class="hs-key-number">${escapeHtml(candidate.sourceNumber)}</span><span class="hs-recommended-mark" aria-hidden="true"${recommended ? '' : ' hidden'}>♥</span></span></button>`;
  }

  function initialCategory(groups) {
    const allowed = new Set([RECOMMENDED_CATEGORY, ALL_CATEGORY, ...groups.map(([family]) => family)]);
    try {
      const saved = localStorage.getItem(CATEGORY_STORAGE_KEY) || '';
      if (allowed.has(saved)) return saved;
    } catch {}

    const current = controller.getSelection()[activeSide];
    const currentFamily = displayFamily(byId(current));
    if (allowed.has(currentFamily)) return currentFamily;
    return groups[0]?.[0] || ALL_CATEGORY;
  }

  function buildCategorySelect() {
    const groups = groupedCandidates();
    activeCategory = initialCategory(groups);
    const total = groups.reduce((sum, [, candidates]) => sum + candidates.length, 0);
    categorySelect.innerHTML = [
      `<option value="${RECOMMENDED_CATEGORY}">♥ 推奨</option>`,
      ...groups.map(([family, candidates]) => `<option value="${escapeHtml(family)}">${escapeHtml(family)} (${candidates.length})</option>`),
      `<option value="${ALL_CATEGORY}">すべて (${total})</option>`,
    ].join('');
    categorySelect.value = activeCategory;
  }

  function updateRecommendedOption(recommended) {
    const option = Array.from(categorySelect.options).find(item => item.value === RECOMMENDED_CATEGORY);
    if (option) option.textContent = `♥ 推奨 (${recommended.size})`;
  }

  function renderCategorySources(recommended = recommendedIds()) {
    const groups = groupedCandidates();

    if (activeCategory === RECOMMENDED_CATEGORY) {
      const candidates = CANDIDATES
        .filter(candidate => !candidate.excluded && recommended.has(candidate.id))
        .sort((a, b) => Number(a.sourceNumber) - Number(b.sourceNumber));
      sources.innerHTML = candidates.length
        ? `<section class="hs-family"><div class="hs-family-grid">${candidates.map(candidate => keyMarkup(candidate, true)).join('')}</div></section>`
        : '<div class="hs-category-empty">現在の組み合わせに推奨候補はありません</div>';
      return;
    }

    if (activeCategory === ALL_CATEGORY) {
      sources.innerHTML = groups.map(([family, candidates]) => `
        <section class="hs-family" data-family="${escapeHtml(family)}">
          <div class="hs-family-title">${escapeHtml(family)}</div>
          <div class="hs-family-grid">${candidates.map(candidate => keyMarkup(candidate, recommended.has(candidate.id))).join('')}</div>
        </section>
      `).join('');
      return;
    }

    const candidates = groups.find(([family]) => family === activeCategory)?.[1] || [];
    sources.innerHTML = candidates.length
      ? `<section class="hs-family" data-family="${escapeHtml(activeCategory)}"><div class="hs-family-grid">${candidates.map(candidate => keyMarkup(candidate, recommended.has(candidate.id))).join('')}</div></section>`
      : '<div class="hs-category-empty">このカテゴリーに音源はありません</div>';
  }

  function renderPinnedSources(recommended = recommendedIds()) {
    const candidates = Array.from(pinnedIds)
      .map(byId)
      .filter(candidate => candidate && !candidate.excluded);
    pinnedPanel.hidden = candidates.length === 0;
    pinnedList.innerHTML = candidates.map(candidate => keyMarkup(candidate, recommended.has(candidate.id))).join('');
  }

  function paintSourceButton(button, selection, recommended) {
    const id = button?.dataset.hsId;
    const candidate = byId(id);
    if (!button || !candidate) return;
    const pinned = pinnedIds.has(id);
    const isRecommended = recommended.has(id);
    const source = String(candidate.originalName || candidate.name || '');
    const pitch = Number.isFinite(candidate.pitch) ? `${candidate.pitch.toFixed(1)} Hz` : '';

    button.classList.toggle('pinned', pinned);
    button.classList.toggle('recommended', isRecommended);
    button.classList.toggle('selected-don', id === selection.don);
    button.classList.toggle('selected-kat', id === selection.kat);
    button.querySelector('.hs-recommended-mark')?.toggleAttribute('hidden', !isRecommended);
    button.setAttribute('aria-label', pinHint(candidate, isRecommended));
    button.setAttribute('aria-description', pinned ? 'ピン留め中。長押しで解除できます。' : '長押しでピン留めできます。');
    button.title = `${source}${pitch ? ` · ${pitch}` : ''} · 長押しでピン留め${pinned ? '解除' : ''}`;
  }

  function pulsePin(button) {
    if (!button?.isConnected) return;
    button.classList.remove('pin-pulse');
    void button.offsetWidth;
    button.classList.add('pin-pulse');
    setTimeout(() => button.classList.remove('pin-pulse'), 360);
  }

  function togglePin(button) {
    const id = button?.dataset.hsId;
    if (!validCandidateIds.has(id)) return;
    if (pinnedIds.has(id)) pinnedIds.delete(id);
    else pinnedIds.add(id);
    savePinnedIds();
    pulsePin(button);
    renderPinnedSources();
    paint();
  }

  function paintRecommendation(recommended) {
    if (!recommendationLine) return;
    const numbers = Array.from(recommended)
      .map(byId)
      .filter(candidate => candidate && !candidate.excluded)
      .sort((a, b) => Number(a.sourceNumber) - Number(b.sourceNumber))
      .map(candidate => candidate.sourceNumber);
    recommendationLine.textContent = `♥ 推奨：${numbers.length ? numbers.join(' ') : '—'}`;
  }

  function sideTitle(label, id) {
    if (id === null) return `${label}: 未選択`;
    if (id === SILENT_ID) return `${label}: 無音`;
    return `${label}: ${byId(id)?.sourceNumber || '—'}`;
  }

  function paint() {
    const selection = controller.getSelection();
    const recommended = recommendedIds(selection);

    roleDonButton.classList.toggle('target', activeSide === 'don');
    roleKatButton.classList.toggle('target', activeSide === 'kat');
    roleDonButton.setAttribute('aria-pressed', activeSide === 'don' ? 'true' : 'false');
    roleKatButton.setAttribute('aria-pressed', activeSide === 'kat' ? 'true' : 'false');
    roleDonButton.title = sideTitle('Don', selection.don);
    roleKatButton.title = sideTitle('Kat', selection.kat);

    grid.dataset.activeSide = activeSide;
    updateRecommendedOption(recommended);
    if (activeCategory === RECOMMENDED_CATEGORY) renderCategorySources(recommended);

    grid.querySelectorAll('.hs-key[data-hs-id]').forEach(button => {
      paintSourceButton(button, selection, recommended);
    });

    if (silentButton) {
      silentButton.classList.toggle('selected-don', activeSide === 'don' && selection.don === SILENT_ID);
      silentButton.classList.toggle('selected-kat', activeSide === 'kat' && selection.kat === SILENT_ID);
    }

    paintRecommendation(recommended);
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
  categorySelect.addEventListener('change', () => {
    activeCategory = categorySelect.value;
    saveActiveCategory();
    renderCategorySources();
    paint();
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

  grid.addEventListener('pointerdown', event => {
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

  grid.addEventListener('pointermove', event => {
    if (!pressState || event.pointerId !== pressState.pointerId || pressState.longPressed) return;
    const dx = event.clientX - pressState.startX;
    const dy = event.clientY - pressState.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
      pressState.cancelled = true;
      clearPressTimer();
    }
  });

  grid.addEventListener('pointerup', event => finishPress(event));
  grid.addEventListener('pointercancel', event => finishPress(event, true));
  grid.addEventListener('lostpointercapture', event => finishPress(event, true));
  grid.addEventListener('contextmenu', event => {
    if (event.target.closest('.hs-key[data-hs-id]')) event.preventDefault();
  });

  grid.addEventListener('click', event => {
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
  window.addEventListener('storage', event => {
    if (event.key === PIN_STORAGE_KEY) {
      const latest = readPinnedIds();
      pinnedIds.clear();
      latest.forEach(id => pinnedIds.add(id));
      renderPinnedSources();
      paint();
    }
  });

  buildCategorySelect();
  renderCategorySources();
  renderPinnedSources();
  paint();
  syncSongTransportButton();
})();
