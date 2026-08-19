(() => {
  'use strict';

  const Context = window.AudioContext || window.webkitAudioContext;
  const noopBridge = { setPreviewActive() {} };
  if (!Context?.prototype?.createGain) {
    window.HitsoundDuckingBridge = noopBridge;
    return;
  }

  const originalCreateGain = Context.prototype.createGain;
  const gainsByContext = new WeakMap();
  const DUCK_FACTOR = 0.28;
  const ATTACK_SEC = 0.026;
  const RELEASE_SEC = 0.18;
  let target = null;
  let previewActive = false;

  function ramp(param, value, duration, context) {
    if (!param || !context) return;
    const now = context.currentTime;
    try {
      if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
      else {
        const current = param.value;
        param.cancelScheduledValues(now);
        param.setValueAtTime(current, now);
      }
      param.linearRampToValueAtTime(value, now + duration);
    } catch {
      param.value = value;
    }
  }

  function applyState(immediate = false) {
    if (!target) return;
    const factor = previewActive ? DUCK_FACTOR : 1;
    const duration = immediate ? 0.001 : (previewActive ? ATTACK_SEC : RELEASE_SEC);
    ramp(target.music.gain, target.baseMusic * factor, duration, target.context);
    ramp(target.effect.gain, target.baseEffect * factor, duration, target.context);
  }

  Context.prototype.createGain = function (...args) {
    const node = originalCreateGain.apply(this, args);
    let gains = gainsByContext.get(this);
    if (!gains) {
      gains = [];
      gainsByContext.set(this, gains);
    }
    gains.push(node);

    // The frozen Viewer creates music, effect and master gains in this order.
    // Capture only the first playback graph and leave every later GainNode untouched.
    if (!target && gains.length === 3) {
      target = {
        context: this,
        music: gains[0],
        effect: gains[1],
        baseMusic: 0.60,
        baseEffect: 1.00,
      };
      queueMicrotask(() => {
        if (!target) return;
        target.baseMusic = Number.isFinite(target.music.gain.value) ? target.music.gain.value : 0.60;
        target.baseEffect = Number.isFinite(target.effect.gain.value) ? target.effect.gain.value : 1.00;
        applyState(true);
      });
    }
    return node;
  };

  window.HitsoundDuckingBridge = {
    setPreviewActive(active) {
      const next = !!active;
      if (previewActive === next) return;
      previewActive = next;
      applyState(false);
    },
  };
})();
