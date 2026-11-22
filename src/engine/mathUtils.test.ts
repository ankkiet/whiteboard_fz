import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATH_GEOMETRY_PRESETS,
  MATH_UNIT_PX,
  buildGeometryPresetElements,
  buildGraphPlotElements,
  compileMathExpression,
  evaluateMathExpression,
  normalizeMathInput,
  sampleFunctionSegments,
} from './mathUtils';

function makeSequentialId() {
  let n = 0;
  return (prefix: string) => {
    n += 1;
    return `${prefix}_${n}`;
  };
}

describe('mathUtils — expression parsing and evaluation', () => {
  it('normalizes friendly Unicode math input and leading y=/f(x)= prefixes', () => {
    assert.equal(normalizeMathInput('y = 2x² - 3×x + √x'), '2x^2 - 3*x + sqrt(x)');
    assert.equal(normalizeMathInput('f(x) = π ÷ 2'), 'pi / 2');
    assert.equal(normalizeMathInput('x³ − 1,5'), 'x^3 - 1.5');
  });

  it('evaluates arithmetic precedence, unary minus, and implicit multiplication', () => {
    assert.equal(evaluateMathExpression('2 + 3 * 4', 0), 14);
    assert.equal(evaluateMathExpression('(2 + 3) * 4', 0), 20);
    assert.equal(evaluateMathExpression('-x^2', 3), -9);
    assert.equal(evaluateMathExpression('(-x)^2', 3), 9);
    assert.equal(evaluateMathExpression('2x + 1', 5), 11);
    assert.equal(evaluateMathExpression('2(x + 3)', 4), 14);
    assert.equal(evaluateMathExpression('2^3^2', 0), 512);
  });

  it('evaluates mathematical functions and constants accurately', () => {
    const sinPiHalf = evaluateMathExpression('sin(pi / 2)', 0);
    assert.ok(sinPiHalf !== null && Math.abs(sinPiHalf - 1) < 1e-9);

    const sqrtVal = evaluateMathExpression('sqrt(16) + abs(-3)', 0);
    assert.equal(sqrtVal, 7);

    const logVal = evaluateMathExpression('log(100) + ln(e)', 0);
    assert.ok(logVal !== null && Math.abs(logVal - 3) < 1e-9);

    const implicitFn = evaluateMathExpression('2sin(x)', Math.PI / 2);
    assert.ok(implicitFn !== null && Math.abs(implicitFn - 2) < 1e-9);
  });

  it('rejects invalid syntax and unknown identifiers safely without throwing', () => {
    assert.equal(compileMathExpression(''), null);
    assert.equal(compileMathExpression('2 + * 3'), null);
    assert.equal(compileMathExpression('(x + 1'), null);
    assert.equal(compileMathExpression('alert(1)'), null);
    assert.equal(compileMathExpression('window.location'), null);
    assert.equal(evaluateMathExpression('1 / 0', 0), null);
  });
});

describe('mathUtils — function curve sampling and graph elements', () => {
  it('samples a continuous parabola into a single segment with canvas-flipped Y coordinates', () => {
    const segs = sampleFunctionSegments('x^2', {
      xMin: -2,
      xMax: 2,
      steps: 40,
      unitPx: MATH_UNIT_PX,
    });
    assert.ok(segs && segs.length === 1);
    const pts = segs[0];
    // At x = -2, y = 4 -> worldX = -80, worldY = -160
    assert.ok(Math.abs(pts[0][0] - -2 * MATH_UNIT_PX) < 1e-6);
    assert.ok(Math.abs(pts[0][1] - -4 * MATH_UNIT_PX) < 1e-6);
  });

  it('splits vertical asymptotes cleanly for y = 1/x', () => {
    const segs = sampleFunctionSegments('1/x', {
      xMin: -4,
      xMax: 4,
      yClamp: 10,
      steps: 200,
    });
    assert.ok(segs && segs.length === 2, `Expected 2 branches for 1/x, got ${segs?.length}`);
  });

  it('handles restricted domain for y = sqrt(x) over [-4, 4]', () => {
    const segs = sampleFunctionSegments('sqrt(x)', {
      xMin: -4,
      xMax: 4,
      steps: 160,
    });
    assert.ok(segs && segs.length === 1);
    // All sampled world X coordinates must be >= 0
    for (const pt of segs[0]) {
      assert.ok(pt[0] >= -1e-6);
    }
  });

  it('builds grouped native whiteboard elements (strokes + label) for a graph plot', () => {
    const createId = makeSequentialId();
    const els = buildGraphPlotElements({
      expression: '0.25*x^2 - 2',
      color: '#4f46e5',
      xMin: -6,
      xMax: 6,
      startZIndex: 10,
      createId,
    });
    assert.ok(els && els.length >= 2);
    const groupId = els[0].groupIds?.[0];
    assert.ok(groupId, 'Plot elements should share a groupId');
    for (const el of els) {
      assert.deepEqual(el.groupIds, [groupId]);
      assert.ok((el.zIndex || 0) > 10);
    }
    const label = els[els.length - 1];
    assert.equal(label.type, 'formula');
    if (label.type === 'formula') {
      assert.equal(label.latex, 'y = 0.25x^{2} - 2');
    }
  });
});

describe('mathUtils — geometry presets', () => {
  it('builds valid pre-grouped elements for every geometry preset', () => {
    const createId = makeSequentialId();
    for (const preset of MATH_GEOMETRY_PRESETS) {
      const els = buildGeometryPresetElements(
        preset.id,
        { x: 100, y: 200 },
        '#1e293b',
        5,
        createId
      );
      assert.ok(els.length >= 4, `Preset ${preset.id} should create multiple elements`);
      const sharedGroup = els[0].groupIds?.[0];
      assert.ok(sharedGroup, `Preset ${preset.id} should be grouped`);
      for (const el of els) {
        assert.deepEqual(el.groupIds, [sharedGroup]);
        assert.ok(Number.isFinite(el.x) && Number.isFinite(el.y));
        assert.ok(Number.isFinite(el.width) && Number.isFinite(el.height));
      }
    }
  });
});
