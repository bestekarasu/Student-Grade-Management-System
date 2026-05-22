import assert from 'node:assert/strict';
import test from 'node:test';
import { computeWeightedGrade, toLetterGrade, validateScore } from '../src/grades.js';

test('computes weighted grades from completed assessments', () => {
  const grade = computeWeightedGrade([
    { score: 90, max_score: 100, weight: 40 },
    { score: 70, max_score: 100, weight: 60 }
  ]);

  assert.equal(grade.currentAverage, 78);
  assert.equal(grade.finalAverage, 78);
  assert.equal(grade.completion, 100);
  assert.equal(grade.letterGrade, 'CB');
});

test('separates current average from final projection when work is missing', () => {
  const grade = computeWeightedGrade([
    { score: 95, max_score: 100, weight: 50 },
    { score: null, max_score: 100, weight: 50 }
  ]);

  assert.equal(grade.currentAverage, 95);
  assert.equal(grade.finalAverage, 47.5);
  assert.equal(grade.completion, 50);
});

test('maps scores to letter grades', () => {
  assert.equal(toLetterGrade(91), 'AA');
  assert.equal(toLetterGrade(82), 'BB');
  assert.equal(toLetterGrade(59), 'FD');
  assert.equal(toLetterGrade(30), 'FF');
});

test('rejects invalid grade input', () => {
  assert.equal(validateScore(85, 100).ok, true);
  assert.equal(validateScore(110, 100).ok, false);
  assert.equal(validateScore(-5, 100).ok, false);
});
