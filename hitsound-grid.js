(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const controller = window.HitsoundController;
  const favorites = window.HitsoundFavorites;
  const $ = id => document.getElementById(id);
  const grid = $('hitsoundGrid');
  const roleDonButton = $('roleDonButton');
  const roleKatButton = $('roleKatButton');
  const roleDonValue = $('roleDonValue');
  const roleKatValue = $('roleKatValue');

  if (!CANDIDATES.length || !controller || !favorites || !grid || !roleDonButton || !roleKatButton) return;

  const SILENT_ID = controller.SILENT_ID;
  let activeSide = 'don';

  const familyOf = candidate => candidate?.originalFamily || candidate?.family || 'Other';
  const displayFamily = candidate => familyOf(candidate) === '808 / Sub' ? 'Bass Drum / Kick' : familyOf(candidate);
  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;

  const preferredOrder = [
    'Bass Drum / Kick',
    'Tom',
    'Timbale',
    'Rimshot',
    'Snare',
    'Cowbell',
    'Agogo',
    'Woodblock',
    'Clave / Claves',
    'Hi-Hat',
  ];

  function groupedCandidates() {
    const groups = new Map();
    for (const candidate of CANDIDATES) {
      const family = displayFamily(candidate);
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family).push(candidate);
    }

    for (const list of groups.values()) {
      list.sort((a, b) =>
        Number(a.sourceNumber) - Number(b.sourceNumber) ||
        (a.pitch ?? Number.POSITIVE_INFINITY) - (b.pitch ?? Number.POSITIVE_INFINITY)
      );
    }

    const orderIndex = family => {
      const preferred = preferredOrder.indexOf(family);
      if (preferred >= 0) return preferred;
      return preferredOrder.length + 1;
    };

    return Array.from(groups.entries()).sort((a, b) => {
      const ao = orderIndex(a[0]), bo = orderIndex(b[0]);
      if (ao !== bo) return ao - bo;
      const ap = Math.min(...a[1].map(candidate => candidate.pitch ?? Number.POSITIVE_INFINITY));
      const bp = Math.min(...b[1].map(candidate => candidate.pitch ?? Number.POSITIVE_INFINITY));
      return ap - bp || a[0].localeCompare(b[0]);
    });
  }

  function keyMarkup(candidate) {
    const source = String(candidate.originalName || candidate.name || '');
    const pitch = Number.isFinite(candidate.pitch) ? `${candidate.pitch.toFixed(1)} Hz` : '';
    return `<button class="hs-key" type="button" data-hs-id="${candidate.id}" title="${source}${pitch ? ` · ${pitch}` : ''}" aria-label="${candidate.sourceNumber} ${source}"><span>${candidate.sourceNumber}</span></button>`;
  }

  function buildGrid() {
    const groups = groupedCandidates();
    grid.innerHTML = `
      <div class="hs-silent-row">
        <button class="hs-key hs-silent" type="button" data-hs-id="${SILENT_ID}" title="無音" aria-label="無音"><span>—</span></button>
      </div>
      ${groups.map(([family, candidates]) => `
        <section class="hs-family" data-family="${family}">
          <div class="hs-family-title">${family}</div>
          <div class="hs-family-grid">${candidates.map(keyMarkup).join('')}</div>
        </section>
      `).join('')}
    `;
  }

  function favoriteRoleSets() {
    const stored = favorites.read();
    const don = new Set(stored.don);
    const kat = new Set(stored.kat);

    for (const key of stored.set) {
      const [dId, kId] = String(key).split('|');
      if (dId) don.add(dId);
      if (kId) kat.add(kId);
    }
    return { don, kat };
  }

  function candidateLabel(id) {
    if (id === SILENT_ID) return '—';
    return byId(id)?.sourceNumber || '—';
  }

  function paintRoleButtons() {
    const selection = controller.getSelection();
    roleDonValue.textContent = candidateLabel(selection.don);
    roleKatValue.textContent = candidateLabel(selection.kat);
    roleDonButton.classList.toggle('target', activeSide === 'don');
    roleKatButton.classList.toggle('target', activeSide === 'kat');
    roleDonButton.setAttribute('aria-pressed', activeSide === 'don' ? 'true' : 'false');
    roleKatButton.setAttribute('aria-pressed', activeSide === 'kat' ? 'true' : 'false');
  }

  function paintGrid() {
    const selection = controller.getSelection();
    const saved = favoriteRoleSets();

    grid.querySelectorAll('.hs-key[data-hs-id]').forEach(button => {
      const id = button.dataset.hsId;
      button.classList.remove('selected-don','selected-kat','fav-don','fav-kat','recommended');

      if (id === selection.don) button.classList.add('selected-don');
      if (id === selection.kat) button.classList.add('selected-kat');
      if (id !== SILENT_ID && saved.don.has(id)) button.classList.add('fav-don');
      if (id !== SILENT_ID && saved.kat.has(id)) button.classList.add('fav-kat');

      if (id !== SILENT_ID && id !== selection.don && id !== selection.kat) {
        if (activeSide === 'kat' && selection.don !== SILENT_ID && favorites.isRecommendedPair(selection.don, id)) {
          button.classList.add('recommended');
        } else if (activeSide === 'don' && selection.kat !== SILENT_ID && favorites.isRecommendedPair(id, selection.kat)) {
          button.classList.add('recommended');
        }
      }
    });

    paintRoleButtons();
  }

  async function choose(id) {
    grid.classList.add('busy');
    try {
      await controller.setSide(activeSide, id);
    } finally {
      grid.classList.remove('busy');
      paintGrid();
    }
  }

  roleDonButton.addEventListener('click', () => {
    activeSide = 'don';
    paintGrid();
  });
  roleKatButton.addEventListener('click', () => {
    activeSide = 'kat';
    paintGrid();
  });

  grid.addEventListener('click', event => {
    const button = event.target.closest('.hs-key[data-hs-id]');
    if (!button || grid.classList.contains('busy')) return;
    choose(button.dataset.hsId).catch(error => alert(error.message));
  });

  window.addEventListener('hitsound-selection-change', paintGrid);
  window.addEventListener('hitsound-favorites-change', paintGrid);

  buildGrid();
  paintGrid();
})();
