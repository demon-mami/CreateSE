(() => {
  'use strict';

  const controller = window.HitsoundController;
  if (!controller) return;

  const $ = id => document.getElementById(id);
  const SILENT_ID = controller.SILENT_ID;
  const POSITION_KEY = 'osutaiko-hitsound-lab:candidate-position:v1';
  const LAST_SOUND_KEY = 'osutaiko-hitsound-lab:last-non-silent:v1';
  const sourcePanel = document.querySelector('.source-panel');
  const auditionPanel = $('auditionPanel');
  const dockMini = auditionPanel?.querySelector('.dock-mini');
  const dockToggle = $('dockToggleButton');
  const dockCollapse = $('dockCollapseButton');
  const roleDon = $('roleDonButton');
  const roleKat = $('roleKatButton');
  const favoriteSheet = $('favoriteSheet');
  const favoriteDialog = $('savedSetsPanel');
  const favoriteOpen = $('favoriteOpenButton');
  const favoriteClose = $('favoriteCloseButton');
  const timeDisplay = $('timeDisplay');
  const miniTime = $('miniTimeDisplay');
  const playButton = $('playButton');
  const miniPlay = $('previewButton');
  const samplePreview = $('samplePreviewAudio');
  const workbenchStatus = $('workbenchStatus');
  let activeSide = 'don';
  let favoriteReturnFocus = null;
  let savePositionTimer = 0;
  let swipeStart = null;
  let previewingSide = null;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch { return fallback; }
  }

  const lastNonSilent = readJson(LAST_SOUND_KEY, {});

  function saveLastNonSilent() {
    try { localStorage.setItem(LAST_SOUND_KEY, JSON.stringify(lastNonSilent)); } catch {}
  }

  function sourceLabel(id) {
    if (!id || id === SILENT_ID) return { number: '無音', name: '無音', family: 'Silent' };
    const source = controller.byId(id);
    return {
      number: String(source?.sourceNumber || '—'),
      name: String(source?.originalName || source?.name || '音源未登録'),
      family: String(source?.originalFamily || source?.family || ''),
    };
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value;
  }

  function syncSelection() {
    const selection = controller.getSelection();
    for (const side of ['don', 'kat']) {
      const id = selection[side];
      if (id && id !== SILENT_ID) lastNonSilent[side] = id;
      const label = sourceLabel(id);
      const cap = side === 'don' ? 'Don' : 'Kat';
      setText(`mini${cap}Value`, label.number);
      setText(`current${cap}Value`, label.number);
      setText(`current${cap}Meta`, `${label.family}${label.family ? ' · ' : ''}${label.name}`);
      const muted = id === SILENT_ID;
      const mute = $(`mute${cap}Button`);
      if (mute) {
        mute.setAttribute('aria-pressed', muted ? 'true' : 'false');
        mute.textContent = muted && lastNonSilent[side] ? `${cap}を戻す` : `${cap}を無音`;
      }
      const preview = $(`preview${cap}Button`);
      if (preview) {
        preview.disabled = muted || !id;
        preview.setAttribute('aria-label', muted ? `${cap}は無音です` : `${cap} ${label.number} を単音試聴`);
      }
    }
    saveLastNonSilent();
    syncActiveSide();
  }

  function syncActiveSide() {
    const donActive = activeSide === 'don';
    for (const [id, active] of [
      ['miniDonTarget', donActive], ['miniKatTarget', !donActive],
      ['currentDonTarget', donActive], ['currentKatTarget', !donActive],
    ]) {
      const button = $(id);
      if (button) button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    $('currentDonCard')?.classList.toggle('active', donActive);
    $('currentKatCard')?.classList.toggle('active', !donActive);
  }

  function chooseSide(side) {
    (side === 'don' ? roleDon : roleKat)?.click();
  }

  async function toggleMute(side) {
    const current = controller.getSelection()[side];
    const next = current === SILENT_ID && lastNonSilent[side] ? lastNonSilent[side] : SILENT_ID;
    try {
      await controller.setSide(side, next);
      if (workbenchStatus) workbenchStatus.textContent = next === SILENT_ID ? `${side === 'don' ? 'Don' : 'Kat'}を無音にしました` : `${side === 'don' ? 'Don' : 'Kat'}の音源を戻しました`;
    } catch (error) {
      if (workbenchStatus) workbenchStatus.textContent = error.message || '音源を切り替えられませんでした';
    }
  }

  function syncSinglePreview() {
    const active = !!samplePreview && !samplePreview.paused && !samplePreview.ended;
    for (const side of ['don', 'kat']) {
      const cap = side === 'don' ? 'Don' : 'Kat';
      const button = $(`preview${cap}Button`);
      if (!button) continue;
      const pressed = active && previewingSide === side;
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      button.textContent = pressed ? '単音を停止' : '単音試聴';
    }
    if (!active) previewingSide = null;
  }

  async function toggleSinglePreview(side) {
    if (previewingSide === side && samplePreview && !samplePreview.paused) {
      controller.stopPreview();
      syncSinglePreview();
      return;
    }
    previewingSide = side;
    try {
      await controller.togglePreview(side);
      syncSinglePreview();
    } catch (error) {
      previewingSide = null;
      syncSinglePreview();
      if (workbenchStatus) workbenchStatus.textContent = error.message || '単音を試聴できませんでした';
    }
  }

  function syncPlay() {
    if (!playButton || !miniPlay) return;
    const playing = playButton.getAttribute('aria-pressed') === 'true';
    miniPlay.disabled = playButton.disabled;
    miniPlay.setAttribute('aria-pressed', playing ? 'true' : 'false');
    miniPlay.setAttribute('aria-label', playing ? '曲を一時停止' : '曲を再生');
    miniPlay.querySelector('span').textContent = playing ? '一時停止' : '再生';
  }

  function setDockExpanded(expanded, { moveFocus = false } = {}) {
    if (!auditionPanel || !dockToggle) return;
    auditionPanel.classList.toggle('is-expanded', expanded);
    dockToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    dockToggle.querySelector('span').textContent = expanded ? '試聴パネルを閉じる' : '試聴パネルを開く';
    if (expanded && moveFocus) auditionPanel.focus({ preventScroll: true });
    if (!expanded && moveFocus) dockToggle.focus({ preventScroll: true });
  }

  function openFavorites() {
    if (!favoriteSheet || !favoriteDialog) return;
    favoriteReturnFocus = document.activeElement;
    favoriteSheet.hidden = false;
    requestAnimationFrame(() => favoriteClose?.focus());
  }

  function closeFavorites() {
    if (!favoriteSheet || favoriteSheet.hidden) return;
    favoriteSheet.hidden = true;
    favoriteReturnFocus?.focus?.();
    favoriteReturnFocus = null;
  }

  function trapFavoriteFocus(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFavorites();
      return;
    }
    if (event.key !== 'Tab' || !favoriteDialog || favoriteSheet?.hidden) return;
    const focusable = Array.from(favoriteDialog.querySelectorAll('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function layoutKey() {
    return matchMedia('(min-width:900px) and (orientation:landscape)').matches ? 'two-pane' : 'dock';
  }

  function readPositions() {
    return readJson(POSITION_KEY, {});
  }

  function saveCandidatePosition(side = activeSide, layout = layoutKey()) {
    if (!sourcePanel) return;
    const panelTop = sourcePanel.getBoundingClientRect().top + 58;
    const candidates = Array.from(sourcePanel.querySelectorAll('[data-hs-id]'));
    const firstVisible = candidates.find(button => button.getBoundingClientRect().bottom > panelTop);
    if (!firstVisible) return;
    const positions = readPositions();
    positions[`${layout}:${side}`] = firstVisible.dataset.hsId;
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(positions)); } catch {}
  }

  function schedulePositionSave() {
    clearTimeout(savePositionTimer);
    const side = activeSide;
    const layout = layoutKey();
    savePositionTimer = window.setTimeout(() => saveCandidatePosition(side, layout), 120);
  }

  function restoreCandidatePosition() {
    if (!sourcePanel) return;
    const id = readPositions()[`${layoutKey()}:${activeSide}`];
    if (!id) return;
    const target = sourcePanel.querySelector(`[data-hs-id="${CSS.escape(id)}"]`);
    if (!target) return;
    const toolbarHeight = sourcePanel.querySelector('.hs-toolbar')?.offsetHeight || 0;
    sourcePanel.scrollTop += target.getBoundingClientRect().top - sourcePanel.getBoundingClientRect().top - toolbarHeight - 8;
  }

  roleDon?.addEventListener('click', () => { activeSide = 'don'; syncActiveSide(); });
  roleKat?.addEventListener('click', () => { activeSide = 'kat'; syncActiveSide(); });
  $('miniDonTarget')?.addEventListener('click', () => chooseSide('don'));
  $('miniKatTarget')?.addEventListener('click', () => chooseSide('kat'));
  $('currentDonTarget')?.addEventListener('click', () => chooseSide('don'));
  $('currentKatTarget')?.addEventListener('click', () => chooseSide('kat'));
  $('previewDonButton')?.addEventListener('click', () => toggleSinglePreview('don'));
  $('previewKatButton')?.addEventListener('click', () => toggleSinglePreview('kat'));
  $('muteDonButton')?.addEventListener('click', () => toggleMute('don'));
  $('muteKatButton')?.addEventListener('click', () => toggleMute('kat'));
  miniPlay?.addEventListener('click', () => { if (!playButton?.disabled) playButton.click(); });
  dockToggle?.addEventListener('click', () => setDockExpanded(!auditionPanel?.classList.contains('is-expanded'), { moveFocus: true }));
  dockCollapse?.addEventListener('click', () => setDockExpanded(false, { moveFocus: true }));
  favoriteOpen?.addEventListener('click', openFavorites);
  favoriteSheet?.addEventListener('click', event => { if (event.target.closest('[data-close-favorites]')) closeFavorites(); });
  favoriteSheet?.addEventListener('keydown', trapFavoriteFocus);
  sourcePanel?.addEventListener('scroll', schedulePositionSave, { passive: true });
  samplePreview?.addEventListener('play', syncSinglePreview);
  samplePreview?.addEventListener('pause', syncSinglePreview);
  samplePreview?.addEventListener('ended', syncSinglePreview);

  dockMini?.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  dockMini?.addEventListener('pointerup', event => {
    if (!swipeStart || event.pointerId !== swipeStart.id) return;
    const dy = event.clientY - swipeStart.y;
    const dx = event.clientX - swipeStart.x;
    swipeStart = null;
    if (dy < -38 && Math.abs(dy) > Math.abs(dx)) setDockExpanded(true);
  });
  auditionPanel?.addEventListener('pointerdown', event => {
    if (!auditionPanel.classList.contains('is-expanded') || event.pointerType === 'mouse' || event.target.closest('button,input')) return;
    swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  auditionPanel?.addEventListener('pointerup', event => {
    if (!swipeStart || event.pointerId !== swipeStart.id) return;
    const dy = event.clientY - swipeStart.y;
    const dx = event.clientX - swipeStart.x;
    swipeStart = null;
    if (dy > 38 && Math.abs(dy) > Math.abs(dx)) setDockExpanded(false);
  });

  window.addEventListener('hitsound-selection-change', event => {
    syncSelection();
    if (workbenchStatus) {
      const side = activeSide === 'don' ? 'Don' : 'Kat';
      const selected = sourceLabel(event.detail?.[activeSide]);
      workbenchStatus.textContent = `${side}に ${selected.number} ${selected.name} を選択中`;
    }
  });
  window.addEventListener('hitsound-active-side-change', event => {
    const nextSide = event.detail?.side === 'kat' ? 'kat' : 'don';
    if (nextSide !== activeSide) saveCandidatePosition(activeSide);
    activeSide = nextSide;
    syncActiveSide();
    if (workbenchStatus) workbenchStatus.textContent = `${activeSide === 'don' ? 'Don' : 'Kat'}を操作対象にしました`;
    requestAnimationFrame(restoreCandidatePosition);
  });
  window.addEventListener('viewer-play-state', syncPlay);
  window.addEventListener('viewer-loop-change', event => {
    const detail = event.detail || {};
    setText('miniLoopState', detail.valid ? `A–B ${detail.enabled ? '反復中' : '設定済み'}` : 'A–B 未設定');
  });
  window.addEventListener('hitsound-saved-sets-change', () => {
    const length = window.HitsoundFavorites?.readSets?.().length || 0;
    setText('favoriteCount', String(length));
  });
  window.addEventListener('hitsound-favorite-applied', event => {
    closeFavorites();
    if (workbenchStatus) workbenchStatus.textContent = `${event.detail?.label || 'Favorite'} を適用しました`;
  });

  if (playButton) {
    new MutationObserver(syncPlay).observe(playButton, { attributes: true, attributeFilter: ['disabled', 'aria-pressed'], childList: true, subtree: true });
  }
  if (timeDisplay && miniTime) {
    new MutationObserver(() => { miniTime.textContent = timeDisplay.textContent; }).observe(timeDisplay, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener('resize', () => {
    schedulePositionSave();
    if (matchMedia('(min-width:900px) and (orientation:landscape)').matches) setDockExpanded(false);
  });

  try { activeSide = localStorage.getItem('osutaiko-hitsound-lab:active-side:v1') === 'kat' ? 'kat' : 'don'; } catch {}
  syncSelection();
  syncPlay();
  setText('favoriteCount', String(window.HitsoundFavorites?.readSets?.().length || 0));
  requestAnimationFrame(restoreCandidatePosition);
})();
