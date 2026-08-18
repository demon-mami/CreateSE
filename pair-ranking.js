(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  const $ = id => document.getElementById(id);
  const donSelect = $('donSelect');
  const katSelect = $('katSelect');
  const katPrev = $('katPrev');
  const katNext = $('katNext');
  const pairEval = document.querySelector('.pair-eval');

  if (!donSelect || !katSelect) return;

  const byId = id => CANDIDATES.find(x => x.id === id);

  // Cross-family候補: 以前の客観選抜で候補として残したPairのみ。
  // High-band control Pairは含めない。
  const GOOD_CROSS = new Map([
    ['A003', new Set(['A026'])], // 808-3 -> Rimshot 22
    ['A005', new Set(['A026'])], // BD1 -> Rimshot 22
    ['A010', new Set(['A026'])], // TOM5 -> Rimshot 22
    ['A026', new Set(['A021'])], // Rimshot 22 -> Timbale-06
    ['A030', new Set(['A055'])], // SNARE5 -> RnT_Claves-05
    ['A058', new Set(['A053'])], // Woodblock-02 -> RnT_Claves-04
    ['A060', new Set(['A055'])], // Cowbell-04 -> RnT_Claves-05
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

  let sorting = false;
  let reorderQueued = false;

  const observer = new MutationObserver(() => {
    // lab.js が候補selectを再生成した時だけ後追いで整列する。
    // 自分自身のDOM並び替えは observer.disconnect() 中に行うので再発火しない。
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

      // ラベルだけ更新。♪/♥を二重に付けない。
      for (const row of rows) {
        if (!row.kat) continue;
        const clean = row.option.textContent.replace(/^[♪♥]\s*/, '');
        row.option.textContent = prefix(don, row.kat) + clean;
      }

      // 並びが既に正しければDOMを動かさない。
      const currentOrder = Array.from(katSelect.options).map(o => o.value).join('|');
      const desiredOrder = rows.map(row => row.option.value).join('|');
      if (currentOrder !== desiredOrder) {
        const fragment = document.createDocumentFragment();
        for (const row of rows) fragment.appendChild(row.option);
        katSelect.appendChild(fragment);
      }

      if (Array.from(katSelect.options).some(o => o.value === selected)) {
        katSelect.value = selected;
      }
    } finally {
      sorting = false;
      startObserving();
    }
  }

  startObserving();

  // Katの←→も画面に見えている並び順で移動させる。
  function stepKat(direction, event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    reorderKatOptions();
    const options = Array.from(katSelect.options);
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

  donSelect.addEventListener('change', () => queueMicrotask(reorderKatOptions));
  $('pairScope')?.addEventListener('change', () => queueMicrotask(reorderKatOptions));

  // 凡例。
  const katSide = katSelect.closest('.pair-side');
  if (katSide && !katSide.querySelector('.pair-order-legend')) {
    const legend = document.createElement('div');
    legend.className = 'pair-order-legend';
    legend.textContent = '♪ 同family　♥ 推奨Cross-family　無印 その他';
    katSelect.insertAdjacentElement('afterend', legend);
  }

  // KEEP / MAYBE / DROP の意味をUI上でも固定。
  if (pairEval) {
    const labels = {
      KEEP: ['KEEP', '次工程へ残す'],
      MAYBE: ['MAYBE', '比較保留'],
      DROP: ['DROP', 'このPairを除外'],
    };
    pairEval.querySelectorAll('[data-pair-eval]').forEach(button => {
      const row = labels[button.dataset.pairEval];
      if (!row) return;
      button.innerHTML = `<span>${row[0]}</span><small>${row[1]}</small>`;
    });

    if (!pairEval.nextElementSibling?.classList.contains('pair-eval-help')) {
      const help = document.createElement('div');
      help.className = 'pair-eval-help';
      help.innerHTML = '<b>KEEP</b>＝有望なので残す　<b>MAYBE</b>＝まだ決めず後で比較　<b>DROP</b>＝この組合せだけ外す（素材自体は除外しない）';
      pairEval.insertAdjacentElement('afterend', help);
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .pair-order-legend{margin-top:4px;color:var(--muted);font-size:8px;line-height:1.45}
    .pair-eval button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
    .pair-eval button small{font-size:7px;font-weight:700;opacity:.82;line-height:1.1}
    .pair-eval-help{margin-top:5px;color:var(--muted);font-size:8px;line-height:1.5}
    .pair-eval-help b{color:var(--text);font-weight:800}
  `;
  document.head.appendChild(style);

  reorderKatOptions();
})();
