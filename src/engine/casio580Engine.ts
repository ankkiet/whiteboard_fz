import { evaluateMathExpression } from './mathUtils';
import { formatPrimeFactorizationLatex, friendlyMathToLatex } from './mathDisplay';

export type CasioAngleUnit = 'D' | 'R';
export type CasioNormMode = 'NORM' | 'FIX' | 'SCI';
export type CasioDisplayFormat = 'exact' | 'decimal' | 'mixed' | 'dms' | 'eng';

export interface CasioExactRepresentation {
  numeric: number;
  decimalText: string;
  exactLatex: string;
  mixedLatex?: string;
  dmsText?: string;
  engLatex?: string;
  hasExactForm: boolean;
  specialSummaryLatex?: string;
  secondaryVars?: Partial<Record<'x' | 'y' | 'r' | 'theta' | 'Q' | 'R', number>>;
}

export interface CasioSystem2x2Result {
  kind: 'unique' | 'infinite' | 'none';
  x?: number;
  y?: number;
  xExactLatex?: string;
  yExactLatex?: string;
  summaryLatex: string;
}

export interface CasioSystem3x3Result {
  kind: 'unique' | 'degenerate';
  x?: number;
  y?: number;
  z?: number;
  summaryLatex: string;
}

export interface CasioCubicResult {
  roots: number[];
  complexNote?: string;
  summaryLatex: string;
}

export interface CasioInequalityResult {
  summaryLatex: string;
}

export interface CasioStats1VarResult {
  n: number;
  mean: number;
  sumX: number;
  sumX2: number;
  popStd: number;
  sampleStd: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface CasioComplexValue {
  re: number;
  im: number;
}

export interface CasioConstantItem {
  id: string;
  symbol: string;
  latex: string;
  name: string;
  value: number;
  token: string;
  unit: string;
}

export interface CasioConversionItem {
  id: string;
  label: string;
  fromUnit: string;
  toUnit: string;
  convert: (v: number) => number;
}

export const CASIO_CONSTANTS: CasioConstantItem[] = [
  { id: 'c', symbol: 'c₀', latex: 'c_0', name: 'Tốc độ ánh sáng chân không', value: 299792458, token: '299792458', unit: 'm/s' },
  { id: 'g', symbol: 'g', latex: 'g', name: 'Gia tốc trọng trường chuẩn', value: 9.80665, token: '9.80665', unit: 'm/s²' },
  { id: 'h', symbol: 'h', latex: 'h', name: 'Hằng số Planck', value: 6.62607015e-34, token: '(6.62607015*10^-34)', unit: 'J·s' },
  { id: 'na', symbol: 'Nₐ', latex: 'N_A', name: 'Hằng số Avogadro', value: 6.02214076e23, token: '(6.02214076*10^23)', unit: 'mol⁻¹' },
  { id: 'r', symbol: 'R', latex: 'R', name: 'Hằng số khí lý tưởng', value: 8.314462618, token: '8.314462618', unit: 'J/(mol·K)' },
  { id: 'e0', symbol: 'e', latex: 'e_0', name: 'Điện tích nguyên tố', value: 1.602176634e-19, token: '(1.602176634*10^-19)', unit: 'C' },
  { id: 'me', symbol: 'mₑ', latex: 'm_e', name: 'Khối lượng electron', value: 9.1093837015e-31, token: '(9.1093837015*10^-31)', unit: 'kg' },
  { id: 'G', symbol: 'G', latex: 'G', name: 'Hằng số hấp dẫn', value: 6.6743e-11, token: '(6.6743*10^-11)', unit: 'N·m²/kg²' },
];

export const CASIO_CONVERSIONS: CasioConversionItem[] = [
  { id: 'deg2rad', label: 'Độ → Radian', fromUnit: '°', toUnit: 'rad', convert: (v) => (v * Math.PI) / 180 },
  { id: 'rad2deg', label: 'Radian → Độ', fromUnit: 'rad', toUnit: '°', convert: (v) => (v * 180) / Math.PI },
  { id: 'kmh2ms', label: 'km/h → m/s', fromUnit: 'km/h', toUnit: 'm/s', convert: (v) => v / 3.6 },
  { id: 'ms2kmh', label: 'm/s → km/h', fromUnit: 'm/s', toUnit: 'km/h', convert: (v) => v * 3.6 },
  { id: 'inch2cm', label: 'inch → cm', fromUnit: 'in', toUnit: 'cm', convert: (v) => v * 2.54 },
  { id: 'cm2inch', label: 'cm → inch', fromUnit: 'cm', toUnit: 'in', convert: (v) => v / 2.54 },
  { id: 'c2f', label: '°C → °F', fromUnit: '°C', toUnit: '°F', convert: (v) => (v * 9) / 5 + 32 },
  { id: 'f2c', label: '°F → °C', fromUnit: '°F', toUnit: '°C', convert: (v) => ((v - 32) * 5) / 9 },
];

export function gcdInt(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

export function lcmInt(a: number, b: number): number {
  const x = Math.abs(Math.round(a));
  const y = Math.abs(Math.round(b));
  if (x === 0 || y === 0) return 0;
  return Math.round((x / gcdInt(x, y)) * y);
}

/**
 * Continued-fraction rational approximation (just like Casio fx-580VN X S⇔D key).
 */
export function approximateRational(value: number, maxDen = 1000, tol = 1e-8): { num: number; den: number } | null {
  if (!Number.isFinite(value)) return null;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  if (Math.abs(abs - Math.round(abs)) < tol) {
    return { num: sign * Math.round(abs), den: 1 };
  }

  let h1 = 1;
  let h0 = 0;
  let k1 = 0;
  let k0 = 1;
  let b = abs;

  for (let i = 0; i < 16; i += 1) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1;
    h1 = h2;
    k0 = k1;
    k1 = k2;
    const frac = b - a;
    if (frac < 1e-12) break;
    b = 1 / frac;
  }

  if (k1 > 1 && Math.abs(abs - h1 / k1) < tol) {
    const g = gcdInt(h1, k1);
    return { num: (sign * h1) / g, den: k1 / g };
  }
  return null;
}

export function toDmsText(value: number): string {
  if (!Number.isFinite(value)) return 'Math ERROR';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const deg = Math.floor(abs + 1e-11);
  const remMin = (abs - deg) * 60;
  const min = Math.floor(remMin + 1e-9);
  const sec = Number(((remMin - min) * 60).toFixed(2));
  return `${sign}${deg}°${min}'${sec}"`;
}

export function toEngLatex(value: number): string {
  if (!Number.isFinite(value)) return '\\text{Math ERROR}';
  if (Math.abs(value) < 1e-15) return '0 \\times 10^{0}';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const engExp = Math.floor(exp / 3) * 3;
  const mantissa = Number((value / 10 ** engExp).toPrecision(8));
  return `${mantissa} \\times 10^{${engExp}}`;
}

export function factorizeIntegerLatex(n: number): string | null {
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) return null;
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) > 1e-7) return null;
  if (Math.abs(rounded) < 2) return String(rounded);
  const neg = rounded < 0;
  let rem = Math.abs(rounded);
  const factors: number[] = [];
  for (let p = 2; p * p <= rem; p += p === 2 ? 1 : 2) {
    while (rem % p === 0) {
      factors.push(p);
      rem /= p;
    }
  }
  if (rem > 1) factors.push(rem);
  const full = formatPrimeFactorizationLatex(Math.abs(rounded), factors);
  const rhs = full.includes('=') ? full.split('=')[1].trim() : full;
  return neg ? `-(${rhs})` : rhs;
}

