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
  const recommendationLine = $('recommendationLine');
  const customInput = $('customHitsoundInput');
  const customSlots = $('customSoundSlots');
  const customCount = $('customSoundCount');
  const customStatus = $('mySoundStatus');
  const workbenchStatus = $('workbenchStatus');
  const roleDonCurrent = $('roleDonCurrent');
  const roleKatCurrent = $('roleKatCurrent');

  if (!CANDIDATES.length || !controller || !favorites || !grid || !sources || !roleDonButton || !roleKatButton || !customInput || !customSlots || !customCount) return;

  const SILENT_ID = controller.SILENT_ID;
  const LEGACY_DELETE_CANDIDATE_STORAGE_KEY = 'osutaiko-hitsound-lab:deletion-candidates:current111-abc-v5';
  const ACTIVE_SIDE_STORAGE_KEY = 'osutaiko-hitsound-lab:active-side:v1';
  const CUSTOM_SLOT_COUNT = 8;
  const CUSTOM_DB_NAME = 'CreateSE-custom-sounds-v1';
  const CUSTOM_STORE_NAME = 'sounds';
  const MAX_CUSTOM_FILE_BYTES = 8 * 1024 * 1024;
  const MAX_CUSTOM_DURATION_SEC = 5;
  const MOVE_TOLERANCE_PX = 11;
  const customRecords = new Map();
  let activeSide = (() => {
    try { return localStorage.getItem(ACTIVE_SIDE_STORAGE_KEY) === 'kat' ? 'kat' : 'don'; }
    catch { return 'don'; }
  })();
  let pressState = null;
  let suppressClickFor = null;
  let customDbPromise = null;
  let customReady = false;
  let customBusy = false;
  let uploadTargetSlot = null;
  let uploadReplace = false;
  let renderedRowCapacity = 0;

  const familyOf = candidate => candidate?.originalFamily || candidate?.family || 'Other';
  const displayFamily = candidate => familyOf(candidate) === 'Taiko Reference' ? 'Taiko' : familyOf(candidate);
  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const customIdForSlot = slot => `__CUSTOM_${slot}__`;

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
    'Taiko',
  ];

  // Fixed placement preserves the user's spatial memory. Wide layouts use two
  // six-key modules; narrow layouts keep the same order and only share a row
  // when the fixed pair still fits without shrinking a touch target.
  const FAMILY_ROW_PLAN = [
    ['Annihilator'],
    ['Doom Pulse', 'Taiko'],
    ['Bass Drum / Kick', 'Snare'],
    ['Clave / Claves'],
    ['Forest Perc A'],
    ['Forest Perc B'],
    ['Forest Perc C', 'Forest Perc D'],
    ['Forest Perc E', 'Forest Perc F'],
    ['Hi-Hat', 'Snap'],
    ['Rimshot'],
    ['Agogo', 'Cowbell'],
    ['Timbale', 'Woodblock'],
    ['Tom'],
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
    return String(candidate.sourceLabel || `SRC-${candidate.sourceNumber}`);
  }

  function keyMarkup(candidate) {
    const source = candidateLabel(candidate);
    const family = displayFamily(candidate);
    const abcGrade = String(candidate.abcGrade || '').toUpperCase();
    return `<button class="hs-key" type="button" data-hs-id="${candidate.id}" data-abc="${abcGrade}" title="${source}" aria-label="${source}、${abcGrade}、${family}" aria-pressed="false" data-base-label="${source}"><span>${candidate.sourceNumber}</span></button>`;
  }

  function candidateRowCapacity() {
    const width = Math.max(0, sources.clientWidth);
    if (!width) return 12;
    return Math.max(4, Math.min(12, Math.floor((width + 7) / 51)));
  }

  function plannedCandidateRows(groups, capacity) {
    const byFamily = new Map(groups);
    const used = new Set();
    const rows = [];

    for (const plannedFamilies of FAMILY_ROW_PLAN) {
      const row = plannedFamilies.map(family => byFamily.get(family)).filter(Boolean).map(list => {
        const family = displayFamily(list[0]);
        used.add(family);
        return [family, list];
      });
      if (!row.length) continue;
      const requiredSlots = row.reduce((sum, group) => sum + group[1].length, 0) + row.length - 1;
      if (row.length === 2 && capacity < 12 && requiredSlots > capacity) {
        rows.push([row[0]], [row[1]]);
      } else {
        rows.push(row);
      }
    }

    for (const group of groups) {
      if (!used.has(group[0])) rows.push([group]);
    }
    return rows;
  }

  function familyMarkup([family, candidates], capacity, { moduleLayout, paired }) {
    let slots;
    let columns;
    if (moduleLayout) {
      const fullWidth = candidates.length > 6;
      slots = fullWidth ? 2 : 1;
      columns = fullWidth ? 12 : 6;
    } else if (paired) {
      slots = Math.min(capacity, candidates.length);
      columns = slots;
    } else {
      slots = capacity;
      columns = capacity;
    }
    return `
      <section class="hs-family" data-family="${family}" style="--family-slots:${slots};--family-columns:${columns}">
        <div class="hs-family-title">${family}</div>
        <div class="hs-family-grid">${candidates.map(keyMarkup).join('')}</div>
      </section>`;
  }

  function buildGrid({ force = false } = {}) {
    const capacity = candidateRowCapacity();
    if (!force && capacity === renderedRowCapacity) return;
    renderedRowCapacity = capacity;
    const groups = groupedCandidates();
    const rows = plannedCandidateRows(groups, capacity);
    const moduleLayout = capacity >= 12;
    sources.style.setProperty('--source-row-slots', String(capacity));
    sources.innerHTML = rows.map(row => `
      <div class="hs-family-row" data-family-count="${row.length}" data-layout="${moduleLayout ? 'modules' : 'slots'}">
        ${row.map((group, index) => `${index > 0 && !moduleLayout ? '<span class="hs-family-spacer" aria-hidden="true"></span>' : ''}${familyMarkup(group, capacity, { moduleLayout, paired: row.length === 2 })}`).join('')}
      </div>
    `).join('');
    paint();
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
        size: record.size,
        fingerprint: record.fingerprint,
        bytes: record.bytes,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('ユーザー音源を保存できません。'));
      transaction.onabort = () => reject(transaction.error || new Error('ユーザー音源の保存が中断されました。'));
    });
  }

  function setCustomStatus(message, { error = false } = {}) {
    if (!customStatus) return;
    customStatus.textContent = message;
    customStatus.classList.toggle('error', error);
  }

  function reportActionError(error, fallback = '操作を完了できませんでした。') {
    const message = error instanceof Error ? error.message : fallback;
    if (workbenchStatus) workbenchStatus.textContent = message;
  }

  async function fingerprintBytes(bytes) {
    const view = bytes instanceof ArrayBuffer
      ? bytes
      : bytes?.buffer?.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    if (!view?.byteLength) throw new Error('音源データを確認できません。');
    if (!globalThis.crypto?.subtle) {
      let first = 0x811c9dc5;
      let second = 0x9e3779b9;
      for (const value of new Uint8Array(view)) {
        first = Math.imul(first ^ value, 0x01000193);
        second = Math.imul(second ^ (value + 0x9d), 0x85ebca6b);
      }
      return `fnv-${view.byteLength}-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
    }
    const digest = await crypto.subtle.digest('SHA-256', view);
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  }

  function customDisplayName(record) {
    const fallback = String(record?.sourceNumber || 'My Sound');
    const fileName = String(record?.name || '').trim();
    if (!fileName) return fallback;
    const baseName = fileName.replace(/\.[^.]+$/, '').trim();
    return baseName || fallback;
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
        soundButton.setAttribute('aria-label', `${record.sourceNumber} ${record.name} を選択`);
        const soundFace = document.createElement('span');
        const soundLabel = document.createElement('span');
        soundLabel.className = 'custom-sound-label';
        soundLabel.textContent = customDisplayName(record);
        soundFace.append(soundLabel);
        soundButton.append(soundFace);

        const replaceButton = document.createElement('button');
        replaceButton.type = 'button';
        replaceButton.className = 'hs-key custom-sound-replace';
        replaceButton.dataset.replaceSlot = String(slot);
        replaceButton.disabled = customBusy;
        replaceButton.title = `${record.sourceNumber} ${record.name} を変更`;
        replaceButton.setAttribute('aria-label', `${record.sourceNumber} ${record.name} を別のWAVへ変更`);
        const replaceFace = document.createElement('span');
        replaceFace.textContent = '↻';
        replaceButton.append(replaceFace);

        item.append(soundButton, replaceButton);
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
          const fingerprint = stored.fingerprint || await fingerprintBytes(stored.bytes);
          const record = controller.registerCustomSource(id, {
            ...stored,
            fingerprint,
            size: Number(stored.size) || stored.bytes?.byteLength || 0,
          });
          customRecords.set(id, record);
          if (!stored.fingerprint) await writeCustomRecord(record);
        } catch (error) {
          console.warn('保存済みユーザー音源を復元できませんでした。', error);
        }
      }
      setCustomStatus(customRecords.size
        ? `${customRecords.size}件のMy Soundを復元しました`
        : 'WAV・8MB以下・5秒以下');
    } catch (error) {
      console.warn('ユーザー音源の保存領域を利用できません。', error);
      setCustomStatus('My Soundの保存領域を利用できません', { error: true });
    } finally {
      customReady = true;
      renderCustomSlots();
      paint();
      window.dispatchEvent(new CustomEvent('hitsound-custom-sources-change'));
    }
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
    roleDonButton.setAttribute('aria-label', `Donを操作対象にする。現在${selection.don === SILENT_ID ? '無音' : (donSource?.sourceNumber || '未選択')}`);
    roleKatButton.setAttribute('aria-label', `Katを操作対象にする。現在${selection.kat === SILENT_ID ? '無音' : (katSource?.sourceNumber || '未選択')}`);
    if (roleDonCurrent) roleDonCurrent.textContent = selection.don === SILENT_ID ? '無音' : (donSource?.sourceNumber || '未選択');
    if (roleKatCurrent) roleKatCurrent.textContent = selection.kat === SILENT_ID ? '無音' : (katSource?.sourceNumber || '未選択');

    grid.dataset.activeSide = activeSide;
    sources.querySelectorAll('.hs-key[data-hs-id]').forEach(button => {
      const id = button.dataset.hsId;
      button.classList.toggle('selected-don', id === selection.don);
      button.classList.toggle('selected-kat', id === selection.kat);
      button.setAttribute('aria-pressed', id === selection[activeSide] ? 'true' : 'false');
    });

    customSlots.querySelectorAll('.custom-sound-key[data-custom-id]').forEach(button => {
      const id = button.dataset.customId;
      button.classList.toggle('selected-don', id === selection.don);
      button.classList.toggle('selected-kat', id === selection.kat);
      button.setAttribute('aria-pressed', id === selection[activeSide] ? 'true' : 'false');
      const states = [
        id === selection.don ? '現在のDon' : '',
        id === selection.kat ? '現在のKat' : '',
      ].filter(Boolean);
      button.setAttribute('aria-description', states.join('。'));
    });

    paintRecommendation();
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

  function requestCustomUpload(slot, { replace = false } = {}) {
    if (!customReady || customBusy || slot < 1 || slot > CUSTOM_SLOT_COUNT) return;
    const id = customIdForSlot(slot);
    const occupied = customRecords.has(id);
    if (replace ? !occupied : occupied) return;
    uploadTargetSlot = slot;
    uploadReplace = replace;
    customInput.value = '';
    setCustomStatus(replace
      ? `My Sound ${slot} を変更するWAVを選択してください`
      : `My Sound ${slot} に追加するWAVを選択してください`);
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
    const isWav = /\.wav$/i.test(file.name || '') || /audio\/(?:wav|x-wav)/i.test(file.type || '');
    if (!isWav) throw new Error('WAVファイルを選択してください。');
    if (!file.size) throw new Error('空の音源ファイルは追加できません。');
    if (file.size > MAX_CUSTOM_FILE_BYTES) throw new Error('音源は8MB以下にしてください。');
    const duration = await probeAudioDuration(file);
    if (duration > MAX_CUSTOM_DURATION_SEC + 0.01) {
      throw new Error('ヒットサウンドは5秒以下にしてください。');
    }
  }

  async function saveCustomSound(file, slot, { replace = false } = {}) {
    const id = customIdForSlot(slot);
    const existing = customRecords.get(id) || null;
    if (!file || customBusy || (replace ? !existing : !!existing)) return;

    customBusy = true;
    renderCustomSlots();
    let record = null;
    let persistenceError = null;

    try {
      await validateCustomSound(file);
      const bytes = await file.arrayBuffer();
      const fingerprint = await fingerprintBytes(bytes);
      record = controller.registerCustomSource(id, {
        id,
        slot,
        sourceNumber: `M${slot}`,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        size: file.size,
        fingerprint,
        bytes,
      });
      customRecords.set(id, record);
      try {
        await writeCustomRecord(record);
      } catch (error) {
        persistenceError = error;
        console.warn('ユーザー音源をブラウザに保存できませんでした。', error);
      }
      setCustomStatus(`${record.name} を${replace ? '変更' : '追加'}しました`);
    } catch (error) {
      if (record) {
        if (replace && existing) {
          const restored = controller.registerCustomSource(id, existing);
          customRecords.set(id, restored);
        } else {
          customRecords.delete(id);
          await controller.unregisterCustomSource(id).catch(() => {});
        }
      }
      setCustomStatus(error instanceof Error ? error.message : `音源を${replace ? '変更' : '追加'}できませんでした。`, { error: true });
      throw error;
    } finally {
      customBusy = false;
      renderCustomSlots();
      paint();
    }

    if (persistenceError) {
      setCustomStatus(replace
        ? '変更した音源は現在使用できますが保存できませんでした。次回起動時は以前の音源に戻ります。'
        : '音源は使用できますが保存できませんでした。次回は再追加してください。', { error: true });
    }

    if (replace) {
      const selection = controller.getSelection();
      if (selection.don === id || selection.kat === id) {
        try {
          await controller.applyPair();
        } catch (error) {
          setCustomStatus(`音源は変更しましたが再生側へ反映できませんでした。${error.message}`, { error: true });
        }
      }
    } else {
      try {
        await chooseSound(id, { preview: false });
      } catch (error) {
        setCustomStatus(`音源は追加しましたが選択を反映できませんでした。${error.message}`, { error: true });
      }
    }
    window.dispatchEvent(new CustomEvent('hitsound-custom-sources-change'));
  }

  function setActiveSide(side) {
    if (side !== 'don' && side !== 'kat') return;
    controller.stopPreview();
    activeSide = side;
    try { localStorage.setItem(ACTIVE_SIDE_STORAGE_KEY, activeSide); } catch {}
    paint();
    window.dispatchEvent(new CustomEvent('hitsound-active-side-change', { detail: { side: activeSide } }));
  }

  function finishPress(event, cancelled = false) {
    if (!pressState || (event?.pointerId != null && event.pointerId !== pressState.pointerId)) return;
    const releasedButton = pressState.button;
    if (cancelled) pressState.cancelled = true;
    if (pressState.cancelled) {
      suppressClickFor = releasedButton;
      event?.preventDefault?.();
      setTimeout(() => {
        if (suppressClickFor === releasedButton) suppressClickFor = null;
      }, 500);
    }
    pressState = null;
  }

  roleDonButton.addEventListener('click', () => setActiveSide('don'));
  roleKatButton.addEventListener('click', () => setActiveSide('kat'));
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
      cancelled: false,
    };
    button.setPointerCapture?.(event.pointerId);
  });

  sources.addEventListener('pointermove', event => {
    if (!pressState || event.pointerId !== pressState.pointerId) return;
    const dx = event.clientX - pressState.startX;
    const dy = event.clientY - pressState.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
      pressState.cancelled = true;
      suppressClickFor = pressState.button;
    }
  });

  sources.addEventListener('pointerup', event => finishPress(event));
  sources.addEventListener('pointercancel', event => finishPress(event, true));
  sources.addEventListener('lostpointercapture', event => finishPress(event, true));

  sources.addEventListener('click', event => {
    const button = event.target.closest('.hs-key[data-hs-id]');
    if (!button || sources.classList.contains('busy')) return;
    if (suppressClickFor === button) {
      suppressClickFor = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    chooseSound(button.dataset.hsId).catch(reportActionError);
  });

  customSlots.addEventListener('click', event => {
    if (customBusy || !customReady) return;

    const replaceButton = event.target.closest('[data-replace-slot]');
    if (replaceButton && customSlots.contains(replaceButton)) {
      requestCustomUpload(Number(replaceButton.dataset.replaceSlot), { replace: true });
      return;
    }

    const addButton = event.target.closest('[data-upload-slot]');
    if (addButton && customSlots.contains(addButton)) {
      requestCustomUpload(Number(addButton.dataset.uploadSlot));
      return;
    }

    const soundButton = event.target.closest('.custom-sound-key[data-custom-id]');
    if (soundButton && customSlots.contains(soundButton)) {
      chooseSound(soundButton.dataset.customId).catch(reportActionError);
    }
  });

  customInput.addEventListener('change', () => {
    const file = customInput.files?.[0] || null;
    const slot = uploadTargetSlot;
    const replace = uploadReplace;
    uploadTargetSlot = null;
    uploadReplace = false;
    customInput.value = '';
    if (!slot) return;
    if (!file) {
      setCustomStatus(`音源の${replace ? '変更' : '追加'}をキャンセルしました`);
      return;
    }
    setCustomStatus(`${file.name} を確認しています…`);
    saveCustomSound(file, slot, { replace }).catch(() => {});
  });
  customInput.addEventListener('cancel', () => {
    const replace = uploadReplace;
    uploadTargetSlot = null;
    uploadReplace = false;
    setCustomStatus(`音源の${replace ? '変更' : '追加'}をキャンセルしました`);
  });

  window.addEventListener('hitsound-selection-change', paint);
  try { localStorage.removeItem(LEGACY_DELETE_CANDIDATE_STORAGE_KEY); } catch {}

  buildGrid({ force: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => buildGrid()).observe(sources);
  } else {
    window.addEventListener('resize', () => buildGrid());
  }
  renderCustomSlots();
  paint();
  window.dispatchEvent(new CustomEvent('hitsound-active-side-change', { detail: { side: activeSide } }));
  restoreCustomSounds();
})();
