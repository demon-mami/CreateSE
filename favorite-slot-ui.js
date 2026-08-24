(() => {
  'use strict';

  const controller = window.HitsoundController;
  const favorites = window.HitsoundFavorites;
  if (!controller || !favorites) return;

  const LEGACY_KEY = favorites.KEY || 'osutaiko-hitsound-lab:pair-favorite-slots:v1';
  const COLLECTION_KEY = 'osutaiko-hitsound-lab:pair-favorite-collections:v2';
  const MAX_ITEMS = 12;
  const SILENT_ID = controller.SILENT_ID;
  const $ = id => document.getElementById(id);

  const buttons = {
    favorite1: $('favoriteOneButton'),
    favorite2: $('favoriteTwoButton'),
  };
  const openButton = $('favoriteOpenButton');
  const countNode = $('favoriteCount');
  const sheet = $('favoriteSheet');
  const dialog = $('savedSetsPanel');
  const title = $('favoriteSheetTitle');
  const list = $('savedSetsList');
  const exportButton = $('exportFavoritesButton');
  const sheetStatus = $('favoriteSheetStatus');
  const feedback = $('setFeedback');
  const workbenchStatus = $('workbenchStatus');

  let activeTab = 'preset';
  let feedbackTimer = 0;
  let tabsRoot = null;

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

  function dedupe(entries) {
    const out = [];
    const seen = new Set();
    for (const value of Array.isArray(entries) ? entries : []) {
      const entry = normalizeEntry(value);
      if (!entry) continue;
      const key = entryKey(entry);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  }

  function emptyCollections() {
    return { favorite1: [], favorite2: [] };
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
      const initial = {
        version: 2,
        favorite1: legacy.favorite1 ? [legacy.favorite1] : [],
        favorite2: legacy.favorite2 ? [legacy.favorite2] : [],
      };
      localStorage.setItem(COLLECTION_KEY, JSON.stringify(initial));
    } catch {}
  }

  function readCollections() {
    migrateLegacyIfNeeded();
    try {
      const parsed = JSON.parse(localStorage.getItem(COLLECTION_KEY) || 'null') || {};
      return {
        favorite1: dedupe(parsed.favorite1),
        favorite2: dedupe(parsed.favorite2),
      };
    } catch {
      return emptyCollections();
    }
  }

  function writeCollections(collections) {
    const normalized = {
      version: 2,
      favorite1: dedupe(collections.favorite1),
      favorite2: dedupe(collections.favorite2),
    };
    try {
      localStorage.setItem(COLLECTION_KEY, JSON.stringify(normalized));
      const verify = JSON.parse(localStorage.getItem(COLLECTION_KEY) || 'null') || {};
      const actual = {
        favorite1: dedupe(verify.favorite1),
        favorite2: dedupe(verify.favorite2),
      };
      if (actual.favorite1.length !== normalized.favorite1.length || actual.favorite2.length !== normalized.favorite2.length) {
        throw new Error('favorite collection verification failed');
      }
      window.dispatchEvent(new CustomEvent('hitsound-favorite-collections-change', { detail: actual }));
      return true;
    } catch {
      setFeedback('お気に入りを保存できませんでした。ブラウザのサイトデータ保存設定を確認してください', true);
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

  function pairText(entry) {
    if (!entry) return '未登録';
    return `Don ${entry.don?.sourceNumber || '—'} + Kat ${entry.kat?.sourceNumber || '—'}`;
  }

  function availability(side) {
    if (!side?.id || side.id === SILENT_ID || side.silent) return { ok: false, reason: '無音を含む組み合わせは使用できません' };
    const source = controller.byId(side.id);
    if (!source) return { ok: false, reason: `${side.sourceNumber} ${side.name} を再登録してください` };
    if (side.custom) {
      if (!side.fingerprint) return { ok: false, reason: 'My Soundを再登録してください' };
      if (!source.custom || source.fingerprint !== side.fingerprint) {
        return { ok: false, reason: `${side.sourceNumber} ${side.name} と同じMy Soundを再登録してください` };
      }
    }
    return { ok: true, reason: '' };
  }

  function entryAvailability(entry) {
    if (!entry) return { ok: false, reason: '組み合わせがありません' };
    const don = availability(entry.don);
    const kat = availability(entry.kat);
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
    }, 2800);
  }

  function setSheetStatus(message = '', error = false) {
    if (!sheetStatus) return;
    sheetStatus.textContent = message;
    sheetStatus.classList.toggle('error', error);
  }

  function slotLabel(slotName) {
    return slotName === 'favorite1' ? 'お気に入り1' : 'お気に入り2';
  }

  function addCurrent(slotName) {
    const entry = currentEntry(slotName);
    const label = slotLabel(slotName);
    if (!entry) {
      setFeedback('DonとKatの両方を選択してください', true);
      return;
    }

    const collections = readCollections();
    const items = collections[slotName];
    if (items.some(item => entryKey(item) === entryKey(entry))) {
      setFeedback(`${label}に保存済みです`);
      renderAll();
      return;
    }
    if (items.length >= MAX_ITEMS) {
      setFeedback(`${label}は最大${MAX_ITEMS}件です。一覧から不要な組み合わせを削除してください`, true);
      renderAll();
      return;
    }

    items.push(entry);
    if (!writeCollections(collections)) return;
    setFeedback(`${label}へ追加しました（${items.length}/${MAX_ITEMS}）`);
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

  async function applyEntry(entry, sourceLabel) {
    const state = entryAvailability(entry);
    if (!state.ok) {
      setSheetStatus(state.reason, true);
      return;
    }
    const applied = await controller.setPair(entry.don.id, entry.kat.id);
    if (!applied) {
      setSheetStatus('組み合わせを適用できませんでした', true);
      return;
    }
    setSheetStatus(`${sourceLabel} ${pairText(entry)} を適用しました`);
    window.dispatchEvent(new CustomEvent('hitsound-preset-applied', { detail: { label: `${sourceLabel} ${pairText(entry)}` } }));
  }

  function getPresets() {
    return typeof favorites.readPresets === 'function' ? favorites.readPresets() : [];
  }

  function createTabs() {
    if (!dialog || tabsRoot) return;
    tabsRoot = document.createElement('div');
    tabsRoot.className = 'favorite-collection-tabs';
    tabsRoot.setAttribute('role', 'tablist');
    tabsRoot.setAttribute('aria-label', '保存済み組み合わせ');
    const actions = dialog.querySelector('.favorite-dialog-actions');
    if (actions) actions.insertAdjacentElement('afterend', tabsRoot);
    else dialog.insertBefore(tabsRoot, list || null);
  }

  function renderTabs() {
    createTabs();
    if (!tabsRoot) return;
    const collections = readCollections();
    const tabs = [
      ['preset', 'Preset', getPresets().length || 12],
      ['favorite1', 'お気に入り1', collections.favorite1.length],
      ['favorite2', 'お気に入り2', collections.favorite2.length],
    ];
    tabsRoot.replaceChildren();
    for (const [tab, label, amount] of tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'favorite-collection-tab';
      button.dataset.favoriteTab = tab;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', activeTab === tab ? 'true' : 'false');
      button.textContent = tab === 'preset' ? `${label} ${amount}` : `${label} ${amount}/${MAX_ITEMS}`;
      tabsRoot.append(button);
    }
  }

  function makeItem(entry, { label = '', deletable = false, slotName = '' } = {}) {
    const item = document.createElement('div');
    item.className = 'favorite-set-item favorite-collection-item';
    const state = entryAvailability(entry);
    item.classList.toggle('unavailable', !state.ok);

    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'hs-key favorite-set-apply';
    apply.dataset.favoriteApply = entry.id;
    if (slotName) apply.dataset.favoriteSlot = slotName;
    apply.disabled = !state.ok;
    apply.title = state.ok ? `${entry.don.name} + ${entry.kat.name}` : state.reason;
    apply.setAttribute('aria-label', state.ok ? `${label} ${pairText(entry)} を適用` : `${pairText(entry)} は適用不可。${state.reason}`);

    const face = document.createElement('span');
    face.className = 'favorite-pair-face';
    const primary = document.createElement('strong');
    primary.textContent = label ? `${label}　${pairText(entry)}` : pairText(entry);
    face.append(primary);
    if (!state.ok) {
      const reason = document.createElement('small');
      reason.textContent = state.reason;
      face.append(reason);
    }
    apply.append(face);
    item.append(apply);

    if (deletable) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'hs-key favorite-set-delete';
      del.dataset.favoriteDelete = entry.id;
      del.dataset.favoriteSlot = slotName;
      del.setAttribute('aria-label', `${pairText(entry)} を${slotLabel(slotName)}から削除`);
      const delFace = document.createElement('span');
      delFace.textContent = '×';
      del.append(delFace);
      item.append(del);
    }

    return item;
  }

  function renderList() {
    if (!list) return;
    list.replaceChildren();
    setSheetStatus('');

    if (activeTab === 'preset') {
      const presets = getPresets();
      presets.forEach((entry, index) => {
        const label = String(entry.id || `P${String(index + 1).padStart(2, '0')}`);
        list.append(makeItem(entry, { label }));
      });
      if (title) title.textContent = 'Preset / Favorites';
      return;
    }

    const collections = readCollections();
    const items = collections[activeTab];
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'favorite-empty';
      empty.textContent = `${slotLabel(activeTab)}はまだ登録されていません`;
      list.append(empty);
      return;
    }

    items.forEach((entry, index) => {
      list.append(makeItem(entry, {
        label: `${index + 1}.`,
        deletable: true,
        slotName: activeTab,
      }));
    });
  }

  function renderButtons() {
    const collections = readCollections();
    const current = currentEntry('current');
    for (const [slotName, button] of Object.entries(buttons)) {
      if (!button) continue;
      const items = collections[slotName];
      const currentSaved = !!current && items.some(item => entryKey(item) === entryKey(current));
      const isOne = slotName === 'favorite1';
      const icon = isOne ? (items.length ? '♥' : '♡') : (items.length ? '★' : '☆');

      button.disabled = !current;
      button.classList.toggle('has-saved-pair', items.length > 0);
      button.classList.toggle('is-current-favorite', currentSaved);
      button.setAttribute('aria-pressed', currentSaved ? 'true' : 'false');
      button.setAttribute('aria-label', `${slotLabel(slotName)} ${items.length}/${MAX_ITEMS}。${currentSaved ? '現在の組み合わせは保存済み' : '現在の組み合わせを追加'}`);
      button.title = `${slotLabel(slotName)}: ${items.length}/${MAX_ITEMS}`;
      button.replaceChildren();

      const iconNode = document.createElement('span');
      iconNode.className = 'favorite-slot-icon';
      iconNode.setAttribute('aria-hidden', 'true');
      iconNode.textContent = icon;
      const meta = document.createElement('span');
      meta.className = 'favorite-slot-meta';
      const labelNode = document.createElement('span');
      labelNode.className = 'favorite-slot-label';
      labelNode.textContent = slotLabel(slotName);
      const count = document.createElement('span');
      count.className = 'favorite-slot-pair';
      count.textContent = `${items.length} / ${MAX_ITEMS}`;
      meta.append(labelNode, count);
      button.append(iconNode, meta);
    }
    if (countNode) countNode.textContent = '12';
    if (openButton) openButton.setAttribute('aria-label', 'Presetとお気に入り一覧を開く');
  }

  function renderAll() {
    renderButtons();
    renderTabs();
    if (sheet && !sheet.hidden) renderList();
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function descriptorCsv(side) {
    return [
      side?.sourceNumber || '', side?.id || '', side?.name || '', side?.family || '',
      side?.pitch ?? '', side?.userLabel || '', side?.custom ? 'YES' : '', side?.fingerprint || '',
    ];
  }

  function makeCsv() {
    const rows = [[
      'PairType','Index',
      'DonNo','DonID','DonName','DonFamily','DonPitchHz','DonUserLabel','DonMySound','DonFingerprint',
      'KatNo','KatID','KatName','KatFamily','KatPitchHz','KatUserLabel','KatMySound','KatFingerprint',
      'Available','CreatedAt'
    ]];
    const presets = getPresets();
    presets.forEach((entry, index) => rows.push([
      'PRESET', index + 1, ...descriptorCsv(entry.don), ...descriptorCsv(entry.kat), entryAvailability(entry).ok ? 'YES' : 'NO', ''
    ]));
    const collections = readCollections();
    for (const slotName of ['favorite1', 'favorite2']) {
      collections[slotName].forEach((entry, index) => rows.push([
        slotName === 'favorite1' ? 'FAVORITE_1' : 'FAVORITE_2', index + 1,
        ...descriptorCsv(entry.don), ...descriptorCsv(entry.kat), entryAvailability(entry).ok ? 'YES' : 'NO', entry.createdAt || ''
      ]));
    }
    return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  async function exportCsv() {
    const file = new File([makeCsv()], 'osu_taiko_hitsound_lab_pairs.csv', { type: 'text/csv;charset=utf-8' });
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: 'osu!taiko Hitsound Lab Pairs' });
        setSheetStatus('CSVを共有しました');
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSheetStatus('CSVを出力しました');
  }

  for (const [slotName, button] of Object.entries(buttons)) {
    button?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      addCurrent(slotName);
    }, { capture: true });
  }

  exportButton?.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    exportCsv().catch(error => setSheetStatus(error?.message || 'CSVを出力できませんでした', true));
  }, { capture: true });

  dialog?.addEventListener('click', event => {
    const tab = event.target.closest('[data-favorite-tab]');
    if (tab) {
      event.preventDefault();
      activeTab = tab.dataset.favoriteTab || 'preset';
      renderTabs();
      renderList();
      return;
    }

    const del = event.target.closest('[data-favorite-delete]');
    if (del) {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeEntry(del.dataset.favoriteSlot, del.dataset.favoriteDelete);
      return;
    }

    const apply = event.target.closest('[data-favorite-apply]');
    if (apply) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = apply.dataset.favoriteApply;
      const slotName = apply.dataset.favoriteSlot || '';
      if (slotName) {
        const entry = readCollections()[slotName].find(item => item.id === id);
        if (entry) applyEntry(entry, slotLabel(slotName)).catch(error => setSheetStatus(error?.message || '適用できませんでした', true));
      } else {
        const entry = getPresets().find(item => item.id === id);
        if (entry) applyEntry(entry, String(entry.id || 'Preset')).catch(error => setSheetStatus(error?.message || '適用できませんでした', true));
      }
    }
  }, { capture: true });

  openButton?.addEventListener('click', () => {
    activeTab = 'preset';
    queueMicrotask(() => {
      renderTabs();
      renderList();
    });
  });

  window.addEventListener('hitsound-selection-change', () => queueMicrotask(renderButtons));
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
  style.dataset.feature = 'favorite-collections-v2';
  style.textContent = `
    .judgment-actions{
      grid-template-columns:112px 112px 72px!important;
      justify-content:center;
      align-items:stretch;
      gap:10px!important;
    }
    .judgment-actions .quick-favorite{
      width:112px;min-width:112px;min-height:48px;padding:4px 7px!important;
      display:grid;grid-template-columns:26px minmax(0,1fr);align-items:center;gap:5px;text-align:left;
    }
    .favorite-slot-icon{display:grid;place-items:center;font-size:20px;line-height:1}
    .favorite-slot-meta{min-width:0;display:grid;gap:2px;line-height:1.1}
    .favorite-slot-label{overflow:hidden;color:rgba(255,255,255,.76);font-size:9px;font-weight:820;white-space:nowrap;text-overflow:ellipsis}
    .favorite-slot-pair{overflow:hidden;color:rgba(255,255,255,.62);font-size:9px;font-weight:760;font-variant-numeric:tabular-nums;white-space:nowrap;text-overflow:ellipsis}
    .quick-favorite.has-saved-pair{border-color:rgba(255,255,255,.42)!important}
    .quick-favorite.favorite-one.has-saved-pair{color:#fff3c7;background:rgba(137,109,39,.22)}
    .quick-favorite.favorite-two.has-saved-pair{color:#f3deff;background:rgba(111,76,139,.25)}
    .quick-favorite.is-current-favorite{box-shadow:0 0 0 1px rgba(255,255,255,.22),0 0 15px rgba(255,255,255,.11)!important}
    .judgment-actions .preset-action{width:72px;min-width:72px}
    .favorite-collection-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:0 0 11px}
    .favorite-collection-tab{min-height:44px;padding:0 8px!important;border-radius:9px!important;font-size:11px!important}
    .favorite-collection-tab[aria-selected="true"]{border-color:rgba(121,212,236,.72)!important;background:rgba(68,149,174,.36)!important;color:#ecfbff!important}
    .favorite-collection-item{grid-template-columns:minmax(0,1fr) 52px}
    .favorite-collection-item:not(:has(.favorite-set-delete)){grid-template-columns:minmax(0,1fr)}
    .favorite-pair-face{height:auto!important;min-height:44px!important;padding:7px 10px!important;display:grid!important;align-content:center!important;justify-items:start!important;gap:2px!important;text-align:left!important}
    .favorite-pair-face strong{font-size:11px;font-weight:820}
    .favorite-pair-face small{display:block;color:#ffd0d2;font-size:9px;line-height:1.25;font-weight:650;white-space:normal}
    .favorite-set-item.unavailable .favorite-set-apply{opacity:.58}
    @media(max-width:430px){
      .judgment-actions{grid-template-columns:106px 106px 68px!important;gap:8px!important}
      .judgment-actions .quick-favorite{width:106px;min-width:106px;padding-inline:6px!important}
      .judgment-actions .preset-action{width:68px;min-width:68px}
      .favorite-slot-label{font-size:8px}.favorite-slot-pair{font-size:8px}
      .favorite-collection-tabs{gap:5px}.favorite-collection-tab{font-size:9px!important;padding-inline:4px!important}
    }
  `;
  document.head.appendChild(style);

  migrateLegacyIfNeeded();
  createTabs();
  renderAll();

  window.HitsoundFavoriteCollections = {
    KEY: COLLECTION_KEY,
    MAX_ITEMS,
    read: readCollections,
  };
})();