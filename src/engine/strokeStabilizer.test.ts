import test from 'node:test';
import assert from 'node:assert/strict';
import { PEN_STABILIZER_CONFIG, StrokeStabilizer } from './strokeStabilizer';

test('StrokeStabilizer preserves initial point and reduces slow hand jitter', () => {
  const stabilizer = new StrokeStabilizer(PEN_STABILIZER_CONFIG);
  const first = stabilizer.process({
    x: 100,
    y: 100,
    pressure: 0.5,
    pointerType: 'mouse',
    timestampMs: 1000,
    zoom: 1,
  });
  assert.equal(first[0], 100);
  assert.equal(first[1], 100);

  // Small alternating jitter at slow speed should be dampened relative to raw amplitude
  const outA = stabilizer.process({
    x: 101,
    y: 104,
    pressure: 0.5,
    pointerType: 'mouse',
    timestampMs: 1016,
    zoom: 1,
  });
  const outB = stabilizer.process({
    x: 102,
    y: 96,
    pressure: 0.5,
    pointerType: 'mouse',
    timestampMs: 1032,
    zoom: 1,
  });

  assert.ok(Math.abs(outA[1] - 100) < 4, 'slow jitter peak should be attenuated');
  assert.ok(Math.abs(outB[1] - 100) < 4, 'oscillating jitter should stay dampened');
});

test('StrokeStabilizer tracks fast movement with minimal lag and lowers simulated pressure', () => {
  const stabilizer = new StrokeStabilizer(PEN_STABILIZER_CONFIG);
  stabilizer.process({
    x: 0,
    y: 0,
    pressure: 0.5,
    pointerType: 'mouse',
    timestampMs: 1000,
    zoom: 1,
  });

  let lastPoint: [number, number, number] = [0, 0, 0.5];
  for (let i = 1; i <= 10; i++) {
    lastPoint = stabilizer.process({
      x: i * 35,
      y: 0,
      pressure: 0.5,
      pointerType: 'mouse',
      timestampMs: 1000 + i * 16,
      zoom: 1,
    });
  }

  assert.ok(350 - lastPoint[0] < 15, `fast stroke should stay close to target, got ${lastPoint[0]}`);
  assert.ok(lastPoint[2] < 0.5, `fast mouse stroke should thin out, got pressure=${lastPoint[2]}`);
});

test('StrokeStabilizer smooths real stylus pressure and preserves bypassSpatial for ruler snapping', () => {
  const stabilizer = new StrokeStabilizer({
    ...PEN_STABILIZER_CONFIG,
    bypassSpatial: true,
  });

  const p0 = stabilizer.process({
    x: 10,
    y: 20,
    pressure: 0.8,
    pointerType: 'pen',
    timestampMs: 100,
    zoom: 1,
  });
  assert.equal(p0[0], 10);
  assert.equal(p0[1], 20);
  assert.ok(p0[2] > 0.8 && p0[2] < 0.95);

  const p1 = stabilizer.process({
    x: 42,
    y: 20,
    pressure: 0.05,
    pointerType: 'pen',
    timestampMs: 116,
    zoom: 1,
  });
  // Exact spatial coordinates preserved when bypassSpatial is true
  assert.equal(p1[0], 42);
  assert.equal(p1[1], 20);
  // Light touch (0.05) maps gracefully without collapsing near zero
  assert.ok(p1[2] > 0.45 && p1[2] < 0.75);
});
