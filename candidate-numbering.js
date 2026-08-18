(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  if (!CANDIDATES.length) return;

  const sourceNumber = candidate => {
    const match = String(candidate?.id || '').match(/(\d+)$/);
    return match ? match[1].padStart(3, '0') : '000';
  };

  // Stable source numbering only. Favorite state is intentionally not reflected
  // through select text colors or option decorations.
  for (const candidate of CANDIDATES) {
    if (!candidate.originalName) candidate.originalName = candidate.name;
    candidate.sourceNumber = sourceNumber(candidate);
    const prefix = `${candidate.sourceNumber}_`;
    if (!String(candidate.name).startsWith(prefix)) {
      candidate.name = `${prefix}${candidate.originalName}`;
    }
  }
})();