export function formatDecimalForMode(
  value: number,
  normMode: CasioNormMode = 'NORM',
  fixDigits = 4
): string {
  if (!Number.isFinite(value)) return 'Math ERROR';
  if (Math.abs(value) < 1e-12) return '0';
  if (normMode === 'FIX') {
    return value.toFixed(Math.max(0, Math.min(9, fixDigits)));
  }
  if (normMode === 'SCI') {
    const [m, e] = value.toExponential(Math.max(1, Math.min(8, fixDigits))).split('e');
    return `${Number(m)}×10^(${Number(e)})`;
  }
  const roundedDec = Number(value.toFixed(9));
  return Object.is(roundedDec, -0) ? '0' : String(roundedDec);
}

/**
 * Recognizes exact surd/pi multiples common on Casio fx-580VN X (`√2/2`, `√3`, `π/6`, etc.),
 * rational fractions (`5/2`, `-7/3`), mixed fractions (`3 1/2`), DMS, and ENG format.
 */
export function formatCasioExact(
  value: number,
  normMode: CasioNormMode = 'NORM',
  fixDigits = 4
): CasioExactRepresentation {
  if (!Number.isFinite(value)) {
    return {
      numeric: value,
      decimalText: 'Math ERROR',
      exactLatex: '\\text{Math ERROR}',
      hasExactForm: false,
    };
  }

  const decimalText = formatDecimalForMode(value, normMode, fixDigits);
  const dmsText = toDmsText(value);
  const engLatex = toEngLatex(value);

  if (Math.abs(value) < 1e-11) {
    return {
      numeric: 0,
      decimalText: normMode === 'FIX' ? (0).toFixed(fixDigits) : '0',
      exactLatex: '0',
      dmsText: `0°0'0"`,
      engLatex: '0 \\times 10^{0}',
      hasExactForm: false,
    };
  }

  // 1. Check rational fraction first
  const rat = approximateRational(value, 500, 1e-8);
  if (rat) {
    if (rat.den === 1) {
      return {
        numeric: value,
        decimalText: normMode === 'NORM' ? String(rat.num) : decimalText,
        exactLatex: String(rat.num),
        dmsText,
        engLatex,
        hasExactForm: false,
      };
    }
    const sign = rat.num < 0 ? '-' : '';
    const absNum = Math.abs(rat.num);
    const whole = Math.floor(absNum / rat.den);
    const rem = absNum % rat.den;
    const mixedLatex =
      whole > 0
        ? `${sign}${whole}\\frac{${rem}}{${rat.den}}`
        : `${sign}\\frac{${absNum}}{${rat.den}}`;
    return {
      numeric: value,
      decimalText,
      exactLatex: `${sign}\\frac{${absNum}}{${rat.den}}`,
      mixedLatex,
      dmsText,
      engLatex,
      hasExactForm: true,
    };
  }

  // 2. Check common quadratic surds & pi multiples
  const basis: { val: number; tex: string }[] = [
    { val: Math.sqrt(2), tex: '\\sqrt{2}' },
    { val: Math.sqrt(3), tex: '\\sqrt{3}' },
    { val: Math.sqrt(5), tex: '\\sqrt{5}' },
    { val: Math.sqrt(6), tex: '\\sqrt{6}' },
    { val: Math.PI, tex: '\\pi' },
  ];

  for (const b of basis) {
    const ratio = value / b.val;
    const mult = approximateRational(ratio, 24, 1e-7);
    if (mult && mult.num !== 0) {
      const sign = mult.num < 0 ? '-' : '';
      const absN = Math.abs(mult.num);
      const numTex = absN === 1 ? b.tex : `${absN}${b.tex}`;
      const exactLatex = mult.den === 1 ? `${sign}${numTex}` : `${sign}\\frac{${numTex}}{${mult.den}}`;
      return {
        numeric: value,
        decimalText,
        exactLatex,
        dmsText,
        engLatex,
        hasExactForm: true,
      };
    }
  }

  return {
    numeric: value,
    decimalText,
    exactLatex: decimalText,
    dmsText,
    engLatex,
    hasExactForm: false,
  };
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) return NaN;
  let res = 1;
  for (let i = 2; i <= n; i += 1) res *= i;
  return res;
}

function nCr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) return NaN;
  const k = Math.min(r, n - r);
  let res = 1;
  for (let i = 1; i <= k; i += 1) {
    res = (res * (n - k + i)) / i;
  }
  return Math.round(res);
}

function nPr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) return NaN;
  let res = 1;
  for (let i = 0; i < r; i += 1) res *= n - i;
  return res;
}

/**
 * Extracts a function call `fnName(...)` with balanced parentheses and splits top-level `;` or `,` args.
 */
function findBalancedFunctionCall(
  input: string,
  fnName: string
): { start: number; end: number; args: string[] } | null {
  const regex = new RegExp(`\\b${fnName}\\s*\\(`, 'i');
  const match = regex.exec(input);
  if (!match) return null;
  const start = match.index;
  const openIdx = start + match[0].length - 1;
  let depth = 0;
  const args: string[] = [];
  let argStart = openIdx + 1;

  for (let i = openIdx; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        args.push(input.slice(argStart, i).trim());
        return { start, end: i + 1, args };
      }
    } else if ((ch === ';' || ch === ',') && depth === 1) {
      args.push(input.slice(argStart, i).trim());
      argStart = i + 1;
    }
  }
  return null;
}

/**
 * Expands recurring decimals like `0.(3)` -> `1/3`, `1.2(34)` -> `1222/990`
 */
function expandRecurringDecimals(s: string): string {
  return s.replace(/(\d+)\.(\d*)\((\d+)\)/g, (_, whole: string, nonRep: string, rep: string) => {
    const w = Number(whole);
    const k = nonRep.length;
    const m = rep.length;
    const fullDigits = Number(`${nonRep}${rep}`);
    const nonRepDigits = nonRep ? Number(nonRep) : 0;
    const den = (10 ** m - 1) * 10 ** k;
    const num = fullDigits - nonRepDigits;
    return `(${w} + (${num})/(${den}))`;
  });
}

/**
 * Converts DMS literals like `30°15'20"` or `30°15'` into decimal degrees.
 */
function expandDmsLiterals(s: string): string {
  return s.replace(/(-?\d+(?:\.\d+)?)°(\d+(?:\.\d+)?)'?(?:(\d+(?:\.\d+)?)"?)?/g, (_, d: string, m: string, sec?: string) => {
    const deg = Number(d);
    const sign = deg < 0 ? -1 : 1;
    const val = sign * (Math.abs(deg) + Number(m) / 60 + (sec ? Number(sec) / 3600 : 0));
    return `(${val})`;
  });
}

export interface CasioEvalOptions {
  angleUnit: CasioAngleUnit;
  ans?: number;
  preAns?: number;
  mem?: number;
  xVal?: number;
  vars?: Record<string, number>;
  normMode?: CasioNormMode;
  fixDigits?: number;
}

