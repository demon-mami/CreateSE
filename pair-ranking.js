(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const $ = id => document.getElementById(id);
  const donSelect = $('donSelect');
  const katSelect = $('katSelect');
  const katPrev = $('katPrev');
  const katNext = $('katNext');

  if (!donSelect || !katSelect) return;

  const byId = id => CANDIDATES.find(x => x.id === id);

  const GOOD_CROSS = new Map([
    ['A003', new Set(['A026'])],
    ['A005', new Set(['A026'])],
    ['A010', new Set(['A026'])],
    ['A026', new Set(['A021'])],
    ['A030', new Set(['A055'])],
    ['A058', new Set(['A053'])],
    ['A060', new Set(['A055'])],
  ]);

  function category(don, kat) {
    if (!don || !kat) return 2;
    if (don.family === kat.family) return 0;
    if (GOOD_CROSS.get(don.id)?.has(kat.id)) return 1;
    return 2;
  }

  function prefix(don, kat) {
    const group = category(don, kat);
    return group === 0 ? '♪ ' : group === 1 ? '♥ ' : '';
  }

  function categoryName(don, kat) {
    const group = category(don, kat);
    return group === 0 ? 'SAME_FAMILY' : group === 1 ? 'RECOMMENDED_CROSS' : 'OTHER';
  }

  let sorting = false;
  let reorderQueued = false;

  const observer = new MutationObserver(() => {
    if (sorting || reorderQueued) return;
    reorderQueued = true;
    queueMicrotask(() => {
      reorderQueued = false;
      reorderKatOptions();
    });
  });

  function startObserving() {
    observer.observe(katSelect, { childList: true });
  }

  function reorderKatOptions() {
    if (sorting) return;
    const don = byId(donSelect.value);
    if (!don) return;

    sorting = true;
    observer.disconnect();

    try {
      const selected = katSelect.value;
      const rows = Array.from(katSelect.options).map((option, index) => {
        const kat = byId(option.value);
        return {
          option,
          index,
          kat,
          group: category(don, kat),
          pitch: kat?.pitch ?? Number.POSITIVE_INFINITY,
          rank: kat?.globalRank ?? Number.POSITIVE_INFINITY,
        };
      });

      rows.sort((a, b) =>
        a.group - b.group ||
        a.pitch - b.pitch ||
        a.rank - b.rank ||
        a.index - b.index
      );

      for (const row of rows) {
        if (!row.kat) continue;
        const clean = row.option.textContent.replace(/^[♪♥]\s*/, '');
        row.option.textContent = prefix(don, row.kat) + clean;
      }

      const currentOrder = Array.from(katSelect.options).map(o => o.value).join('|');
      const desiredOrder = rows.map(row => row.option.value).join('|');
      if (currentOrder !== desiredOrder) {
        const fragment = document.createDocumentFragment();
        for (const row of rows) fragment.appendChild(row.option);
        katSelect.appendChild(fragment);
      }

      if (Array.from(katSelect.options).some(o => o.value === selected)) katSelect.value = selected;
    } finally {
      sorting = false;
      startObserving();
    }
  }

  startObserving();

  function stepKat(direction, event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    reorderKatOptions();

    const options = Array.from(katSelect.options).filter(o => o.value);
    if (!options.length) return;

    let index = options.findIndex(o => o.value === katSelect.value);
    if (index < 0) index = 0;
    index = Math.max(0, Math.min(options.length - 1, index + direction));
    if (options[index].value === katSelect.value) return;

    katSelect.value = options[index].value;
    katSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  katPrev?.addEventListener('click', event => stepKat(-1, event), true);
  katNext?.addEventListener('click', event => stepKat(1, event), true);

  const katSide = katSelect.closest('.pair-side');
  if (katSide && !katSide.querySelector('.pair-order-legend')) {
    const legend = document.createElement('div');
    legend.className = 'pair-order-legend';
    legend.textContent = '♪ 同family　♥ 推奨Cross-family　無印 その他';
    katSelect.insertAdjacentElement('afterend', legend);
  }

  const FAVORITES_KEY = 'osutaiko-hitsound-lab-favorites-v1';
  let stored = { don: [], kat: [], set: [] };

  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || 'null');
    if (parsed) {
      stored = {
        don: Array.isArray(parsed.don) ? parsed.don : [],
        kat: Array.isArray(parsed.kat) ? parsed.kat : [],
        set: Array.isArray(parsed.set) ? parsed.set : [],
      };
    }
  } catch {}

  const favDon = new Set(stored.don);
  const favKat = new Set(stored.kat);
  const favSet = new Set(stored.set);

  const favDonButton = $('favDonButton');
  const favKatButton = $('favKatButton');
  const favSetButton = $('favSetButton');
  const exportButton = $('exportFavoritesButton');

  function currentSetKey() {
    return donSelect.value && katSelect.value ? `${donSelect.value}|${katSelect.value}` : '';
  }

  function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify({
      don: Array.from(favDon),
      kat: Array.from(favKat),
      set: Array.from(favSet),
    }));
  }

  function updateFavoriteButtons() {
    const donId = donSelect.value;
    const katId = katSelect.value;
    const setKey = currentSetKey();

    if (favDonButton) {
      favDonButton.disabled = !donId;
      favDonButton.classList.toggle('active', !!donId && favDon.has(donId));
    }
    if (favKatButton) {
      favKatButton.disabled = !katId;
      favKatButton.classList.toggle('active', !!katId && favKat.has(katId));
    }
    if (favSetButton) {
      favSetButton.disabled = !setKey;
      favSetButton.classList.toggle('active', !!setKey && favSet.has(setKey));
    }
  }

  function toggleFavorite(set, key) {
    if (!key) return;
    if (set.has(key)) set.delete(key);
    else set.add(key);
    saveFavorites();
    updateFavoriteButtons();
  }

  favDonButton?.addEventListener('click', () => toggleFavorite(favDon, donSelect.value));
  favKatButton?.addEventListener('click', () => toggleFavorite(favKat, katSelect.value));
  favSetButton?.addEventListener('click', () => toggleFavorite(favSet, currentSetKey()));

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function makeCsv() {
    const rows = [[
      'FavoriteType',
      'DonID','DonName','DonFamily','DonPitchHz','DonUserLabel',
      'KatID','KatName','KatFamily','KatPitchHz','KatUserLabel',
      'PairCategory','PairMark'
    ]];

    const donItems = Array.from(favDon)
      .map(byId).filter(Boolean)
      .sort((a,b) => a.pitch - b.pitch || a.globalRank - b.globalRank);

    for (const d of donItems) {
      rows.push([
        'DON', d.id, d.name, d.family, d.pitch, d.userLabel,
        '', '', '', '', '', '', ''
      ]);
    }

    const katItems = Array.from(favKat)
      .map(byId).filter(Boolean)
      .sort((a,b) => a.pitch - b.pitch || a.globalRank - b.globalRank);

    for (const k of katItems) {
      rows.push([
        'KAT', '', '', '', '', '',
        k.id, k.name, k.family, k.pitch, k.userLabel, '', ''
      ]);
    }

    const setItems = Array.from(favSet)
      .map(key => {
        const [dId, kId] = key.split('|');
        const d = byId(dId), k = byId(kId);
        return d && k ? { d, k } : null;
      })
      .filter(Boolean)
      .sort((a,b) =>
        a.d.pitch - b.d.pitch ||
        a.k.pitch - b.k.pitch ||
        a.d.globalRank - b.d.globalRank ||
        a.k.globalRank - b.k.globalRank
      );

    for (const { d, k } of setItems) {
      rows.push([
        'SET',
        d.id, d.name, d.family, d.pitch, d.userLabel,
        k.id, k.name, k.family, k.pitch, k.userLabel,
        categoryName(d, k), prefix(d, k).trim()
      ]);
    }

    return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  async function exportCsv() {
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

  exportButton?.addEventListener('click', exportCsv);

  function afterSelectionChange() {
    queueMicrotask(() => {
      reorderKatOptions();
      updateFavoriteButtons();
    });
  }

  donSelect.addEventListener('change', afterSelectionChange);
  katSelect.addEventListener('change', updateFavoriteButtons);
  $('pairScope')?.addEventListener('change', afterSelectionChange);

  $('donPrev')?.addEventListener('click', () => queueMicrotask(updateFavoriteButtons));
  $('donNext')?.addEventListener('click', () => queueMicrotask(updateFavoriteButtons));
  katPrev?.addEventListener('click', () => queueMicrotask(updateFavoriteButtons));
  katNext?.addEventListener('click', () => queueMicrotask(updateFavoriteButtons));

  const style = document.createElement('style');
  style.textContent = `
    .pair-order-legend{margin-top:4px;color:var(--muted);font-size:8px;line-height:1.45}
    .pair-side-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
    .pair-side-head .pair-side-title{margin-bottom:0}
    .favorite-button{min-height:32px;border:1px solid var(--line);border-radius:8px;background:var(--panel-2);color:var(--text);font-size:9px;font-weight:850}
    .favorite-button.side-favorite{flex:0 0 auto;min-width:64px;min-height:27px;padding:0 8px;font-size:8px}
    .favorite-button.active{border-color:#d8ad78;background:rgba(216,173,120,.22);color:#f0d3a5}
    .favorite-button:disabled{opacity:.34}
    .pair-rule-only{margin-top:7px;min-height:15px}
    .pair-footer-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:5px}
    .pair-footer-actions .favorite-button{min-height:35px}
    .favorite-button.export{border-color:var(--accent-border);background:var(--accent-soft);color:var(--accent-text)}
  `;
  document.head.appendChild(style);

  reorderKatOptions();
  updateFavoriteButtons();
})();
