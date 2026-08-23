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
  const deleteCandidateButton = $('deleteCandidateButton');
  const recommendationLine = $('recommendationLine');
  const deleteCandidateLine = $('deleteCandidateLine');
  const customInput = $('customHitsoundInput');
  const customSlots = $('customSoundSlots');
  const customCount = $('customSoundCount');
  const customStatus = $('mySoundStatus');
  const workbenchStatus = $('workbenchStatus');
  const roleDonCurrent = $('roleDonCurrent');
  const roleKatCurrent = $('roleKatCurrent');

  if (!CANDIDATES.length || !controller || !favorites || !grid || !sources || !roleDonButton || !roleKatButton || !customInput || !customSlots || !customCount) return;

  const SILENT_ID = controller.SILENT_ID;
  const DELETE_CANDIDATE_STORAGE_KEY = 'osutaiko-hitsound-lab:deletion-candidates:current111-abc-v5';
  const ACTIVE_SIDE_STORAGE_KEY = 'osutaiko-hitsound-lab:active-side:v1';
  const CUSTOM_SLOT_COUNT = 4;
  const CUSTOM_DB_NAME = 'CreateSE-custom-sounds-v1';
  const CUSTOM_STORE_NAME = 'sounds';
  const MAX_CUSTOM_FILE_BYTES = 8 * 1024 * 1024;
  const MAX_CUSTOM_DURATION_SEC = 5;
  const MOVE_TOLERANCE_PX = 11;
  const validCandidateIds = new Set(CANDIDATES.filter(candidate => !candidate.excluded).map(candidate => candidate.id));
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
  let renderedRowCapacity = 0;

  const familyOf = candidate => candidate?.originalFamily || candidate?.family || 'Other';
  const displayFamily = candidate => familyOf(candidate) === 'Taiko Reference' ? 'Taiko' : familyOf(candidate);
  const byId = id => CANDIDATES.find(candidate => candidate.id === id) || null;
  const customIdForSlot = slot => `__CUSTOM_${slot}__`;

  function readDeleteCandidateIds() {
    try {
      const saved = JSON.parse(localStorage.getItem(DELETE_CANDIDATE_STORAGE_KEY) || '[]');
      return new Set(Array.isArray(saved) ? saved.filter(id => validCandidateIds.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  const deleteCandidateIds = readDeleteCandidateIds();

  function saveDeleteCandidateIds() {
    try {
      localStorage.setItem(DELETE_CANDIDATE_STORAGE_KEY, JSON.stringify(Array.from(deleteCandidateIds)));
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
    'Taiko',
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

  function packCandidateRows(groups, capacity) {
    const indexed = groups.map((group, index) => ({ group, index, count: group[1].length }));
    const rows = indexed.filter(item => item.count >= capacity).map(item => [item]);
    const remaining = indexed
      .filter(item => item.count < capacity)
      .sort((a, b) => b.count - a.count || a.index - b.index);

    while (remaining.length) {
      const first = remaining.shift();
      let partnerIndex = -1;
      let partnerDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < remaining.length; index++) {
        const candidate = remaining[index];
        if (first.count + candidate.count + 1 > capacity) continue;
        const distance = Math.abs(first.index - candidate.index);
        if (distance < partnerDistance) {
          partnerIndex = index;
          partnerDistance = distance;
        }
      }
      const row = [first];
      if (partnerIndex >= 0) row.push(remaining.splice(partnerIndex, 1)[0]);
      row.sort((a, b) => a.index - b.index);
      rows.push(row);
    }

    rows.sort((a, b) => a[0].index - b[0].index);
    return rows.map(row => row.map(item => item.group));
  }

  function familyMarkup([family, candidates], capacity) {
    const slots = Math.min(capacity, candidates.length);
    return `
      <section class="hs-family" data-family="${family}" style="--family-slots:${slots};--family-columns:${slots}">
        <div class="hs-family-title">${family}</div>
        <div class="hs-family-grid">${candidates.map(keyMarkup).join('')}</div>
      </section>`;
  }

  function buildGrid({ force = false } = {}) {
    const capacity = candidateRowCapacity();
    if (!force && capacity === renderedRowCapacity) return;
    renderedRowCapacity = capacity;
    const groups = groupedCandidates();
    const rows = packCandidateRows(groups, capacity);
    sources.style.setProperty('--source-row-slots', String(capacity));
    sources.innerHTML = rows.map(row => `
      <div class="hs-family-row" data-family-count="${row.length}">
        ${familyMarkup(row[0], capacity)}
        ${row.length === 2 ? `<span class="hs-family-spacer" aria-hidden="true"></span>${familyMarkup(row[1], capacity)}` : ''}
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
        soundButton.setAttribute('aria-label', `${record.sourceNumber} ${record.name} を選択`);
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

  function currentDeleteCandidateId() {
    const id = controller.getSelection()[activeSide];
    return validCandidateIds.has(id) ? id : null;
  }

  function paintDeleteCandidates() {
    const currentId = currentDeleteCandidateId();
    const currentCandidate = byId(currentId);
    const marked = !!currentId && deleteCandidateIds.has(currentId);
    const candidates = Array.from(deleteCandidateIds)
      .map(byId)
      .filter(candidate => candidate && !candidate.excluded)
      .sort((a, b) => Number(a.sourceNumber) - Number(b.sourceNumber));

    sources.querySelectorAll('.hs-key[data-hs-id]').forEach(button => {
      const isMarked = deleteCandidateIds.has(button.dataset.hsId);
      button.classList.toggle('delete-candidate', isMarked);
      const candidate = byId(button.dataset.hsId);
      const selection = controller.getSelection();
      const states = [
        button.dataset.hsId === selection.don ? '現在のDon' : '',
        button.dataset.hsId === selection.kat ? '現在のKat' : '',
        isMarked ? '削除候補として記録済み' : '',
      ].filter(Boolean);
      button.setAttribute('aria-description', states.join('。'));
    });

    if (deleteCandidateButton) {
      deleteCandidateButton.disabled = !currentId;
      deleteCandidateButton.classList.toggle('marked', marked);
      deleteCandidateButton.setAttribute('aria-pressed', marked ? 'true' : 'false');
      const number = currentCandidate?.sourceNumber || '';
      const action = marked ? '削除候補から解除' : '削除候補に追加';
      deleteCandidateButton.setAttribute('aria-label', currentId ? `${number}を${action}` : '削除候補にできる内蔵音源が未選択');
      deleteCandidateButton.title = currentId ? `${number}を${action}` : '内蔵音源を選択してください';
      deleteCandidateButton.textContent = marked ? '候補 ✓' : '候補';
    }

    if (deleteCandidateLine) {
      const numbers = candidates.map(candidate => candidate.sourceNumber);
      deleteCandidateLine.textContent = `削除候補（${numbers.length}）：${numbers.length ? numbers.join(' ') : '—'}`;
      deleteCandidateLine.title = numbers.length ? `${numbers.length}音を記録中` : '削除候補はありません';
    }
  }

  function toggleCurrentDeleteCandidate() {
    const id = currentDeleteCandidateId();
    if (!id) return;
    const remove = deleteCandidateIds.has(id);
    if (remove) deleteCandidateIds.delete(id);
    else deleteCandidateIds.add(id);
    saveDeleteCandidateIds();
    paintDeleteCandidates();
    const number = byId(id)?.sourceNumber || '';
    if (workbenchStatus) workbenchStatus.textContent = remove
      ? `${number} を削除候補から解除しました`
      : `${number} を削除候補として記録しました`;
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

    if (silentButton) {
      silentButton.classList.toggle('selected-don', activeSide === 'don' && selection.don === SILENT_ID);
      silentButton.classList.toggle('selected-kat', activeSide === 'kat' && selection.kat === SILENT_ID);
    }

    paintRecommendation();
    paintDeleteCandidates();
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
    setCustomStatus(`My Sound ${slot} に追加するWAVを選択してください`);
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
      setCustomStatus(`${record.sourceNumber} ${record.name} を追加しました`);
    } catch (error) {
      if (record) {
        customRecords.delete(id);
        await controller.unregisterCustomSource(id).catch(() => {});
      }
      setCustomStatus(error instanceof Error ? error.message : '音源を追加できませんでした。', { error: true });
      throw error;
    } finally {
      customBusy = false;
      renderCustomSlots();
      paint();
    }

    if (persistenceError) {
      setCustomStatus('音源は使用できますが保存できませんでした。次回は再追加してください。', { error: true });
    }

    try {
      await chooseSound(id, { preview: false });
    } catch (error) {
      setCustomStatus(`音源は追加しましたが選択を反映できませんでした。${error.message}`, { error: true });
    }
    window.dispatchEvent(new CustomEvent('hitsound-custom-sources-change'));
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
      setCustomStatus('画面から削除しましたが保存データを削除できませんでした。', { error: true });
    } else {
      setCustomStatus(`${record.sourceNumber} ${record.name} を削除しました`);
    }
    window.dispatchEvent(new CustomEvent('hitsound-custom-sources-change'));
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
  silentButton?.addEventListener('click', () => chooseSilent().catch(reportActionError));
  deleteCandidateButton?.addEventListener('click', toggleCurrentDeleteCandidate);

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

    const deleteButton = event.target.closest('[data-delete-custom]');
    if (deleteButton && customSlots.contains(deleteButton)) {
      const record = customRecords.get(deleteButton.dataset.deleteCustom);
      if (!record || !window.confirm(`${record.sourceNumber} ${record.name} をMy Soundから削除しますか？`)) return;
      removeCustomSound(deleteButton.dataset.deleteCustom).catch(error => {
        setCustomStatus(error.message || 'My Soundを削除できませんでした。', { error: true });
      });
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
    uploadTargetSlot = null;
    customInput.value = '';
    if (!slot) return;
    if (!file) {
      setCustomStatus('音源の追加をキャンセルしました');
      return;
    }
    setCustomStatus(`${file.name} を確認しています…`);
    addCustomSound(file, slot).catch(() => {});
  });
  customInput.addEventListener('cancel', () => {
    uploadTargetSlot = null;
    setCustomStatus('音源の追加をキャンセルしました');
  });

  window.addEventListener('hitsound-selection-change', paint);
  window.addEventListener('storage', event => {
    if (event.key !== DELETE_CANDIDATE_STORAGE_KEY) return;
    const saved = readDeleteCandidateIds();
    deleteCandidateIds.clear();
    saved.forEach(id => deleteCandidateIds.add(id));
    paintDeleteCandidates();
  });

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