/**
 * Evaluates a Casio fx-580VN X expression string supporting:
 * - Ans, PreAns, M, and variables A, B, C, D, T, F, x, y, z
 * - Degree / Radian trig (`sin`, `cos`, `tan`, `cot`, `asin`, `acos`, `atan`, `acot`)
 * - Calculus & discrete ops: `int(f;a;b)`, `ddx(f;a)`, `sum(f;a;b)`, `prod(f;a;b)`, `lim(f;a)`
 * - `logb(base;val)`, `nroot(n;val)`, `cbrt`, `nCr`, `nPr`, `!`, `GCD`, `LCM`, `mod`, `Ceil`, `Intg`, `Ran`, `RanInt`
 * - Special multi-output ops: `a ÷R b`, `Pol(x;y)`, `Rec(r;θ)`
 * - Recurring decimals `0.(3)` and DMS literals `30°15'0"`
 */
export function evaluateCasioExpression(
  raw: string,
  options: CasioEvalOptions
): CasioExactRepresentation | null {
  const normMode = options.normMode ?? 'NORM';
  const fixDigits = options.fixDigits ?? 4;
  let s = raw.trim();
  if (!s) return null;

  // Handle special 2-output commands first: Pol(x;y), Rec(r;θ), a ÷R b
  const polCall = findBalancedFunctionCall(s, 'Pol');
  if (polCall && polCall.start === 0 && polCall.end === s.length && polCall.args.length === 2) {
    const xv = evaluateCasioExpression(polCall.args[0], options)?.numeric;
    const yv = evaluateCasioExpression(polCall.args[1], options)?.numeric;
    if (xv === undefined || yv === undefined) return null;
    const r = Math.hypot(xv, yv);
    let theta = Math.atan2(yv, xv);
    if (options.angleUnit === 'D') theta = (theta * 180) / Math.PI;
    const base = formatCasioExact(r, normMode, fixDigits);
    const rTex = base.hasExactForm ? base.exactLatex : base.decimalText;
    const tStr = formatDecimalForMode(theta, normMode, fixDigits);
    return {
      ...base,
      specialSummaryLatex: `r = ${rTex},\\; \\theta = ${tStr}${options.angleUnit === 'D' ? '^\\circ' : ''}`,
      secondaryVars: { r, theta },
    };
  }

  const recCall = findBalancedFunctionCall(s, 'Rec');
  if (recCall && recCall.start === 0 && recCall.end === s.length && recCall.args.length === 2) {
    const rv = evaluateCasioExpression(recCall.args[0], options)?.numeric;
    const tv = evaluateCasioExpression(recCall.args[1], options)?.numeric;
    if (rv === undefined || tv === undefined) return null;
    const rad = options.angleUnit === 'D' ? (tv * Math.PI) / 180 : tv;
    const xv = rv * Math.cos(rad);
    const yv = rv * Math.sin(rad);
    const xRep = formatCasioExact(xv, normMode, fixDigits);
    const yRep = formatCasioExact(yv, normMode, fixDigits);
    const xTex = xRep.hasExactForm ? xRep.exactLatex : xRep.decimalText;
    const yTex = yRep.hasExactForm ? yRep.exactLatex : yRep.decimalText;
    return {
      ...xRep,
      specialSummaryLatex: `x = ${xTex},\\; y = ${yTex}`,
      secondaryVars: { x: xv, y: yv },
    };
  }

  // Euclidean division `a ÷R b`
  if (/÷R/i.test(s)) {
    const parts = s.split(/÷R/i);
    if (parts.length === 2) {
      const a = evaluateCasioExpression(parts[0], options)?.numeric;
      const b = evaluateCasioExpression(parts[1], options)?.numeric;
      if (a === undefined || b === undefined || Math.abs(b) < 1e-12) return null;
      const q = Math.trunc(a / b);
      const r = a - q * b;
      const qStr = formatDecimalForMode(q, 'NORM');
      const rStr = formatDecimalForMode(r, 'NORM');
      return {
        numeric: q,
        decimalText: `${qStr}, R = ${rStr}`,
        exactLatex: `Q = ${qStr},\\; R = ${rStr}`,
        hasExactForm: true,
        specialSummaryLatex: `Q = ${qStr},\\; R = ${rStr}`,
        secondaryVars: { Q: q, R: r },
      };
    }
  }

  const ansVal = options.ans ?? 0;
  const preAnsVal = options.preAns ?? 0;
  const memVal = options.mem ?? 0;
  const vars = options.vars ?? {};

  s = expandRecurringDecimals(s);
  s = expandDmsLiterals(s);

  // Handle calculus/summation/limit BEFORE substituting variable x
  const evalInnerFx = (exprBody: string, xVal: number): number => {
    const r = evaluateCasioExpression(exprBody, { ...options, xVal });
    return r ? r.numeric : NaN;
  };

  // int(f(x); a; b[; var]) -> Simpson composite rule (100 subintervals)
  let guard = 0;
  while (guard < 8) {
    const call = findBalancedFunctionCall(s, 'int');
    if (!call || call.args.length < 3) break;
    const a = evaluateCasioExpression(call.args[1], options)?.numeric;
    const b = evaluateCasioExpression(call.args[2], options)?.numeric;
    if (a === undefined || b === undefined) return null;
    const rawVar = (call.args[3] ?? '').trim();
    const intVar = /^[a-zA-Z]$/.test(rawVar) ? rawVar : 'x';
    const bodyExpr =
      intVar === 'x'
        ? call.args[0]
        : call.args[0].replace(new RegExp(`\\b${intVar}\\b`, 'g'), 'x');
    const n = 100;
    const h = (b - a) / n;
    let sum = evalInnerFx(bodyExpr, a) + evalInnerFx(bodyExpr, b);
    for (let i = 1; i < n; i += 1) {
      const y = evalInnerFx(bodyExpr, a + i * h);
      sum += (i % 2 === 0 ? 2 : 4) * y;
    }
    const integralVal = (h / 3) * sum;
    if (!Number.isFinite(integralVal)) return null;
    s = `${s.slice(0, call.start)}(${integralVal})${s.slice(call.end)}`;
    guard += 1;
  }

  // ddx(f(x); a) -> 5-point central derivative
  guard = 0;
  while (guard < 8) {
    const call = findBalancedFunctionCall(s, 'ddx');
    if (!call || call.args.length < 2) break;
    const a = evaluateCasioExpression(call.args[1], options)?.numeric;
    if (a === undefined) return null;
    const h = 1e-4;
    const deriv =
      (-evalInnerFx(call.args[0], a + 2 * h) +
        8 * evalInnerFx(call.args[0], a + h) -
        8 * evalInnerFx(call.args[0], a - h) +
        evalInnerFx(call.args[0], a - 2 * h)) /
      (12 * h);
    if (!Number.isFinite(deriv)) return null;
    s = `${s.slice(0, call.start)}(${deriv})${s.slice(call.end)}`;
    guard += 1;
  }

  // sum(f(x); start; end) -> Sigma
  guard = 0;
  while (guard < 8) {
    const call = findBalancedFunctionCall(s, 'sum');
    if (!call || call.args.length < 3) break;
    const startN = evaluateCasioExpression(call.args[1], options)?.numeric;
    const endN = evaluateCasioExpression(call.args[2], options)?.numeric;
    if (startN === undefined || endN === undefined) return null;
    const lo = Math.round(startN);
    const hi = Math.round(endN);
    if (hi - lo > 5000) return null;
    let total = 0;
    for (let k = lo; k <= hi; k += 1) {
      const v = evalInnerFx(call.args[0], k);
      if (!Number.isFinite(v)) return null;
      total += v;
    }
    s = `${s.slice(0, call.start)}(${total})${s.slice(call.end)}`;
    guard += 1;
  }

  // prod(f(x); start; end) -> Pi
  guard = 0;
  while (guard < 8) {
    const call = findBalancedFunctionCall(s, 'prod');
    if (!call || call.args.length < 3) break;
    const startN = evaluateCasioExpression(call.args[1], options)?.numeric;
    const endN = evaluateCasioExpression(call.args[2], options)?.numeric;
    if (startN === undefined || endN === undefined) return null;
    const lo = Math.round(startN);
    const hi = Math.round(endN);
    if (hi - lo > 2000) return null;
    let total = 1;
    for (let k = lo; k <= hi; k += 1) {
      const v = evalInnerFx(call.args[0], k);
      if (!Number.isFinite(v)) return null;
      total *= v;
    }
    s = `${s.slice(0, call.start)}(${total})${s.slice(call.end)}`;
    guard += 1;
  }

  // lim(f(x); target) -> numerical two-sided limit (supports 1e9 for ∞)
  guard = 0;
  while (guard < 8) {
    const call = findBalancedFunctionCall(s, 'lim');
    if (!call || call.args.length < 2) break;
    const targetRaw = call.args[1].trim();
    let limVal = NaN;
    if (targetRaw === '∞' || targetRaw === '+∞' || /^inf$/i.test(targetRaw)) {
      limVal = evalInnerFx(call.args[0], 1e6);
    } else if (targetRaw === '-∞' || /^-inf$/i.test(targetRaw)) {
      limVal = evalInnerFx(call.args[0], -1e6);
    } else {
      const a = evaluateCasioExpression(targetRaw, options)?.numeric;
      if (a === undefined) return null;
      const left = evalInnerFx(call.args[0], a - 1e-6);
      const right = evalInnerFx(call.args[0], a + 1e-6);
      if (Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-2) {
        limVal = (left + right) / 2;
      } else if (Number.isFinite(right)) {
        limVal = right;
      } else {
        limVal = left;
      }
    }
    if (!Number.isFinite(limVal)) return null;
    s = `${s.slice(0, call.start)}(${limVal})${s.slice(call.end)}`;
    guard += 1;
  }

  // mixfrac(whole; num; den) -> mixed fraction
  guard = 0;
  while (guard < 12) {
    const call = findBalancedFunctionCall(s, 'mixfrac');
    if (!call || call.args.length < 3) break;
    const w = evaluateCasioExpression(call.args[0], options)?.numeric;
    const num = evaluateCasioExpression(call.args[1], options)?.numeric;
    const den = evaluateCasioExpression(call.args[2], options)?.numeric;
    if (w === undefined || num === undefined || den === undefined || Math.abs(den) < 1e-12) return null;
    const sign = w < 0 ? -1 : 1;
    const val = sign * (Math.abs(w) + num / den);
    if (!Number.isFinite(val)) return null;
    s = `${s.slice(0, call.start)}(${val})${s.slice(call.end)}`;
    guard += 1;
  }

  // frac(num; den) -> 2D fraction
  guard = 0;
  while (guard < 16) {
    const call = findBalancedFunctionCall(s, 'frac');
    if (!call || call.args.length < 2) break;
    const num = evaluateCasioExpression(call.args[0], options)?.numeric;
    const den = evaluateCasioExpression(call.args[1], options)?.numeric;
    if (num === undefined || den === undefined || Math.abs(den) < 1e-12) return null;
    const val = num / den;
    if (!Number.isFinite(val)) return null;
    s = `${s.slice(0, call.start)}(${val})${s.slice(call.end)}`;
    guard += 1;
  }

  // pow(base; exp) -> 2D power
  guard = 0;
  while (guard < 16) {
    const call = findBalancedFunctionCall(s, 'pow');
    if (!call || call.args.length < 2) break;
    const base = evaluateCasioExpression(call.args[0], options)?.numeric;
    const exp = evaluateCasioExpression(call.args[1], options)?.numeric;
    if (base === undefined || exp === undefined) return null;
    const val = Math.pow(base, exp);
    if (!Number.isFinite(val)) return null;
    s = `${s.slice(0, call.start)}(${val})${s.slice(call.end)}`;
    guard += 1;
  }

  // logb(base; val)
  guard = 0;
  while (guard < 10) {
    const call = findBalancedFunctionCall(s, 'logb');
    if (!call || call.args.length < 2) break;
    const base = evaluateCasioExpression(call.args[0], options)?.numeric;
    const val = evaluateCasioExpression(call.args[1], options)?.numeric;
    if (base === undefined || val === undefined || base <= 0 || base === 1 || val <= 0) return null;
    s = `${s.slice(0, call.start)}(${Math.log(val) / Math.log(base)})${s.slice(call.end)}`;
    guard += 1;
  }

  // nroot(n; val)
  guard = 0;
  while (guard < 10) {
    const call = findBalancedFunctionCall(s, 'nroot');
    if (!call || call.args.length < 2) break;
    const nVal = evaluateCasioExpression(call.args[0], options)?.numeric;
    const val = evaluateCasioExpression(call.args[1], options)?.numeric;
    if (nVal === undefined || val === undefined || nVal === 0) return null;
    const res =
      val < 0 && Math.abs(nVal % 2) === 1
        ? -Math.pow(-val, 1 / nVal)
        : Math.pow(val, 1 / nVal);
    if (!Number.isFinite(res)) return null;
    s = `${s.slice(0, call.start)}(${res})${s.slice(call.end)}`;
    guard += 1;
  }

  // GCD(a; b) & LCM(a; b)
  guard = 0;
  while (guard < 10) {
    const call = findBalancedFunctionCall(s, 'GCD');
    if (!call || call.args.length < 2) break;
    const a = evaluateCasioExpression(call.args[0], options)?.numeric;
    const b = evaluateCasioExpression(call.args[1], options)?.numeric;
    if (a === undefined || b === undefined) return null;
    s = `${s.slice(0, call.start)}(${gcdInt(a, b)})${s.slice(call.end)}`;
    guard += 1;
  }
  guard = 0;
  while (guard < 10) {
    const call = findBalancedFunctionCall(s, 'LCM');
    if (!call || call.args.length < 2) break;
    const a = evaluateCasioExpression(call.args[0], options)?.numeric;
    const b = evaluateCasioExpression(call.args[1], options)?.numeric;
    if (a === undefined || b === undefined) return null;
    s = `${s.slice(0, call.start)}(${lcmInt(a, b)})${s.slice(call.end)}`;
    guard += 1;
  }

  // Ran() and RanInt(a; b)
  s = s.replace(/\bRan\s*\(\s*\)/gi, () => `(${Number(Math.random().toFixed(4))})`);
  guard = 0;
  while (guard < 6) {
    const call = findBalancedFunctionCall(s, 'RanInt');
    if (!call || call.args.length < 2) break;
    const a = evaluateCasioExpression(call.args[0], options)?.numeric;
    const b = evaluateCasioExpression(call.args[1], options)?.numeric;
    if (a === undefined || b === undefined) return null;
    const lo = Math.ceil(Math.min(a, b));
    const hi = Math.floor(Math.max(a, b));
    const r = Math.floor(Math.random() * (hi - lo + 1)) + lo;
    s = `${s.slice(0, call.start)}(${r})${s.slice(call.end)}`;
    guard += 1;
  }

  // Symbols & operators
  s = s
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−|–/g, '-')
    .replace(/π/g, 'pi')
    .replace(/∞/g, '1000000')
    .replace(/√\(/g, 'sqrt(')
    .replace(/\bPreAns\b/gi, `(${preAnsVal})`)
    .replace(/\bAns\b/gi, `(${ansVal})`)
    .replace(/\bM\b/g, `(${vars.M ?? memVal})`)
    .replace(/\b([ABCDFyzT])\b/g, (_, vName: string) => `(${vars[vName] ?? 0})`);

  if (options.xVal !== undefined) {
    s = s.replace(/\bx\b/gi, `(${options.xVal})`);
  } else if (vars.x !== undefined) {
    s = s.replace(/\bx\b/gi, `(${vars.x})`);
  }

  // Infix `a mod b`
  s = s.replace(/(-?\d+(?:\.\d+)?)\s*mod\s*(-?\d+(?:\.\d+)?)/gi, (_, a: string, b: string) => {
    const av = Number(a);
    const bv = Number(b);
    if (bv === 0) return 'NaN';
    return `(${((av % bv) + bv) % bv})`;
  });

  // Ceil / Intg aliases
  s = s.replace(/\bCeil\s*\(/gi, 'ceil(').replace(/\bIntg\s*\(/gi, 'floor(');

  // Combinatorics: 5C2 -> nCr, 5P2 -> nPr
  s = s.replace(/(\d+)\s*C\s*(\d+)/g, (_, n: string, r: string) => {
    const val = nCr(Number(n), Number(r));
    return Number.isFinite(val) ? String(val) : 'NaN';
  });
  s = s.replace(/(\d+)\s*P\s*(\d+)/g, (_, n: string, r: string) => {
    const val = nPr(Number(n), Number(r));
    return Number.isFinite(val) ? String(val) : 'NaN';
  });

  // Factorials: 5!
  s = s.replace(/(\d+)!/g, (_, n: string) => {
    const val = factorial(Number(n));
    return Number.isFinite(val) ? String(val) : 'NaN';
  });

  // Cube root cbrt(u)
  guard = 0;
  while (guard < 10) {
    const call = findBalancedFunctionCall(s, 'cbrt');
    if (!call || call.args.length < 1) break;
    const innerVal = evaluateCasioExpression(call.args[0], options)?.numeric;
    if (innerVal === undefined) return null;
    s = `${s.slice(0, call.start)}(${Math.cbrt(innerVal)})${s.slice(call.end)}`;
    guard += 1;
  }

  // cot / acot
  guard = 0;
  while (guard < 10) {
    const call = findBalancedFunctionCall(s, 'acot');
    if (!call || call.args.length < 1) break;
    const v = evaluateCasioExpression(call.args[0], options)?.numeric;
    if (v === undefined) return null;
    const rad = Math.PI / 2 - Math.atan(v);
    const res = options.angleUnit === 'D' ? (rad * 180) / Math.PI : rad;
    s = `${s.slice(0, call.start)}(${res})${s.slice(call.end)}`;
    guard += 1;
  }
  guard = 0;
  while (guard < 10) {
    const call = findBalancedFunctionCall(s, 'cot');
    if (!call || call.args.length < 1) break;
    const v = evaluateCasioExpression(call.args[0], options)?.numeric;
    if (v === undefined) return null;
    const rad = options.angleUnit === 'D' ? (v * Math.PI) / 180 : v;
    const t = Math.tan(rad);
    if (Math.abs(t) < 1e-12) return null;
    s = `${s.slice(0, call.start)}(${1 / t})${s.slice(call.end)}`;
    guard += 1;
  }

  // Convert trig functions when in Degree mode ('D')
  if (options.angleUnit === 'D') {
    guard = 0;
    while (guard < 10) {
      const m = /\b(asin|acos|atan)\s*\(([^()]+)\)/i.exec(s);
      if (!m) break;
      const fn = m[1].toLowerCase();
      const argVal = evaluateMathExpression(m[2], 0);
      if (argVal === null) return null;
      const rad = fn === 'asin' ? Math.asin(argVal) : fn === 'acos' ? Math.acos(argVal) : Math.atan(argVal);
      if (!Number.isFinite(rad)) return null;
      const deg = (rad * 180) / Math.PI;
      s = `${s.slice(0, m.index)}(${deg})${s.slice(m.index + m[0].length)}`;
      guard += 1;
    }
    s = s.replace(/\b(sin|cos|tan)\s*\(([^()]+)\)/gi, (_, fn: string, inner: string) => {
      return `${fn}((${inner})*pi/180)`;
    });
  }

  if (s.includes('NaN')) return null;

  const val = evaluateMathExpression(s, 0);
  if (val === null || !Number.isFinite(val)) return null;
  return formatCasioExact(val, normMode, fixDigits);
}

/**
 * Numerical equation SOLVE (`SHIFT` + `CALC`):
 * Solves `LHS = RHS` (or `expr = 0`) for `x` using damped Newton-Raphson + multi-start search.
 */
export function solveCasioEquation(
  equationRaw: string,
  options: CasioEvalOptions,
  initialGuess = 1
): CasioExactRepresentation | null {
  const parts = equationRaw.split('=');
  if (parts.length > 2) return null;
  const fExpr = parts.length === 2 ? `(${parts[0]}) - (${parts[1]})` : parts[0];

  const evalF = (x: number): number => {
    const r = evaluateCasioExpression(fExpr, { ...options, xVal: x });
    return r ? r.numeric : NaN;
  };

  const seeds = [initialGuess, 0, 1, -1, 2, -2, 5, -5, 10, -10];
  for (const seed of seeds) {
    let x = seed;
    for (let iter = 0; iter < 50; iter += 1) {
      const fx = evalF(x);
      if (!Number.isFinite(fx)) break;
      if (Math.abs(fx) < 1e-10) {
        return formatCasioExact(x, options.normMode, options.fixDigits);
      }
      const h = 1e-6;
      const dfx = (evalF(x + h) - evalF(x - h)) / (2 * h);
      if (!Number.isFinite(dfx) || Math.abs(dfx) < 1e-12) break;
      const next = x - fx / dfx;
      if (!Number.isFinite(next) || Math.abs(next) > 1e8) break;
      x = next;
    }
    const check = evalF(x);
    if (Number.isFinite(check) && Math.abs(check) < 1e-6) {
      return formatCasioExact(x, options.normMode, options.fixDigits);
    }
  }
  return null;
}

function replaceBalancedCallToLatex(
  input: string,
  fnName: string,
  formatter: (args: string[]) => string
): string {
  let out = input;
  let guard = 0;
  while (guard < 12) {
    const call = findBalancedFunctionCall(out, fnName);
    if (!call) break;
    const replacement = formatter(call.args);
    out = `${out.slice(0, call.start)}${replacement}${out.slice(call.end)}`;
    guard += 1;
  }
  return out;
}

/**
 * Formats Casio calculator expression buffer into Natural-V.P.A.M. LaTeX for the LCD screen.
 */
export function casioExprToNaturalLatex(expr: string): string {
  if (!expr.trim()) return '0';
  let s = expr;
  // Convert recurring decimals `0.(3)` -> `0.\overline{3}`
  s = s.replace(/(\d+)\.(\d*)\((\d+)\)/g, '$1.$2\\overline{$3}');

  const orBox = (v?: string, fallback = '\\square') =>
    v && v.trim() ? casioExprToNaturalLatex(v.trim()) : fallback;

  // Format multi-arg Casio functions BEFORE friendlyMathToLatex so `;` separators don't confuse fraction/operator rules
  s = replaceBalancedCallToLatex(
    s,
    'mixfrac',
    (args) => `${orBox(args[0])}\\frac{${orBox(args[1])}}{${orBox(args[2])}}`
  );
  s = replaceBalancedCallToLatex(
    s,
    'frac',
    (args) => `\\frac{${orBox(args[0])}}{${orBox(args[1])}}`
  );
  s = replaceBalancedCallToLatex(
    s,
    'pow',
    (args) => `{${orBox(args[0])}}^{${orBox(args[1])}}`
  );
  s = replaceBalancedCallToLatex(s, 'cbrt', (args) => `\\sqrt[3]{${orBox(args[0])}}`);
  s = replaceBalancedCallToLatex(s, 'nroot', (args) => `\\sqrt[${orBox(args[0])}]{${orBox(args[1])}}`);
  s = replaceBalancedCallToLatex(s, 'logb', (args) => `\\log_{${orBox(args[0])}}\\left(${orBox(args[1])}\\right)`);
  s = replaceBalancedCallToLatex(
    s,
    'int',
    (args) =>
      `\\int_{${orBox(args[1], '\\square')}}^{${orBox(args[2], '\\square')}} ${orBox(args[0], '\\square')}\\,\\mathrm{d}${orBox(args[3], 'x')}`
  );
  s = replaceBalancedCallToLatex(
    s,
    'ddx',
    (args) => `\\left.\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(${orBox(args[0], '\\square')}\\right)\\right|_{x=${orBox(args[1], '\\square')}}`
  );
  s = replaceBalancedCallToLatex(
    s,
    'sum',
    (args) => `\\sum_{x=${orBox(args[1], '\\square')}}^{${orBox(args[2], '\\square')}} ${orBox(args[0], '\\square')}`
  );
  s = replaceBalancedCallToLatex(
    s,
    'prod',
    (args) => `\\prod_{x=${orBox(args[1], '\\square')}}^{${orBox(args[2], '\\square')}} ${orBox(args[0], '\\square')}`
  );
  s = replaceBalancedCallToLatex(
    s,
    'lim',
    (args) => `\\lim_{x \\to ${orBox(args[1], '\\square')}} \\left(${orBox(args[0], '\\square')}\\right)`
  );
  s = replaceBalancedCallToLatex(
    s,
    'GCD',
    (args) => `\\text{GCD}\\left(${orBox(args[0])};\\,${orBox(args[1])}\\right)`
  );
  s = replaceBalancedCallToLatex(
    s,
    'LCM',
    (args) => `\\text{LCM}\\left(${orBox(args[0])};\\,${orBox(args[1])}\\right)`
  );
  s = replaceBalancedCallToLatex(
    s,
    'Pol',
    (args) => `\\text{Pol}\\left(${orBox(args[0])};\\,${orBox(args[1])}\\right)`
  );
  s = replaceBalancedCallToLatex(
    s,
    'Rec',
    (args) => `\\text{Rec}\\left(${orBox(args[0])};\\,${orBox(args[1])}\\right)`
  );
  s = replaceBalancedCallToLatex(
    s,
    'RanInt',
    (args) => `\\text{RanInt}\\#\\left(${orBox(args[0])};\\,${orBox(args[1])}\\right)`
  );

  if (!/\\[a-zA-Z]+/.test(s)) {
    s = friendlyMathToLatex(s);
  } else {
    // Even if LaTeX commands already exist from multi-arg calls, still convert surrounding sin/cos/sqrt/fractions
    s = s
      .replace(/\bsqrt\s*\(([^()]*)\)/gi, (_, inner: string) => `\\sqrt{${inner.trim() || '\\square'}}`)
      .replace(/\b(sin|cos|tan|cot|ln|log)\b/gi, (m) => `\\${m.toLowerCase()}`)
      .replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}');
  }

  s = s
    .replace(/÷R/gi, '\\;\\div R\\;')
    .replace(/(\d+)\s*C\s*(\d+)/g, 'C_{$1}^{$2}')
    .replace(/(\d+)\s*P\s*(\d+)/g, 'A_{$1}^{$2}')
    .replace(/\bPreAns\b/g, '\\text{PreAns}')
    .replace(/\bAns\b/g, '\\text{Ans}')
    .replace(/(?:\*|\\cdot)\s*10\^/g, ' \\times 10^');

  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Complex Number Evaluator (`MODE 2: CMPLX`) supporting `a + bi` arithmetic, polar `r∠θ`, `Abs`, `Conjg`, `Arg`, powers `i^3`.
 */
export function formatComplexLatex(c: CasioComplexValue, polar = false, angleUnit: CasioAngleUnit = 'D'): string {
  const re = Math.abs(c.re) < 1e-10 ? 0 : Number(c.re.toFixed(6));
  const im = Math.abs(c.im) < 1e-10 ? 0 : Number(c.im.toFixed(6));
  if (polar) {
    const r = Number(Math.hypot(re, im).toFixed(6));
    let ang = Math.atan2(im, re);
    if (angleUnit === 'D') ang = (ang * 180) / Math.PI;
    const angRounded = Number(ang.toFixed(4));
    return `${r}\\angle ${angRounded}${angleUnit === 'D' ? '^\\circ' : ''}`;
  }
  if (im === 0) return String(re);
  const imAbs = Math.abs(im);
  const imStr = imAbs === 1 ? 'i' : `${imAbs}i`;
  if (re === 0) return im < 0 ? `-${imStr}` : imStr;
  return `${re} ${im < 0 ? '-' : '+'} ${imStr}`;
}

export function evaluateCasioComplex(raw: string, angleUnit: CasioAngleUnit = 'D'): CasioComplexValue | null {
  let s = raw
    .replace(/\s+/g, '')
    .replace(/−|–/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/');
  if (!s) return null;

  // Insert implicit `*` between `)(`, `2(`, `)i`, `2i` handled as token
  s = s
    .replace(/\)\(/g, ')*(')
    .replace(/(\d)\(/g, '$1*(')
    .replace(/\)([0-9a-zA-Z])/g, ')*$1');

  let pos = 0;

  const parseExpr = (): CasioComplexValue | null => {
    let left = parseTerm();
    if (!left) return null;
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++];
      const right = parseTerm();
      if (!right) return null;
      left = op === '+' ? { re: left.re + right.re, im: left.im + right.im } : { re: left.re - right.re, im: left.im - right.im };
    }
    return left;
  };

  const parseTerm = (): CasioComplexValue | null => {
    let left = parseUnary();
    if (!left) return null;
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const right = parseUnary();
      if (!right) return null;
      if (op === '*') {
        left = { re: left.re * right.re - left.im * right.im, im: left.re * right.im + left.im * right.re };
      } else {
        const den = right.re * right.re + right.im * right.im;
        if (den < 1e-12) return null;
        left = {
          re: (left.re * right.re + left.im * right.im) / den,
          im: (left.im * right.re - left.re * right.im) / den,
        };
      }
    }
    return left;
  };

  const parseUnary = (): CasioComplexValue | null => {
    if (s[pos] === '+') {
      pos += 1;
      return parseUnary();
    }
    if (s[pos] === '-') {
      pos += 1;
      const inner = parseUnary();
      return inner ? { re: -inner.re, im: -inner.im } : null;
    }
    return parsePower();
  };

  const raiseComplex = (base: CasioComplexValue, n: number): CasioComplexValue | null => {
    if (!Number.isInteger(n)) return null;
    let res: CasioComplexValue = { re: 1, im: 0 };
    for (let k = 0; k < Math.abs(n); k += 1) {
      res = { re: res.re * base.re - res.im * base.im, im: res.re * base.im + res.im * base.re };
    }
    if (n < 0) {
      const den = res.re * res.re + res.im * res.im;
      if (den < 1e-12) return null;
      return { re: res.re / den, im: -res.im / den };
    }
    return res;
  };

  const parsePower = (): CasioComplexValue | null => {
    let base = parsePrimary();
    if (!base) return null;
    if (s[pos] === '∠') {
      pos += 1;
      const angAtom = parseUnary();
      if (!angAtom) return null;
      const rad = angleUnit === 'D' ? (angAtom.re * Math.PI) / 180 : angAtom.re;
      base = { re: base.re * Math.cos(rad), im: base.re * Math.sin(rad) };
    }
    if (s[pos] === '^') {
      pos += 1;
      const expVal = parseUnary();
      if (!expVal || Math.abs(expVal.im) > 1e-9) return null;
      return raiseComplex(base, Math.round(expVal.re));
    }
    return base;
  };

  const parsePrimary = (): CasioComplexValue | null => {
    // Function calls: Abs(...), Conjg(...), Arg(...), sqrt(...)
    const fnMatch = /^(Abs|abs|Conjg|conjg|Arg|arg|sqrt)\(/.exec(s.slice(pos));
    if (fnMatch) {
      const fn = fnMatch[1].toLowerCase();
      pos += fnMatch[0].length;
      const inner = parseExpr();
      if (!inner || s[pos] !== ')') return null;
      pos += 1;
      if (fn === 'abs') return { re: Math.hypot(inner.re, inner.im), im: 0 };
      if (fn === 'conjg') return { re: inner.re, im: -inner.im };
      if (fn === 'arg') {
        const rad = Math.atan2(inner.im, inner.re);
        return { re: angleUnit === 'D' ? (rad * 180) / Math.PI : rad, im: 0 };
      }
      if (fn === 'sqrt') {
        const r = Math.hypot(inner.re, inner.im);
        const theta = Math.atan2(inner.im, inner.re) / 2;
        return { re: Math.sqrt(r) * Math.cos(theta), im: Math.sqrt(r) * Math.sin(theta) };
      }
    }

    if (s[pos] === '(') {
      pos += 1;
      const inner = parseExpr();
      if (!inner || s[pos] !== ')') return null;
      pos += 1;
      return inner;
    }

    if (s[pos] === 'i') {
      pos += 1;
      return { re: 0, im: 1 };
    }

    const numMatch = /^\d+(?:\.\d+)?/.exec(s.slice(pos));
    if (numMatch) {
      pos += numMatch[0].length;
      const val = Number(numMatch[0]);
      if (s[pos] === 'i') {
        pos += 1;
        // Handle `3i^2` -> `3 * (i^2)`
        if (s[pos] === '^') {
          pos += 1;
          const expVal = parseUnary();
          if (!expVal) return null;
          const iPow = raiseComplex({ re: 0, im: 1 }, Math.round(expVal.re));
          return iPow ? { re: val * iPow.re, im: val * iPow.im } : null;
        }
        return { re: 0, im: val };
      }
      return { re: val, im: 0 };
    }
    return null;
  };

  const result = parseExpr();
  if (!result || pos !== s.length) return null;
  return result;
}

/**
 * Matrix Operations (`MODE 3: MATRIX`) for 2×2 & 3×3 matrices.
 */
export function computeMatrixDet(m: number[][]): number {
  if (m.length === 2) {
    return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  }
  if (m.length === 3) {
    return (
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    );
  }
  return NaN;
}

export function computeMatrixInverse(m: number[][]): number[][] | null {
  const det = computeMatrixDet(m);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10) return null;
  if (m.length === 2) {
    return [
      [m[1][1] / det, -m[0][1] / det],
      [-m[1][0] / det, m[0][0] / det],
    ];
  }
  const n = m.length;
  const inv: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const sub = m
        .filter((_, ri) => ri !== r)
        .map((row) => row.filter((_, ci) => ci !== c));
      const cofactor = ((r + c) % 2 === 0 ? 1 : -1) * computeMatrixDet(sub);
      inv[c][r] = cofactor / det;
    }
  }
  return inv;
}

