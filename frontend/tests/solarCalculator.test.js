import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateArrayCapacityKw,
  calculatePanelCount,
  isValidPanelCount,
} from '../src/solarCalculator.js';

test('rounds up when target size is not an exact multiple of panel wattage', () => {
  assert.equal(calculatePanelCount(1, 550), 2);
  assert.equal(calculateArrayCapacityKw(2, 550), 1.1);
});

test('keeps exact target sizing when panel wattage divides evenly', () => {
  assert.equal(calculatePanelCount(2.2, 550), 4);
  assert.equal(calculateArrayCapacityKw(4, 550), 2.2);
});

test('accepts panel-count boundaries and rejects invalid edits', () => {
  for (const valid of [1, 2, 100]) assert.equal(isValidPanelCount(valid), true);
  for (const invalid of [0, -1, 1.5, 101, NaN, Infinity]) {
    assert.equal(isValidPanelCount(invalid), false);
  }
});

test('rejects invalid targets, panel ratings, and oversized estimates', () => {
  for (const target of [0, -1, NaN, Infinity]) {
    assert.throws(() => calculatePanelCount(target, 550), RangeError);
  }
  for (const watts of [0, -400, NaN, Infinity]) {
    assert.throws(() => calculatePanelCount(1, watts), RangeError);
  }
  assert.throws(() => calculatePanelCount(100, 400), RangeError);
  assert.throws(() => calculateArrayCapacityKw(101, 550), RangeError);
});
