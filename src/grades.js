export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function toLetterGrade(score) {
  const value = toNumber(score);
  if (value >= 90) return 'AA';
  if (value >= 85) return 'BA';
  if (value >= 80) return 'BB';
  if (value >= 75) return 'CB';
  if (value >= 70) return 'CC';
  if (value >= 65) return 'DC';
  if (value >= 60) return 'DD';
  if (value >= 50) return 'FD';
  return 'FF';
}

export function computeWeightedGrade(items) {
  const totalWeight = items.reduce((sum, item) => sum + toNumber(item.weight), 0);
  const gradedItems = items.filter((item) => item.score !== null && item.score !== undefined && item.score !== '');
  const gradedWeight = gradedItems.reduce((sum, item) => sum + toNumber(item.weight), 0);

  const earned = gradedItems.reduce((sum, item) => {
    const maxScore = Math.max(toNumber(item.max_score, 100), 0.01);
    const percent = Math.max(0, Math.min(100, (toNumber(item.score) / maxScore) * 100));
    return sum + percent * toNumber(item.weight);
  }, 0);

  const currentAverage = gradedWeight > 0 ? earned / gradedWeight : 0;
  const finalAverage = totalWeight > 0 ? earned / totalWeight : 0;
  const completion = totalWeight > 0 ? (gradedWeight / totalWeight) * 100 : 0;

  return {
    currentAverage: round(currentAverage),
    finalAverage: round(finalAverage),
    completion: round(completion),
    totalWeight: round(totalWeight),
    gradedWeight: round(gradedWeight),
    letterGrade: toLetterGrade(currentAverage)
  };
}

export function validateScore(value, maxScore = 100) {
  const text = String(value ?? '').trim();
  if (!text) return { ok: true, empty: true };

  const score = Number(text);
  const max = toNumber(maxScore, 100);
  if (!Number.isFinite(score) || score < 0 || score > max) {
    return { ok: false, message: `Score must be between 0 and ${round(max)}.` };
  }

  return { ok: true, empty: false, score };
}

export function round(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}