export function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < n; k += 1) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out;
}

export function matrixToLatex(m: number[][]): string {
  const rows = m
    .map((row) =>
      row
        .map((v) => {
          const rep = formatCasioExact(v);
          return rep.hasExactForm ? rep.exactLatex : rep.decimalText;
        })
        .join(' & ')
    )
    .join(' \\\\ ');
  return `\\begin{pmatrix} ${rows} \\end{pmatrix}`;
}

/**
 * Vector Operations (`MODE 4: VECTOR`) for 2D / 3D vectors.
 */
export function computeVectorMetrics(u: number[], v: number[], angleUnit: CasioAngleUnit = 'D') {
  const len = Math.min(u.length, v.length);
  const sum = u.slice(0, len).map((val, i) => val + v[i]);
  const dot = u.slice(0, len).reduce((acc, val, i) => acc + val * v[i], 0);
  const magU = Math.hypot(...u.slice(0, len));
  const magV = Math.hypot(...v.slice(0, len));
  let angle = NaN;
  if (magU > 1e-10 && magV > 1e-10) {
    const cosA = Math.max(-1, Math.min(1, dot / (magU * magV)));
    const rad = Math.acos(cosA);
    angle = angleUnit === 'D' ? (rad * 180) / Math.PI : rad;
  }
  const cross =
    len === 3
      ? [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ]
      : [u[0] * v[1] - u[1] * v[0]];
  return { sum, dot, magU, magV, angle, cross };
}

