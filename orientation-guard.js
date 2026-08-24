(() => {
  'use strict';

  const guard = document.getElementById('orientationGuard');
  if (!guard) return;

  const ua = navigator.userAgent || '';
  const isIPhone = /iPhone/i.test(ua);
  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

  function applyOrientationGuard() {
    const landscape = matchMedia('(orientation: landscape)').matches;
    const blocked = (isIPhone && landscape) || (isIPad && !landscape);
    document.documentElement.classList.toggle('orientation-blocked', blocked);
    guard.hidden = !blocked;
    if (blocked) guard.textContent = isIPad ? 'iPadは横向きで使用してください' : 'iPhoneは縦向きで使用してください';
  }

  applyOrientationGuard();
  window.addEventListener('orientationchange', applyOrientationGuard, { passive: true });
  screen.orientation?.addEventListener?.('change', applyOrientationGuard);
})();