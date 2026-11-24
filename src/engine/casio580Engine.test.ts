import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  casioExprToNaturalLatex,
  computeCasioDistribution,
  computeCasioLinReg,
  computeCasioStats1Var,
  computeMatrixDet,
  computeMatrixInverse,
  computeVectorMetrics,
  evaluateCasioBaseN,
  evaluateCasioComplex,
  evaluateCasioExpression,
  evaluateCasioVerify,
  factorizeIntegerLatex,
  formatCasioExact,
  parseCasioCoeff,
  solveCasioCubicFull,
  solveCasioEquation,
  solveCasioEquationAllRoots,
  solveCasioLinearSystemFull,
  solveCasioQuadraticFull,
  solveCasioQuarticFull,
  solveCasioRatio,
  solveCubicEquation,
  solveCubicInequality,
  solveLinearSystem2x2,
  solveLinearSystem3x3,
  solveLinearSystem4x4,
  solveQuadraticInequality,
  solveQuarticEquation,
  subtractMatrices,
  toDmsText,
  toEngLatex,
  transposeMatrix,
} from './casio580Engine';

import {
  findEnclosingCasio2dTemplate,
  flattenCasio2dSlots,
  getNavigableCasio2dSlots,
  parseCasio2dNodes,
} from './casio2dParser';

