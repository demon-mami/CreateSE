(() => {
  'use strict';

  const controller = window.HitsoundController;
  const favorites = window.HitsoundFavorites;
  if (!controller || !favorites) return;

  const STORAGE_KEY = favorites.KEY || 'osutaiko-hitsound-lab:pair-favorite-slots:v1';
  const SILENT_ID = controller.SILENT_ID;
  const buttons = {
    favorite1: document.getElementById('favoriteOneButton'),
    favorite2: document.getElementById('favoriteTwoButton'),
  };
  const feedback = document.getElementById('setFeedback');
  const workbenchStatus = document.getElementById('workbenchStatus');
  let feedbackTimer = 0;

  function makeId(slotName) {
    if (globalThis.crypto?.randomUUID) return `${slotName}-${crypto.randomUUID()}`;
    return `${slotName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function descriptor(id) {
    const source = controller.byId(id);
    if (!source) return null;
    return {
      id,
      sourceNumber: String(source.sourceNumber || '—'),
      name: String(source.originalName || source.name || '名称なし'),
      family: String(source.originalFamily || source.family || ''),
      pitch: Number.isFinite(source.pitch) ? source.pitch : '',
      userLabel: String(source.userLabel || ''),
      custom: !!source.custom,
      slot: Number.isInteger(source.slot) ? source.slot : null,
      fingerprint: String(source.fingerprint || ''),
      silent: false,
    };
  }

  function currentEntry(slotName) {
    const selection = controller.getSelection();
    if (!selection?.don || !selection?.kat) return null;
    if (selection.don === SILENT_ID || selection.kat === SILENT_ID) return null;

    const don = descriptor(selection.don);
    const kat = descriptor(selection.kat);
    if (!don || !kat) return null;
    if ((don.custom && !don.fingerprint) || (kat.custom && !kat.fingerprint)) return null;

    return {
      id: makeId(slotName),
      don,
      kat,
      createdAt: new Date().toISOString(),
    };
  }

  function readSlots() {
    try {
      if (typeof favorites.readSlots === 'function') {
        const slots = favorites.readSlots();
        return {
          favorite1: slots?.favorite1 || null,
          favorite2: slots?.favorite2 || null,
        };
      }
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {};
      return {
        favorite1: parsed.favorite1 || null,
        favorite2: parsed.favorite2 || null,
      };
    } catch {
      return { favorite1: null, favorite2: null };
    }
  }

  function sideKey(side) {
    if (!side) return '';
    return `${side.id || ''}@${side.custom ? (side.fingerprint || '') : 'builtin'}`;
  }

  function entryKey(entry) {
    return entry ? `${sideKey(entry.don)}|${sideKey(entry.kat)}` : '';
  }

  function pairText(entry) {
    if (!entry) return '未登録';
    return `Don ${entry.don?.sourceNumber || '—'} / Kat ${entry.kat?.sourceNumber || '—'}`;
  }

  function pairTitle(entry) {
    if (!entry) return '未登録';
    return `${pairText(entry)}\n${entry.don?.name || '—'} + ${entry.kat?.name || '—'}`;
  }

  function setFeedback(message, error = false) {
    if (workbenchStatus) workbenchStatus.textContent = message;
    if (!feedback) return;
    clearTimeout(feedbackTimer);
    feedback.textContent = message;
    feedback.classList.toggle('error', error);
    feedbackTimer = window.setTimeout(() => {
      feedback.textContent = '';
      feedback.classList.remove('error');
    }, 2600);
  }

  function persistSlots(slots, slotName, expectedEntry) {
    try {
      const payload = {
        version: 1,
        favorite1: slots.favorite1 || null,
        favorite2: slots.favorite2 || null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

      const verified = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {};
      if (entryKey(verified[slotName]) !== entryKey(expectedEntry)) {
        throw new Error('favorite slot verification failed');
      }
      return true;
    } catch {
      setFeedback('お気に入りを保存できませんでした。ブラウザのサイトデータ保存設定を確認してください', true);
      return false;
    }
  }

  function renderButton(slotName, button, saved, current) {
    if (!button) return;
    const number = slotName === 'favorite1' ? '1' : '2';
    const hasSaved = !!saved;
    const matches = hasSaved && !!current && entryKey(saved) === entryKey(current);
    const icon = slotName === 'favorite1' ? (hasSaved ? '♥' : '♡') : (hasSaved ? '★' : '☆');
    const label = `お気に入り${number}`;
    const savedText = pairText(saved);

    button.disabled = !current;
    button.classList.toggle('has-saved-pair', hasSaved);
    button.classList.toggle('is-current-favorite', matches);
    button.setAttribute('aria-pressed', matches ? 'true' : 'false');
    button.setAttribute('aria-label', !current
      ? `${label}。保存内容: ${savedText}。現在は登録できる組み合わせがありません`
      : hasSaved
        ? `${label}。保存内容: ${savedText}。現在の組み合わせで上書き`
        : `${label}。未登録。現在の組み合わせを登録`);
    button.title = pairTitle(saved);
    button.replaceChildren();

    const iconNode = document.createElement('span');
    iconNode.className = 'favorite-slot-icon';
    iconNode.setAttribute('aria-hidden', 'true');
    iconNode.textContent = icon;

    const metaNode = document.createElement('span');
    metaNode.className = 'favorite-slot-meta';

    const labelNode = document.createElement('span');
    labelNode.className = 'favorite-slot-label';
    labelNode.textContent = label;

    const pairNode = document.createElement('span');
    pairNode.className = 'favorite-slot-pair';
    pairNode.textContent = savedText;

    metaNode.append(labelNode, pairNode);
    button.append(iconNode, metaNode);
  }

  function render() {
    const slots = readSlots();
    const current = currentEntry('current');
    renderButton('favorite1', buttons.favorite1, slots.favorite1, current);
    renderButton('favorite2', buttons.favorite2, slots.favorite2, current);
  }

  function saveSlot(slotName) {
    const entry = currentEntry(slotName);
    const label = slotName === 'favorite1' ? 'お気に入り1' : 'お気に入り2';
    if (!entry) {
      setFeedback('DonとKatの両方を選択してください', true);
      render();
      return;
    }

    const slots = readSlots();
    const previous = slots[slotName];
    if (entryKey(previous) === entryKey(entry)) {
      setFeedback(`${label}に保存済みです`);
      render();
      return;
    }

    slots[slotName] = entry;
    if (!persistSlots(slots, slotName, entry)) {
      render();
      return;
    }

    window.dispatchEvent(new CustomEvent('hitsound-quick-favorites-change', {
      detail: {
        favorite1: entryKey(slots.favorite1),
        favorite2: entryKey(slots.favorite2),
      },
    }));
    setFeedback(previous ? `${label}を現在の組み合わせで上書きしました` : `${label}へ登録しました`);
    render();
  }

  for (const [slotName, button] of Object.entries(buttons)) {
    if (!button) continue;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveSlot(slotName);
    }, { capture: true });
  }

  window.addEventListener('hitsound-selection-change', () => queueMicrotask(render));
  window.addEventListener('hitsound-custom-sources-change', () => queueMicrotask(render));
  window.addEventListener('hitsound-quick-favorites-change', () => queueMicrotask(render));
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) render();
  });
  window.addEventListener('pageshow', render);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });

  const style = document.createElement('style');
  style.dataset.feature = 'favorite-slot-visibility';
  style.textContent = `
    .judgment-actions{
      grid-template-columns:112px 112px 72px!important;
      justify-content:center;
      align-items:stretch;
      gap:10px!important;
    }
    .judgment-actions .quick-favorite{
      width:112px;
      min-width:112px;
      min-height:48px;
      padding:4px 7px!important;
      display:grid;
      grid-template-columns:26px minmax(0,1fr);
      align-items:center;
      gap:5px;
      text-align:left;
    }
    .favorite-slot-icon{
      display:grid;
      place-items:center;
      font-size:20px;
      line-height:1;
    }
    .favorite-slot-meta{
      min-width:0;
      display:grid;
      gap:2px;
      line-height:1.1;
    }
    .favorite-slot-label{
      overflow:hidden;
      color:rgba(255,255,255,.76);
      font-size:9px;
      font-weight:820;
      white-space:nowrap;
      text-overflow:ellipsis;
    }
    .favorite-slot-pair{
      overflow:hidden;
      color:rgba(255,255,255,.58);
      font-size:8px;
      font-weight:720;
      font-variant-numeric:tabular-nums;
      white-space:nowrap;
      text-overflow:ellipsis;
    }
    .quick-favorite.has-saved-pair{
      border-color:rgba(255,255,255,.42)!important;
    }
    .quick-favorite.favorite-one.has-saved-pair{
      color:#fff3c7;
      background:rgba(137,109,39,.22);
    }
    .quick-favorite.favorite-two.has-saved-pair{
      color:#f3deff;
      background:rgba(111,76,139,.25);
    }
    .quick-favorite.is-current-favorite{
      box-shadow:0 0 0 1px rgba(255,255,255,.18),0 0 15px rgba(255,255,255,.10)!important;
    }
    .quick-favorite.is-current-favorite .favorite-slot-pair{
      color:rgba(255,255,255,.88);
    }
    .judgment-actions .preset-action{
      width:72px;
      min-width:72px;
    }
    @media(max-width:430px){
      .judgment-actions{
        grid-template-columns:106px 106px 68px!important;
        gap:8px!important;
      }
      .judgment-actions .quick-favorite{
        width:106px;
        min-width:106px;
        padding-inline:6px!important;
      }
      .judgment-actions .preset-action{
        width:68px;
        min-width:68px;
      }
      .favorite-slot-label{font-size:8px}
      .favorite-slot-pair{font-size:7.5px}
    }
  `;
  document.head.appendChild(style);

  render();
})();
