(() => {
  'use strict';

  const CHARTS = Array.isArray(window.TEST_CHARTS) ? window.TEST_CHARTS : [];
  const $ = id => document.getElementById(id);
  const el = {
    select: $('chartSelect'),
    oszInput: $('oszInput'),
    difficulty: $('fixedDifficulty'),
    title: $('songTitle'),
    songMeta: $('songMeta'),
    status: $('statusBadge'),
    play: $('playButton'),
    chartInfo: document.querySelector('.chart-info')
  };

  let packPromise = null;
  let serial = 0;
  let currentChart = null;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function keepChartInfoVisible() {
    if (el.chartInfo) el.chartInfo.hidden = false;
  }

  function setInputFile(input, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  }

  async function mapPack() {
    if (!packPromise) {
      packPromise = (async () => {
        if (!window.JSZip) throw new Error('JSZipを読み込めません。');
        const response = await fetch('./maps.zip', { cache: 'force-cache' });
        if (!response.ok) throw new Error('maps.zip がありません。GitHub repo rootへアップロードしてください。');
        return JSZip.loadAsync(await response.arrayBuffer());
      })();
    }
    return packPromise;
  }

  async function chartBytes(chart) {
    if (chart.file) {
      const response = await fetch(`./${chart.file}`, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`譜面ファイルがありません: ${chart.file}`);
      return response.arrayBuffer();
    }

    const pack = await mapPack();
    const entry = pack.file(chart.entry);
    if (!entry) throw new Error(`maps.zip内にありません: ${chart.entry}`);
    return entry.async('arraybuffer');
  }

  async function waitForViewerReady(mySerial, timeoutMs = 30000) {
    const start = performance.now();
    while (mySerial === serial && performance.now() - start < timeoutMs) {
      const status = el.status?.textContent || '';
      if (status === '準備完了' && !el.play?.disabled) return true;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return false;
  }

  function enforceDisplay(chart) {
    if (!chart || chart !== currentChart) return;
    if (el.title) el.title.textContent = chart.title;
    if (el.difficulty) el.difficulty.textContent = chart.difficulty;
    keepChartInfoVisible();
  }

  async function loadChart(chart) {
    const mySerial = ++serial;
    currentChart = chart;
    keepChartInfoVisible();
    if (el.status) el.status.textContent = '譜面読込中';
    if (el.title) el.title.textContent = chart.title;
    if (el.difficulty) el.difficulty.textContent = chart.difficulty;

    const bytes = await chartBytes(chart);
    if (mySerial !== serial) return;

    const file = new File([bytes], `${chart.title}.osz`, {
      type: 'application/octet-stream',
      lastModified: Date.now()
    });
    setInputFile(el.oszInput, file);
    el.oszInput.dispatchEvent(new Event('change', { bubbles: true }));

    await waitForViewerReady(mySerial);
    enforceDisplay(chart);
  }

  el.select.innerHTML =
    '<option value="">譜面を選択</option>' +
    CHARTS.map(chart => `<option value="${esc(chart.id)}">${esc(chart.title)}</option>`).join('');

  keepChartInfoVisible();
  if (el.difficulty) el.difficulty.textContent = '—';

  el.select.addEventListener('change', async () => {
    const chart = CHARTS.find(x => x.id === el.select.value);
    if (!chart) {
      currentChart = null;
      keepChartInfoVisible();
      if (el.title) el.title.textContent = '—';
      if (el.difficulty) el.difficulty.textContent = '—';
      return;
    }
    try {
      await loadChart(chart);
    } catch (error) {
      console.error(error);
      if (el.status) el.status.textContent = 'エラー';
      alert(error instanceof Error ? error.message : String(error));
    }
  });

  if (el.title) {
    new MutationObserver(() => {
      if (currentChart && el.title.textContent !== currentChart.title) el.title.textContent = currentChart.title;
    }).observe(el.title, { childList: true, characterData: true, subtree: true });
  }
})();
