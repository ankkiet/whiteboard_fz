import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeFunctionFeatures,
  autoGenerateVariationTable,
  buildBarChartElements,
  buildBarModelElements,
  buildBase10Elements,
  buildClockElements,
  buildFractionModelElements,
  buildIntegralShadingElements,
  buildJumpNumberLineElements,
  buildNumberLineIntervalElements,
  buildPrimeFactorTreeElements,
  buildProbabilityTreeElements,
  buildSolid3DSnapshotElements,
  buildUnitCircleElements,
  buildVariationTableElements,
  buildVennDiagramElements,
  buildVerticalArithmeticElements,
  compileParametricExpression,
  computeDefiniteIntegral,
  computeGcdLcm,
  computeStatistics,
  expressionUsesParamM,
  factorizePrime,
  getExactTrigInfo,
  projectSolid3D,
  solveQuadratic,
  substituteParamM,
} from './mathEngine';
import {
  FORMULA_HANDBOOK,
  LATEX_KEYPAD_BY_GRADE,
  MATH_GRADE_MODES,
  VirtualGeometryToolsState,
  snapPointToVirtualToolEdge,
} from './mathCurriculum';
import { ShapeElement } from '../types/board';

function makeSequentialId() {
  let n = 0;
  return (prefix: string) => {
    n += 1;
    return `${prefix}_${n}`;
  };
}

