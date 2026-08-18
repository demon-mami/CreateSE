(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const controller = window.HitsoundController;
  if (!CANDIDATES.length || !controller) return;

  const FAVORITES_KEY = 'osutaiko-hitsound-lab-favorites-v1';
  const SILENT_ID = controller.SILENT_ID;
  const $ = id => document.getElementById(id);
  const favDonButton = $('favDonButton');
  const favKatButton = $('favKatButton');
  const favSetButton = $('favSetButton');
  const exportButton = $('exportFavoritesButton');

  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const familyOf = candidate => candidate?.originalFamily || candidate?.family || '';

  const GOOD_CROSS = new Map([
    ['A003', new Set(['A026'])],
    ['A005', new Set(['A026'])],
    ['A010', new Set(['A026'])],
    ['A026', new Set(['A021'])],
    ['A030', new Set(['A055'])],
    ['A058', new Set(['A053'])],
    ['A060', new Set(['A055'])],
  ]);

  let stored = readFavorites();

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

  function writeFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(stored));
    updateButtons();
    window.dispatchEvent(new CustomEvent('hitsound-favorites-change', { detail: readFavorites() }));
  }

  function currentSetKey() {
    const { don, kat } = controller.getSelection();
    if (!don || !kat || don === SILENT_ID || kat === SILENT_ID) return '';
    return `${don}|${kat}`;
  }

  function toggleList(key, value) {
    if (!value || value === SILENT_ID) return;
    const list = new Set(stored[key]);
    if (list.has(value)) list.delete(value);
    else list.add(value);
    stored[key] = Array.from(list);
    writeFavorites();
  }

  function toggleSet() {
    const key = currentSetKey();
    if (!key) return;
    const list = new Set(stored.set);
    if (list.has(key)) list.delete(key);
    else list.add(key);
    stored.set = Array.from(list);
    writeFavorites();
  }

  function updateButtons() {
    stored = readFavorites();
    const { don, kat } = controller.getSelection();
    const setKey = currentSetKey();

    if (favDonButton) {
      favDonButton.disabled = !don || don === SILENT_ID;
      favDonButton.classList.toggle('active', !!don && stored.don.includes(don));
    }
    if (favKatButton) {
      favKatButton.disabled = !kat || kat === SILENT_ID;
      favKatButton.classList.toggle('active', !!kat && stored.kat.includes(kat));
    }
    if (favSetButton) {
      favSetButton.disabled = !setKey;
      favSetButton.classList.toggle('active', !!setKey && stored.set.includes(setKey));
    }
  }

  function isRecommendedPair(donId, katId) {
    return !!donId && !!katId && GOOD_CROSS.get(donId)?.has(katId) === true;
  }

  function pairCategory(d, k) {
    if (!d || !k) return 'OTHER';
    if (familyOf(d) === familyOf(k)) return 'SAME_FAMILY';
    if (isRecommendedPair(d.id, k.id)) return 'RECOMMENDED_CROSS';
    return 'OTHER';
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function makeCsv() {
    const rows = [[
      'FavoriteType',
      'DonNo','DonID','DonName','DonSourceName','DonFamily','DonPitchHz','DonUserLabel',
      'KatNo','KatID','KatName','KatSourceName','KatFamily','KatPitchHz','KatUserLabel',
      'PairCategory','PairMark'
    ]];

    const sortCandidates = ids => ids
      .map(byId).filter(Boolean)
      .sort((a, b) => Number(a.sourceNumber) - Number(b.sourceNumber));

    for (const d of sortCandidates(stored.don)) {
      rows.push([
        'DON', d.sourceNumber, d.id, d.name, d.originalName, familyOf(d), d.pitch, d.userLabel,
        '', '', '', '', '', '', '', '', ''
      ]);
    }

    for (const k of sortCandidates(stored.kat)) {
      rows.push([
        'KAT', '', '', '', '', '', '', '',
        k.sourceNumber, k.id, k.name, k.originalName, familyOf(k), k.pitch, k.userLabel,
        '', ''
      ]);
    }

    const sets = stored.set.map(key => {
      const [dId, kId] = String(key).split('|');
      const d = byId(dId), k = byId(kId);
      return d && k ? { d, k } : null;
    }).filter(Boolean).sort((a, b) =>
      Number(a.d.sourceNumber) - Number(b.d.sourceNumber) ||
      Number(a.k.sourceNumber) - Number(b.k.sourceNumber)
    );

    for (const { d, k } of sets) {
      const category = pairCategory(d, k);
      rows.push([
        'SET',
        d.sourceNumber, d.id, d.name, d.originalName, familyOf(d), d.pitch, d.userLabel,
        k.sourceNumber, k.id, k.name, k.originalName, familyOf(k), k.pitch, k.userLabel,
        category, category === 'RECOMMENDED_CROSS' ? '♥' : ''
      ]);
    }

    return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  async function exportCsv() {
    stored = readFavorites();
    const file = new File(
      [makeCsv()],
      'osu_taiko_hitsound_lab_favorites.csv',
      { type: 'text/csv;charset=utf-8' }
    );

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

  favDonButton?.addEventListener('click', () => {
    const { don } = controller.getSelection();
    toggleList('don', don);
  });
  favKatButton?.addEventListener('click', () => {
    const { kat } = controller.getSelection();
    toggleList('kat', kat);
  });
  favSetButton?.addEventListener('click', toggleSet);
  exportButton?.addEventListener('click', exportCsv);

  window.addEventListener('hitsound-selection-change', updateButtons);
  window.addEventListener('storage', event => {
    if (event.key === FAVORITES_KEY) updateButtons();
  });

  window.HitsoundFavorites = {
    KEY: FAVORITES_KEY,
    read: readFavorites,
    isRecommendedPair,
    pairCategory,
  };

  updateButtons();
})();
