(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const controller = window.HitsoundController;
  const favorites = window.HitsoundFavorites;
  const $ = id => document.getElementById(id);
  const grid = $('hitsoundGrid');
  const sources = $('hitsoundSources');
  const roleDonButton = $('roleDonButton');
  const roleKatButton = $('roleKatButton');
  const silentButton = $('silentButton');
  const previewButton = $('previewButton');
  const recommendationLine = $('recommendationLine');

  if (!CANDIDATES.length || !controller || !favorites || !grid || !sources || !roleDonButton || !roleKatButton) return;

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
    'Cowbell',
    'Agogo',
    'Woodblock',
    'Clave / Claves',
    'Hi-Hat',
  ];

  function groupedCandidates() {
    const groups = new Map();
    for (const candidate of CANDIDATES) {
      if (candidate.excluded) continue;
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
      return preferred >= 0 ? preferred : preferredOrder.length + 1;
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
    sources.innerHTML = groups.map(([family, candidates]) => `
      <section class="hs-family" data-family="${family}">
        <div class="hs-family-title">${family}</div>
        <div class="hs-family-grid">${candidates.map(keyMarkup).join('')}</div>
      </section>
    `).join('');
  }

  function paintRecommendation() {
    if (!recommendationLine) return;
    const ids = favorites.recommendedFor(activeSide, controller.getSelection());
    const numbers = ids
      .map(byId)
      .filter(candidate => candidate && !candidate.excluded)
      .sort((a, b) => Number(a.sourceNumber) - Number(b.sourceNumber))
      .map(candidate => candidate.sourceNumber);
    recommendationLine.textContent = `推奨：${numbers.length ? numbers.join(' ') : '—'}`;
  }

  function paint() {
    const selection = controller.getSelection();

    roleDonButton.classList.toggle('target', activeSide === 'don');
    roleKatButton.classList.toggle('target', activeSide === 'kat');
    roleDonButton.setAttribute('aria-pressed', activeSide === 'don' ? 'true' : 'false');
    roleKatButton.setAttribute('aria-pressed', activeSide === 'kat' ? 'true' : 'false');
    roleDonButton.title = selection.don === SILENT_ID ? 'Don: 無音' : `Don: ${byId(selection.don)?.sourceNumber || '—'}`;
    roleKatButton.title = selection.kat === SILENT_ID ? 'Kat: 無音' : `Kat: ${byId(selection.kat)?.sourceNumber || '—'}`;

    grid.dataset.activeSide = activeSide;
    sources.querySelectorAll('.hs-key[data-hs-id]').forEach(button => {
      const id = button.dataset.hsId;
      button.classList.toggle('selected-don', id === selection.don);
      button.classList.toggle('selected-kat', id === selection.kat);
    });

    if (silentButton) {
      silentButton.classList.toggle('selected-don', activeSide === 'don' && selection.don === SILENT_ID);
      silentButton.classList.toggle('selected-kat', activeSide === 'kat' && selection.kat === SILENT_ID);
    }

    paintRecommendation();
  }

  async function choose(id) {
    sources.classList.add('busy');
    try {
      await controller.setSide(activeSide, id);
    } finally {
      sources.classList.remove('busy');
      paint();
    }
  }

  function setActiveSide(side) {
    if (side !== 'don' && side !== 'kat') return;
    controller.stopPreview();
    activeSide = side;
    paint();
  }

  roleDonButton.addEventListener('click', () => setActiveSide('don'));
  roleKatButton.addEventListener('click', () => setActiveSide('kat'));
  silentButton?.addEventListener('click', () => choose(SILENT_ID).catch(error => alert(error.message)));
  previewButton?.addEventListener('click', () => controller.togglePreview(activeSide).catch(error => alert(error.message)));

  sources.addEventListener('click', event => {
    const button = event.target.closest('.hs-key[data-hs-id]');
    if (!button || sources.classList.contains('busy')) return;
    choose(button.dataset.hsId).catch(error => alert(error.message));
  });

  window.addEventListener('hitsound-selection-change', paint);

  buildGrid();
  paint();
})();
