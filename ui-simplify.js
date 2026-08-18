(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const donSelect = $('donSelect');
  const katSelect = $('katSelect');
  const audio = $('samplePreviewAudio');
  const donPreview = $('donPreview');
  const katPreview = $('katPreview');

  // Favorites: replace explanatory words with compact visual role markers.
  const donLabel = document.querySelector('.favorite-shortcut-label.don');
  const katLabel = document.querySelector('.favorite-shortcut-label.kat');
  const setLabel = document.querySelector('.favorite-shortcut-label.set');
  if (donLabel) donLabel.textContent = '★🔴';
  if (katLabel) katLabel.textContent = '★🔵';
  if (setLabel) setLabel.textContent = '★SET';

  // userLabel remains available internally for filtering/CSV, but is omitted from
  // browsing text to reduce visual information density.
  function simplifyOptionText(option) {
    if (!option?.value) return;
    option.textContent = String(option.textContent || '')
      .replace(/\s*\[[DKB]\]\s*·?\s*/g, ' · ')
      .replace(/\s+·\s+/g, ' · ')
      .trim();
  }

  function simplifySelect(select) {
    if (!select) return;
    Array.from(select.options).forEach(simplifyOptionText);
  }

  let simplifyQueued = false;
  function queueSimplify() {
    if (simplifyQueued) return;
    simplifyQueued = true;
    queueMicrotask(() => {
      simplifyQueued = false;
      simplifySelect(donSelect);
      simplifySelect(katSelect);
    });
  }

  if (donSelect) {
    new MutationObserver(queueSimplify).observe(donSelect, { childList: true });
    donSelect.addEventListener('change', queueSimplify);
  }
  if (katSelect) {
    new MutationObserver(queueSimplify).observe(katSelect, { childList: true });
    katSelect.addEventListener('change', queueSimplify);
  }
  $('pairScope')?.addEventListener('change', queueSimplify);
  queueSimplify();

  // Don/Kat preview buttons share one neutral play/pause UI. lab.js still owns
  // candidate loading; this layer only pauses/resumes the already-loaded preview.
  if (audio && donPreview && katPreview) {
    const buttons = [donPreview, katPreview];
    let activeButton = null;
    let pausedButton = null;
    let requestedButton = null;

    function paint() {
      for (const button of buttons) {
        const playing = button === activeButton && !audio.paused && !audio.ended;
        button.textContent = playing ? 'Ⅱ' : '▶';
        button.setAttribute('aria-pressed', playing ? 'true' : 'false');
      }
    }

    function capture(button, event) {
      if (button === activeButton && !audio.paused && !audio.ended) {
        event.preventDefault();
        event.stopImmediatePropagation();
        pausedButton = button;
        audio.pause();
        return;
      }

      if (button === pausedButton && audio.paused && !audio.ended && audio.currentTime > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        requestedButton = button;
        audio.play().catch(() => {});
        return;
      }

      pausedButton = null;
      requestedButton = button;
    }

    donPreview.addEventListener('click', event => capture(donPreview, event), true);
    katPreview.addEventListener('click', event => capture(katPreview, event), true);

    audio.addEventListener('play', () => {
      activeButton = requestedButton || pausedButton || activeButton;
      pausedButton = null;
      requestedButton = null;
      paint();
    });

    audio.addEventListener('pause', () => {
      if (requestedButton && requestedButton !== activeButton) pausedButton = null;
      else if (activeButton && audio.currentTime > 0 && !audio.ended) pausedButton = activeButton;
      activeButton = null;
      paint();
    });

    function clearPreviewState() {
      activeButton = null;
      pausedButton = null;
      requestedButton = null;
      paint();
    }

    audio.addEventListener('ended', clearPreviewState);
    audio.addEventListener('emptied', clearPreviewState);
    donSelect?.addEventListener('change', () => { if (pausedButton === donPreview) pausedButton = null; paint(); });
    katSelect?.addEventListener('change', () => { if (pausedButton === katPreview) pausedButton = null; paint(); });

    paint();
  }
})();