/**
 * Solves a 2×2 linear system (`MODE 6 -> Hệ PT 2 ẩn`)
 */
export function solveLinearSystem2x2(
  a1: number,
  b1: number,
  c1: number,
  a2: number,
  b2: number,
  c2: number
): CasioSystem2x2Result {
  const det = a1 * b2 - a2 * b1;
  const detX = c1 * b2 - c2 * b1;
  const detY = a1 * c2 - a2 * c1;

  if (Math.abs(det) < 1e-10) {
    if (Math.abs(detX) < 1e-10 && Math.abs(detY) < 1e-10) {
      return { kind: 'infinite', summaryLatex: '\\text{Hệ vô số nghiệm}' };
    }
    return { kind: 'none', summaryLatex: '\\text{Hệ vô nghiệm}' };
  }

  const x = detX / det;
  const y = detY / det;
  const xRep = formatCasioExact(x);
  const yRep = formatCasioExact(y);

  return {
    kind: 'unique',
    x,
    y,
    xExactLatex: xRep.exactLatex,
    yExactLatex: yRep.exactLatex,
    summaryLatex: `x = ${xRep.exactLatex},\\quad y = ${yRep.exactLatex}`,
  };
}

/**
 * Solves a 3×3 linear system (`MODE 6 -> Hệ PT 3 ẩn`)
 */
