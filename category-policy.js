(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const categorySelect = document.getElementById('pairCategory');
  if (!CANDIDATES.length || !categorySelect) return;

  const BASS_CATEGORY = 'Bass Drum / Kick';
  const HIHAT_FAMILY = 'Hi-Hat';

  // 808/Sub keeps its original source classification outside category browsing.
  // While Bass Drum / Kick is selected, treat every 808/Sub source as part of that
  // category and expose it on both DON and KAT sides by temporarily using role B.
  const sources808 = CANDIDATES
    .filter(candidate => candidate.family === '808 / Sub')
    .map(candidate => ({
      candidate,
      family: candidate.family,
      userLabel: candidate.userLabel,
    }));

  function sync808CategoryPolicy() {
    const bassCategoryActive = categorySelect.value === BASS_CATEGORY;
    for (const source of sources808) {
      source.candidate.family = bassCategoryActive ? BASS_CATEGORY : source.family;
      source.candidate.userLabel = bassCategoryActive ? 'B' : source.userLabel;
    }
  }

  // Capture phase runs before lab.js category handlers, so their pool rebuild sees
  // the intended temporary role/family values.
  categorySelect.addEventListener('change', sync808CategoryPolicy, true);
  sync808CategoryPolicy();

  // lab.js builds the category options at runtime. Keep the internal family key as
  // Hi-Hat while presenting the requested Japanese display name.
  function applyJapaneseLabels() {
    const option = Array.from(categorySelect.options)
      .find(item => item.value === HIHAT_FAMILY);
    if (option) option.textContent = 'Hi-Hat（ハイハット）';
  }

  const observer = new MutationObserver(applyJapaneseLabels);
  observer.observe(categorySelect, { childList: true });
  applyJapaneseLabels();
})();
