(() => {
  'use strict';
  const originalFetch = window.fetch.bind(window);
  const VIEWER_BASE = 'https://demon-mami.github.io/osutaiko-mami-viewer/';
  window.fetch = (input, init) => {
    const raw = typeof input === 'string' ? input : input?.url;
    if (typeof raw === 'string' && /^\.\/hitsounds\//i.test(raw)) {
      return originalFetch(VIEWER_BASE + raw.replace(/^\.\//, ''), init);
    }
    return originalFetch(input, init);
  };
})();