export function solveLinearSystem3x3(rows: number[][]): CasioSystem3x3Result {
  if (rows.length !== 3 || rows.some((r) => r.length !== 4)) {
    return { kind: 'degenerate', summaryLatex: '\\text{Dữ liệu không hợp lệ}' };
  }
  const mat = rows.map((r) => r.slice(0, 3));
  const rhs = rows.map((r) => r[3]);
  const det = computeMatrixDet(mat);
  if (Math.abs(det) < 1e-10) {
    return { kind: 'degenerate', summaryLatex: '\\text{Hệ vô nghiệm hoặc vô số nghiệm}' };
  }
  const replaceCol = (colIdx: number) =>
    mat.map((row, ri) => row.map((val, ci) => (ci === colIdx ? rhs[ri] : val)));

  const x = computeMatrixDet(replaceCol(0)) / det;
  const y = computeMatrixDet(replaceCol(1)) / det;
  const z = computeMatrixDet(replaceCol(2)) / det;
  const xr = formatCasioExact(x);
  const yr = formatCasioExact(y);
  const zr = formatCasioExact(z);
  return {
    kind: 'unique',
    x,
    y,
    z,
    summaryLatex: `x=${xr.exactLatex},\\; y=${yr.exactLatex},\\; z=${zr.exactLatex}`,
  };
}

