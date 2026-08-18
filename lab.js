(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const STORE_KEY = 'osutaiko-hitsound-lab-pairs-v01';
  const $ = id => document.getElementById(id);
  const el = {
    donSelect: $('donSelect'), katSelect: $('katSelect'), scope: $('pairScope'),
    donPrev: $('donPrev'), donNext: $('donNext'), katPrev: $('katPrev'), katNext: $('katNext'),
    donPreview: $('donPreview'), katPreview: $('katPreview'),
    donMeta: $('donMeta'), katMeta: $('katMeta'), pairRule: $('pairRule'),
    savePair: $('savePairButton'), savedCount: $('savedCount'), savedList: $('savedPairsList'),
    donInput: $('donHitsoundInput'), katInput: $('kaHitsoundInput'),
    previewAudio: $('samplePreviewAudio'), status: $('statusBadge'), play: $('playButton')
  };

  let store = { saved: [], evaluations: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (parsed) store = { saved: parsed.saved || [], evaluations: parsed.evaluations || {} };
  } catch {}

  let donId = CANDIDATES.find(x => x.name === 'RnT_Timbale-02.wav')?.id || CANDIDATES[0]?.id || '';
  let katId = CANDIDATES.find(x => x.name === 'RnT_Timbale-06.wav')?.id || CANDIDATES.at(-1)?.id || '';
  let packPromise = null;
  const bytesCache = new Map();
  const objectUrls = new Set();
  let applySerial = 0;

  const byId = id => CANDIDATES.find(x => x.id === id);
  const pairKey = () => `${donId}|${katId}`;
  const saveStore = () => localStorage.setItem(STORE_KEY, JSON.stringify(store));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
      if (ready && serial === applySerial && el.play?.textContent.trim() === '▶') {
        el.play.click();
      }
    }
  }

  async function applyPair({ resume = true } = {}) {
    const serial = ++applySerial;
    const resumeAfter = resume && wasPlaying();
    const [don, kat] = await Promise.all([candidateBytes(donId), candidateBytes(katId)]);
    if (serial !== applySerial) return;

    setInputFile(el.donInput, fileForCandidate(byId(donId), don));
    el.donInput.dispatchEvent(new Event('change', { bubbles: true }));
    if (!(await waitForRebuild(serial))) return;

    setInputFile(el.katInput, fileForCandidate(byId(katId), kat));
    el.katInput.dispatchEvent(new Event('change', { bubbles: true }));
    if (!(await waitForRebuild(serial))) return;

    if (resumeAfter && serial === applySerial && el.play?.textContent.trim() === '▶') {
      el.play.click();
    }
  }

  // Role policy is one-way and anchored on the DON side.
  // DON: only sounds previously classified D or B.
  // KAT: only sounds previously classified K or B, and strictly higher than the selected DON.
  // Changing KAT never changes or filters the DON candidate pool.
  function donPool() {
    return CANDIDATES
      .filter(x => x.userLabel === 'D' || x.userLabel === 'B')
      .sort((a,b) => a.pitch - b.pitch || a.globalRank - b.globalRank);
  }

  function katPool() {
    const d = byId(donId);
    if (!d) return [];
    let list = CANDIDATES.filter(x =>
      (x.userLabel === 'K' || x.userLabel === 'B') && x.pitch > d.pitch
    );
    if (el.scope.value === 'SAME') list = list.filter(x => x.family === d.family);
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

  function fillSelect(select, list, current, emptyText = '該当候補なし') {
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
    fillSelect(el.donSelect, donPool(), donId, 'D/BのDON候補なし');
    fillSelect(el.katSelect, katPool(), katId, 'このDONより高いK/B候補なし');

    const d = byId(donId), k = byId(katId);
    if (!d) return;
    if (!k) {
      el.donSelect.value = donId;
      el.donMeta.textContent = `${d.family} · user ${d.userLabel} · ${d.pitch.toFixed(1)} Hz`;
      el.katMeta.textContent = '該当KAT候補なし';
      el.pairRule.textContent = 'このDONより高いK/B候補がありません';
      el.pairRule.className = 'pair-rule bad';
      return;
    }
    el.donSelect.value = donId;
    el.katSelect.value = katId;
    el.donMeta.textContent = `${d.family} · user ${d.userLabel} · ${d.pitch.toFixed(1)} Hz`;
    el.katMeta.textContent = `${k.family} · user ${k.userLabel} · ${k.pitch.toFixed(1)} Hz`;

    const ok = d.pitch < k.pitch;
    el.pairRule.textContent = ok ? `✓ ${(k.pitch / d.pitch).toFixed(2)}× high` : 'Low Don / High Kat NG';
    el.pairRule.className = `pair-rule ${ok ? 'ok' : 'bad'}`;

    const key = pairKey();
    const saved = store.saved.includes(key);
    const ev = store.evaluations[key] || '';
    el.savePair.classList.toggle('saved', saved);
    el.savePair.textContent = saved ? '★ Saved' : '☆ Save Pair';
    document.querySelectorAll('[data-pair-eval]').forEach(button => {
      button.classList.toggle('active', button.dataset.pairEval === ev);
    });
    renderSaved();
  }

  function renderSaved() {
    el.savedCount.textContent = String(store.saved.length);
    if (!store.saved.length) {
      el.savedList.innerHTML = '<div class="saved-item">まだ保存Pairはありません。</div>';
      return;
    }
    el.savedList.innerHTML = store.saved.map((key, i) => {
      const [dId, kId] = key.split('|');
      const d = byId(dId), k = byId(kId);
      if (!d || !k) return '';
      return `<div class="saved-item"><span>${i+1}. ${esc(d.name)} → ${esc(k.name)}</span><button class="saved-load" data-load-pair="${key}" type="button">Load</button></div>`;
    }).join('');

    el.savedList.querySelectorAll('[data-load-pair]').forEach(button => {
      button.addEventListener('click', async () => {
        [donId, katId] = button.dataset.loadPair.split('|');
        renderPair();
        await applyPair();
      });
    });
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
    const previousKat = katId;
    renderPair();
    if (katId && katId !== previousKat) await applyCandidate('kat', katId);
  });
  el.donPrev.addEventListener('click', () => cycle('don', -1));
  el.donNext.addEventListener('click', () => cycle('don', 1));
  el.katPrev.addEventListener('click', () => cycle('kat', -1));
  el.katNext.addEventListener('click', () => cycle('kat', 1));
  el.donPreview.addEventListener('click', () => preview(donId).catch(e => alert(e.message)));
  el.katPreview.addEventListener('click', () => preview(katId).catch(e => alert(e.message)));

  el.savePair.addEventListener('click', () => {
    const key = pairKey();
    const index = store.saved.indexOf(key);
    if (index >= 0) store.saved.splice(index, 1);
    else store.saved.push(key);
    saveStore();
    renderPair();
  });

  document.querySelectorAll('[data-pair-eval]').forEach(button => {
    button.addEventListener('click', () => {
      store.evaluations[pairKey()] = button.dataset.pairEval;
      saveStore();
      renderPair();
    });
  });

  window.addEventListener('beforeunload', () => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
  });

  renderPair();

  // After the original viewer finishes loading an OSZ, apply the current Pair sequentially.
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
