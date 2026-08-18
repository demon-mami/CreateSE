(() => {
  'use strict';

  const CANDIDATES = Array.isArray(window.HITSOUND_CANDIDATES) ? window.HITSOUND_CANDIDATES : [];
  if (!CANDIDATES.length) return;

  // Human-facing numbering is now a compact two-digit pitch rank.
  // Internal candidate IDs / ZIP entry names stay unchanged so existing assets and
  // stored favorites remain compatible.
  const ordered = [...CANDIDATES].sort((a, b) =>
    (a.pitch ?? Number.POSITIVE_INFINITY) - (b.pitch ?? Number.POSITIVE_INFINITY) ||
    (a.globalRank ?? Number.POSITIVE_INFINITY) - (b.globalRank ?? Number.POSITIVE_INFINITY) ||
    String(a.id).localeCompare(String(b.id))
  );

  ordered.forEach((candidate, index) => {
    if (!candidate.originalName) candidate.originalName = String(candidate.name || '');
    if (!candidate.originalFamily) candidate.originalFamily = candidate.family || 'Other';

    candidate.sourceNumber = String(10 + index); // 52 candidates -> 10..61
    candidate.name = `${candidate.sourceNumber}.wav`;
  });

  window.HITSOUND_NUMBERED_CANDIDATES = ordered;
})();