/**
 * Solves a cubic equation `ax³ + bx² + cx + d = 0` (`MODE 6 -> PT Bậc 3`)
 */
export function solveCubicEquation(a: number, b: number, c: number, d: number): CasioCubicResult {
  if (Math.abs(a) < 1e-10) {
    return { roots: [], summaryLatex: '\\text{Cần hệ số } a \\ne 0' };
  }
  const p = (3 * a * c - b * b) / (3 * a * a);
  const q = (2 * b ** 3 - 9 * a * b * c + 27 * a * a * d) / (27 * a ** 3);
  const disc = (q * q) / 4 + (p * p * p) / 27;
  const shift = -b / (3 * a);

  let roots: number[] = [];
  if (disc > 1e-10) {
    const sqrtD = Math.sqrt(disc);
    const t = Math.cbrt(-q / 2 + sqrtD) + Math.cbrt(-q / 2 - sqrtD) + shift;
    roots = [t];
  } else if (Math.abs(disc) <= 1e-10) {
    if (Math.abs(q) < 1e-10) {
      roots = [shift];
    } else {
      const t1 = 2 * Math.cbrt(-q / 2) + shift;
      const t2 = -Math.cbrt(-q / 2) + shift;
      roots = [t1, t2].sort((u, v) => u - v);
    }
  } else {
    const r = Math.sqrt((-p * p * p) / 27);
    const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const m = 2 * Math.cbrt(r);
    roots = [
      m * Math.cos(phi / 3) + shift,
      m * Math.cos((phi + 2 * Math.PI) / 3) + shift,
      m * Math.cos((phi + 4 * Math.PI) / 3) + shift,
    ].sort((u, v) => u - v);
  }

  const rootLatex = roots
    .map((rt, i) => {
      const rep = formatCasioExact(rt);
      return `x_{${i + 1}} = ${rep.hasExactForm ? rep.exactLatex : rep.decimalText}`;
    })
    .join(',\\; ');

  return {
    roots,
    complexNote: roots.length === 1 ? '1 nghiệm thực' : undefined,
    summaryLatex: rootLatex,
  };
}