describe('mathEngine — parametric graphing, calculus & analysis', () => {
  it('detects parameter m and substitutes cleanly including implicit multiplication', () => {
    assert.equal(expressionUsesParamM('x^3 - 3*m*x + 1'), true);
    assert.equal(expressionUsesParamM('x^2 + 2x - 1'), false);

    const fn = compileParametricExpression('x^3 - 3mx + 1', 2);
    assert.ok(fn);
    // At x = 1, m = 2 => 1 - 6 + 1 = -4
    assert.ok(Math.abs(fn(1) - -4) < 1e-6);
    assert.equal(substituteParamM('2m + 1', 3).includes('(3)'), true);
  });

  it('analyzes extrema, roots, and asymptotes accurately', () => {
    // f(x) = x^3 - 3x => local max at (-1, 2), local min at (1, -2)
    const cubic = analyzeFunctionFeatures('x^3 - 3*x', -4, 4, 1);
    assert.ok(cubic.extrema.some((p) => p.kind === 'max' && Math.abs(p.x - -1) < 0.15));
    assert.ok(cubic.extrema.some((p) => p.kind === 'min' && Math.abs(p.x - 1) < 0.15));
    assert.ok(cubic.roots.length >= 3);

    // f(x) = (2*x + 1) / (x - 1) => vertical asymptote at x = 1, horizontal asymptote y = 2
    const rational = analyzeFunctionFeatures('(2*x + 1) / (x - 1)', -6, 6, 1);
    assert.ok(rational.verticalAsymptotes.some((vx) => Math.abs(vx - 1) < 0.25));
    assert.ok(rational.horizontalAsymptote !== null && Math.abs(rational.horizontalAsymptote - 2) < 0.05);
  });

  it('computes definite integral, area S, and revolution volume V via Simpson rule', () => {
    // ∫_0^2 x^2 dx = 8/3 ≈ 2.6667, V = π ∫_0^2 x^4 dx = 32π/5 ≈ 20.1062
    const res = computeDefiniteIntegral('x^2', 0, 2, 1);
    assert.ok(res);
    assert.ok(Math.abs(res.signedIntegral - 8 / 3) < 1e-4);
    assert.ok(Math.abs(res.areaS - 8 / 3) < 1e-4);
    assert.ok(Math.abs(res.volumeV - (32 * Math.PI) / 5) < 1e-3);

    const shaded = buildIntegralShadingElements({
      expression: 'x^2',
      a: 0,
      b: 2,
      color: '#4f46e5',
      startZIndex: 0,
      createId: makeSequentialId(),
    });
    assert.ok(shaded && shaded.length > 10);
  });

  it('auto-generates and renders Vietnamese variation tables & number line intervals', () => {
    const data = autoGenerateVariationTable('x^3 - 3*x', 1);
    assert.ok(data);
    assert.ok(data.xValues.length >= 4);
    assert.equal(data.xValues[0], '-∞');
    assert.equal(data.xValues[data.xValues.length - 1], '+∞');

    const tableEls = buildVariationTableElements(data, { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.ok(tableEls.some((e) => e.type === 'arrow'));
    assert.ok(tableEls.every((e) => e.groupIds && e.groupIds.length === 1));

    const intervalEls = buildNumberLineIntervalElements(
      { leftBound: -2, rightBound: 5, leftClosed: true, rightClosed: false },
      { x: 0, y: 0 },
      '#1e293b',
      0,
      makeSequentialId()
    );
    assert.ok(intervalEls.length > 8);
  });
});

describe('mathEngine — primary school manipulatives (Lớp 1–5)', () => {
  it('builds Base-10 blocks, vertical arithmetic (+ − × :), bar models, fractions, clock & jump line', () => {
    const b10 = buildBase10Elements({ hundreds: 1, tens: 2, ones: 3 }, { x: 0, y: 0 }, 0, makeSequentialId());
    assert.ok(b10.some((e) => e.type === 'text' && e.text.includes('123')));

    const addEls = buildVerticalArithmeticElements(245, 138, '+', { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.ok(addEls.length > 8);

    const divEls = buildVerticalArithmeticElements(125, 4, '/', { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.ok(divEls.some((e) => e.type === 'text' && e.text === '31'));
    assert.ok(divEls.some((e) => e.type === 'text' && e.text.includes('Dư 1')));

    const barEls = buildBarModelElements(
      { labelA: 'An', partsA: 2, labelB: 'Bình', partsB: 3, summaryLabel: 'Tổng = 45' },
      { x: 0, y: 0 },
      '#1e293b',
      0,
      makeSequentialId()
    );
    assert.ok(barEls.filter((e) => e.type === 'rectangle').length === 5);

    const fracBar = buildFractionModelElements(3, 5, 'bar', { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.equal(fracBar.filter((e) => e.type === 'rectangle').length, 5);

    const fracCircle = buildFractionModelElements(2, 6, 'circle', { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.ok(fracCircle.some((e) => e.type === 'ellipse' && e.sectorStartAngle !== undefined && e.sectorEndAngle !== undefined));
    assert.equal(fracCircle.filter((e) => e.type === 'line').length, 6);

    const clock = buildClockElements(9, 15, { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.ok(clock.some((e) => e.type === 'text' && e.text === '09:15'));

    const jumpLine = buildJumpNumberLineElements(3, 4, { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.ok(jumpLine.some((e) => e.type === 'stroke'));
  });
});

describe('mathEngine — algebra, trig, stats & probability (Lớp 6–12)', () => {
  it('factorizes primes, computes GCD/LCM, solves quadratics, and returns exact trig values', () => {
    assert.deepEqual(factorizePrime(360), [2, 2, 2, 3, 3, 5]);
    assert.deepEqual(computeGcdLcm(24, 36), { gcd: 12, lcm: 72 });

    const q = solveQuadratic(1, -5, 6);
    assert.equal(q.delta, 1);
    assert.deepEqual(q.roots, [2, 3]);

    const tree = buildPrimeFactorTreeElements(60, { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.ok(tree.some((e) => e.type === 'formula' && e.latex === '60 = 2^{2} \\cdot 3 \\cdot 5'));

    const trig45 = getExactTrigInfo(45);
    assert.equal(trig45.radLabel, 'π/4');
    assert.equal(trig45.cosLabel, '√2/2');
    assert.equal(trig45.sinLabel, '√2/2');

    const circle = buildUnitCircleElements(60, { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.ok(circle.length >= 10);
  });

  it('computes descriptive statistics and builds bar charts, Venn & probability trees', () => {
    const stats = computeStatistics([4, 6, 6, 8, 10, 12]);
    assert.ok(stats);
    assert.equal(stats.count, 6);
    assert.ok(Math.abs(stats.mean - 46 / 6) < 1e-6);
    assert.equal(stats.median, 7);
    assert.equal(stats.q1, 6);
    assert.equal(stats.q3, 10);
    assert.equal(stats.iqr, 4);
    assert.equal(stats.range, 8);
    assert.deepEqual(stats.mode, [6]);

    const bars = buildBarChartElements(
      [
        { label: 'T1', value: 12 },
        { label: 'T2', value: 18 },
      ],
      { x: 0, y: 0 },
      '#1e293b',
      0,
      makeSequentialId()
    );
    assert.equal(bars.filter((e) => e.type === 'rectangle').length, 2);

    const venn = buildVennDiagramElements('Toán', 'Lý', { x: 0, y: 0 }, 0, makeSequentialId());
    assert.equal(venn.filter((e) => e.type === 'ellipse').length, 2);

    const probTree = buildProbabilityTreeElements(0.4, 0.8, 0.3, { x: 0, y: 0 }, '#1e293b', 0, makeSequentialId());
    assert.ok(probTree.some((e) => e.type === 'text' && e.text.includes('0.320')));
  });
});

describe('mathEngine — 3D projection, hidden-line dashed rendering & edge snapping', () => {
  it('projects a 3D cube and square pyramid with both visible solid and hidden dashed edges', () => {
    const cube = projectSolid3D('cube', 0.58, 0.38, 100);
    assert.equal(cube.edges.length, 12);
    assert.ok(cube.edges.some((e) => e.dashed === true), 'Cube must have hidden dashed edges');
    assert.ok(cube.edges.some((e) => e.dashed === false), 'Cube must have visible solid edges');

    const snapshot = buildSolid3DSnapshotElements({
      solidType: 'square-pyramid',
      yaw: 0.55,
      pitch: 0.35,
      center: { x: 100, y: 100 },
      color: '#1e293b',
      startZIndex: 0,
      createId: makeSequentialId(),
    });
    const lineEls = snapshot.filter((e): e is ShapeElement => e.type === 'line');
    assert.equal(lineEls.length, 8);
    assert.ok(lineEls.some((l) => l.dashed === true));
    assert.ok(lineEls.some((l) => l.dashed === false));
    assert.ok(snapshot.every((e) => e.groupIds && e.groupIds.length === 1));

    // Unfolding net for cube produces 6 face squares (24 edges)
    const unfolded = projectSolid3D('cube', 0.5, 0.3, 100, 1);
    assert.equal(unfolded.edges.length, 24);

    // Oxyz coordinate point projection
    const oxyz = projectSolid3D('oxyz', 0.55, 0.35, 100, 0, { x: 2, y: 3, z: 2 });
    assert.ok(oxyz.labels.some((l) => l.text === 'A(2; 3; 2)'));
  });

  it('snaps pen points straight onto active virtual ruler & set square edges', () => {
    const tools: VirtualGeometryToolsState = {
      ruler: { active: true, x: 100, y: 200, angle: 0, length: 400, height: 56 },
      setSquare: { active: false, x: 0, y: 0, angle: 0, legA: 240, legB: 180 },
      protractor: { active: false, x: 0, y: 0, angle: 0, radius: 130, measureDeg: 60 },
      compass: { active: false, cx: 0, cy: 0, radius: 110, angle: 0 },
    };

    const nearTop = snapPointToVirtualToolEdge({ x: 250, y: 193 }, tools, 16);
    assert.equal(nearTop.snapped, true);
    assert.ok(Math.abs(nearTop.point.y - 200) < 1e-6);
    assert.ok(Math.abs(nearTop.point.x - 250) < 1e-6);

    const farAway = snapPointToVirtualToolEdge({ x: 250, y: 120 }, tools, 16);
    assert.equal(farAway.snapped, false);
  });

  it('provides complete curriculum presets for all 3 grade modes', () => {
    assert.equal(MATH_GRADE_MODES.length, 3);
    assert.ok(LATEX_KEYPAD_BY_GRADE.primary.length >= 12);
    assert.ok(LATEX_KEYPAD_BY_GRADE.middle.length >= 14);
    assert.ok(LATEX_KEYPAD_BY_GRADE.high.length >= 16);
    assert.ok(FORMULA_HANDBOOK.filter((f) => f.grade === 'primary').length >= 5);
    assert.ok(FORMULA_HANDBOOK.filter((f) => f.grade === 'middle').length >= 5);
    assert.ok(FORMULA_HANDBOOK.filter((f) => f.grade === 'high').length >= 5);
  });
});
