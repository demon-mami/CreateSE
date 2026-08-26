(() => {
  'use strict';

  const controller = window.HitsoundController;
  if (!controller) return;

  const $ = id => document.getElementById(id);
  const auditionPanel = $('auditionPanel');
  const dockMini = auditionPanel?.querySelector('.dock-mini');
  const dockToggle = $('dockToggleButton');
  const dockCollapse = $('dockCollapseButton');
  const favoriteSheet = $('favoriteSheet');
  const favoriteDialog = $('savedSetsPanel');
  const favoriteOpen = $('favoriteOpenButton');
  const favoriteClose = $('favoriteCloseButton');
  const playButton = $('playButton');
  const miniPlay = $('previewButton');
  const workbenchStatus = $('workbenchStatus');
  let activeSide = 'don';
  let favoriteReturnFocus = null;
  let swipeStart = null;
  let dockTransitionTimer = 0;
  let dockTransitionHandler = null;
  const DOCK_TRANSITION_MS = 480;
  const DOCK_TRANSITION_FALLBACK_MS = DOCK_TRANSITION_MS * 3;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value;
  }

  function sourceLabel(id) {
    if (!id || id === controller.SILENT_ID) return { number: '無音' };
    const source = controller.byId(id);
    return { number: String(source?.sourceNumber || '—') };
  }

  function syncPlay() {
    if (!playButton || !miniPlay) return;
    const playing = playButton.getAttribute('aria-pressed') === 'true';
    miniPlay.disabled = playButton.disabled;
    miniPlay.setAttribute('aria-pressed', playing ? 'true' : 'false');
    miniPlay.setAttribute('aria-label', playing ? '曲を一時停止' : '曲を再生');
    const face = miniPlay.querySelector('span');
    if (face) face.textContent = playing ? 'Ⅱ' : '▶';
  }

  function setDockExpanded(expanded, { moveFocus = false } = {}) {
    if (!auditionPanel || !dockToggle) return;
    const currentlyExpanded = auditionPanel.classList.contains('is-expanded');
    if (currentlyExpanded === expanded || auditionPanel.classList.contains('is-transitioning')) return;

    clearTimeout(dockTransitionTimer);
    if (dockTransitionHandler) auditionPanel.removeEventListener('transitionend', dockTransitionHandler);
    auditionPanel.classList.add('is-transitioning');
    auditionPanel.setAttribute('aria-busy', 'true');
    auditionPanel.classList.toggle('is-expanded', expanded);
    dockToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    dockToggle.setAttribute('aria-label', expanded ? '再生パネルを収納' : '再生パネルを展開');
    if (expanded && moveFocus) auditionPanel.focus({ preventScroll: true });
    if (!expanded && moveFocus) dockToggle.focus({ preventScroll: true });

    const finishTransition = event => {
      if (event && (event.target !== auditionPanel || event.propertyName !== 'height')) return;
      clearTimeout(dockTransitionTimer);
      if (dockTransitionHandler) auditionPanel.removeEventListener('transitionend', dockTransitionHandler);
      dockTransitionHandler = null;
      auditionPanel.classList.remove('is-transitioning');
      auditionPanel.removeAttribute('aria-busy');
    };
    if (reducedMotion.matches) finishTransition();
    else {
      dockTransitionHandler = finishTransition;
      auditionPanel.addEventListener('transitionend', dockTransitionHandler);
      dockTransitionTimer = window.setTimeout(finishTransition, DOCK_TRANSITION_FALLBACK_MS);
    }
  }

  function openPresets() {
    if (!favoriteSheet || !favoriteDialog) return;
    favoriteReturnFocus = document.activeElement;
    favoriteSheet.hidden = false;
    requestAnimationFrame(() => favoriteClose?.focus());
  }

  function closePresets() {
    if (!favoriteSheet || favoriteSheet.hidden) return;
    favoriteSheet.hidden = true;
    favoriteReturnFocus?.focus?.();
    favoriteReturnFocus = null;
  }

  function trapPresetFocus(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePresets();
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

  miniPlay?.addEventListener('click', () => { if (!playButton?.disabled) playButton.click(); });
  dockToggle?.addEventListener('click', () => setDockExpanded(!auditionPanel?.classList.contains('is-expanded'), { moveFocus: true }));
  dockCollapse?.addEventListener('click', () => setDockExpanded(false, { moveFocus: true }));
  favoriteOpen?.addEventListener('click', openPresets);
  favoriteSheet?.addEventListener('click', event => { if (event.target.closest('[data-close-favorites]')) closePresets(); });
  favoriteSheet?.addEventListener('keydown', trapPresetFocus);

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
    if (workbenchStatus) {
      const side = activeSide === 'don' ? 'Don' : 'Kat';
      const selected = sourceLabel(event.detail?.[activeSide]);
      workbenchStatus.textContent = `${side} ${selected.number} を選択`;
    }
  });
  window.addEventListener('hitsound-active-side-change', event => {
    activeSide = event.detail?.side === 'kat' ? 'kat' : 'don';
    if (workbenchStatus) workbenchStatus.textContent = '';
  });
  window.addEventListener('viewer-play-state', syncPlay);
  window.addEventListener('hitsound-preset-applied', event => {
    closePresets();
    if (workbenchStatus) workbenchStatus.textContent = `${event.detail?.label || 'Preset'} を適用しました`;
  });

  if (playButton) {
    new MutationObserver(syncPlay).observe(playButton, { attributes: true, attributeFilter: ['disabled', 'aria-pressed'], childList: true, subtree: true });
  }

  window.addEventListener('resize', () => {
    if (matchMedia('(min-width:900px) and (orientation:landscape)').matches) setDockExpanded(false);
  });

  try { activeSide = localStorage.getItem('osutaiko-hitsound-lab:active-side:v1') === 'kat' ? 'kat' : 'don'; } catch {}
  syncPlay();
  setText('favoriteCount', String(window.HitsoundFavorites?.readPresets?.().length || 12));
})();