/**
 * Solves quadratic inequality `ax² + bx + c (> | < | >= | <=) 0` (`MODE 7: BấtPT`)
 */
export function solveQuadraticInequality(
  a: number,
  b: number,
  c: number,
  op: '>' | '<' | '>=' | '<='
): CasioInequalityResult {
  if (Math.abs(a) < 1e-10) {
    return { summaryLatex: '\\text{Cần } a \\ne 0' };
  }
  const strict = op === '>' || op === '<';
  const wantPositive = op === '>' || op === '>=';
  const delta = b * b - 4 * a * c;

  if (delta < -1e-10) {
    const alwaysTrue = (a > 0 && wantPositive) || (a < 0 && !wantPositive);
    return { summaryLatex: alwaysTrue ? 'x \\in \\mathbb{R}' : '\\text{Vô nghiệm}' };
  }
  if (Math.abs(delta) <= 1e-10) {
    const r0 = formatCasioExact(-b / (2 * a));
    const rTex = r0.hasExactForm ? r0.exactLatex : r0.decimalText;
    const matchSame = (a > 0 && wantPositive) || (a < 0 && !wantPositive);
    if (matchSame) {
      return { summaryLatex: strict ? `x \\ne ${rTex}` : 'x \\in \\mathbb{R}' };
    }
    return { summaryLatex: strict ? '\\text{Vô nghiệm}' : `x = ${rTex}` };
  }

  const sD = Math.sqrt(delta);
  const r1 = (-b - sD) / (2 * a);
  const r2 = (-b + sD) / (2 * a);
  const lo = Math.min(r1, r2);
  const hi = Math.max(r1, r2);
  const loRep = formatCasioExact(lo);
  const hiRep = formatCasioExact(hi);
  const loTex = loRep.hasExactForm ? loRep.exactLatex : loRep.decimalText;
  const hiTex = hiRep.hasExactForm ? hiRep.exactLatex : hiRep.decimalText;

  const outside = (a > 0 && wantPositive) || (a < 0 && !wantPositive);
  const le = strict ? '<' : '\\le';
  const ge = strict ? '>' : '\\ge';

  if (outside) {
    return { summaryLatex: `x ${le} ${loTex} \\;\\text{hoặc}\\; x ${ge} ${hiTex}` };
  }
  return { summaryLatex: `${loTex} ${le} x ${le} ${hiTex}` };
}

/**
 * 1-Variable Descriptive Statistics (`MODE 8: Thống kê`)
 */
export function computeCasioStats1Var(values: number[]): CasioStats1VarResult | null {
  const clean = values.filter((v) => Number.isFinite(v));
  const n = clean.length;
  if (n === 0) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  const sumX = sorted.reduce((acc, v) => acc + v, 0);
  const sumX2 = sorted.reduce((acc, v) => acc + v * v, 0);
  const mean = sumX / n;
  const variancePop = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const varianceSample = n > 1 ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0;

  const getMed = (arr: number[]) => {
    const m = arr.length;
    if (m === 0) return 0;
    const mid = Math.floor(m / 2);
    return m % 2 === 1 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };
  const mid = Math.floor(n / 2);
  const lower = sorted.slice(0, mid);
  const upper = n % 2 === 1 ? sorted.slice(mid + 1) : sorted.slice(mid);

  return {
    n,
    mean,
    sumX,
    sumX2,
    popStd: Math.sqrt(variancePop),
    sampleStd: Math.sqrt(varianceSample),
    min: sorted[0],
    q1: lower.length > 0 ? getMed(lower) : sorted[0],
    median: getMed(sorted),
    q3: upper.length > 0 ? getMed(upper) : sorted[n - 1],
    max: sorted[n - 1],
  };
}
