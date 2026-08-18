(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const FAVORITES_KEY = 'osutaiko-hitsound-lab-favorites-v1';
  const $ = id => document.getElementById(id);

  const donSelect = $('donSelect');
  const katSelect = $('katSelect');
  const scopeSelect = $('pairScope');
  const donInput = $('donHitsoundInput');
  const katInput = $('kaHitsoundInput');
  const status = $('statusBadge');
  const play = $('playButton');
  const pairBuilder = document.querySelector('.pair-builder');
  const pairHead = document.querySelector('.pair-builder-head');
  const topActions = document.querySelector('.pair-footer-actions');

  if (!CANDIDATES.length || !donSelect || !katSelect || !pairBuilder) return;

  const byId = id => CANDIDATES.find(candidate => candidate.id === id);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  const sourceNumber = candidate => {
    if (candidate?.sourceNumber) return candidate.sourceNumber;
    const match = String(candidate?.id || '').match(/(\d+)$/);
    return match ? match[1].padStart(3, '0') : '000';
  };

  const shortName = candidate => {
    const raw = String(candidate?.originalName || candidate?.name || '')
      .replace(/^\d{3}_/, '')
      .replace(/\.wav$/i, '');
    return `${sourceNumber(candidate)} · ${raw}`;
  };

  function readFavorites() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || 'null') || {};
      return {
        don: Array.isArray(parsed.don) ? parsed.don : [],
        kat: Array.isArray(parsed.kat) ? parsed.kat : [],
        set: Array.isArray(parsed.set) ? parsed.set : [],
      };
    } catch {
      return { don: [], kat: [], set: [] };
    }
  }

  // Move SET★ / CSV to the top of the HITSOUND PAIR block.
  if (pairHead && topActions && topActions.parentElement !== pairHead) {
    topActions.classList.add('pair-head-actions');
    pairHead.appendChild(topActions);
  }

  const dock = document.createElement('div');
  dock.id = 'favoriteShortcutPanel';
  dock.className = 'favorite-shortcut-panel';
  dock.innerHTML = `
    <div class="favorite-shortcut-title">FAVORITES</div>
    <div class="favorite-shortcut-row">
      <span class="favorite-shortcut-label don">DON</span>
      <div id="favoriteDonList" class="favorite-chip-list"></div>
    </div>
    <div class="favorite-shortcut-row">
      <span class="favorite-shortcut-label kat">KAT</span>
      <div id="favoriteKatList" class="favorite-chip-list"></div>
    </div>
    <div class="favorite-shortcut-row">
      <span class="favorite-shortcut-label set">SET</span>
      <div id="favoriteSetList" class="favorite-chip-list"></div>
    </div>`;
  pairBuilder.insertAdjacentElement('afterend', dock);

  const donList = $('favoriteDonList');
  const katList = $('favoriteKatList');
  const setList = $('favoriteSetList');

  function optionExists(select, id) {
    return Array.from(select.options).some(option => option.value === id);
  }

  function emitSelectChange(select, value) {
    if (!value || select.value === value) return false;
    if (!optionExists(select, value)) return false;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function waitForHiddenInputChange(input, timeoutMs = 10000) {
    if (!input) return Promise.resolve(false);
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        input.removeEventListener('change', onChange);
        resolve(value);
      };
      const onChange = () => finish(true);
      const timer = setTimeout(() => finish(false), timeoutMs);
      input.addEventListener('change', onChange, { once: true });
    });
  }

  async function waitForStableReady(wasPlayable, timeoutMs = 20000) {
    if (!wasPlayable) {
      await delay(180);
      return true;
    }

    const started = performance.now();
    let readySince = 0;
    while (performance.now() - started < timeoutMs) {
      const isReady = (status?.textContent || '') === '準備完了' && !play?.disabled;
      if (isReady) {
        if (!readySince) readySince = performance.now();
        // Require a quiet period so sequential Don->Kat rebuilds are not split midway.
        if (performance.now() - readySince >= 280) return true;
      } else {
        readySince = 0;
      }
      await delay(45);
    }
    return false;
  }

  async function selectOne(select, hiddenInput, id) {
    if (!id || select.value === id) return true;
    if (!optionExists(select, id)) return false;

    const wasPlayable = !!play && !play.disabled;
    const hiddenChanged = waitForHiddenInputChange(hiddenInput);
    const changed = emitSelectChange(select, id);
    if (!changed) return false;
    await hiddenChanged;
    await waitForStableReady(wasPlayable);
    return true;
  }

  function ensureAllScope() {
    if (!scopeSelect || scopeSelect.value === 'ALL') return;
    scopeSelect.value = 'ALL';
    scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  let applying = false;
  async function runExclusive(work) {
    if (applying) return;
    applying = true;
    dock.classList.add('busy');
    renderFavorites();
    try {
      await work();
    } finally {
      applying = false;
      dock.classList.remove('busy');
      renderFavorites();
    }
  }

  async function applyFavoriteDon(id) {
    await selectOne(donSelect, donInput, id);
  }

  async function applyFavoriteKat(id) {
    const d = byId(donSelect.value);
    const k = byId(id);
    if (!d || !k || k.pitch <= d.pitch) return;

    if (!optionExists(katSelect, id)) {
      ensureAllScope();
      await delay(0);
    }
    await selectOne(katSelect, katInput, id);
  }

  async function applyFavoriteSet(key) {
    const [dId, kId] = String(key || '').split('|');
    const d = byId(dId);
    const k = byId(kId);
    if (!d || !k || k.pitch <= d.pitch) return;

    // A saved SET is a direct recall command, so allow cross-family SETs regardless
    // of the current browsing scope.
    if (scopeSelect?.value === 'SAME' && d.family !== k.family) {
      ensureAllScope();
      await delay(0);
    }

    await selectOne(donSelect, donInput, dId);

    if (!optionExists(katSelect, kId)) {
      ensureAllScope();
      await delay(0);
    }
    await selectOne(katSelect, katInput, kId);
  }

  function emptyMarkup() {
    return '<span class="favorite-empty">—</span>';
  }

  function renderFavorites() {
    const fav = readFavorites();
    const currentDon = byId(donSelect.value);

    const dons = fav.don.map(byId).filter(Boolean);
    donList.innerHTML = dons.length ? dons.map(candidate =>
      `<button type="button" class="favorite-chip don" data-quick-don="${candidate.id}" title="${candidate.name}" ${applying ? 'disabled' : ''}>${shortName(candidate)}</button>`
    ).join('') : emptyMarkup();

    const kats = fav.kat.map(byId).filter(Boolean);
    katList.innerHTML = kats.length ? kats.map(candidate => {
      const compatible = !!currentDon && candidate.pitch > currentDon.pitch;
      const disabled = applying || !compatible;
      const title = compatible
        ? candidate.name
        : `${candidate.name} — 現在のDONより高くないため選択不可`;
      return `<button type="button" class="favorite-chip kat" data-quick-kat="${candidate.id}" title="${title}" ${disabled ? 'disabled' : ''}>${shortName(candidate)}</button>`;
    }).join('') : emptyMarkup();

    const sets = fav.set.map(key => {
      const [dId, kId] = String(key).split('|');
      const d = byId(dId), k = byId(kId);
      return d && k ? { key, d, k } : null;
    }).filter(Boolean);
    setList.innerHTML = sets.length ? sets.map(({ key, d, k }) =>
      `<button type="button" class="favorite-chip set" data-quick-set="${key}" title="${d.name} + ${k.name}" ${applying ? 'disabled' : ''}>${sourceNumber(d)} + ${sourceNumber(k)}</button>`
    ).join('') : emptyMarkup();

    donList.querySelectorAll('[data-quick-don]').forEach(button => {
      button.addEventListener('click', () => runExclusive(() => applyFavoriteDon(button.dataset.quickDon)));
    });
    katList.querySelectorAll('[data-quick-kat]').forEach(button => {
      button.addEventListener('click', () => runExclusive(() => applyFavoriteKat(button.dataset.quickKat)));
    });
    setList.querySelectorAll('[data-quick-set]').forEach(button => {
      button.addEventListener('click', () => runExclusive(() => applyFavoriteSet(button.dataset.quickSet)));
    });
  }

  // Pair-ranking writes localStorage in its click handlers first; refresh just after it.
  ['favDonButton', 'favKatButton', 'favSetButton'].forEach(id => {
    $(id)?.addEventListener('click', () => setTimeout(renderFavorites, 0));
  });
  donSelect.addEventListener('change', () => setTimeout(renderFavorites, 0));
  katSelect.addEventListener('change', () => setTimeout(renderFavorites, 0));
  scopeSelect?.addEventListener('change', () => setTimeout(renderFavorites, 0));

  const style = document.createElement('style');
  style.textContent = `
    .pair-builder-head{align-items:center}
    .pair-footer-actions.pair-head-actions{
      display:flex;
      grid-template-columns:none;
      flex:0 0 auto;
      gap:4px;
      margin-top:0;
    }
    .pair-head-actions .favorite-button{
      min-width:50px;
      min-height:27px;
      padding:0 7px;
      font-size:8px;
    }
    .pair-head-actions .favorite-button.export{min-width:58px}
    .favorite-button.active{
      border-color:var(--accent-border);
      background:var(--accent-soft);
      color:var(--accent-text);
    }
    .favorite-shortcut-panel{
      margin-top:7px;
      padding:7px 8px;
      border:1px solid var(--line);
      border-radius:9px;
      background:var(--surface);
    }
    .favorite-shortcut-title{
      margin-bottom:4px;
      color:var(--muted);
      font-size:8px;
      font-weight:850;
      letter-spacing:.08em;
    }
    .favorite-shortcut-row{
      display:grid;
      grid-template-columns:28px minmax(0,1fr);
      align-items:center;
      gap:5px;
      min-height:29px;
    }
    .favorite-shortcut-label{
      font-size:8px;
      font-weight:900;
      text-align:center;
    }
    .favorite-shortcut-label.don{color:var(--don)}
    .favorite-shortcut-label.kat{color:var(--ka)}
    .favorite-shortcut-label.set{color:var(--text)}
    .favorite-chip-list{
      display:flex;
      align-items:center;
      gap:4px;
      min-width:0;
      overflow-x:auto;
      overflow-y:hidden;
      padding:1px 0 2px;
      scrollbar-width:thin;
    }
    .favorite-chip{
      flex:0 0 auto;
      min-height:25px;
      max-width:190px;
      padding:0 7px;
      border:1px solid var(--line);
      border-radius:7px;
      background:var(--panel-2);
      color:var(--text);
      font-size:8px;
      font-weight:800;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .favorite-chip.don{border-color:rgba(238,185,178,.36)}
    .favorite-chip.kat{border-color:rgba(176,204,215,.36)}
    .favorite-chip.set{border-color:var(--accent-border)}
    .favorite-chip:disabled{opacity:.30}
    .favorite-empty{color:var(--muted);font-size:9px}
    .favorite-shortcut-panel.busy{opacity:.82}
    @media(max-width:430px){
      .pair-builder-head{gap:5px}
      .scope-field{width:94px}
      .pair-head-actions .favorite-button{min-width:45px;padding:0 5px}
      .pair-head-actions .favorite-button.export{min-width:53px}
    }
  `;
  document.head.appendChild(style);

  renderFavorites();
})();
