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

  // The userLabel remains available internally for filtering/CSV, but is omitted from
  // the browsing text to reduce visual information density.
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

  // Don/Kat preview buttons share one neutral play/pause UI. The underlying preview
  // loading remains handled by lab.js; this only adds pause/resume-state presentation.
  if (audio && donPreview && katPreview) {
    const buttons = [donPreview, katPreview];
    let activeButton = null;
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
        audio.pause();
        return;
      }
      requestedButton = button;
    }

    donPreview.addEventListener('click', event => capture(donPreview, event), true);
    katPreview.addEventListener('click', event => capture(katPreview, event), true);

    audio.addEventListener('play', () => {
      activeButton = requestedButton || activeButton;
      paint();
    });
    audio.addEventListener('pause', () => {
      activeButton = null;
      paint();
    });
    audio.addEventListener('ended', () => {
      activeButton = null;
      paint();
    });
    audio.addEventListener('emptied', () => {
      activeButton = null;
      paint();
    });

    paint();
  }
})();
