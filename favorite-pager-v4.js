(() => {
  'use strict';

  const controller = window.HitsoundController;
  const favorites = window.HitsoundFavorites;
  const collectionsApi = window.HitsoundFavoriteCollections;
  if (!controller || !favorites || !collectionsApi) return;

  const KEY = collectionsApi.KEY || 'osutaiko-hitsound-lab:pair-favorite-collections:v2';
  const MAX_ITEMS = collectionsApi.MAX_ITEMS || 12;
  const SILENT_ID = controller.SILENT_ID;
  const $ = id => document.getElementById(id);
  const sheet = $('favoriteSheet');
  const dialog = $('savedSetsPanel');
  const list = $('savedSetsList');
  const title = $('favoriteSheetTitle');
  const status = $('favoriteSheetStatus');
  const openButton = $('favoriteOpenButton');
  if (!dialog || !list) return;

  const PAGE_KEYS = ['preset', 'favorite1', 'favorite2'];
  let pageIndex = 0;

  // v2/v3 switchers are retired. The manager now uses one arrow-paged view.
  dialog.querySelectorAll('.favorite-collection-tabs, #favoriteManagerTabs').forEach(node => node.remove());

  const pager = document.createElement('div');
  pager.id = 'favoritePager';
  pager.className = 'favorite-pager';
  pager.setAttribute('aria-label', 'Presetとお気に入りのページ切り替え');

  const previousButton = document.createElement('button');
  previousButton.type = 'button';
  previousButton.className = 'favorite-page-arrow previous';
  previousButton.textContent = '←';
  previousButton.setAttribute('aria-label', '前のページ');

  const pageLabel = document.createElement('div');
  pageLabel.className = 'favorite-page-label';
  pageLabel.setAttribute('aria-live', 'polite');

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'favorite-page-arrow next';
  nextButton.textContent = '→';
  nextButton.setAttribute('aria-label', '次のページ');

  pager.append(previousButton, pageLabel, nextButton);
  const actions = dialog.querySelector('.favorite-dialog-actions');
  if (actions) actions.insertAdjacentElement('afterend', pager);
  else dialog.insertBefore(pager, list);

  function readCollections() {
    try {
      const value = collectionsApi.read?.() || {};
      return {
        favorite1: Array.isArray(value.favorite1) ? value.favorite1 : [],
        favorite2: Array.isArray(value.favorite2) ? value.favorite2 : [],
      };
    } catch {
      return { favorite1: [], favorite2: [] };
    }
  }

  function readPresets() {
    try {
      return typeof favorites.readPresets === 'function' ? favorites.readPresets() : [];
    } catch {
      return [];
    }
  }

  function pairText(entry) {
    return `Don ${entry?.don?.sourceNumber || '—'} + Kat ${entry?.kat?.sourceNumber || '—'}`;
  }

  function slotLabel(slotName) {
    return slotName === 'favorite1' ? 'お気に入り1' : 'お気に入り2';
  }

  function availability(side) {
    if (!side?.id || side.id === SILENT_ID || side.silent) return { ok: false, reason: '無音を含む組み合わせは使用できません' };
    const source = controller.byId(side.id);
    if (!source) return { ok: false, reason: `${side.sourceNumber || '—'} ${side.name || ''} を再登録してください` };
    if (side.custom) {
      if (!side.fingerprint) return { ok: false, reason: 'My Soundを再登録してください' };
      if (!source.custom || source.fingerprint !== side.fingerprint) {
        return { ok: false, reason: `${side.sourceNumber || '—'} ${side.name || ''} と同じMy Soundを再登録してください` };
      }
    }
    return { ok: true, reason: '' };
  }

  function entryAvailability(entry) {
    const don = availability(entry?.don);
    const kat = availability(entry?.kat);
    return don.ok && kat.ok ? { ok: true, reason: '' } : { ok: false, reason: don.reason || kat.reason };
  }

  function setStatus(message = '', error = false) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function writeCollections(collections) {
    try {
      const payload = {
        version: 2,
        favorite1: Array.isArray(collections.favorite1) ? collections.favorite1.slice(0, MAX_ITEMS) : [],
        favorite2: Array.isArray(collections.favorite2) ? collections.favorite2.slice(0, MAX_ITEMS) : [],
      };
      localStorage.setItem(KEY, JSON.stringify(payload));
      const verify = JSON.parse(localStorage.getItem(KEY) || 'null') || {};
      if (!Array.isArray(verify.favorite1) || !Array.isArray(verify.favorite2)) throw new Error('verify failed');
      window.dispatchEvent(new CustomEvent('hitsound-favorite-collections-change', { detail: payload }));
      return true;
    } catch {
      setStatus('お気に入りを保存できませんでした', true);
      return false;
    }
  }

  async function applyEntry(entry, label) {
    const state = entryAvailability(entry);
    if (!state.ok) {
      setStatus(state.reason, true);
      return;
    }
    const applied = await controller.setPair(entry.don.id, entry.kat.id);
    if (!applied) {
      setStatus('組み合わせを適用できませんでした', true);
      return;
    }
    window.dispatchEvent(new CustomEvent('hitsound-preset-applied', {
      detail: { label: `${label} ${pairText(entry)}` },
    }));
  }

  function removeEntry(slotName, id) {
    const collections = readCollections();
    const before = collections[slotName]?.length || 0;
    collections[slotName] = (collections[slotName] || []).filter(entry => entry.id !== id);
    if (collections[slotName].length === before) return;
    if (writeCollections(collections)) render();
  }

  function makePairButton(entry, label, slotName = '') {
    const row = document.createElement('div');
    row.className = `favorite-manager-row${slotName ? ' deletable' : ''}`;

    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'favorite-manager-apply';
    const state = entryAvailability(entry);
    apply.disabled = !state.ok;
    apply.setAttribute('aria-label', state.ok ? `${label} ${pairText(entry)} を適用` : `${pairText(entry)} は適用不可。${state.reason}`);

    const main = document.createElement('strong');
    main.textContent = `${label} ${pairText(entry)}`;
    apply.append(main);
    if (!state.ok) {
      const reason = document.createElement('small');
      reason.textContent = state.reason;
      apply.append(reason);
    }
    apply.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      applyEntry(entry, label).catch(error => setStatus(error?.message || '適用できませんでした', true));
    });
    row.append(apply);

    if (slotName) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'favorite-manager-delete';
      del.textContent = '×';
      del.setAttribute('aria-label', `${pairText(entry)} を${slotLabel(slotName)}から削除`);
      del.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        removeEntry(slotName, entry.id);
      });
      row.append(del);
    }

    return row;
  }

  function currentPageKey() {
    return PAGE_KEYS[pageIndex] || 'preset';
  }

  function renderPager() {
    const collections = readCollections();
    const presets = readPresets();
    const key = currentPageKey();

    if (key === 'preset') pageLabel.textContent = `Preset ${presets.length || 12}/${MAX_ITEMS}`;
    else if (key === 'favorite1') pageLabel.textContent = `♥ ${collections.favorite1.length}/${MAX_ITEMS}`;
    else pageLabel.textContent = `★ ${collections.favorite2.length}/${MAX_ITEMS}`;

    previousButton.disabled = pageIndex === 0;
    nextButton.disabled = pageIndex === PAGE_KEYS.length - 1;
    previousButton.setAttribute('aria-disabled', previousButton.disabled ? 'true' : 'false');
    nextButton.setAttribute('aria-disabled', nextButton.disabled ? 'true' : 'false');
  }

  function renderList() {
    list.replaceChildren();
    setStatus('');
    const key = currentPageKey();

    if (title) title.textContent = 'Preset / Favorites';

    if (key === 'preset') {
      const presets = readPresets();
      presets.forEach((entry, index) => {
        const label = String(entry.id || `P${String(index + 1).padStart(2, '0')}`);
        list.append(makePairButton(entry, label));
      });
      return;
    }

    const collections = readCollections();
    const items = collections[key] || [];
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'favorite-empty';
      empty.textContent = `${slotLabel(key)}はまだ登録されていません`;
      list.append(empty);
      return;
    }

    items.forEach((entry, index) => {
      list.append(makePairButton(entry, `${index + 1}.`, key));
    });
  }

  function render() {
    renderPager();
    if (!sheet || !sheet.hidden) renderList();
  }

  function movePage(delta) {
    const next = Math.max(0, Math.min(PAGE_KEYS.length - 1, pageIndex + delta));
    if (next === pageIndex) return;
    pageIndex = next;
    render();
  }

  previousButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    movePage(-1);
  });

  nextButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    movePage(1);
  });

  openButton?.addEventListener('click', () => {
    pageIndex = 0;
    queueMicrotask(render);
  });

  ['hitsound-favorite-collections-change', 'hitsound-custom-sources-change'].forEach(name => {
    window.addEventListener(name, () => queueMicrotask(render));
  });
  window.addEventListener('storage', event => {
    if (event.key === KEY) queueMicrotask(render);
  });
  window.addEventListener('pageshow', () => queueMicrotask(render));

  const style = document.createElement('style');
  style.dataset.feature = 'favorite-pager-v4';
  style.textContent = `
    .favorite-collection-tabs,#favoriteManagerTabs{display:none!important}
    .favorite-pager{
      display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;gap:10px;
      margin:0 0 12px;
    }
    .favorite-page-arrow{
      width:52px;min-width:52px;min-height:46px;padding:0!important;border:1px solid rgba(255,255,255,.20)!important;
      border-radius:10px!important;background:rgba(43,58,65,.88)!important;color:#fff!important;
      font-size:22px!important;font-weight:850!important;line-height:1!important;touch-action:manipulation;
    }
    .favorite-page-arrow:disabled{opacity:.25!important}
    .favorite-page-label{
      min-height:46px;display:flex;align-items:center;justify-content:center;padding:0 12px;
      border:1px solid rgba(121,212,236,.42);border-radius:10px;background:rgba(68,149,174,.22);
      color:#f2fdff;font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;text-align:center;
    }
    .favorite-manager-row{display:grid;grid-template-columns:minmax(0,1fr);gap:7px}
    .favorite-manager-row.deletable{grid-template-columns:minmax(0,1fr) 52px}
    .favorite-manager-apply,.favorite-manager-delete{
      min-height:46px;border:1px solid rgba(255,255,255,.18);border-radius:9px;
      background:linear-gradient(180deg,rgba(72,87,95,.58),rgba(45,59,66,.58));color:#fff;
    }
    .favorite-manager-apply{padding:7px 10px;text-align:left;display:grid;align-content:center;gap:2px}
    .favorite-manager-apply strong{font-size:11px;font-weight:830}
    .favorite-manager-apply small{font-size:9px;color:#ffd0d2;line-height:1.25}
    .favorite-manager-apply:disabled{opacity:.55}
    .favorite-manager-delete{padding:0;color:#ffd0d2;background:rgba(121,48,55,.34);font-size:17px;font-weight:900}
    #savedSetsList.favorite-set-grid{gap:8px}
    @media(max-width:430px){
      .favorite-pager{grid-template-columns:46px minmax(0,1fr) 46px;gap:7px}
      .favorite-page-arrow{width:46px;min-width:46px}
      .favorite-page-label{font-size:11px;padding-inline:8px}
    }
  `;
  document.head.append(style);

  render();
})();