describe('casio580Engine — Natural-V.P.A.M., S⇔D & Real-Life fx-580VN X', () => {
  it('converts decimals, mixed fractions, DMS, ENG, and trig surds cleanly', () => {
    const f1 = formatCasioExact(2.5);
    assert.equal(f1.exactLatex, '\\frac{5}{2}');
    assert.equal(f1.mixedLatex, '2\\frac{1}{2}');
    assert.equal(f1.hasExactForm, true);

    const f2 = formatCasioExact(1 / 3);
    assert.equal(f2.exactLatex, '\\frac{1}{3}');

    const s2 = formatCasioExact(Math.SQRT2 / 2);
    assert.equal(s2.exactLatex, '\\frac{\\sqrt{2}}{2}');

    assert.equal(toDmsText(30.25), `30°15'0"`);
    assert.equal(toEngLatex(12345), '12.345 \\times 10^{3}');
    assert.equal(factorizeIntegerLatex(360), '2^{3} \\cdot 3^{2} \\cdot 5');
  });

  it('evaluates degree/radian trig, variables, recurring decimals, DMS literals, and discrete ops', () => {
    const r1 = evaluateCasioExpression('sin(30) + sqrt(16)', { angleUnit: 'D' });
    assert.ok(r1);
    assert.equal(r1.numeric, 4.5);
    assert.equal(r1.exactLatex, '\\frac{9}{2}');

    const r2 = evaluateCasioExpression('sin(45)', { angleUnit: 'D' });
    assert.ok(r2);
    assert.equal(r2.exactLatex, '\\frac{\\sqrt{2}}{2}');

    const r3 = evaluateCasioExpression('asin(0.5)', { angleUnit: 'D' });
    assert.ok(r3 && Math.abs(r3.numeric - 30) < 1e-6);

    const r4 = evaluateCasioExpression('5C2 + 4! + cbrt(27)', { angleUnit: 'D' });
    assert.ok(r4 && r4.numeric === 37);

    const r5 = evaluateCasioExpression('Ans * 2 + A', { angleUnit: 'D', ans: 3.5, vars: { A: 5 } });
    assert.ok(r5 && r5.numeric === 12);

    const rec = evaluateCasioExpression('0.(3) + 0.(6)', { angleUnit: 'D' });
    assert.ok(rec && Math.abs(rec.numeric - 1) < 1e-8);

    const dms = evaluateCasioExpression(`30°30'0"`, { angleUnit: 'D' });
    assert.ok(dms && Math.abs(dms.numeric - 30.5) < 1e-8);

    const gcdLcm = evaluateCasioExpression('GCD(12; 18) + LCM(4; 6)', { angleUnit: 'D' });
    assert.ok(gcdLcm && gcdLcm.numeric === 18);

    const divR = evaluateCasioExpression('17 ÷R 5', { angleUnit: 'D' });
    assert.ok(divR?.specialSummaryLatex?.includes('Q = 3'));
    assert.ok(divR?.specialSummaryLatex?.includes('R = 2'));

    const pol = evaluateCasioExpression('Pol(3; 4)', { angleUnit: 'D' });
    assert.ok(pol?.secondaryVars?.r === 5);
  });

  it('evaluates definite integrals (3-arg and 4-arg), 2D frac/mixfrac/pow, derivatives, Sigma/Pi sums, limits, log_a(b), nroot, and SOLVE', () => {
    const integ = evaluateCasioExpression('int(x^2; 0; 3)', { angleUnit: 'D' });
    assert.ok(integ && Math.abs(integ.numeric - 9) < 1e-4);

    const integ2d = evaluateCasioExpression('int(pow(x;2);0;3;x)', { angleUnit: 'D' });
    assert.ok(integ2d && Math.abs(integ2d.numeric - 9) < 1e-4);

    const integCustomVar = evaluateCasioExpression('int(pow(t;2);0;3;t)', { angleUnit: 'D' });
    assert.ok(integCustomVar && Math.abs(integCustomVar.numeric - 9) < 1e-4);

    const frac2d = evaluateCasioExpression('frac(3;4) + mixfrac(1;1;4)', { angleUnit: 'D' });
    assert.ok(frac2d && Math.abs(frac2d.numeric - 2) < 1e-8);

    const deriv = evaluateCasioExpression('ddx(pow(x;3); 2)', { angleUnit: 'D' });
    assert.ok(deriv && Math.abs(deriv.numeric - 12) < 1e-5);

    const sigma = evaluateCasioExpression('sum(x; 1; 10)', { angleUnit: 'D' });
    assert.ok(sigma && sigma.numeric === 55);

    const prod = evaluateCasioExpression('prod(x; 1; 5)', { angleUnit: 'D' });
    assert.ok(prod && prod.numeric === 120);

    const lim = evaluateCasioExpression('lim((x^2 - 1)/(x - 1); 1)', { angleUnit: 'D' });
    assert.ok(lim && Math.abs(lim.numeric - 2) < 1e-3);

    const logb = evaluateCasioExpression('logb(2; 8) + nroot(4; 16)', { angleUnit: 'D' });
    assert.ok(logb && Math.abs(logb.numeric - 5) < 1e-8);

    const solved = solveCasioEquation('2*x - 7 = 3', { angleUnit: 'D' }, 0);
    assert.ok(solved && Math.abs(solved.numeric - 5) < 1e-6);
  });

  it('parses 2D Natural-V.P.A.M. template boxes with disjoint character ranges and vertical D-pad links', () => {
    const expr = 'int(;;;x)';
    const nodes = parseCasio2dNodes(expr);
    const navSlots = getNavigableCasio2dSlots(nodes);
    // 4 navigable boxes: integrand (a0), lower limit (a1), upper limit (a2), variable (a3)
    assert.equal(navSlots.length, 4);
    assert.deepEqual(
      navSlots.map((s) => [s.start, s.end, s.value]),
      [
        [4, 4, ''],
        [5, 5, ''],
        [6, 6, ''],
        [7, 8, 'x'],
      ]
    );
    // Vertical links: integrand down -> lower limit, up -> upper limit
    assert.equal(navSlots[0].downSlotId, navSlots[1].id);
    assert.equal(navSlots[0].upSlotId, navSlots[2].id);
    assert.equal(navSlots[1].upSlotId, navSlots[2].id);
    assert.equal(navSlots[2].downSlotId, navSlots[1].id);

    const enclosing = findEnclosingCasio2dTemplate(nodes, navSlots[1].id);
    assert.ok(enclosing && enclosing.template.kind === 'int' && enclosing.argIndex === 1);

    const nestedNodes = parseCasio2dNodes('int(frac(1;2);0;3;x)');
    const nestedSlots = flattenCasio2dSlots(nestedNodes).filter((s) => s.role === 'arg');
    assert.equal(nestedSlots.length, 5); // num(1), den(2), lower(0), upper(3), var(x)

    // Number or variable preceding 2D templates (e.g. 3sqrt(), 3sqrt(5), 3frac(1;2))
    const sqrtPrefixed = parseCasio2dNodes('3sqrt()');
    assert.equal(sqrtPrefixed.length, 3); // gap('3'), template('sqrt'), gap('')
    assert.equal(sqrtPrefixed[0].type, 'slot');
    assert.equal(sqrtPrefixed[0].value, '3');
    assert.equal(sqrtPrefixed[1].type, 'template');
    assert.equal(sqrtPrefixed[1].kind, 'sqrt');
  });

  it('formats expressions including calculus and custom roots to Natural-V.P.A.M. LaTeX', () => {
    const tex = casioExprToNaturalLatex('sin(30) + frac(1;2) + cbrt(8)');
    assert.ok(tex.includes('\\sin(30)'));
    assert.ok(tex.includes('\\frac{1}{2}'));
    assert.ok(tex.includes('\\sqrt[3]{8}'));

    const intTex = casioExprToNaturalLatex('int(pow(x;2); 0; 1; x)');
    assert.ok(intTex.includes('\\int_{0}^{1}'));
    assert.ok(intTex.includes('{x}^{2}'));

    const sqrt3Tex = casioExprToNaturalLatex('3sqrt(5)');
    assert.equal(sqrt3Tex, '3\\sqrt{5}');

    const frac3Tex = casioExprToNaturalLatex('3frac(1;2)');
    assert.equal(frac3Tex, '3\\frac{1}{2}');

    const pow3Tex = casioExprToNaturalLatex('3pow(2;3)');
    assert.equal(pow3Tex, '3{2}^{3}');
  });

  it('computes Complex numbers, 2x2/3x3 Matrices, Vectors, Cubic, Systems, Inequalities, and Stats', () => {
    const cmp = evaluateCasioComplex('(2+3i)*(1-i)');
    assert.ok(cmp && cmp.re === 5 && cmp.im === 1);

    const mat = [
      [2, 1],
      [1, 3],
    ];
    assert.equal(computeMatrixDet(mat), 5);
    const inv = computeMatrixInverse(mat);
    assert.ok(inv && Math.abs(inv[0][0] - 0.6) < 1e-8);

    const vec = computeVectorMetrics([1, 0, 0], [0, 1, 0], 'D');
    assert.equal(vec.dot, 0);
    assert.equal(vec.angle, 90);
    assert.deepEqual(vec.cross, [0, 0, 1]);

    const sys2 = solveLinearSystem2x2(2, 1, 5, 1, -1, 1);
    assert.equal(sys2.kind, 'unique');
    assert.equal(sys2.x, 2);
    assert.equal(sys2.y, 1);

    const sys3 = solveLinearSystem3x3([
      [1, 1, 1, 6],
      [2, -1, 1, 3],
      [1, 2, -1, 2],
    ]);
    assert.equal(sys3.kind, 'unique');
    assert.ok(Math.abs((sys3.x ?? 0) - 1) < 1e-6);
    assert.ok(Math.abs((sys3.y ?? 0) - 2) < 1e-6);
    assert.ok(Math.abs((sys3.z ?? 0) - 3) < 1e-6);

    const cubic = solveCubicEquation(1, -6, 11, -6);
    assert.equal(cubic.roots.length, 3);
    assert.ok(Math.abs(cubic.roots[0] - 1) < 1e-6);
    assert.ok(Math.abs(cubic.roots[2] - 3) < 1e-6);

    const ineq = solveQuadraticInequality(1, -5, 6, '>');
    assert.ok(ineq.summaryLatex.includes('2') && ineq.summaryLatex.includes('3'));

    const stats = computeCasioStats1Var([2, 4, 4, 4, 5, 5, 7, 9]);
    assert.ok(stats && stats.n === 8 && stats.mean === 5 && stats.popStd === 2);
  });

  it('supports Gradian angle unit, Base-N (Mode 3), 4x4 Matrix & Transpose (Mode 4)', () => {
    // Gradian: 100g = 90° => sin(100g) = 1, asin(1) = 100g
    const sinG = evaluateCasioExpression('sin(100)', { angleUnit: 'G' });
    assert.ok(sinG && Math.abs(sinG.numeric - 1) < 1e-8);
    const asinG = evaluateCasioExpression('asin(1)', { angleUnit: 'G' });
    assert.ok(asinG && Math.abs(asinG.numeric - 100) < 1e-6);

    // Mode 3: Base-N
    const decRes = evaluateCasioBaseN('255', 'DEC');
    assert.ok(decRes && decRes.hex === 'FF' && decRes.bin === '11111111' && decRes.oct === '377');
    const hexLogic = evaluateCasioBaseN('FF AND 0F', 'HEX');
    assert.ok(hexLogic && hexLogic.value === 15 && hexLogic.hex === 'F');
    const binXor = evaluateCasioBaseN('1010 XOR 1100', 'BIN');
    assert.ok(binXor && binXor.bin === '110' && binXor.value === 6);

    // Mode 4: 4x4 Matrix determinant, inverse, transpose, subtract
    const m4 = [
      [2, 0, 0, 0],
      [0, 3, 0, 0],
      [0, 0, 4, 0],
      [0, 0, 0, 5],
    ];
    assert.equal(computeMatrixDet(m4), 120);
    const inv4 = computeMatrixInverse(m4);
    assert.ok(inv4 && Math.abs(inv4[0][0] - 0.5) < 1e-8 && Math.abs(inv4[3][3] - 0.2) < 1e-8);
    assert.deepEqual(
      transposeMatrix([
        [1, 2],
        [3, 4],
      ]),
      [
        [1, 3],
        [2, 4],
      ]
    );
    assert.deepEqual(
      subtractMatrices(
        [
          [5, 4],
          [3, 2],
        ],
        [
          [1, 1],
          [2, 0],
        ]
      ),
      [
        [4, 3],
        [1, 2],
      ]
    );
  });

  it('computes Distributions (Mode 7), 4x4 Systems & Quartic (Mode 9), Cubic Ineq (Mode A), Verify (Mode B), and Ratio (Mode C)', () => {
    // Mode 7: Normal CD, InvNormal, Binomial, Poisson
    const normCd = computeCasioDistribution({ kind: 'normalCD', lower: -1, upper: 1, mu: 0, sigma: 1 });
    assert.ok(normCd && Math.abs(normCd.value - 0.682689) < 1e-4);
    const invN = computeCasioDistribution({ kind: 'invNormal', area: 0.975, mu: 0, sigma: 1 });
    assert.ok(invN && Math.abs(invN.value - 1.95996) < 1e-3);
    const binom = computeCasioDistribution({ kind: 'binomialPD', x: 5, n: 10, p: 0.5 });
    assert.ok(binom && Math.abs(binom.value - 252 / 1024) < 1e-6);
    const pois = computeCasioDistribution({ kind: 'poissonPD', x: 0, lambda: 2 });
    assert.ok(pois && Math.abs(pois.value - Math.exp(-2)) < 1e-6);

    // Mode 9: 4x4 Linear System (x=1, y=2, z=3, t=4)
    const sys4 = solveLinearSystem4x4([
      [1, 1, 1, 1, 10],
      [2, -1, 1, 0, 3],
      [1, 2, -1, 1, 6],
      [0, 1, 2, -1, 4],
    ]);
    assert.equal(sys4.kind, 'unique');
    assert.ok(Math.abs((sys4.x ?? 0) - 1) < 1e-6);
    assert.ok(Math.abs((sys4.y ?? 0) - 2) < 1e-6);
    assert.ok(Math.abs((sys4.z ?? 0) - 3) < 1e-6);
    assert.ok(Math.abs((sys4.t ?? 0) - 4) < 1e-6);

    // Mode 9: Quartic (x-1)(x-2)(x-3)(x-4) = x⁴ - 10x³ + 35x² - 50x + 24 = 0
    const quartic = solveQuarticEquation(1, -10, 35, -50, 24);
    assert.equal(quartic.roots.length, 4);
    assert.ok(Math.abs(quartic.roots[0] - 1) < 1e-5);
    assert.ok(Math.abs(quartic.roots[3] - 4) < 1e-5);

    // Mode A: Cubic inequality (x-1)(x-2)(x-3) > 0 => 1 < x < 2 or x > 3
    const ineq3 = solveCubicInequality(1, -6, 11, -6, '>');
    assert.ok(ineq3.summaryLatex.includes('1 < x < 2') && ineq3.summaryLatex.includes('x > 3'));

    // Mode B: Verify
    const verTrue = evaluateCasioVerify('sin(30)', '=', '1/2', { angleUnit: 'D' });
    assert.ok(verTrue && verTrue.isTrue === true);
    const verFalse = evaluateCasioVerify('2^3', '>', '10', { angleUnit: 'D' });
    assert.ok(verFalse && verFalse.isTrue === false);

    // Mode C: Ratio (3 : 4 = X : 8 => X = 6; 3 : 4 = 6 : X => X = 8)
    const r1 = solveCasioRatio(3, 4, 0, 8, 'c');
    assert.equal(r1.kind, 'ok');
    assert.equal(r1.value, 6);
    const r2 = solveCasioRatio(3, 4, 6, 0, 'd');
    assert.equal(r2.kind, 'ok');
    assert.equal(r2.value, 8);
  });

  it('solves implicit-multiplication equations (3x+5, 2x^2-5x+2=0) and evaluates authentic sin⁻¹/cos⁻¹/tan⁻¹ & 2sin(30)', () => {
    // Regression: `3x+5` previously failed with Can't Solve due to `\bx\b` missing `3x`
    const s1 = solveCasioEquation('3x+5', { angleUnit: 'D' }, 1);
    assert.ok(s1 && Math.abs(s1.numeric - -5 / 3) < 1e-6);
    assert.equal(s1.exactLatex, '-\\frac{5}{3}');

    const s2 = solveCasioEquation('3x + 5 = 11', { angleUnit: 'D' }, 0);
    assert.ok(s2 && Math.abs(s2.numeric - 2) < 1e-6);

    const s3 = solveCasioEquation('2x^2 - 5x + 2 = 0', { angleUnit: 'D' }, 0);
    assert.ok(s3 && (Math.abs(s3.numeric - 0.5) < 1e-6 || Math.abs(s3.numeric - 2) < 1e-6));

    // Implicit multiplication with variables, trig, and 2D pow/sqrt
    const eval3x2 = evaluateCasioExpression('3pow(x;2) + 2x', { angleUnit: 'D', vars: { x: 2 } });
    assert.ok(eval3x2 && Math.abs(eval3x2.numeric - 16) < 1e-8);

    const eval2sin = evaluateCasioExpression('2sin(30)', { angleUnit: 'D' });
    assert.ok(eval2sin && Math.abs(eval2sin.numeric - 1) < 1e-8);

    const eval2sqrt5 = evaluateCasioExpression('2sqrt(5)', { angleUnit: 'D' });
    assert.ok(eval2sqrt5 && Math.abs(eval2sqrt5.numeric - 2 * Math.sqrt(5)) < 1e-8);
    assert.equal(eval2sqrt5.exactLatex, '2\\sqrt{5}');

    // Authentic Casio inverse trig notation (`sin⁻¹(`, `cos⁻¹(`, `tan⁻¹(`, `cot⁻¹(`)
    const invSin = evaluateCasioExpression('sin⁻¹(0.5)', { angleUnit: 'D' });
    assert.ok(invSin && Math.abs(invSin.numeric - 30) < 1e-6);
    const invCosTan = evaluateCasioExpression('cos⁻¹(0.5) + tan⁻¹(1)', { angleUnit: 'D' });
    assert.ok(invCosTan && Math.abs(invCosTan.numeric - 105) < 1e-6);
    const invCot = evaluateCasioExpression('cot⁻¹(1)', { angleUnit: 'D' });
    assert.ok(invCot && Math.abs(invCot.numeric - 45) < 1e-6);

    assert.equal(casioExprToNaturalLatex('sin⁻¹(0.5)'), '\\sin^{-1}(0.5)');
  });

  it('finds ALL real roots for SHIFT+SOLVE (quadratic, cubic, even-multiplicity, and ignores vertical asymptotes)', () => {
    // 3x² - 2 = 0 -> x₁ = -√6/3, x₂ = √6/3
    const quadAll = solveCasioEquationAllRoots('3pow(x;2) - 2', { angleUnit: 'D' }, 1);
    assert.ok(quadAll && quadAll.roots.length === 2);
    assert.equal(quadAll.roots[0].exactLatex, '-\\frac{\\sqrt{6}}{3}');
    assert.equal(quadAll.roots[1].exactLatex, '\\frac{\\sqrt{6}}{3}');
    assert.ok(quadAll.exactSummaryLatex.includes('x_{1} = -\\frac{\\sqrt{6}}{3}'));
    assert.ok(quadAll.exactSummaryLatex.includes('x_{2} = \\frac{\\sqrt{6}}{3}'));

    // Cubic with 3 real roots: x³ - 6x² + 11x - 6 = 0 -> 1, 2, 3
    const cubAll = solveCasioEquationAllRoots('x^3 - 6x^2 + 11x - 6 = 0', { angleUnit: 'D' }, 0);
    assert.ok(cubAll && cubAll.roots.length === 3);
    assert.ok(Math.abs(cubAll.roots[0].numeric - 1) < 1e-5);
    assert.ok(Math.abs(cubAll.roots[1].numeric - 2) < 1e-5);
    assert.ok(Math.abs(cubAll.roots[2].numeric - 3) < 1e-5);

    // Even-multiplicity touching root: (x - 2)^2 = 0 -> x = 2
    const dbl = solveCasioEquationAllRoots('(x - 2)^2 = 0', { angleUnit: 'D' }, 0);
    assert.ok(dbl && dbl.roots.length === 1 && Math.abs(dbl.roots[0].numeric - 2) < 1e-5);

    // Vertical asymptote sign-change should NOT produce a fake root: 1/(x - 1) = 0 -> null
    const asym = solveCasioEquationAllRoots('1/(x - 1) = 0', { angleUnit: 'D' }, 0);
    assert.equal(asym, null);
  });

  it('implements authentic Casio fx-580VN X Mode 9 solvers (exact surds, complex roots, extrema, RREF systems)', () => {
    assert.equal(parseCasioCoeff('1/2'), 0.5);
    assert.equal(parseCasioCoeff('-sqrt(4)'), -2);

    // MENU 9 -> 2 -> 2: x² - 2x - 1 = 0 => 1 + √2, 1 - √2, GTNN at (1, -2)
    const qSurd = solveCasioQuadraticFull(1, -2, -1);
    assert.equal(qSurd.kind, 'ok');
    assert.equal(qSurd.steps.length, 4);
    assert.equal(qSurd.steps[0].exactLatex, '1 + \\sqrt{2}');
    assert.equal(qSurd.steps[1].exactLatex, '1 - \\sqrt{2}');
    assert.ok(qSurd.steps[2].label.includes('GTNN') && qSurd.steps[2].numeric === 1);
    assert.ok(qSurd.steps[3].label.includes('GTNN') && qSurd.steps[3].numeric === -2);

    // Complex quadratic: x² - 2x + 5 = 0 => 1 + 2i, 1 - 2i
    const qCmp = solveCasioQuadraticFull(1, -2, 5);
    assert.equal(qCmp.steps[0].exactLatex, '1 + 2i');
    assert.equal(qCmp.steps[1].exactLatex, '1 - 2i');

    // Negative leading coeff -> GTLN
    const qMax = solveCasioQuadraticFull(-1, 4, -3);
    assert.ok(qMax.steps[2].label.includes('GTLN') && qMax.steps[2].numeric === 2);
    assert.ok(qMax.steps[3].label.includes('GTLN') && qMax.steps[3].numeric === 1);

    // MENU 9 -> 2 -> 3: x³ - 3x² + 2 = 0 => local max (0, 2) and local min (2, -2)
    const cExt = solveCasioCubicFull(1, -3, 0, 2);
    assert.ok(cExt.steps.some((s) => s.label === 'Cực đại · x =' && s.numeric === 0));
    assert.ok(cExt.steps.some((s) => s.label === 'Cực tiểu · x =' && s.numeric === 2));

    // Cubic with complex conjugate roots: x³ + x = 0 => 0, i, -i
    const cCmp = solveCasioCubicFull(1, 0, 1, 0);
    assert.equal(cCmp.steps.length, 3);
    assert.equal(cCmp.steps[1].exactLatex, 'i');
    assert.equal(cCmp.steps[2].exactLatex, '-i');

    // MENU 9 -> 2 -> 4: x⁴ - 1 = 0 => 1, -1, i, -i
    const q4 = solveCasioQuarticFull(1, 0, 0, 0, -1);
    assert.equal(q4.steps.length, 4);
    assert.ok(q4.steps.some((s) => s.exactLatex === 'i'));
    assert.ok(q4.steps.some((s) => s.exactLatex === '-i'));

    // MENU 9 -> 1 -> 3: RREF distinguishes No Solution vs Infinite Solutions
    const noSol = solveCasioLinearSystemFull([
      [1, 1, 1, 2],
      [2, 2, 2, 5],
      [0, 1, 0, 1],
    ]);
    assert.equal(noSol.kind, 'none');

    const infSol = solveCasioLinearSystemFull([
      [1, 1, 1, 2],
      [2, 2, 2, 4],
      [3, 3, 3, 6],
    ]);
    assert.equal(infSol.kind, 'infinite');

    // Mode 6 -> 2: Linear Regression y = 2 + 3x
    const lin = computeCasioLinReg([
      { x: 1, y: 5 },
      { x: 2, y: 8 },
      { x: 3, y: 11 },
    ]);
    assert.ok(lin && Math.abs(lin.a - 2) < 1e-8 && Math.abs(lin.b - 3) < 1e-8 && Math.abs(lin.r - 1) < 1e-8);

    // Mode 5: Unit vector
    const vec3 = computeVectorMetrics([3, 4, 0], [0, 1, 0], 'D');
    assert.ok(vec3.unitU && Math.abs(vec3.unitU[0] - 0.6) < 1e-8 && Math.abs(vec3.unitU[1] - 0.8) < 1e-8);
  });
});

