(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const $ = id => document.getElementById(id);
  const el = {
    donSelect: $('donSelect'), katSelect: $('katSelect'), scope: $('pairScope'), category: $('pairCategory'),
    donPrev: $('donPrev'), donNext: $('donNext'), katPrev: $('katPrev'), katNext: $('katNext'),
    donPreview: $('donPreview'), katPreview: $('katPreview'),
    donMeta: $('donMeta'), katMeta: $('katMeta'), pairRule: $('pairRule'),
    donInput: $('donHitsoundInput'), katInput: $('kaHitsoundInput'),
    previewAudio: $('samplePreviewAudio'), status: $('statusBadge'), play: $('playButton')
  };

  if (!el.donSelect || !el.katSelect || !el.scope || !el.category) return;

  let donId = CANDIDATES.find(x => x.name === 'RnT_Timbale-02.wav')?.id
    || CANDIDATES.find(x => x.userLabel === 'D' || x.userLabel === 'B')?.id
    || '';
  let katId = CANDIDATES.find(x => x.name === 'RnT_Timbale-06.wav')?.id || '';

  let packPromise = null;
  const bytesCache = new Map();
  const objectUrls = new Set();
  let applySerial = 0;

  const byId = id => CANDIDATES.find(x => x.id === id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const CATEGORY_LABELS = new Map([
    ['808 / Sub', '808 / Sub（808・サブベース）'],
    ['Bass Drum / Kick', 'Bass Drum / Kick（バスドラム／キック）'],
    ['Tom', 'Tom（タム）'],
    ['Timbale', 'Timbale（ティンバレス）'],
    ['Rimshot', 'Rimshot（リムショット）'],
    ['Snare', 'Snare（スネア）'],
    ['Cowbell', 'Cowbell（カウベル）'],
    ['Agogo', 'Agogo（アゴゴ）'],
    ['Woodblock', 'Woodblock（ウッドブロック）'],
    ['Clave / Claves', 'Clave / Claves（クラベス）'],
  ]);

  function initCategorySelect() {
    const familyStats = new Map();
    for (const candidate of CANDIDATES) {
      const key = candidate.family || 'Other';
      let stat = familyStats.get(key);
      if (!stat) {
        stat = { family: key, firstRank: candidate.globalRank ?? Number.POSITIVE_INFINITY, hasDon: false, hasKat: false };
        familyStats.set(key, stat);
      }
      stat.firstRank = Math.min(stat.firstRank, candidate.globalRank ?? Number.POSITIVE_INFINITY);
      if (candidate.userLabel === 'D' || candidate.userLabel === 'B') stat.hasDon = true;
      if (candidate.userLabel === 'K' || candidate.userLabel === 'B') stat.hasKat = true;
    }

    const families = Array.from(familyStats.values())
      .filter(stat => stat.hasDon && stat.hasKat)
      .sort((a, b) => a.firstRank - b.firstRank || a.family.localeCompare(b.family));

    el.category.innerHTML = '<option value="">全カテゴリー</option>' + families.map(stat => {
      const label = CATEGORY_LABELS.get(stat.family) || stat.family;
      return `<option value="${esc(stat.family)}">${esc(label)}</option>`;
    }).join('');
  }

  initCategorySelect();

  const selectedCategory = () => el.category.value || '';
  const categoryMode = () => !!selectedCategory();

  async function hitsoundPack() {
    if (!packPromise) {
      packPromise = (async () => {
        if (!window.JSZip) throw new Error('JSZipを読み込めません。');
        const response = await fetch('./hitsounds.zip', { cache: 'force-cache' });
        if (!response.ok) throw new Error('hitsounds.zip がありません。GitHub repo rootへアップロードしてください。');
        return JSZip.loadAsync(await response.arrayBuffer());
      })();
    }
    return packPromise;
  }

  async function candidateBytes(id) {
    if (bytesCache.has(id)) return bytesCache.get(id).slice(0);
    const c = byId(id);
    if (!c) throw new Error('候補が見つかりません。');
    const pack = await hitsoundPack();
    const entry = pack.file(c.entry);
    if (!entry) throw new Error(`hitsounds.zip内にありません: ${c.entry}`);
    const bytes = await entry.async('arraybuffer');
    bytesCache.set(id, bytes);
    return bytes.slice(0);
  }

  function fileForCandidate(candidate, bytes) {
    return new File([bytes], candidate.name, { type: 'audio/wav', lastModified: Date.now() });
  }

  function setInputFile(input, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  }

  function wasPlaying() {
    return el.play && el.play.textContent.trim() !== '▶' && !el.play.disabled;
  }

  async function waitForRebuild(serial, timeoutMs = 15000) {
    const start = performance.now();
    while (serial === applySerial && performance.now() - start < timeoutMs) {
      const elapsed = performance.now() - start;
      const status = el.status?.textContent || '';
      if (elapsed >= 120 && status === '準備完了' && !el.play?.disabled) return true;
      await new Promise(r => setTimeout(r, 60));
    }
    return false;
  }

  async function waitForViewerReady(timeoutMs = 30000) {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if ((el.status?.textContent || '') === '準備完了' && !el.play?.disabled) return true;
      await new Promise(r => setTimeout(r, 80));
    }
    return false;
  }

  async function applyCandidate(side, id, { resume = true } = {}) {
    const candidate = byId(id);
    if (!candidate) return;
    const input = side === 'don' ? el.donInput : el.katInput;
    if (!input) return;

    const serial = ++applySerial;
    const resumeAfter = resume && wasPlaying();
    const bytes = await candidateBytes(id);
    if (serial !== applySerial) return;

    setInputFile(input, fileForCandidate(candidate, bytes));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    if (resumeAfter) {
      const ready = await waitForRebuild(serial);
      if (ready && serial === applySerial && el.play?.textContent.trim() === '▶') el.play.click();
    }
  }

  async function applyPair({ resume = true } = {}) {
    const d = byId(donId), k = byId(katId);
    if (!d || !k) return;

    const serial = ++applySerial;
    const resumeAfter = resume && wasPlaying();
    const [don, kat] = await Promise.all([candidateBytes(donId), candidateBytes(katId)]);
    if (serial !== applySerial) return;

    setInputFile(el.donInput, fileForCandidate(d, don));
    el.donInput.dispatchEvent(new Event('change', { bubbles: true }));
    if (!(await waitForRebuild(serial))) return;

    setInputFile(el.katInput, fileForCandidate(k, kat));
    el.katInput.dispatchEvent(new Event('change', { bubbles: true }));
    if (!(await waitForRebuild(serial))) return;

    if (resumeAfter && serial === applySerial && el.play?.textContent.trim() === '▶') el.play.click();
  }

  function donPool() {
    const category = selectedCategory();
    return CANDIDATES
      .filter(x =>
        (x.userLabel === 'D' || x.userLabel === 'B') &&
        (!category || x.family === category)
      )
      .sort((a,b) => a.pitch - b.pitch || a.globalRank - b.globalRank);
  }

  function katPool() {
    const category = selectedCategory();
    const d = byId(donId);

    let list = CANDIDATES.filter(x => x.userLabel === 'K' || x.userLabel === 'B');

    if (category) {
      // Category exploration intentionally bypasses the normal Kat > Don pitch gate.
      list = list.filter(x => x.family === category);
    } else {
      if (!d) return [];
      list = list.filter(x => x.pitch > d.pitch);
      if (el.scope.value === 'SAME') list = list.filter(x => x.family === d.family);
    }

    return list.sort((a,b) => a.pitch - b.pitch || a.globalRank - b.globalRank);
  }

  function normalizePair() {
    const dons = donPool();
    if (!dons.some(x => x.id === donId)) donId = dons[0]?.id || '';

    const kats = katPool();
    if (!kats.some(x => x.id === katId)) katId = kats[0]?.id || '';
  }

  function optionText(c) {
    return `${c.name} [${c.userLabel}] · ${Math.round(c.pitch)}Hz`;
  }

  function fillSelect(select, list, current, emptyText) {
    if (!list.length) {
      select.innerHTML = `<option value="">${esc(emptyText)}</option>`;
      select.value = '';
      select.disabled = true;
      return;
    }

    select.disabled = false;
    select.innerHTML = list.map(c => `<option value="${c.id}">${esc(optionText(c))}</option>`).join('');
    select.value = list.some(c => c.id === current) ? current : list[0].id;
  }

  function renderPair() {
    normalizePair();

    const category = selectedCategory();
    fillSelect(el.donSelect, donPool(), donId, category ? 'このカテゴリーにDON候補なし' : 'D/BのDON候補なし');
    fillSelect(el.katSelect, katPool(), katId, category ? 'このカテゴリーにKAT候補なし' : 'このDONより高いK/B候補なし');

    const d = byId(donId), k = byId(katId);

    if (d) {
      el.donSelect.value = donId;
      el.donMeta.textContent = `${d.family} · user ${d.userLabel} · ${d.pitch.toFixed(1)} Hz`;
    } else {
      el.donMeta.textContent = '該当DON候補なし';
    }

    if (k) {
      el.katSelect.value = katId;
      el.katMeta.textContent = `${k.family} · user ${k.userLabel} · ${k.pitch.toFixed(1)} Hz`;
    } else {
      el.katMeta.textContent = '該当KAT候補なし';
    }

    if (!d || !k) {
      el.pairRule.textContent = category ? '選択カテゴリーにペア候補がありません' : 'このDONより高いK/B候補がありません';
      el.pairRule.className = 'pair-rule bad';
      return;
    }

    if (categoryMode()) {
      el.pairRule.textContent = 'カテゴリー探索モード';
      el.pairRule.className = 'pair-rule ok';
      return;
    }

    const ok = d.pitch < k.pitch;
    el.pairRule.textContent = ok ? `✓ ${(k.pitch / d.pitch).toFixed(2)}× high` : 'Low Don / High Kat NG';
    el.pairRule.className = `pair-rule ${ok ? 'ok' : 'bad'}`;
  }

  async function applySelectionDelta(previousDon, previousKat) {
    const donChanged = donId !== previousDon;
    const katChanged = katId !== previousKat;
    if (!donChanged && !katChanged) return;

    if (donChanged && katChanged && donId && katId) {
      await applyPair();
      return;
    }
    if (donChanged && donId) await applyCandidate('don', donId);
    if (katChanged && katId) await applyCandidate('kat', katId);
  }

  async function cycle(side, dir) {
    const list = side === 'don' ? donPool() : katPool();
    if (!list.length) return;

    const current = side === 'don' ? donId : katId;
    let index = list.findIndex(x => x.id === current);
    if (index < 0) index = 0;
    index = Math.max(0, Math.min(list.length - 1, index + dir));
    if (list[index].id === current) return;

    if (side === 'don') {
      const previousKat = katId;
      donId = list[index].id;
      renderPair();
      if (!katId) return;
      if (katId !== previousKat) await applyPair();
      else await applyCandidate('don', donId);
    } else {
      katId = list[index].id;
      renderPair();
      await applyCandidate('kat', katId);
    }
  }

  async function preview(id) {
    if (!id) return;
    const bytes = await candidateBytes(id);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    objectUrls.add(url);
    el.previewAudio.pause();
    el.previewAudio.src = url;
    el.previewAudio.currentTime = 0;
    el.previewAudio.onended = () => {
      URL.revokeObjectURL(url);
      objectUrls.delete(url);
    };
    await el.previewAudio.play();
  }

  el.donSelect.addEventListener('change', async () => {
    const previousKat = katId;
    donId = el.donSelect.value;
    renderPair();

    if (!katId) return;
    if (katId !== previousKat) await applyPair();
    else await applyCandidate('don', donId);
  });

  el.katSelect.addEventListener('change', async () => {
    katId = el.katSelect.value;
    renderPair();
    if (katId) await applyCandidate('kat', katId);
  });

  el.scope.addEventListener('change', async () => {
    const previousDon = donId;
    const previousKat = katId;
    renderPair();
    await applySelectionDelta(previousDon, previousKat);
  });

  el.category.addEventListener('change', async () => {
    const previousDon = donId;
    const previousKat = katId;
    renderPair();
    await applySelectionDelta(previousDon, previousKat);
  });

  el.donPrev.addEventListener('click', () => cycle('don', -1));
  el.donNext.addEventListener('click', () => cycle('don', 1));
  el.katPrev.addEventListener('click', () => cycle('kat', -1));
  el.katNext.addEventListener('click', () => cycle('kat', 1));

  el.donPreview.addEventListener('click', () => preview(donId).catch(e => alert(e.message)));
  el.katPreview.addEventListener('click', () => preview(katId).catch(e => alert(e.message)));

  window.addEventListener('beforeunload', () => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
  });

  renderPair();

  $('oszInput')?.addEventListener('change', async () => {
    if (!(await waitForViewerReady())) return;
    try {
      await applyPair({ resume: false });
    } catch (error) {
      console.warn(error);
      if (el.status) el.status.textContent = 'hitsounds.zip待ち';
    }
  });
})();
