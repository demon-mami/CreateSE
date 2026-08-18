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
  const pairBuilder = document.querySelector('.pair-builder');
  const recommendationLine = $('recommendationLine');

  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const valid = candidate => candidate && !candidate.excluded;
  const validSideId = id => id === SILENT_ID || valid(byId(id));
  const familyOf = candidate => candidate?.originalFamily || candidate?.family || '';

  const GOOD_CROSS = new Map([
    ['A003', new Set(['A026'])],
    ['A005', new Set(['A026'])],
    ['A010', new Set(['A026'])],
    ['A026', new Set(['A021'])],
    ['A058', new Set(['A053'])],
    ['A060', new Set(['A055'])],
  ]);

  let feedback = $('setFeedback');
  if (!feedback && pairBuilder) {
    feedback = document.createElement('div');
    feedback.id = 'setFeedback';
    feedback.className = 'set-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    if (recommendationLine) recommendationLine.insertAdjacentElement('beforebegin', feedback);
    else pairBuilder.appendChild(feedback);
  }

  const feedbackStyle = document.createElement('style');
  feedbackStyle.textContent = `
    .set-feedback{
      min-height:30px;display:flex;align-items:center;justify-content:center;margin:0 2px 2px;
      color:rgba(255,255,255,.72);font-size:11px;font-weight:750;letter-spacing:.01em;
      opacity:0;pointer-events:none;text-align:center;text-shadow:0 1px 10px rgba(255,255,255,.06)
    }
    .set-feedback.show{animation:setFavoriteFeedback 2.8s ease-out forwards}
    @keyframes setFavoriteFeedback{
      0%{opacity:0;transform:translateY(3px)}12%{opacity:.72;transform:translateY(0)}
      52%{opacity:.58;transform:translateY(0)}100%{opacity:0;transform:translateY(-2px)}
    }
    @media(prefers-reduced-motion:reduce){
      .set-feedback.show{animation:setFavoriteFeedbackReduced 2.8s linear forwards}
      @keyframes setFavoriteFeedbackReduced{0%{opacity:.68}70%{opacity:.55}100%{opacity:0}}
    }
  `;
  document.head.appendChild(feedbackStyle);

  let feedbackClearTimer = 0;
  function showSetFeedback() {
    if (!feedback) return;
    clearTimeout(feedbackClearTimer);
    feedback.textContent = 'お気に入りに追加しました';
    feedback.classList.remove('show');
    void feedback.offsetWidth;
    feedback.classList.add('show');
    feedbackClearTimer = window.setTimeout(() => {
      feedback.classList.remove('show');
      feedback.textContent = '';
    }, 3000);
  }

  function readSets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {};
      const raw = Array.isArray(parsed.set) ? parsed.set : [];
      return raw.filter(key => {
        const [dId, kId] = String(key).split('|');
        return validSideId(dId) && validSideId(kId) && !(dId === SILENT_ID && kId === SILENT_ID);
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
    if (!validSideId(don) || !validSideId(kat)) return '';
    if (don === SILENT_ID && kat === SILENT_ID) return '';
    return `${don}|${kat}`;
  }

  function recordCurrentSet() {
    const key = currentSetKey();
    if (!key) return;
    const sets = readSets();
    if (sets.includes(key)) return;
    sets.push(key);
    writeSets(sets);
    showSetFeedback();
  }

  function removeSet(key) {
    const sets = readSets().filter(item => item !== key);
    writeSets(sets);
  }

  async function applySet(key) {
    const [donId, katId] = String(key).split('|');
    if (!validSideId(donId) || !validSideId(katId)) return;
    await controller.setPair(donId, katId);
  }

  function updateSetButton() {
    if (setButton) setButton.disabled = !currentSetKey();
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
      for (const [dId, kats] of GOOD_CROSS.entries()) {
        if (kats.has(selection.kat) && valid(byId(dId))) out.push(dId);
      }
      return out;
    }
    return [];
  }

  function sideLabel(id) {
    if (id === SILENT_ID) return '—';
    return byId(id)?.sourceNumber || '—';
  }

  function sideTitle(id) {
    if (id === SILENT_ID) return '無音';
    const candidate = byId(id);
    return candidate ? (candidate.originalName || candidate.name) : '—';
  }

  function renderSavedSets() {
    if (!panel || !list) return;
    const sets = readSets();
    list.innerHTML = sets.map(key => {
      const [dId, kId] = String(key).split('|');
      const label = `${sideLabel(dId)} + ${sideLabel(kId)}`;
      const title = `${sideTitle(dId)} + ${sideTitle(kId)}`;
      return `
        <div class="favorite-set-item">
          <button class="hs-key favorite-set-apply" type="button" data-apply-set="${key}" title="${title}" aria-label="${label} を適用"><span>${label}</span></button>
          <button class="hs-key favorite-set-delete" type="button" data-delete-set="${key}" aria-label="${label} を削除"><span>×</span></button>
        </div>`;
    }).join('');
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function sideCsv(id) {
    if (id === SILENT_ID) return ['—', SILENT_ID, 'silent.wav', 'silent', 'Silent', '', ''];
    const candidate = byId(id);
    if (!valid(candidate)) return ['', '', '', '', '', '', ''];
    return [
      candidate.sourceNumber,
      candidate.id,
      candidate.name,
      candidate.originalName,
      familyOf(candidate),
      candidate.pitch,
      candidate.userLabel,
    ];
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
      const recommended = isRecommendedPair(dId, kId);
      let category = 'OTHER';
      if (dId === SILENT_ID || kId === SILENT_ID) category = 'SILENT_SIDE';
      else if (valid(d) && valid(k) && familyOf(d) === familyOf(k)) category = 'SAME_FAMILY';
      else if (recommended) category = 'RECOMMENDED_CROSS';

      rows.push([
        'SET',
        ...sideCsv(dId),
        ...sideCsv(kId),
        category,
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
  list?.addEventListener('click', event => {
    const applyButton = event.target.closest('[data-apply-set]');
    if (applyButton) {
      applySet(applyButton.dataset.applySet).catch(error => alert(error.message));
      return;
    }
    const deleteButton = event.target.closest('[data-delete-set]');
    if (deleteButton) removeSet(deleteButton.dataset.deleteSet);
  });

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
