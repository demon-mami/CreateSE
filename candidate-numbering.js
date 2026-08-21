(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  if (!CANDIDATES.length) return;

  const ordered = [...CANDIDATES].sort((a, b) =>
    Number(a.sourceNumber ?? Number.POSITIVE_INFINITY) - Number(b.sourceNumber ?? Number.POSITIVE_INFINITY) ||
    (a.globalRank ?? Number.POSITIVE_INFINITY) - (b.globalRank ?? Number.POSITIVE_INFINITY) ||
    String(a.id).localeCompare(String(b.id))
  );

  ordered.forEach((candidate, index) => {
    if (!candidate.originalName) candidate.originalName = String(candidate.name || '');
    if (!candidate.originalFamily) candidate.originalFamily = candidate.family || 'Other';

    candidate.sourceNumber = String(candidate.sourceNumber || index + 1).padStart(3, '0');
    candidate.name = candidate.originalName;
    candidate.excluded = false;
  });

  window.HITSOUND_NUMBERED_CANDIDATES = ordered;
})();
