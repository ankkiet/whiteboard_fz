import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  casioExprToNaturalLatex,
  computeCasioStats1Var,
  computeMatrixDet,
  computeMatrixInverse,
  computeVectorMetrics,
  evaluateCasioComplex,
  evaluateCasioExpression,
  factorizeIntegerLatex,
  formatCasioExact,
  solveCasioEquation,
  solveCubicEquation,
  solveLinearSystem2x2,
  solveLinearSystem3x3,
  solveQuadraticInequality,
  toDmsText,
  toEngLatex,
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
  });

  it('formats expressions including calculus and custom roots to Natural-V.P.A.M. LaTeX', () => {
    const tex = casioExprToNaturalLatex('sin(30) + frac(1;2) + cbrt(8)');
    assert.ok(tex.includes('\\sin(30)'));
    assert.ok(tex.includes('\\frac{1}{2}'));
    assert.ok(tex.includes('\\sqrt[3]{8}'));

    const intTex = casioExprToNaturalLatex('int(pow(x;2); 0; 1; x)');
    assert.ok(intTex.includes('\\int_{0}^{1}'));
    assert.ok(intTex.includes('{x}^{2}'));
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
});

