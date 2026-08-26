(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const controller = window.HitsoundController;
  if (!CANDIDATES.length || !controller) return;

  const LEGACY_STORAGE_KEY = 'osutaiko-hitsound-lab-favorites-current111-abc-v5';
  const LEGACY_SEED_KEY = `${LEGACY_STORAGE_KEY}:seed:phase7a-pair12-v5`;
  const SLOT_STORAGE_KEY = 'osutaiko-hitsound-lab:pair-favorite-slots:v1';
  const PRESET_MAX_ITEMS = 30;
  const PRESET_PAIRS = Object.freeze([
    ['P01', 'SRC051', 'SRC052'],
    ['P02', 'SRC116', 'SRC092'],
    ['P03', 'SRC072', 'SRC073'],
    ['P04', 'SRC071', 'SRC073'],
    ['P05', 'SRC066', 'SRC069'],
    ['P06', 'SRC069', 'SRC107'],
    ['P07', 'SRC070', 'SRC101'],
    ['P08', 'SRC006', 'SRC007'],
    ['P09', 'SRC025', 'SRC026'],
    ['P10', 'SRC043', 'SRC047'],
    ['P11', 'SRC107', 'SRC101'],
    ['P12', 'SRC006', 'SRC003'],
  ]);
  const SILENT_ID = controller.SILENT_ID;
  const $ = id => document.getElementById(id);
  const slotButtons = {
    favorite1: $('favoriteOneButton'),
    favorite2: $('favoriteTwoButton'),
  };
  const exportButton = $('exportFavoritesButton');
  const list = $('savedSetsList');
  const count = $('favoriteCount');
  const feedback = $('setFeedback');
  const sheetStatus = $('favoriteSheetStatus');
  const workbenchStatus = $('workbenchStatus');
  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const valid = candidate => candidate && !candidate.excluded;
  const familyOf = candidate => candidate?.originalFamily || candidate?.family || '';
  const GOOD_CROSS = new Map();
  let feedbackTimer = 0;

  for (const [, donId, katId] of PRESET_PAIRS) {
    if (!GOOD_CROSS.has(donId)) GOOD_CROSS.set(donId, new Set());
    GOOD_CROSS.get(donId).add(katId);
  }

  function makeId(prefix = 'favorite') {
    if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function describe(id) {
    if (!id || id === SILENT_ID) return { id: id || SILENT_ID, silent: true, sourceNumber: '無音', name: '無音' };
    const source = controller.byId(id);
    if (!source) return { id, sourceNumber: '—', name: '音源未登録' };
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
    };
  }

  function normalizeDescriptor(value) {
    if (typeof value === 'string') return describe(value);
    if (!value || typeof value !== 'object') return describe(SILENT_ID);
    return {
      id: String(value.id || SILENT_ID),
      sourceNumber: String(value.sourceNumber || '—'),
      name: String(value.name || '音源未登録'),
      family: String(value.family || ''),
      pitch: Number.isFinite(value.pitch) ? value.pitch : '',
      userLabel: String(value.userLabel || ''),
      custom: !!value.custom,
      slot: Number.isInteger(value.slot) ? value.slot : null,
      fingerprint: String(value.fingerprint || ''),
      silent: value.id === SILENT_ID || !!value.silent,
    };
  }

  function normalizeEntry(value, fallbackId = makeId()) {
    if (!value || typeof value !== 'object') return null;
    return {
      id: String(value.id || fallbackId),
      don: normalizeDescriptor(value.don),
      kat: normalizeDescriptor(value.kat),
      createdAt: String(value.createdAt || ''),
    };
  }

  function descriptorKey(side) {
    return `${side.id}@${side.custom ? side.fingerprint : 'builtin'}`;
  }

  function entryKey(entry) {
    return entry ? `${descriptorKey(entry.don)}|${descriptorKey(entry.kat)}` : '';
  }

  function presetEntries() {
    return PRESET_PAIRS.slice(0, PRESET_MAX_ITEMS).map(([pairId, donId, katId]) => ({
      id: pairId,
      don: describe(donId),
      kat: describe(katId),
      createdAt: '',
      fixed: true,
    }));
  }

  function readSlots() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SLOT_STORAGE_KEY) || 'null') || {};
      return {
        favorite1: normalizeEntry(parsed.favorite1, 'favorite-1'),
        favorite2: normalizeEntry(parsed.favorite2, 'favorite-2'),
      };
    } catch {
      return { favorite1: null, favorite2: null };
    }
  }

  function writeSlots(slots) {
    try {
      localStorage.setItem(SLOT_STORAGE_KEY, JSON.stringify({
        version: 1,
        favorite1: slots.favorite1 || null,
        favorite2: slots.favorite2 || null,
      }));
    } catch {}
    updateQuickButtons();
    window.dispatchEvent(new CustomEvent('hitsound-quick-favorites-change', {
      detail: {
        favorite1: entryKey(slots.favorite1),
        favorite2: entryKey(slots.favorite2),
      },
    }));
  }

  function currentEntry(prefix = 'favorite') {
    const { don, kat } = controller.getSelection();
    const donDescriptor = describe(don);
    const katDescriptor = describe(kat);
    if (!don || !kat || don === SILENT_ID || kat === SILENT_ID) return null;
    if (!controller.byId(don) || !controller.byId(kat)) return null;
    if ((donDescriptor.custom && !donDescriptor.fingerprint) || (katDescriptor.custom && !katDescriptor.fingerprint)) return null;
    return {
      id: makeId(prefix),
      don: donDescriptor,
      kat: katDescriptor,
      createdAt: new Date().toISOString(),
    };
  }

  function availability(side) {
    if (!side?.id || side.id === SILENT_ID || side.silent) return { ok: false, reason: '無音を含む組み合わせは使用できません' };
    const source = controller.byId(side.id);
    if (!source) return { ok: false, reason: `${side.sourceNumber} ${side.name} を再登録してください` };
    if (side.custom || source.custom) {
      if (!side.fingerprint) return { ok: false, reason: 'My Soundを再登録してください' };
      if (!source.custom || source.fingerprint !== side.fingerprint) {
        return { ok: false, reason: `${side.sourceNumber} ${side.name} と同じMy Soundを再登録してください` };
      }
    }
    return { ok: true, reason: '' };
  }

  function entryAvailability(entry) {
    const don = availability(entry.don);
    const kat = availability(entry.kat);
    return don.ok && kat.ok ? { ok: true, reason: '' } : { ok: false, reason: don.reason || kat.reason };
  }

  function pairLabel(entry) {
    return `Don ${entry.don.sourceNumber} + Kat ${entry.kat.sourceNumber}`;
  }

  function setFeedback(message, { error = false } = {}) {
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

  function setSheetStatus(message) {
    if (sheetStatus) sheetStatus.textContent = message;
  }

  function toggleSlot(slotName) {
    const entry = currentEntry(slotName);
    if (!entry) {
      setFeedback('DonとKatの両方を選択してください', { error: true });
      return;
    }
    const slots = readSlots();
    const same = entryKey(slots[slotName]) === entryKey(entry);
    slots[slotName] = same ? null : entry;
    writeSlots(slots);
    const label = slotName === 'favorite1' ? 'お気に入り1' : 'お気に入り2';
    setFeedback(same ? `${label}を解除しました` : `${label}へ登録しました`);
  }

  function updateQuickButtons() {
    const slots = readSlots();
    const current = currentEntry('current');
    for (const [slotName, button] of Object.entries(slotButtons)) {
      if (!button) continue;
      const saved = slots[slotName];
      const matches = !!current && entryKey(saved) === entryKey(current);
      const number = slotName === 'favorite1' ? '1' : '2';
      button.disabled = !current;
      button.classList.toggle('has-saved-pair', !!saved);
      button.setAttribute('aria-pressed', matches ? 'true' : 'false');
      button.textContent = slotName === 'favorite1' ? (matches ? '♥' : '♡') : (matches ? '★' : '☆');
      button.setAttribute('aria-label', !current
        ? `お気に入り${number}へ登録できる組み合わせがありません`
        : matches
          ? `現在の組み合わせをお気に入り${number}から解除`
          : saved
            ? `お気に入り${number}を現在の組み合わせで上書き`
            : `現在の組み合わせをお気に入り${number}へ登録`);
    }
  }

  async function applyPreset(id) {
    const entry = presetEntries().find(item => item.id === id);
    if (!entry) return;
    const state = entryAvailability(entry);
    if (!state.ok) {
      setSheetStatus(state.reason);
      return;
    }
    const applied = await controller.setPair(entry.don.id, entry.kat.id);
    setSheetStatus(applied ? `${pairLabel(entry)} を適用しました` : 'プリセットを適用できませんでした');
    if (applied) window.dispatchEvent(new CustomEvent('hitsound-preset-applied', { detail: { label: pairLabel(entry) } }));
  }

  function renderPresets() {
    if (!list) return;
    const entries = presetEntries();
    list.replaceChildren();
    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = 'favorite-set-item preset-set-item';
      const state = entryAvailability(entry);
      item.classList.toggle('unavailable', !state.ok);

      const applyButton = document.createElement('button');
      applyButton.type = 'button';
      applyButton.className = 'hs-key favorite-set-apply';
      applyButton.dataset.applyPreset = entry.id;
      applyButton.disabled = !state.ok;
      applyButton.setAttribute('aria-label', state.ok ? `${entry.id} ${pairLabel(entry)} を適用` : `${entry.id} は適用不可。${state.reason}`);
      applyButton.title = state.ok ? `${entry.don.name} + ${entry.kat.name}` : state.reason;
      const face = document.createElement('span');
      face.textContent = `${entry.id}　${pairLabel(entry)}`;
      applyButton.append(face);
      item.append(applyButton);
      list.append(item);
    }
    if (count) count.textContent = String(entries.length);
    if (exportButton) exportButton.disabled = false;
  }

  function isRecommendedPair(donId, katId) {
    return donId !== SILENT_ID && katId !== SILENT_ID && GOOD_CROSS.get(donId)?.has(katId) === true;
  }

  function recommendedFor(side, selection = controller.getSelection()) {
    if (side === 'kat') {
      if (!selection.don || selection.don === SILENT_ID) return [];
      return Array.from(GOOD_CROSS.get(selection.don) || []).filter(id => valid(byId(id)));
    }
    if (side === 'don') {
      if (!selection.kat || selection.kat === SILENT_ID) return [];
      const out = [];
      for (const [donId, katIds] of GOOD_CROSS.entries()) {
        if (katIds.has(selection.kat) && valid(byId(donId))) out.push(donId);
      }
      return out;
    }
    return [];
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function descriptorCsv(side) {
    const source = controller.byId(side.id) || byId(side.id);
    return [
      side.sourceNumber,
      side.id,
      side.name,
      side.family || familyOf(source),
      side.pitch ?? source?.pitch ?? '',
      side.userLabel || source?.userLabel || '',
      side.custom ? 'YES' : '',
      side.fingerprint || '',
    ];
  }

  function makeCsv() {
    const rows = [[
      'PairType',
      'DonNo','DonID','DonName','DonFamily','DonPitchHz','DonUserLabel','DonMySound','DonFingerprint',
      'KatNo','KatID','KatName','KatFamily','KatPitchHz','KatUserLabel','KatMySound','KatFingerprint',
      'Available','CreatedAt'
    ]];
    for (const entry of presetEntries()) {
      rows.push([
        `PRESET_${entry.id}`,
        ...descriptorCsv(entry.don),
        ...descriptorCsv(entry.kat),
        entryAvailability(entry).ok ? 'YES' : 'NO',
        '',
      ]);
    }
    const slots = readSlots();
    for (const [slotName, entry] of Object.entries(slots)) {
      if (!entry) continue;
      rows.push([
        slotName === 'favorite1' ? 'FAVORITE_1' : 'FAVORITE_2',
        ...descriptorCsv(entry.don),
        ...descriptorCsv(entry.kat),
        entryAvailability(entry).ok ? 'YES' : 'NO',
        entry.createdAt || '',
      ]);
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
      if (error?.name === 'AbortError') {
        setSheetStatus('CSV出力をキャンセルしました');
        return;
      }
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

  slotButtons.favorite1?.addEventListener('click', () => toggleSlot('favorite1'));
  slotButtons.favorite2?.addEventListener('click', () => toggleSlot('favorite2'));
  exportButton?.addEventListener('click', () => exportCsv().catch(error => setSheetStatus(error.message || 'CSVを出力できませんでした')));
  list?.addEventListener('click', event => {
    const applyButton = event.target.closest('[data-apply-preset]');
    if (applyButton) applyPreset(applyButton.dataset.applyPreset).catch(error => setSheetStatus(error.message || 'プリセットを適用できませんでした'));
  });

  window.addEventListener('hitsound-selection-change', updateQuickButtons);
  window.addEventListener('hitsound-custom-sources-change', () => {
    renderPresets();
    updateQuickButtons();
  });
  window.addEventListener('storage', event => {
    if (event.key === SLOT_STORAGE_KEY) updateQuickButtons();
  });

  window.HitsoundFavorites = {
    KEY: SLOT_STORAGE_KEY,
    MAX_PRESETS: PRESET_MAX_ITEMS,
    readSets: presetEntries,
    readPresets: presetEntries,
    readSlots,
    isRecommendedPair,
    recommendedFor,
  };

  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SEED_KEY);
  } catch {}
  renderPresets();
  updateQuickButtons();
})();