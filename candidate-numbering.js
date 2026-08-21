(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  if (!CANDIDATES.length) return;

  const ordered = [...CANDIDATES].sort((a, b) =>
    Number(a.sourceNumber ?? Number.POSITIVE_INFINITY) - Number(b.sourceNumber ?? Number.POSITIVE_INFINITY) ||
    (a.pitch ?? Number.POSITIVE_INFINITY) - (b.pitch ?? Number.POSITIVE_INFINITY) ||
    String(a.id).localeCompare(String(b.id))
  );

  ordered.forEach(candidate => {
    if (!candidate.originalName) candidate.originalName = String(candidate.name || '');
    if (!candidate.originalFamily) candidate.originalFamily = candidate.family || 'Other';
    candidate.sourceNumber = String(candidate.sourceNumber || '');
    candidate.name = `${candidate.sourceNumber}.wav`;
    candidate.excluded = false;
  });

  window.HITSOUND_NUMBERED_CANDIDATES = ordered;
})();
