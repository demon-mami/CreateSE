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
  const songPlayButton = $('playButton');
  const recommendationLine = $('recommendationLine');
  const customInput = $('customHitsoundInput');
  const customSlots = $('customSoundSlots');
  const customCount = $('customSoundCount');

  if (!CANDIDATES.length || !controller || !favorites || !grid || !sources || !roleDonButton || !roleKatButton || !customInput || !customSlots || !customCount) return;

  const SILENT_ID = controller.SILENT_ID;
  const PIN_STORAGE_KEY = 'osutaiko-hitsound-lab:pinned-sources:v1';
  const CUSTOM_SLOT_COUNT = 4;
  const CUSTOM_DB_NAME = 'CreateSE-custom-sounds-v1';
  const CUSTOM_STORE_NAME = 'sounds';
  const MAX_CUSTOM_FILE_BYTES = 8 * 1024 * 1024;
  const MAX_CUSTOM_DURATION_SEC = 5;
  const LONG_PRESS_MS = 520;
  const MOVE_TOLERANCE_PX = 11;
  const validCandidateIds = new Set(CANDIDATES.filter(candidate => !candidate.excluded).map(candidate => candidate.id));
  const customRecords = new Map();
  let activeSide = 'don';
  let pressState = null;
  let suppressClickFor = null;
  let customDbPromise = null;
  let customReady = false;
  let customBusy = false;
  let uploadTargetSlot = null;

  const familyOf = candidate => candidate?.originalFamily || candidate?.family || 'Other';
  const displayFamily = candidate => familyOf(candidate);
  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const customIdForSlot = slot => `__CUSTOM_${slot}__`;

  function readPinnedIds() {
    try {
      const saved = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) || '[]');
      return new Set(Array.isArray(saved) ? saved.filter(id => validCandidateIds.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  const pinnedIds = readPinnedIds();

  function savePinnedIds() {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(Array.from(pinnedIds)));
    } catch {}
  }

  const preferredOrder = [
    'Annihilator',
    'Doom Pulse',
    'Bass Drum / Kick',
    'Clap',
    'Clave / Claves',
    'Forest Perc A',
    'Forest Perc B',
    'Forest Perc C',
    'Forest Perc D',
    'Forest Perc E',
    'Forest Perc F',
    'Hi-Hat',
    'Rimshot',
    'Agogo',
    'Cowbell',
    'Timbale',
    'Woodblock',
    'Snap',
    'Snare',
    'Tom',
    'Taiko Reference',
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

  function candidateLabel(candidate) {
    return `${candidate.sourceNumber} ${candidate.originalName || candidate.name || ''}`.trim();
  }

  function pinHint(candidate) {
    return `${candidateLabel(candidate)} · 長押しでピン留め${pinnedIds.has(candidate.id) ? '解除' : ''}`;
  }

  function keyMarkup(candidate) {
    const source = String(candidate.originalName || candidate.name || '');
    const pitch = Number.isFinite(candidate.pitch) ? `${candidate.pitch.toFixed(1)} Hz` : '';
    const pinned = pinnedIds.has(candidate.id);
    return `<button class="hs-key${pinned ? ' pinned' : ''}" type="button" data-hs-id="${candidate.id}" title="${source}${pitch ? ` · ${pitch}` : ''} · 長押しでピン留め${pinned ? '解除' : ''}" aria-label="${pinHint(candidate)}" data-base-label="${candidateLabel(candidate)}"><span>${candidate.sourceNumber}</span></button>`;
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

  function openCustomDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('このブラウザでは音源を保存できません。'));
    if (customDbPromise) return customDbPromise;

    customDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(CUSTOM_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CUSTOM_STORE_NAME)) {
          db.createObjectStore(CUSTOM_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('ユーザー音源の保存領域を開けません。'));
      request.onblocked = () => reject(new Error('ユーザー音源の保存領域がほかのタブで使用中です。'));
    });
    return customDbPromise;
  }

  async function readCustomRecords() {
    const db = await openCustomDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(CUSTOM_STORE_NAME, 'readonly').objectStore(CUSTOM_STORE_NAME).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error || new Error('保存済み音源を読み込めません。'));
    });
  }

  async function writeCustomRecord(record) {
    const db = await openCustomDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOM_STORE_NAME, 'readwrite');
      transaction.objectStore(CUSTOM_STORE_NAME).put({
        id: record.id,
        slot: record.slot,
        sourceNumber: record.sourceNumber,
        name: record.name,
        type: record.type,
        lastModified: record.lastModified,
        bytes: record.bytes,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('ユーザー音源を保存できません。'));
      transaction.onabort = () => reject(transaction.error || new Error('ユーザー音源の保存が中断されました。'));
    });
  }

  async function deleteCustomRecord(id) {
    const db = await openCustomDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CUSTOM_STORE_NAME, 'readwrite');
      transaction.objectStore(CUSTOM_STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('ユーザー音源を削除できません。'));
      transaction.onabort = () => reject(transaction.error || new Error('ユーザー音源の削除が中断されました。'));
    });
  }

  function renderCustomSlots() {
    const fragment = document.createDocumentFragment();

    for (let slot = 1; slot <= CUSTOM_SLOT_COUNT; slot++) {
      const id = customIdForSlot(slot);
      const record = customRecords.get(id);
      const item = document.createElement('div');
      item.className = `custom-sound-slot${record ? '' : ' empty'}`;

      if (!record) {
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'hs-key custom-sound-add';
        addButton.dataset.uploadSlot = String(slot);
        addButton.disabled = !customReady || customBusy;
        addButton.title = `My Sound ${slot} に音源を追加`;
        addButton.setAttribute('aria-label', `ユーザー音源 ${slot} を追加`);
        const face = document.createElement('span');
        face.textContent = customReady ? '＋' : '…';
        addButton.append(face);
        item.append(addButton);
      } else {
        const soundButton = document.createElement('button');
        soundButton.type = 'button';
        soundButton.className = 'hs-key custom-sound-key';
        soundButton.dataset.customId = id;
        soundButton.disabled = customBusy;
        soundButton.title = record.name;
        soundButton.setAttribute('aria-label', `${record.sourceNumber} ${record.name} を選択・試聴`);
        const soundFace = document.createElement('span');
        soundFace.textContent = record.sourceNumber;
        soundButton.append(soundFace);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'hs-key custom-sound-delete';
        deleteButton.dataset.deleteCustom = id;
        deleteButton.disabled = customBusy;
        deleteButton.title = `${record.name} を削除`;
        deleteButton.setAttribute('aria-label', `${record.sourceNumber} ${record.name} を削除`);
        const deleteFace = document.createElement('span');
        deleteFace.textContent = '×';
        deleteButton.append(deleteFace);

        item.append(soundButton, deleteButton);
      }
      fragment.append(item);
    }

    customSlots.replaceChildren(fragment);
    customSlots.classList.toggle('busy', !customReady || customBusy);
    customSlots.setAttribute('aria-busy', (!customReady || customBusy) ? 'true' : 'false');
    customCount.textContent = `${customRecords.size} / ${CUSTOM_SLOT_COUNT}`;
  }

  async function restoreCustomSounds() {
    try {
      const records = await readCustomRecords();
      for (const stored of records) {
        const slot = Number(stored?.slot);
        const id = customIdForSlot(slot);
        if (slot < 1 || slot > CUSTOM_SLOT_COUNT || stored?.id !== id || customRecords.has(id)) continue;
        try {
          const record = controller.registerCustomSource(id, stored);
          customRecords.set(id, record);
        } catch (error) {
          console.warn('保存済みユーザー音源を復元できませんでした。', error);
        }
      }
    } catch (error) {
      console.warn('ユーザー音源の保存領域を利用できません。', error);
    } finally {
      customReady = true;
      renderCustomSlots();
      paint();
    }
  }

  function paintPinnedButton(button) {
    const id = button?.dataset.hsId;
    const candidate = byId(id);
    if (!button || !candidate) return;
    const pinned = pinnedIds.has(id);
    const source = String(candidate.originalName || candidate.name || '');
    const pitch = Number.isFinite(candidate.pitch) ? `${candidate.pitch.toFixed(1)} Hz` : '';
    button.classList.toggle('pinned', pinned);
    button.setAttribute('aria-label', pinHint(candidate));
    button.setAttribute('aria-description', pinned ? 'ピン留め中。長押しで解除できます。' : '長押しでピン留めできます。');
    button.title = `${source}${pitch ? ` · ${pitch}` : ''} · 長押しでピン留め${pinned ? '解除' : ''}`;
  }

  function togglePin(button) {
    const id = button?.dataset.hsId;
    if (!validCandidateIds.has(id)) return;
    if (pinnedIds.has(id)) pinnedIds.delete(id);
    else pinnedIds.add(id);
    savePinnedIds();
    paintPinnedButton(button);
    button.classList.remove('pin-pulse');
    void button.offsetWidth;
    button.classList.add('pin-pulse');
    setTimeout(() => button.classList.remove('pin-pulse'), 360);
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
    const donSource = controller.byId(selection.don);
    const katSource = controller.byId(selection.kat);

    roleDonButton.classList.toggle('target', activeSide === 'don');
    roleKatButton.classList.toggle('target', activeSide === 'kat');
    roleDonButton.setAttribute('aria-pressed', activeSide === 'don' ? 'true' : 'false');
    roleKatButton.setAttribute('aria-pressed', activeSide === 'kat' ? 'true' : 'false');
    roleDonButton.title = selection.don === SILENT_ID ? 'Don: 無音' : `Don: ${donSource?.sourceNumber || '—'}`;
    roleKatButton.title = selection.kat === SILENT_ID ? 'Kat: 無音' : `Kat: ${katSource?.sourceNumber || '—'}`;

    grid.dataset.activeSide = activeSide;
    sources.querySelectorAll('.hs-key[data-hs-id]').forEach(button => {
      const id = button.dataset.hsId;
      button.classList.toggle('selected-don', id === selection.don);
      button.classList.toggle('selected-kat', id === selection.kat);
      paintPinnedButton(button);
    });

    customSlots.querySelectorAll('.custom-sound-key[data-custom-id]').forEach(button => {
      const id = button.dataset.customId;
      button.classList.toggle('selected-don', id === selection.don);
      button.classList.toggle('selected-kat', id === selection.kat);
    });

    if (silentButton) {
      silentButton.classList.toggle('selected-don', activeSide === 'don' && selection.don === SILENT_ID);
      silentButton.classList.toggle('selected-kat', activeSide === 'kat' && selection.kat === SILENT_ID);
    }

    paintRecommendation();
  }

  function syncSongTransportButton() {
    if (!previewButton) return;
    const face = previewButton.querySelector('span') || previewButton;
    const playing = !!songPlayButton && !songPlayButton.disabled && songPlayButton.textContent.trim() !== '▶';
    face.textContent = playing ? 'Ⅱ' : '▶';
    previewButton.disabled = !songPlayButton || songPlayButton.disabled;
    previewButton.setAttribute('aria-pressed', playing ? 'true' : 'false');
    previewButton.setAttribute('aria-label', playing ? '曲を一時停止' : '曲を再生');
  }

  async function chooseSound(id, { preview = true } = {}) {
    const current = controller.getSelection()[activeSide];
    const deselecting = current === id;
    const nextId = deselecting ? null : id;
    try {
      await controller.setSide(activeSide, nextId, { preview: preview && !deselecting });
    } finally {
      paint();
    }
  }

  function requestCustomUpload(slot) {
    if (!customReady || customBusy || slot < 1 || slot > CUSTOM_SLOT_COUNT) return;
    if (customRecords.has(customIdForSlot(slot))) return;
    uploadTargetSlot = slot;
    customInput.value = '';
    customInput.click();
  }

  function probeAudioDuration(file) {
    return new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(file);
      let timer = 0;

      const cleanup = () => {
        clearTimeout(timer);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        audio.removeAttribute('src');
        URL.revokeObjectURL(url);
      };

      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        cleanup();
        if (Number.isFinite(duration) && duration > 0) resolve(duration);
        else reject(new Error('音源の長さを確認できません。'));
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error('この音声形式はブラウザで読み込めません。'));
      };
      timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('音源の確認に時間がかかりすぎました。'));
      }, 8000);
      audio.src = url;
    });
  }

  async function validateCustomSound(file) {
    if (!file.size) throw new Error('空の音源ファイルは追加できません。');
    if (file.size > MAX_CUSTOM_FILE_BYTES) throw new Error('音源は8MB以下にしてください。');
    const duration = await probeAudioDuration(file);
    if (duration > MAX_CUSTOM_DURATION_SEC + 0.01) {
      throw new Error('ヒットサウンドは5秒以下にしてください。');
    }
  }

  async function addCustomSound(file, slot) {
    const id = customIdForSlot(slot);
    if (!file || customBusy || customRecords.has(id)) return;

    customBusy = true;
    renderCustomSlots();
    let record = null;
    let persistenceError = null;

    try {
      await validateCustomSound(file);
      const bytes = await file.arrayBuffer();
      record = controller.registerCustomSource(id, {
        id,
        slot,
        sourceNumber: `M${slot}`,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        bytes,
      });
      customRecords.set(id, record);

      try {
        await writeCustomRecord(record);
      } catch (error) {
        persistenceError = error;
        console.warn('ユーザー音源をブラウザに保存できませんでした。', error);
      }
    } catch (error) {
      if (record) {
        customRecords.delete(id);
        await controller.unregisterCustomSource(id).catch(() => {});
      }
      throw error;
    } finally {
      customBusy = false;
      renderCustomSlots();
      paint();
    }

    if (persistenceError) {
      alert('音源は使用できますが、ブラウザへの保存に失敗しました。次回は再追加してください。');
    }

    try {
      await chooseSound(id, { preview: false });
    } catch (error) {
      alert(`音源は追加しましたが、選択を反映できませんでした。\n${error.message}`);
    }
  }

  async function removeCustomSound(id) {
    const record = customRecords.get(id);
    if (!record || customBusy) return;

    customBusy = true;
    customRecords.delete(id);
    renderCustomSlots();

    let deleteError = null;
    try {
      await Promise.all([
        controller.unregisterCustomSource(id),
        deleteCustomRecord(id).catch(error => { deleteError = error; }),
      ]);
    } finally {
      customBusy = false;
      renderCustomSlots();
      paint();
    }

    if (deleteError) {
      console.warn('保存済みユーザー音源を削除できませんでした。', deleteError);
      alert('この画面からは削除しましたが、ブラウザの保存データを削除できませんでした。');
    }
  }

  async function chooseSilent() {
    try {
      await controller.setSide(activeSide, SILENT_ID);
    } finally {
      paint();
    }
  }

  function setActiveSide(side) {
    if (side !== 'don' && side !== 'kat') return;
    controller.stopPreview();
    activeSide = side;
    paint();
  }

  function clearPressTimer() {
    if (pressState?.timer) clearTimeout(pressState.timer);
    if (pressState) pressState.timer = 0;
  }

  function finishPress(event, cancelled = false) {
    if (!pressState || (event?.pointerId != null && event.pointerId !== pressState.pointerId)) return;
    const releasedButton = pressState.button;
    const wasLongPress = pressState.longPressed;
    clearPressTimer();
    if (cancelled) pressState.cancelled = true;
    if (wasLongPress) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      setTimeout(() => {
        if (suppressClickFor === releasedButton) suppressClickFor = null;
      }, 900);
    }
    pressState = null;
  }

  roleDonButton.addEventListener('click', () => setActiveSide('don'));
  roleKatButton.addEventListener('click', () => setActiveSide('kat'));
  silentButton?.addEventListener('click', () => chooseSilent().catch(error => alert(error.message)));
  previewButton?.addEventListener('click', () => {
    if (!songPlayButton?.disabled) songPlayButton.click();
  });

  if (songPlayButton && previewButton) {
    new MutationObserver(syncSongTransportButton).observe(songPlayButton, {
      attributes: true,
      attributeFilter: ['disabled'],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  sources.addEventListener('pointerdown', event => {
    const button = event.target.closest('.hs-key[data-hs-id]');
    if (!button || sources.classList.contains('busy')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    finishPress(null, true);
    pressState = {
      button,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      longPressed: false,
      cancelled: false,
      timer: 0,
    };
    button.setPointerCapture?.(event.pointerId);
    pressState.timer = setTimeout(() => {
      if (!pressState || pressState.button !== button || pressState.cancelled) return;
      pressState.longPressed = true;
      suppressClickFor = button;
      togglePin(button);
      if (navigator.vibrate) navigator.vibrate(12);
    }, LONG_PRESS_MS);
  });

  sources.addEventListener('pointermove', event => {
    if (!pressState || event.pointerId !== pressState.pointerId || pressState.longPressed) return;
    const dx = event.clientX - pressState.startX;
    const dy = event.clientY - pressState.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
      pressState.cancelled = true;
      clearPressTimer();
    }
  });

  sources.addEventListener('pointerup', event => finishPress(event));
  sources.addEventListener('pointercancel', event => finishPress(event, true));
  sources.addEventListener('lostpointercapture', event => finishPress(event, true));
  sources.addEventListener('contextmenu', event => {
    if (event.target.closest('.hs-key[data-hs-id]')) event.preventDefault();
  });

  sources.addEventListener('click', event => {
    const button = event.target.closest('.hs-key[data-hs-id]');
    if (!button || sources.classList.contains('busy')) return;
    if (suppressClickFor === button) {
      suppressClickFor = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    chooseSound(button.dataset.hsId).catch(error => alert(error.message));
  });

  customSlots.addEventListener('click', event => {
    if (customBusy || !customReady) return;

    const deleteButton = event.target.closest('[data-delete-custom]');
    if (deleteButton && customSlots.contains(deleteButton)) {
      removeCustomSound(deleteButton.dataset.deleteCustom).catch(error => alert(error.message));
      return;
    }

    const addButton = event.target.closest('[data-upload-slot]');
    if (addButton && customSlots.contains(addButton)) {
      requestCustomUpload(Number(addButton.dataset.uploadSlot));
      return;
    }

    const soundButton = event.target.closest('.custom-sound-key[data-custom-id]');
    if (soundButton && customSlots.contains(soundButton)) {
      chooseSound(soundButton.dataset.customId).catch(error => alert(error.message));
    }
  });

  customInput.addEventListener('change', () => {
    const file = customInput.files?.[0] || null;
    const slot = uploadTargetSlot;
    uploadTargetSlot = null;
    customInput.value = '';
    if (!file || !slot) return;
    addCustomSound(file, slot).catch(error => alert(`音源を追加できませんでした。\n${error.message}`));
  });

  window.addEventListener('hitsound-selection-change', paint);

  buildGrid();
  renderCustomSlots();
  paint();
  syncSongTransportButton();
  restoreCustomSounds();
})();
