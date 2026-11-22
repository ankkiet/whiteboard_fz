import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStraightStrokePoints,
  clampEraserSize,
  clampStrokeWidth,
  computeBrushRadiusWorld,
  magneticSnapLineEnd,
  stepEraserSize,
  stepStrokeWidth,
} from './drawingUtils';

test('clampStrokeWidth and clampEraserSize enforce safe bounds', () => {
  assert.equal(clampStrokeWidth(0), 1);
  assert.equal(clampStrokeWidth(4.6), 5);
  assert.equal(clampStrokeWidth(99), 20);
  assert.equal(clampStrokeWidth(Number.NaN), 4);

  assert.equal(clampEraserSize(2), 10);
  assert.equal(clampEraserSize(36.2), 36);
  assert.equal(clampEraserSize(150), 96);
  assert.equal(clampEraserSize(Number.POSITIVE_INFINITY), 24);
});

test('stepStrokeWidth and stepEraserSize adjust sizes cleanly for keyboard shortcuts', () => {
  assert.equal(stepStrokeWidth(4, 1), 5);
  assert.equal(stepStrokeWidth(4, -1), 3);
  assert.equal(stepStrokeWidth(1, -1), 1);
  assert.equal(stepStrokeWidth(10, 1), 12);
  assert.equal(stepStrokeWidth(20, 1), 20);

  assert.equal(stepEraserSize(24, 1), 30);
  assert.equal(stepEraserSize(24, -1), 18);
  assert.equal(stepEraserSize(10, -1), 10);
});

test('computeBrushRadiusWorld matches freehand pen and highlighter sizing', () => {
  assert.equal(computeBrushRadiusWorld(4, false), (4 * 1.45) / 2);
  assert.equal(computeBrushRadiusWorld(1, false), 2.5 / 2);
  assert.equal(computeBrushRadiusWorld(4, true), 16 / 2);
  assert.equal(computeBrushRadiusWorld(8, true), (8 * 3.5) / 2);
});

test('magneticSnapLineEnd snaps near cardinal and 45-degree angles while allowing free diagonals', () => {
  // Nearly horizontal (within 2 degrees) -> snaps to exact 0 degrees
  const horiz = magneticSnapLineEnd({ x: 0, y: 0 }, { x: 100, y: 2 });
  assert.equal(horiz.snappedAngleDeg, 0);
  assert.ok(Math.abs(horiz.point.y) < 1e-6);
  assert.ok(Math.abs(horiz.point.x - Math.hypot(100, 2)) < 1e-6);

  // Nearly vertical -> snaps to 90 degrees
  const vert = magneticSnapLineEnd({ x: 10, y: 20 }, { x: 12, y: 120 });
  assert.equal(vert.snappedAngleDeg, 90);
  assert.ok(Math.abs(vert.point.x - 10) < 1e-6);

  // Clearly off-axis (22 degrees) -> stays free
  const free = magneticSnapLineEnd({ x: 0, y: 0 }, { x: 100, y: 40 });
  assert.equal(free.snappedAngleDeg, null);
  assert.deepEqual(free.point, { x: 100, y: 40 });
});

test('buildStraightStrokePoints interpolates uniform points from start to end', () => {
  const pts = buildStraightStrokePoints([0, 0, 0.8], [60, 0, 0.2], 10);
  assert.equal(pts.length, 7);
  assert.deepEqual(pts[0], [0, 0, 0.5]);
  assert.deepEqual(pts[3], [30, 0, 0.5]);
  assert.deepEqual(pts[6], [60, 0, 0.5]);

  const tiny = buildStraightStrokePoints([5, 5, 0.5], [5.1, 5.1, 0.5], 6);
  assert.equal(tiny.length, 1);
  assert.deepEqual(tiny[0], [5, 5, 0.5]);
});
