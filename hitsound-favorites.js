(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const controller = window.HitsoundController;
  if (!CANDIDATES.length || !controller) return;

  const STORAGE_KEY = 'osutaiko-hitsound-lab-favorites-v1';
  const SILENT_ID = controller.SILENT_ID;
  const $ = id => document.getElementById(id);
  const setButton = $('favSetButton');
  const exportButton = $('exportFavoritesButton');
  const list = $('savedSetsList');
  const empty = $('favoriteEmpty');
  const count = $('favoriteCount');
  const feedback = $('setFeedback');
  const sheetStatus = $('favoriteSheetStatus');
  const workbenchStatus = $('workbenchStatus');

  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const valid = candidate => candidate && !candidate.excluded;
  const familyOf = candidate => candidate?.originalFamily || candidate?.family || '';
  const GOOD_CROSS = new Map();
  let feedbackTimer = 0;
  let undoTimer = 0;
  let pendingUndo = null;

  function makeId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `favorite-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

  function normalizeEntry(value, index) {
    if (typeof value === 'string') {
      const [donId, katId] = value.split('|');
      return { id: `legacy-${index}-${donId}-${katId}`, don: describe(donId), kat: describe(katId), legacy: true };
    }
    if (!value || typeof value !== 'object') return null;
    return {
      id: String(value.id || `favorite-${index}-${Date.now()}`),
      don: normalizeDescriptor(value.don),
      kat: normalizeDescriptor(value.kat),
      createdAt: String(value.createdAt || ''),
      legacy: !!value.legacy,
    };
  }

  function readSets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {};
      return (Array.isArray(parsed.set) ? parsed.set : []).map(normalizeEntry).filter(Boolean);
    } catch {
      return [];
    }
  }

  function writeSets(sets) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, set: sets })); } catch {}
    renderSavedSets();
    updateSetButton();
    window.dispatchEvent(new CustomEvent('hitsound-saved-sets-change', { detail: sets.map(entry => entry.id) }));
  }

  function descriptorKey(side) {
    return `${side.id}@${side.custom ? side.fingerprint : 'builtin'}`;
  }

  function entryKey(entry) {
    return `${descriptorKey(entry.don)}|${descriptorKey(entry.kat)}`;
  }

  function currentEntry() {
    const { don, kat } = controller.getSelection();
    const donDescriptor = describe(don);
    const katDescriptor = describe(kat);
    if (!don || !kat || don === SILENT_ID || kat === SILENT_ID) return null;
    if (!controller.byId(don) || !controller.byId(kat)) return null;
    if ((donDescriptor.custom && !donDescriptor.fingerprint) || (katDescriptor.custom && !katDescriptor.fingerprint)) return null;
    return { id: makeId(), don: donDescriptor, kat: katDescriptor, createdAt: new Date().toISOString() };
  }

  function availability(side) {
    if (!side?.id || side.id === SILENT_ID || side.silent) return { ok: false, reason: '無音を含むFavoriteは適用できません' };
    const source = controller.byId(side.id);
    if (!source) return { ok: false, reason: `${side.sourceNumber} ${side.name} を再登録してください` };
    if (side.custom) {
      if (!side.fingerprint) return { ok: false, reason: '旧My Sound Favoriteは音源を再登録して保存し直してください' };
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

  function setFeedback(message, { error = false } = {}) {
    if (workbenchStatus) workbenchStatus.textContent = message;
    if (!feedback) return;
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.classList.toggle('error', error);
    feedbackTimer = window.setTimeout(() => {
      feedback.textContent = '';
      feedback.classList.remove('error');
    }, 3200);
  }

  function setSheetStatus(message, undo = null) {
    if (!sheetStatus) return;
    sheetStatus.replaceChildren(document.createTextNode(message));
    if (!undo) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-undo';
    button.textContent = '元に戻す';
    button.addEventListener('click', restoreDeletedSet, { once: true });
    sheetStatus.append(document.createTextNode(' '), button);
  }

  function recordCurrentSet() {
    const entry = currentEntry();
    if (!entry) {
      setFeedback('DonとKatの両方に音源を選択してください。無音はFavoriteに登録できません。', { error: true });
      return;
    }
    const sets = readSets();
    if (sets.some(saved => entryKey(saved) === entryKey(entry))) {
      setFeedback('この組み合わせは登録済みです');
      return;
    }
    sets.push(entry);
    writeSets(sets);
    setFeedback('Favoriteへ追加しました');
  }

  function removeSet(id) {
    const sets = readSets();
    const index = sets.findIndex(entry => entry.id === id);
    if (index < 0) return;
    clearTimeout(undoTimer);
    pendingUndo = { entry: sets[index], index };
    sets.splice(index, 1);
    writeSets(sets);
    setSheetStatus('Favoriteを削除しました。', pendingUndo);
    undoTimer = window.setTimeout(() => {
      pendingUndo = null;
      setSheetStatus('');
    }, 6000);
  }

  function restoreDeletedSet() {
    if (!pendingUndo) return;
    clearTimeout(undoTimer);
    const sets = readSets();
    sets.splice(Math.min(pendingUndo.index, sets.length), 0, pendingUndo.entry);
    pendingUndo = null;
    writeSets(sets);
    setSheetStatus('Favoriteを元に戻しました');
  }

  async function applySet(id) {
    const entry = readSets().find(item => item.id === id);
    if (!entry) return;
    const state = entryAvailability(entry);
    if (!state.ok) {
      setSheetStatus(state.reason);
      return;
    }
    const applied = await controller.setPair(entry.don.id, entry.kat.id);
    setSheetStatus(applied ? `${pairLabel(entry)} を適用しました` : 'Favoriteを適用できませんでした');
    if (applied) window.dispatchEvent(new CustomEvent('hitsound-favorite-applied', { detail: { label: pairLabel(entry) } }));
  }

  function updateSetButton() {
    if (!setButton) return;
    const entry = currentEntry();
    const saved = entry && readSets().some(item => entryKey(item) === entryKey(entry));
    setButton.disabled = !entry;
    setButton.setAttribute('aria-pressed', saved ? 'true' : 'false');
    setButton.textContent = saved ? 'Favorite登録済み' : 'Favoriteへ追加';
    setButton.title = entry ? (saved ? 'この組み合わせは登録済みです' : '現在の組み合わせをFavoriteへ追加') : 'DonとKatの両方に音源を選択してください。無音は登録できません';
  }

  function pairLabel(entry) {
    return `Don ${entry.don.sourceNumber} + Kat ${entry.kat.sourceNumber}`;
  }

  function renderSavedSets() {
    if (!list) return;
    const sets = readSets();
    list.replaceChildren();
    for (const entry of sets) {
      const item = document.createElement('div');
      item.className = 'favorite-set-item';
      const state = entryAvailability(entry);

      const applyButton = document.createElement('button');
      applyButton.type = 'button';
      applyButton.className = 'hs-key favorite-set-apply';
      applyButton.dataset.applySet = entry.id;
      applyButton.disabled = !state.ok;
      applyButton.setAttribute('aria-label', state.ok ? `${pairLabel(entry)} を適用` : `${pairLabel(entry)} は適用不可。${state.reason}`);
      applyButton.title = state.ok ? `${entry.don.name} + ${entry.kat.name}` : state.reason;
      const face = document.createElement('span');
      face.textContent = pairLabel(entry);
      applyButton.append(face);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'hs-key favorite-set-delete';
      deleteButton.dataset.deleteSet = entry.id;
      deleteButton.setAttribute('aria-label', `${pairLabel(entry)} をFavoriteから削除`);
      const deleteFace = document.createElement('span');
      deleteFace.textContent = '削除';
      deleteButton.append(deleteFace);

      item.append(applyButton, deleteButton);
      list.append(item);
    }
    if (empty) empty.hidden = sets.length > 0;
    if (count) count.textContent = String(sets.length);
    if (exportButton) exportButton.disabled = sets.length === 0;
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
      'FavoriteType',
      'DonNo','DonID','DonName','DonFamily','DonPitchHz','DonUserLabel','DonMySound','DonFingerprint',
      'KatNo','KatID','KatName','KatFamily','KatPitchHz','KatUserLabel','KatMySound','KatFingerprint',
      'Available','CreatedAt'
    ]];
    for (const entry of readSets()) {
      rows.push([
        'SET',
        ...descriptorCsv(entry.don),
        ...descriptorCsv(entry.kat),
        entryAvailability(entry).ok ? 'YES' : 'NO',
        entry.createdAt || '',
      ]);
    }
    return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  async function exportCsv() {
    const file = new File([makeCsv()], 'osu_taiko_hitsound_lab_favorites.csv', { type: 'text/csv;charset=utf-8' });
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: 'osu!taiko Hitsound Lab Favorites' });
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

  setButton?.addEventListener('click', recordCurrentSet);
  exportButton?.addEventListener('click', () => exportCsv().catch(error => setSheetStatus(error.message || 'CSVを出力できませんでした')));
  list?.addEventListener('click', event => {
    const applyButton = event.target.closest('[data-apply-set]');
    if (applyButton) {
      applySet(applyButton.dataset.applySet).catch(error => setSheetStatus(error.message || 'Favoriteを適用できませんでした'));
      return;
    }
    const deleteButton = event.target.closest('[data-delete-set]');
    if (deleteButton) removeSet(deleteButton.dataset.deleteSet);
  });

  window.addEventListener('hitsound-selection-change', updateSetButton);
  window.addEventListener('hitsound-custom-sources-change', () => {
    renderSavedSets();
    updateSetButton();
  });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) {
      renderSavedSets();
      updateSetButton();
    }
  });

  window.HitsoundFavorites = {
    KEY: STORAGE_KEY,
    readSets,
    isRecommendedPair,
    recommendedFor,
  };

  renderSavedSets();
  updateSetButton();
})();
