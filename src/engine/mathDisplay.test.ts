import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPrimeFactorizationLatex,
  formatTrigValueToLatex,
  friendlyMathToLatex,
  latexToReadableMath,
  parseMathSegments,
} from './mathDisplay';

describe('mathDisplay — friendly math to standard LaTeX', () => {
  it('converts algebraic expressions, implicit products, fractions, and roots cleanly', () => {
    assert.equal(friendlyMathToLatex('x^3 - 3*m*x + 1'), 'x^{3} - 3mx + 1');
    assert.equal(friendlyMathToLatex('(2*x+1)/(x-1)'), '\\frac{2x+1}{x-1}');
    assert.equal(friendlyMathToLatex('2*sqrt(x + 1)'), '2\\sqrt{x + 1}');
    assert.equal(friendlyMathToLatex('sin(30) + sqrt(16)'), '\\sin(30) + \\sqrt{16}');
    assert.equal(friendlyMathToLatex('0.25*x^2 - 2'), '0.25x^{2} - 2');
  });

  it('preserves existing valid LaTeX commands untouched', () => {
    const raw = 'I = \\int_{0}^{2} x^2\\,dx = \\frac{8}{3}';
    assert.equal(friendlyMathToLatex(raw), raw);
  });
});

describe('mathDisplay — readable Unicode fallback (zero raw LaTeX backslashes)', () => {
  it('strips all LaTeX commands and braces into clean textbook Unicode math', () => {
    const out1 = latexToReadableMath('I = \\int_{0}^{2} x^2\\,dx = \\frac{8}{3}');
    assert.ok(!out1.includes('\\'), `Expected no backslashes, got: ${out1}`);
    assert.ok(!out1.includes('{') && !out1.includes('}'));
    assert.ok(out1.includes('∫') && out1.includes('x²') && out1.includes('8/3'));

    const out2 = latexToReadableMath('\\Delta = b^2 - 4ac, \\quad x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}');
    assert.ok(!out2.includes('\\'));
    assert.ok(out2.includes('Δ') && out2.includes('±') && out2.includes('√Δ'));

    const out3 = latexToReadableMath('S = \\frac{(a + b) \\times h}{2}');
    assert.ok(!out3.includes('\\'));
    assert.ok(out3.includes('×'));
  });
});

describe('mathDisplay — curriculum helpers and mixed text parsing', () => {
  it('formats prime factorizations and exact trig values to LaTeX', () => {
    assert.equal(formatPrimeFactorizationLatex(120, [2, 2, 2, 3, 5]), '120 = 2^{3} \\cdot 3 \\cdot 5');
    assert.equal(formatTrigValueToLatex('√2/2'), '\\frac{\\sqrt{2}}{2}');
    assert.equal(formatTrigValueToLatex('-√3/2'), '-\\frac{\\sqrt{3}}{2}');
    assert.equal(formatTrigValueToLatex('3π/4'), '\\frac{3\\pi}{4}');
    assert.equal(formatTrigValueToLatex('KXĐ'), '\\text{KXĐ}');
  });

  it('splits mixed Vietnamese problem statements into prose and KaTeX math segments', () => {
    const segs1 = parseMathSegments('Cho hàm số $y = \\frac{2x+1}{x-1}$ có đồ thị (C).');
    assert.equal(segs1.length, 3);
    assert.equal(segs1[0].kind, 'text');
    assert.equal(segs1[1].kind, 'math');
    assert.equal(segs1[1].content, 'y = \\frac{2x+1}{x-1}');

    const segs2 = parseMathSegments('Cho hàm số y = x³ - 3mx + 1. Tìm m để hàm số có 2 cực trị.');
    assert.ok(segs2.some((s) => s.kind === 'math' && s.content.includes('x^{3}')));
    assert.ok(segs2.some((s) => s.kind === 'text' && s.content.includes('Tìm m')));
  });
});
