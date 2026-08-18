(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const FAVORITES_KEY = 'osutaiko-hitsound-lab-favorites-v1';
  const STAR_COLOR = '#f0c96b';
  const $ = id => document.getElementById(id);
  const donSelect = $('donSelect');
  const katSelect = $('katSelect');

  if (!CANDIDATES.length || !donSelect || !katSelect) return;

  const sourceNumber = candidate => {
    const match = String(candidate?.id || '').match(/(\d+)$/);
    return match ? match[1].padStart(3, '0') : '000';
  };

  // Keep the original source name while making the browser-side File name stable
  // and human-identifiable. The internal ZIP entry name remains an implementation detail.
  for (const candidate of CANDIDATES) {
    if (!candidate.originalName) candidate.originalName = candidate.name;
    candidate.sourceNumber = sourceNumber(candidate);
    const prefix = `${candidate.sourceNumber}_`;
    if (!String(candidate.name).startsWith(prefix)) {
      candidate.name = `${prefix}${candidate.originalName}`;
    }
  }

  const byId = id => CANDIDATES.find(candidate => candidate.id === id);

  function favorites() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || 'null') || {};
      return {
        don: new Set(Array.isArray(parsed.don) ? parsed.don : []),
        kat: new Set(Array.isArray(parsed.kat) ? parsed.kat : []),
      };
    } catch {
      return { don: new Set(), kat: new Set() };
    }
  }

  function baseOptionText(candidate) {
    return `${candidate.name} [${candidate.userLabel}] · ${Math.round(candidate.pitch)}Hz`;
  }

  function decorateSelect(select, role, favoriteIds) {
    for (const option of Array.from(select.options)) {
      const candidate = byId(option.value);
      if (!candidate) continue;

      const categoryMark = role === 'kat'
        ? (option.textContent.match(/^\s*([♪♥])/)?.[1] || '')
        : '';
      const starred = favoriteIds.has(candidate.id);
      option.textContent = `${categoryMark ? `${categoryMark} ` : ''}${starred ? '★ ' : ''}${baseOptionText(candidate)}`;
      option.style.color = starred ? STAR_COLOR : '';
      option.style.fontWeight = starred ? '850' : '';
    }

    const selectedStarred = !!select.value && favoriteIds.has(select.value);
    select.classList.toggle('candidate-favorite-current', selectedStarred);
  }

  let refreshQueued = false;
  function refresh() {
    const fav = favorites();
    decorateSelect(donSelect, 'don', fav.don);
    decorateSelect(katSelect, 'kat', fav.kat);
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      refresh();
    });
  }

  // lab.js rebuilds option elements and pair-ranking.js reorders KAT options.
  // Observe only direct option-list changes so our own text updates do not recurse.
  const donObserver = new MutationObserver(queueRefresh);
  const katObserver = new MutationObserver(queueRefresh);
  donObserver.observe(donSelect, { childList: true });
  katObserver.observe(katSelect, { childList: true });

  donSelect.addEventListener('change', queueRefresh);
  katSelect.addEventListener('change', queueRefresh);
  $('pairScope')?.addEventListener('change', queueRefresh);

  // pair-ranking.js updates localStorage first; refresh in the next microtask.
  $('favDonButton')?.addEventListener('click', queueRefresh);
  $('favKatButton')?.addEventListener('click', queueRefresh);

  const style = document.createElement('style');
  style.textContent = `
    select.candidate-favorite-current{
      color:${STAR_COLOR};
      font-weight:850;
      border-color:rgba(240,201,107,.66);
    }
  `;
  document.head.appendChild(style);

  refresh();
})();
