(() => {
  'use strict';

  const controller = window.HitsoundController;
  const favorites = window.HitsoundFavorites;
  if (!controller || !favorites) return;

  const LEGACY_KEY = favorites.KEY || 'osutaiko-hitsound-lab:pair-favorite-slots:v1';
  const COLLECTION_KEY = 'osutaiko-hitsound-lab:pair-favorite-collections:v2';
  const MAX_ITEMS = 12;
  const SILENT_ID = controller.SILENT_ID;
  const CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫'];
  const $ = id => document.getElementById(id);

  const toggleButtons = {
    favorite1: $('favoriteOneButton'),
    favorite2: $('favoriteTwoButton'),
  };
  const listButtons = {
    favorite1: $('favoriteOneListButton'),
    favorite2: $('favoriteTwoListButton'),
  };
  const setButton = $('favoriteOpenButton');
  const judgmentPanel = document.querySelector('.judgment-panel');
  const feedback = $('setFeedback');
  const workbenchStatus = $('workbenchStatus');

  let openSource = '';
  let dropdown = null;
  let feedbackTimer = 0;

  function makeId(prefix = 'favorite') {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeDescriptor(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      id: String(value.id || ''),
      sourceNumber: String(value.sourceNumber || '—'),
      name: String(value.name || '音源未登録'),
      family: String(value.family || ''),
      pitch: Number.isFinite(value.pitch) ? value.pitch : '',
      userLabel: String(value.userLabel || ''),
      custom: !!value.custom,
      slot: Number.isInteger(value.slot) ? value.slot : null,
      fingerprint: String(value.fingerprint || ''),
      silent: !!value.silent || value.id === SILENT_ID,
    };
  }

  function normalizeEntry(value, fallbackPrefix = 'favorite') {
    if (!value || typeof value !== 'object') return null;
    const don = normalizeDescriptor(value.don);
    const kat = normalizeDescriptor(value.kat);
    if (!don || !kat || !don.id || !kat.id) return null;
    return {
      id: String(value.id || makeId(fallbackPrefix)),
      don,
      kat,
      createdAt: String(value.createdAt || ''),
    };
  }

  function descriptorKey(side) {
    if (!side) return '';
    return `${side.id || ''}@${side.custom ? (side.fingerprint || '') : 'builtin'}`;
  }

  function entryKey(entry) {
    return entry ? `${descriptorKey(entry.don)}|${descriptorKey(entry.kat)}` : '';
  }

  function createdTime(entry) {
    const value = Date.parse(entry?.createdAt || '');
    return Number.isFinite(value) ? value : 0;
  }

  function dedupeNewest(entries) {
    const out = [];
    const seen = new Set();
    for (const value of Array.isArray(entries) ? entries : []) {
      const entry = normalizeEntry(value);
      if (!entry) continue;
      const key = entryKey(entry);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
    }
    out.sort((a, b) => createdTime(b) - createdTime(a));
    return out.slice(0, MAX_ITEMS);
  }

  function readLegacySlots() {
    try {
      if (typeof favorites.readSlots === 'function') {
        const slots = favorites.readSlots() || {};
        return {
          favorite1: normalizeEntry(slots.favorite1, 'favorite1'),
          favorite2: normalizeEntry(slots.favorite2, 'favorite2'),
        };
      }
      const raw = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null') || {};
      return {
        favorite1: normalizeEntry(raw.favorite1, 'favorite1'),
        favorite2: normalizeEntry(raw.favorite2, 'favorite2'),
      };
    } catch {
      return { favorite1: null, favorite2: null };
    }
  }

  function migrateLegacyIfNeeded() {
    try {
      if (localStorage.getItem(COLLECTION_KEY)) return;
      const legacy = readLegacySlots();
      localStorage.setItem(COLLECTION_KEY, JSON.stringify({
        version: 2,
        favorite1: legacy.favorite1 ? [legacy.favorite1] : [],
        favorite2: legacy.favorite2 ? [legacy.favorite2] : [],
      }));
    } catch {}
  }

  function readCollections() {
    migrateLegacyIfNeeded();
    try {
      const parsed = JSON.parse(localStorage.getItem(COLLECTION_KEY) || 'null') || {};
      return {
        favorite1: dedupeNewest(parsed.favorite1),
        favorite2: dedupeNewest(parsed.favorite2),
      };
    } catch {
      return { favorite1: [], favorite2: [] };
    }
  }

  function writeCollections(collections) {
    const normalized = {
      version: 2,
      favorite1: dedupeNewest(collections.favorite1),
      favorite2: dedupeNewest(collections.favorite2),
    };
    try {
      localStorage.setItem(COLLECTION_KEY, JSON.stringify(normalized));
      const verify = JSON.parse(localStorage.getItem(COLLECTION_KEY) || 'null') || {};
      if (!Array.isArray(verify.favorite1) || !Array.isArray(verify.favorite2)) throw new Error('verify failed');
      window.dispatchEvent(new CustomEvent('hitsound-favorite-collections-change', { detail: normalized }));
      return true;
    } catch {
      setFeedback('お気に入りを保存できませんでした', true);
      return false;
    }
  }

  function descriptorFromCurrent(id) {
    if (!id || id === SILENT_ID) return null;
    const source = controller.byId(id);
    if (!source) return null;
    return {
      id,
      sourceNumber: String(source.sourceNumber || '—'),
      name: String(source.originalName || source.name || '名称なし'),
      family: String(source.originalFamily || source.family || ''),
      pitch: Number.isFinite(source.pitch) ? source.pitch : '',
      userLabel: String(source.userLabel || ''),
      custom: !!source.custom,
      slot: Number.isInteger(source.slot) ? source.slot : null,
      fingerprint: String(source.fingerprint || ''),
      silent: false,
    };
  }

  function currentEntry(prefix = 'favorite') {
    const selection = controller.getSelection();
    if (!selection?.don || !selection?.kat) return null;
    const don = descriptorFromCurrent(selection.don);
    const kat = descriptorFromCurrent(selection.kat);
    if (!don || !kat) return null;
    if ((don.custom && !don.fingerprint) || (kat.custom && !kat.fingerprint)) return null;
    return { id: makeId(prefix), don, kat, createdAt: new Date().toISOString() };
  }

  function slotLabel(slotName) {
    return slotName === 'favorite1' ? 'お気に入り①' : 'お気に入り②';
  }

  function dropdownLabel(source) {
    if (source === 'preset') return 'セット';
    return slotLabel(source);
  }

  function pairText(entry) {
    return `Don ${entry?.don?.sourceNumber || '—'} + Kat ${entry?.kat?.sourceNumber || '—'}`;
  }

  function formatSourceNumber(value) {
    const text = String(value ?? '—');
    return /^\d+$/.test(text) ? text.padStart(3, '0') : text;
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

  function setFeedback(message, error = false) {
    if (workbenchStatus) workbenchStatus.textContent = message;
    if (!feedback) return;
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.classList.toggle('error', error);
    feedbackTimer = window.setTimeout(() => {
      feedback.textContent = '';
      feedback.classList.remove('error');
    }, 2400);
  }

  function currentSavedIndex(slotName, current = currentEntry('current'), collections = readCollections()) {
    if (!current) return -1;
    const key = entryKey(current);
    return collections[slotName].findIndex(entry => entryKey(entry) === key);
  }

  function toggleCurrent(slotName) {
    const current = currentEntry(slotName);
    if (!current) {
      setFeedback('DonとKatの両方を選択してください', true);
      return;
    }

    const collections = readCollections();
    const items = collections[slotName];
    const index = items.findIndex(entry => entryKey(entry) === entryKey(current));
    const label = slotLabel(slotName);

    if (index >= 0) {
      items.splice(index, 1);
      if (!writeCollections(collections)) return;
      setFeedback(`${label}から解除しました`);
    } else {
      if (items.length >= MAX_ITEMS) {
        setFeedback(`${label}は最大${MAX_ITEMS}件です`, true);
        return;
      }
      items.unshift(current);
      if (!writeCollections(collections)) return;
      setFeedback(`${label}へ登録しました`);
    }
    renderAll();
  }

  function removeEntry(slotName, id) {
    const collections = readCollections();
    const before = collections[slotName].length;
    collections[slotName] = collections[slotName].filter(entry => entry.id !== id);
    if (collections[slotName].length === before) return;
    if (!writeCollections(collections)) return;
    renderAll();
  }

  function getPresets() {
    try {
      return typeof favorites.readPresets === 'function' ? favorites.readPresets() : [];
    } catch {
      return [];
    }
  }

  function dropdownItems(source) {
    if (source === 'preset') return getPresets();
    return readCollections()[source] || [];
  }

  async function applyEntry(entry, source) {
    const state = entryAvailability(entry);
    if (!state.ok) {
      setFeedback(state.reason, true);
      return;
    }
    const applied = await controller.setPair(entry.don.id, entry.kat.id);
    if (!applied) {
      setFeedback('組み合わせを適用できませんでした', true);
      return;
    }
    setFeedback(`${dropdownLabel(source)} ${pairText(entry)} を適用しました`);
    closeDropdown();
  }

  function ensureDropdown() {
    if (dropdown || !judgmentPanel) return dropdown;
    dropdown = document.createElement('div');
    dropdown.id = 'favoriteQuickDropdown';
    dropdown.className = 'favorite-quick-dropdown';
    dropdown.hidden = true;
    dropdown.setAttribute('role', 'menu');
    judgmentPanel.append(dropdown);
    return dropdown;
  }

  function appendPairCard(list, entry, index, source, currentKey) {
    const row = document.createElement('div');
    row.className = 'favorite-dropdown-row';
    const selected = !!currentKey && entryKey(entry) === currentKey;
    row.classList.toggle('is-current-selection', selected);

    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'favorite-dropdown-apply';
    const state = entryAvailability(entry);
    apply.disabled = !state.ok;
    apply.dataset.pairApply = entry.id;
    apply.dataset.pairSource = source;
    apply.setAttribute('aria-label', state.ok ? `${pairText(entry)} を適用` : `${pairText(entry)} は適用不可。${state.reason}`);
    if (selected) apply.setAttribute('aria-current', 'true');
    if (!state.ok) apply.title = state.reason;

    const rank = document.createElement('span');
    rank.className = 'favorite-card-rank';
    rank.textContent = CIRCLED[index] || String(index + 1);

    const don = document.createElement('span');
    don.className = 'favorite-card-source don';
    don.textContent = formatSourceNumber(entry.don?.sourceNumber);

    const kat = document.createElement('span');
    kat.className = 'favorite-card-source kat';
    kat.textContent = formatSourceNumber(entry.kat?.sourceNumber);

    apply.append(rank, don, kat);
    row.append(apply);

    if (source !== 'preset') {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'favorite-dropdown-delete';
      del.dataset.favoriteDelete = entry.id;
      del.dataset.favoriteSlot = source;
      del.textContent = '×';
      del.setAttribute('aria-label', `${pairText(entry)} を${slotLabel(source)}から削除`);
      row.append(del);
    }

    list.append(row);
  }

  function renderDropdown() {
    const root = ensureDropdown();
    if (!root || !openSource) return;
    const items = dropdownItems(openSource);
    const current = currentEntry('current');
    const currentKey = entryKey(current);
    root.replaceChildren();
    root.dataset.source = openSource;

    const head = document.createElement('div');
    head.className = 'favorite-dropdown-head';
    const title = document.createElement('strong');
    title.textContent = dropdownLabel(openSource);
    const count = document.createElement('span');
    count.textContent = openSource === 'preset' ? `${items.length}` : `${items.length}/${MAX_ITEMS}`;
    head.append(title, count);
    root.append(head);

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'favorite-dropdown-empty';
      empty.textContent = 'まだ登録されていません';
      root.append(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'favorite-dropdown-list';
    items.forEach((entry, index) => appendPairCard(list, entry, index, openSource, currentKey));
    root.append(list);
  }

  function triggerButtons() {
    return [...Object.values(listButtons), setButton].filter(Boolean);
  }

  function openDropdown(source) {
    const root = ensureDropdown();
    if (!root) return;
    if (openSource === source && !root.hidden) {
      closeDropdown();
      return;
    }
    openSource = source;
    renderDropdown();
    root.hidden = false;
    for (const [name, button] of Object.entries(listButtons)) {
      button?.setAttribute('aria-expanded', name === source ? 'true' : 'false');
    }
    setButton?.setAttribute('aria-expanded', source === 'preset' ? 'true' : 'false');
  }

  function closeDropdown() {
    openSource = '';
    if (dropdown) dropdown.hidden = true;
    for (const button of Object.values(listButtons)) button?.setAttribute('aria-expanded', 'false');
    setButton?.setAttribute('aria-expanded', 'false');
  }

  function renderButtons() {
    const collections = readCollections();
    const current = currentEntry('current');
    for (const [slotName, button] of Object.entries(toggleButtons)) {
      if (!button) continue;
      const currentSaved = currentSavedIndex(slotName, current, collections) >= 0;
      const isOne = slotName === 'favorite1';
      button.disabled = !current;
      button.classList.toggle('is-current-favorite', currentSaved);
      button.classList.remove('has-saved-pair');
      button.setAttribute('aria-pressed', currentSaved ? 'true' : 'false');
      button.textContent = isOne ? (currentSaved ? '♥' : '♡') : (currentSaved ? '★' : '☆');
      button.setAttribute('aria-label', currentSaved
        ? `現在の組み合わせを${slotLabel(slotName)}から解除`
        : `現在の組み合わせを${slotLabel(slotName)}へ登録`);
      button.title = currentSaved ? '現在の組み合わせは登録済み' : '現在の組み合わせを登録';
    }

    for (const [slotName, button] of Object.entries(listButtons)) {
      if (!button) continue;
      const amount = collections[slotName].length;
      button.textContent = slotLabel(slotName);
      button.title = `${slotLabel(slotName)} ${amount}/${MAX_ITEMS}`;
      button.setAttribute('aria-label', `${slotLabel(slotName)}の登録済み組み合わせを表示。${amount}/${MAX_ITEMS}件`);
    }

    if (setButton) {
      setButton.setAttribute('aria-label', '固定セットを表示');
      setButton.title = '固定セットを表示';
    }
  }

  function renderAll() {
    renderButtons();
    if (openSource) renderDropdown();
  }

  for (const [slotName, button] of Object.entries(toggleButtons)) {
    button?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleCurrent(slotName);
    }, { capture: true });
  }

  for (const [slotName, button] of Object.entries(listButtons)) {
    button?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openDropdown(slotName);
    }, { capture: true });
  }

  setButton?.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openDropdown('preset');
  }, { capture: true });

  ensureDropdown()?.addEventListener('click', event => {
    const del = event.target.closest('[data-favorite-delete]');
    if (del) {
      event.preventDefault();
      removeEntry(del.dataset.favoriteSlot, del.dataset.favoriteDelete);
      return;
    }

    const apply = event.target.closest('[data-pair-apply]');
    if (!apply) return;
    event.preventDefault();
    const source = apply.dataset.pairSource;
    const entry = dropdownItems(source).find(item => item.id === apply.dataset.pairApply);
    if (entry) applyEntry(entry, source).catch(error => setFeedback(error?.message || '適用できませんでした', true));
  });

  document.addEventListener('pointerdown', event => {
    if (!openSource || !dropdown || dropdown.hidden) return;
    if (dropdown.contains(event.target)) return;
    if (triggerButtons().some(button => button.contains(event.target))) return;
    closeDropdown();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && openSource) closeDropdown();
  });

  window.addEventListener('hitsound-selection-change', () => queueMicrotask(renderAll));
  window.addEventListener('hitsound-custom-sources-change', () => queueMicrotask(renderAll));
  window.addEventListener('hitsound-favorite-collections-change', () => queueMicrotask(renderAll));
  window.addEventListener('storage', event => {
    if (event.key === COLLECTION_KEY) renderAll();
  });
  window.addEventListener('pageshow', renderAll);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderAll();
  });

  const style = document.createElement('style');
  style.dataset.feature = 'favorite-unified-dropdown-v4';
  style.textContent = `
    .judgment-panel{position:relative!important}
    .judgment-actions{
      grid-template-columns:112px 112px 82px!important;
      justify-content:center;align-items:stretch;gap:8px!important;
    }
    .favorite-split{
      min-width:0;height:48px;display:grid;grid-template-columns:42px minmax(0,1fr);
      border:1px solid rgba(255,255,255,.18);border-radius:10px;overflow:hidden;background:rgba(45,59,66,.50);
    }
    .favorite-split>button{width:auto!important;min-width:0!important;height:46px!important;min-height:46px!important;border:0!important;border-radius:0!important;box-shadow:none!important}
    .favorite-split .quick-favorite{
      display:grid!important;place-items:center!important;padding:0!important;font-size:21px!important;
      border-right:1px solid rgba(255,255,255,.14)!important;background:rgba(255,255,255,.035)!important;
    }
    .favorite-split .favorite-list-button{
      padding:0 5px!important;background:transparent!important;color:rgba(255,255,255,.78)!important;
      font-size:9px!important;font-weight:850!important;line-height:1.1!important;white-space:nowrap!important;
    }
    .favorite-split .favorite-list-button[aria-expanded="true"],
    .judgment-actions .preset-action[aria-expanded="true"]{background:rgba(121,212,236,.15)!important;color:#f1fcff!important}
    .favorite-split .favorite-one[aria-pressed="true"]{
      color:#fff3c7!important;background:rgba(137,109,39,.42)!important;
      box-shadow:inset 0 0 12px rgba(244,212,125,.15)!important;
    }
    .favorite-split .favorite-two[aria-pressed="true"]{
      color:#f3deff!important;background:rgba(111,76,139,.44)!important;
      box-shadow:inset 0 0 12px rgba(196,139,238,.15)!important;
    }
    .favorite-split .quick-favorite:not([aria-pressed="true"]){color:rgba(255,255,255,.72)!important}
    .judgment-actions .preset-action{
      width:82px!important;min-width:82px!important;display:grid!important;grid-template-columns:auto 1fr!important;
      place-items:center!important;gap:4px!important;padding:0 7px!important;font-size:9px!important;line-height:1.05!important;
    }
    .set-check-icon{font-size:16px;font-weight:950;letter-spacing:-2px}
    .favorite-quick-dropdown[hidden]{display:none!important}
    .favorite-quick-dropdown{
      position:absolute;z-index:80;top:calc(100% + 5px);left:50%;transform:translateX(-50%);
      width:min(356px,calc(100vw - 24px));max-height:min(362px,54dvh);overflow:auto;overscroll-behavior:contain;
      padding:8px;border:1px solid rgba(121,212,236,.38);border-radius:12px;
      background:linear-gradient(180deg,rgba(28,46,55,.985),rgba(19,32,39,.99));box-shadow:0 15px 38px rgba(0,0,0,.48);
    }
    .favorite-dropdown-head{display:flex;align-items:center;justify-content:space-between;padding:4px 4px 8px;color:#eefbff;font-size:11px}
    .favorite-dropdown-head span{color:rgba(255,255,255,.58);font-variant-numeric:tabular-nums}
    .favorite-dropdown-list{display:grid;gap:6px}
    .favorite-dropdown-row{
      display:grid;grid-template-columns:minmax(0,1fr) 42px;gap:5px;padding:2px;
      border:1px solid transparent;border-radius:10px;background:transparent;
    }
    .favorite-dropdown-row:not(:has(.favorite-dropdown-delete)){grid-template-columns:minmax(0,1fr)}
    .favorite-dropdown-row.is-current-selection{
      border-color:rgba(139,224,244,.68);
      background:rgba(91,177,199,.18);
      box-shadow:inset 0 0 0 1px rgba(218,250,255,.07),0 0 12px rgba(75,232,255,.08);
    }
    .favorite-dropdown-apply,.favorite-dropdown-delete{min-height:44px!important;border-radius:8px!important}
    .favorite-dropdown-apply{
      min-width:0;padding:0 10px!important;display:grid!important;
      grid-template-columns:42px minmax(74px,1fr) minmax(74px,1fr);align-items:center;column-gap:11px;
      border:1px solid rgba(255,255,255,.12)!important;background:rgba(255,255,255,.035)!important;
      color:#fff!important;text-align:left!important;font-variant-numeric:tabular-nums;
    }
    .favorite-dropdown-row.is-current-selection .favorite-dropdown-apply{background:rgba(121,212,236,.08)!important}
    .favorite-card-rank{
      display:grid;place-items:center;align-self:stretch;border-right:1px solid rgba(255,255,255,.11);
      color:rgba(255,255,255,.72);font-size:15px;font-weight:850;
    }
    .favorite-card-source{
      min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;
      color:#f3f7f9;font-size:14px;font-weight:900;letter-spacing:.035em;white-space:nowrap;
    }
    .favorite-card-source::before{content:"";width:10px;height:10px;flex:0 0 10px;border-radius:50%}
    .favorite-card-source.don::before{background:#e8656c;box-shadow:0 0 7px rgba(232,101,108,.25)}
    .favorite-card-source.kat::before{background:#68b9dc;box-shadow:0 0 7px rgba(104,185,220,.25)}
    .favorite-dropdown-delete{
      padding:0!important;color:#ffd0d2!important;background:rgba(121,48,55,.27)!important;
      border:1px solid rgba(255,184,188,.14)!important;font-size:16px!important;font-weight:900!important;
    }
    .favorite-dropdown-empty{margin:0;padding:14px 8px;color:rgba(255,255,255,.60);font-size:11px;text-align:center}
    @media(max-width:430px){
      .judgment-actions{grid-template-columns:108px 108px 78px!important;gap:6px!important}
      .favorite-split{grid-template-columns:40px minmax(0,1fr)}
      .favorite-split .favorite-list-button{font-size:8px!important;padding-inline:3px!important}
      .judgment-actions .preset-action{width:78px!important;min-width:78px!important;padding-inline:5px!important;font-size:8px!important}
      .favorite-quick-dropdown{width:min(350px,calc(100vw - 18px));padding:7px}
      .favorite-dropdown-apply{grid-template-columns:38px minmax(68px,1fr) minmax(68px,1fr);column-gap:8px;padding-inline:7px!important}
      .favorite-card-source{font-size:13px;gap:6px}
    }
  `;
  document.head.appendChild(style);

  migrateLegacyIfNeeded();
  ensureDropdown();
  renderAll();

  window.HitsoundFavoriteCollections = {
    KEY: COLLECTION_KEY,
    MAX_ITEMS,
    read: readCollections,
    toggleCurrent,
  };
})();
