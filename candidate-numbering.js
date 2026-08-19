(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  if (!CANDIDATES.length) return;

  const EXCLUDED_SOURCE_NUMBERS = new Set(['23', '31']);
  const ordered = [...CANDIDATES].sort((a, b) =>
    (a.pitch ?? Number.POSITIVE_INFINITY) - (b.pitch ?? Number.POSITIVE_INFINITY) ||
    (a.globalRank ?? Number.POSITIVE_INFINITY) - (b.globalRank ?? Number.POSITIVE_INFINITY) ||
    String(a.id).localeCompare(String(b.id))
  );

  ordered.forEach((candidate, index) => {
    if (!candidate.originalName) candidate.originalName = String(candidate.name || '');
    if (!candidate.originalFamily) candidate.originalFamily = candidate.family || 'Other';

    candidate.sourceNumber = String(10 + index); // stable pitch-order numbering: 10..61
    candidate.name = `${candidate.sourceNumber}.wav`;
    candidate.excluded = EXCLUDED_SOURCE_NUMBERS.has(candidate.sourceNumber);
  });

  window.HITSOUND_NUMBERED_CANDIDATES = ordered.filter(candidate => !candidate.excluded);
})();
