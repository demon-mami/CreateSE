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
  const panel = $('savedSetsPanel');
  const list = $('savedSetsList');

  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const valid = candidate => candidate && !candidate.excluded;
  const familyOf = candidate => candidate?.originalFamily || candidate?.family || '';

  const GOOD_CROSS = new Map([
    ['A003', new Set(['A026'])],
    ['A005', new Set(['A026'])],
    ['A010', new Set(['A026'])],
    ['A026', new Set(['A021'])],
    ['A058', new Set(['A053'])],
    ['A060', new Set(['A055'])],
  ]);

  function readSets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {};
      const raw = Array.isArray(parsed.set) ? parsed.set : [];
      return raw.filter(key => {
        const [dId, kId] = String(key).split('|');
        return valid(byId(dId)) && valid(byId(kId));
      });
    } catch {
      return [];
    }
  }

  function writeSets(sets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ don: [], kat: [], set: sets }));
    renderSavedSets();
    updateSetButton();
    window.dispatchEvent(new CustomEvent('hitsound-saved-sets-change', { detail: sets.slice() }));
  }

  function currentSetKey() {
    const { don, kat } = controller.getSelection();
    if (!don || !kat || don === SILENT_ID || kat === SILENT_ID) return '';
    if (!valid(byId(don)) || !valid(byId(kat))) return '';
    return `${don}|${kat}`;
  }

  function recordCurrentSet() {
    const key = currentSetKey();
    if (!key) return;
    const sets = readSets();
    if (!sets.includes(key)) sets.push(key);
    writeSets(sets);
  }

  function updateSetButton() {
    if (setButton) setButton.disabled = !currentSetKey();
  }

  function isRecommendedPair(donId, katId) {
    return !!donId && !!katId && GOOD_CROSS.get(donId)?.has(katId) === true;
  }

  function recommendedFor(side, selection = controller.getSelection()) {
    if (side === 'kat') {
      if (!selection.don || selection.don === SILENT_ID) return [];
      return Array.from(GOOD_CROSS.get(selection.don) || []).filter(id => valid(byId(id)));
    }

    if (side === 'don') {
      if (!selection.kat || selection.kat === SILENT_ID) return [];
      const out = [];
      for (const [dId, kats] of GOOD_CROSS.entries()) {
        if (kats.has(selection.kat) && valid(byId(dId))) out.push(dId);
      }
      return out;
    }
    return [];
  }

  function renderSavedSets() {
    if (!panel || !list) return;
    const sets = readSets();
    panel.hidden = sets.length === 0;
    list.innerHTML = sets.map(key => {
      const [dId, kId] = String(key).split('|');
      const d = byId(dId), k = byId(kId);
      if (!valid(d) || !valid(k)) return '';
      return `<div class="saved-set-row" title="${d.originalName || d.name} + ${k.originalName || k.name}">${d.sourceNumber} + ${k.sourceNumber}</div>`;
    }).join('');
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function makeCsv() {
    const rows = [[
      'FavoriteType',
      'DonNo','DonID','DonName','DonSourceName','DonFamily','DonPitchHz','DonUserLabel',
      'KatNo','KatID','KatName','KatSourceName','KatFamily','KatPitchHz','KatUserLabel',
      'PairCategory','Recommended'
    ]];

    for (const key of readSets()) {
      const [dId, kId] = String(key).split('|');
      const d = byId(dId), k = byId(kId);
      if (!valid(d) || !valid(k)) continue;
      const recommended = isRecommendedPair(d.id, k.id);
      rows.push([
        'SET',
        d.sourceNumber, d.id, d.name, d.originalName, familyOf(d), d.pitch, d.userLabel,
        k.sourceNumber, k.id, k.name, k.originalName, familyOf(k), k.pitch, k.userLabel,
        familyOf(d) === familyOf(k) ? 'SAME_FAMILY' : (recommended ? 'RECOMMENDED_CROSS' : 'OTHER'),
        recommended ? 'YES' : ''
      ]);
    }

    return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  async function exportCsv() {
    const file = new File([makeCsv()], 'osu_taiko_hitsound_lab_favorites.csv', { type: 'text/csv;charset=utf-8' });

    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: 'osu!taiko Hitsound Lab Favorites' });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  setButton?.addEventListener('click', recordCurrentSet);
  exportButton?.addEventListener('click', exportCsv);
  window.addEventListener('hitsound-selection-change', updateSetButton);
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) renderSavedSets();
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
