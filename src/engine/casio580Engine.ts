import { evaluateMathExpression } from './mathUtils';
import { formatPrimeFactorizationLatex, friendlyMathToLatex } from './mathDisplay';

export type CasioAngleUnit = 'D' | 'R' | 'G';
export type CasioNormMode = 'NORM' | 'FIX' | 'SCI';
export type CasioDisplayFormat = 'exact' | 'decimal' | 'mixed' | 'dms' | 'eng';
export type CasioBaseMode = 'DEC' | 'HEX' | 'BIN' | 'OCT';
export type CasioVerifyOp = '=' | '!=' | '>' | '<' | '>=' | '<=';
export type CasioDistKind =
  | 'normalPD'
  | 'normalCD'
  | 'invNormal'
  | 'binomialPD'
  | 'binomialCD'
  | 'poissonPD'
  | 'poissonCD';

export function angleToRad(val: number, unit: CasioAngleUnit): number {
  if (unit === 'D') return (val * Math.PI) / 180;
  if (unit === 'G') return (val * Math.PI) / 200;
  return val;
}

export function radToAngle(rad: number, unit: CasioAngleUnit): number {
  if (unit === 'D') return (rad * 180) / Math.PI;
  if (unit === 'G') return (rad * 200) / Math.PI;
  return rad;
}

export function angleUnitSuffixLatex(unit: CasioAngleUnit): string {
  if (unit === 'D') return '^\\circ';
  if (unit === 'G') return '^g';
  return '';
}

export interface CasioBaseNResult {
  value: number;
  dec: string;
  hex: string;
  bin: string;
  oct: string;
}

export interface CasioSystem4x4Result {
  kind: 'unique' | 'degenerate';
  x?: number;
  y?: number;
  z?: number;
  t?: number;
  summaryLatex: string;
}

export interface CasioQuarticResult {
  roots: number[];
  complexCount: number;
  summaryLatex: string;
}

export interface CasioVerifyResult {
  isTrue: boolean;
  lhsVal: number;
  rhsVal: number;
  lhsLatex: string;
  rhsLatex: string;
  summaryLatex: string;
}

export interface CasioRatioResult {
  kind: 'ok' | 'error';
  value?: number;
  exactLatex?: string;
  decimalText?: string;
  summaryLatex: string;
}

export interface CasioDistResult {
  value: number;
  summaryLatex: string;
  label: string;
}

export interface CasioEqStepItem {
  label: string;
  exactLatex: string;
  decimalLatex: string;
  numeric?: number;
}

export interface CasioEqFullResult {
  kind: 'ok' | 'infinite' | 'none' | 'error';
  message?: string;
  steps: CasioEqStepItem[];
  summaryLatex: string;
}

export interface CasioExactRepresentation {
  numeric: number;
  decimalText: string;
  exactLatex: string;
  mixedLatex?: string;
  dmsText?: string;
  engLatex?: string;
  hasExactForm: boolean;
  specialSummaryLatex?: string;
  specialDecimalLatex?: string;
  secondaryVars?: Partial<Record<'x' | 'y' | 'r' | 'theta' | 'Q' | 'R', number>>;
}

export interface CasioSolveAllResult {
  roots: CasioExactRepresentation[];
  exactSummaryLatex: string;
  decimalSummaryLatex: string;
  hasMoreRoots: boolean;
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

export interface CasioLinRegResult {
  n: number;
  a: number;
  b: number;
  r: number;
  r2: number;
  meanX: number;
  meanY: number;
  summaryLatex: string;
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
  // Allow function calls preceded by numbers, signs, or variables (e.g. 3frac(1;2), 3sqrt(16), 3pow(2;3))
  const patternStr = fnName.toLowerCase() === 'int'
    ? '(?<![a-zA-Z])int\\s*\\('
    : `${fnName}\\s*\\(`;
  const regex = new RegExp(patternStr, 'i');
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
 * Converts a JS number into a parser-safe literal without scientific `e-7` notation
 * (so `mathUtils` never confuses `1.5e-7` with `1.5 * Math.E - 7`).
 */
function numToSafeLiteral(v: number): string {
  if (!Number.isFinite(v)) return 'NaN';
  if (Math.abs(v) < 1e-14) return '0';
  const str = String(v);
  if (!/[eE]/.test(str)) return str;
  const [mantissa, exp] = str.split(/[eE]/);
  return `(${mantissa}*10^(${Number(exp)}))`;
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

  // Normalize authentic Casio inverse-trig notation (`sin⁻¹(`, `cos⁻¹(`, `tan⁻¹(`, `cot⁻¹(`) before parsing
  s = s
    .replace(/sin\s*(?:⁻\s*¹|\^\s*-?\s*1)\s*\(/gi, 'asin(')
    .replace(/cos\s*(?:⁻\s*¹|\^\s*-?\s*1)\s*\(/gi, 'acos(')
    .replace(/tan\s*(?:⁻\s*¹|\^\s*-?\s*1)\s*\(/gi, 'atan(')
    .replace(/cot\s*(?:⁻\s*¹|\^\s*-?\s*1)\s*\(/gi, 'acot(');

  // Handle special 2-output commands first: Pol(x;y), Rec(r;θ), a ÷R b
  const polCall = findBalancedFunctionCall(s, 'Pol');
  if (polCall && polCall.start === 0 && polCall.end === s.length && polCall.args.length === 2) {
    const xv = evaluateCasioExpression(polCall.args[0], options)?.numeric;
    const yv = evaluateCasioExpression(polCall.args[1], options)?.numeric;
    if (xv === undefined || yv === undefined) return null;
    const r = Math.hypot(xv, yv);
    const theta = radToAngle(Math.atan2(yv, xv), options.angleUnit);
    const base = formatCasioExact(r, normMode, fixDigits);
    const rTex = base.hasExactForm ? base.exactLatex : base.decimalText;
    const tStr = formatDecimalForMode(theta, normMode, fixDigits);
    return {
      ...base,
      specialSummaryLatex: `r = ${rTex},\\; \\theta = ${tStr}${angleUnitSuffixLatex(options.angleUnit)}`,
      secondaryVars: { r, theta },
    };
  }

  const recCall = findBalancedFunctionCall(s, 'Rec');
  if (recCall && recCall.start === 0 && recCall.end === s.length && recCall.args.length === 2) {
    const rv = evaluateCasioExpression(recCall.args[0], options)?.numeric;
    const tv = evaluateCasioExpression(recCall.args[1], options)?.numeric;
    if (rv === undefined || tv === undefined) return null;
    const rad = angleToRad(tv, options.angleUnit);
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

  // Combinatorics MUST run before substituting single-letter variables (so `5C2` doesn't treat `C` as variable C)
  s = s.replace(/(\d+)\s*C\s*(\d+)/g, (_, n: string, r: string) => {
    const val = nCr(Number(n), Number(r));
    return Number.isFinite(val) ? String(val) : 'NaN';
  });
  s = s.replace(/(\d+)\s*P\s*(\d+)/g, (_, n: string, r: string) => {
    const val = nPr(Number(n), Number(r));
    return Number.isFinite(val) ? String(val) : 'NaN';
  });

  // Symbols & operators (use letter-only boundaries so implicit multiplication like `3x`, `2A`, `2Ans`, `2sin(30)` works!)
  s = s
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−|–/g, '-')
    .replace(/π/g, 'pi')
    .replace(/∞/g, '1000000')
    .replace(/√\(/g, 'sqrt(')
    .replace(/(?<![a-zA-Z])PreAns(?![a-zA-Z])/gi, `(${numToSafeLiteral(preAnsVal)})`)
    .replace(/(?<![a-zA-Z])Ans(?![a-zA-Z])/gi, `(${numToSafeLiteral(ansVal)})`)
    .replace(/(?<![a-zA-Z])M(?![a-zA-Z])/g, `(${numToSafeLiteral(vars.M ?? memVal)})`)
    .replace(/(?<![a-zA-Z])([ABCDFyzT])(?![a-zA-Z])/g, (_, vName: string) => `(${numToSafeLiteral(vars[vName] ?? 0)})`);

  if (options.xVal !== undefined) {
    s = s.replace(/(?<![a-zA-Z])x(?![a-zA-Z])/gi, `(${numToSafeLiteral(options.xVal)})`);
  } else if (vars.x !== undefined) {
    s = s.replace(/(?<![a-zA-Z])x(?![a-zA-Z])/gi, `(${numToSafeLiteral(vars.x)})`);
  }

  // Infix `a mod b`
  s = s.replace(/(-?\d+(?:\.\d+)?)\s*mod\s*(-?\d+(?:\.\d+)?)/gi, (_, a: string, b: string) => {
    const av = Number(a);
    const bv = Number(b);
    if (bv === 0) return 'NaN';
    return `(${((av % bv) + bv) % bv})`;
  });

  // Ceil / Intg aliases
  s = s.replace(/(?<![a-zA-Z])Ceil\s*\(/gi, 'ceil(').replace(/(?<![a-zA-Z])Intg\s*\(/gi, 'floor(');

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
    const res = radToAngle(rad, options.angleUnit);
    s = `${s.slice(0, call.start)}(${res})${s.slice(call.end)}`;
    guard += 1;
  }
  guard = 0;
  while (guard < 10) {
    const call = findBalancedFunctionCall(s, 'cot');
    if (!call || call.args.length < 1) break;
    const v = evaluateCasioExpression(call.args[0], options)?.numeric;
    if (v === undefined) return null;
    const rad = angleToRad(v, options.angleUnit);
    const t = Math.tan(rad);
    if (Math.abs(t) < 1e-12) return null;
    s = `${s.slice(0, call.start)}(${1 / t})${s.slice(call.end)}`;
    guard += 1;
  }

  // Convert trig functions when in Degree ('D') or Gradian ('G') mode
  if (options.angleUnit === 'D' || options.angleUnit === 'G') {
    const scaleDen = options.angleUnit === 'D' ? 180 : 200;
    guard = 0;
    while (guard < 12) {
      const m = /(?<![a-zA-Z])(asin|acos|atan)\s*\(([^()]+)\)/i.exec(s);
      if (!m) break;
      const fn = m[1].toLowerCase();
      const argVal = evaluateMathExpression(m[2], 0);
      if (argVal === null) return null;
      const rad = fn === 'asin' ? Math.asin(argVal) : fn === 'acos' ? Math.acos(argVal) : Math.atan(argVal);
      if (!Number.isFinite(rad)) return null;
      const converted = radToAngle(rad, options.angleUnit);
      s = `${s.slice(0, m.index)}(${converted})${s.slice(m.index + m[0].length)}`;
      guard += 1;
    }
    guard = 0;
    while (guard < 12) {
      const m = /(?<![a-zA-Z])(sin|cos|tan)\s*\(([^()]+)\)/i.exec(s);
      if (!m) break;
      const fn = m[1].toLowerCase();
      const argVal = evaluateMathExpression(m[2], 0);
      if (argVal === null) return null;
      const rad = (argVal * Math.PI) / scaleDen;
      const trigVal = fn === 'sin' ? Math.sin(rad) : fn === 'cos' ? Math.cos(rad) : Math.tan(rad);
      if (!Number.isFinite(trigVal)) return null;
      s = `${s.slice(0, m.index)}(${trigVal})${s.slice(m.index + m[0].length)}`;
      guard += 1;
    }
  }

  if (s.includes('NaN')) return null;

  const val = evaluateMathExpression(s, 0);
  if (val === null || !Number.isFinite(val)) return null;
  return formatCasioExact(val, normMode, fixDigits);
}

/**
 * Full real-root numerical equation SOLVE (`SHIFT` + `CALC`):
 * Finds ALL distinct real roots of `LHS = RHS` (or `expr = 0`) using:
 *  1) Multi-scale grid bracketing + bisection + Newton-Raphson polish (filters out vertical asymptotes),
 *  2) Local-minimum & multi-seed damped Newton search for even-multiplicity roots (e.g. `(x-2)^2 = 0`).
 */
export function solveCasioEquationAllRoots(
  equationRaw: string,
  options: CasioEvalOptions,
  initialGuess = 1
): CasioSolveAllResult | null {
  const parts = equationRaw.split('=');
  if (parts.length > 2) return null;
  const fExpr = parts.length === 2 ? `(${parts[0]}) - (${parts[1]})` : parts[0];
  if (!fExpr.trim()) return null;

  const evalF = (x: number): number => {
    const r = evaluateCasioExpression(fExpr, { ...options, xVal: x });
    return r ? r.numeric : NaN;
  };

  // Validate expression is not constant-unparseable everywhere
  const rawCandidates: { x: number; err: number }[] = [];

  const acceptRoot = (xVal: number) => {
    if (!Number.isFinite(xVal) || Math.abs(xVal) > 1e7) return;
    const xNorm = Math.abs(xVal) < 1e-8 ? 0 : xVal;
    const fx = evalF(xNorm);
    if (!Number.isFinite(fx) || Math.abs(fx) > 1e-5) return;
    // Guard against false roots near vertical asymptotes: verify nearby values aren't exploding
    const fLeft = evalF(xNorm - 1e-5);
    const fRight = evalF(xNorm + 1e-5);
    if (
      (Number.isFinite(fLeft) && Math.abs(fLeft) > 1e4) ||
      (Number.isFinite(fRight) && Math.abs(fRight) > 1e4)
    ) {
      return;
    }
    rawCandidates.push({ x: xNorm, err: Math.abs(fx) });
  };

  const polishNewton = (startX: number, maxIter = 50): number | null => {
    let x = startX;
    for (let iter = 0; iter < maxIter; iter += 1) {
      const fx = evalF(x);
      if (!Number.isFinite(fx)) return null;
      if (Math.abs(fx) < 1e-11) return x;
      const h = Math.max(1e-7, Math.abs(x) * 1e-7);
      const fPlus = evalF(x + h);
      const fMinus = evalF(x - h);
      if (!Number.isFinite(fPlus) || !Number.isFinite(fMinus)) return null;
      const dfx = (fPlus - fMinus) / (2 * h);
      if (!Number.isFinite(dfx) || Math.abs(dfx) < 1e-13) {
        return Math.abs(fx) < 1e-6 ? x : null;
      }
      let step = fx / dfx;
      if (Math.abs(step) > 50) step = Math.sign(step) * 50;
      const next = x - step;
      if (!Number.isFinite(next) || Math.abs(next) > 1e7) return null;
      x = next;
    }
    const finalFx = evalF(x);
    return Number.isFinite(finalFx) && Math.abs(finalFx) < 1e-5 ? x : null;
  };

  // Multi-scale scanning grid: dense near [-12, 12], medium in [-100, 100], coarse in [-1000, 1000]
  const gridSet = new Set<number>([initialGuess]);
  for (let i = -48; i <= 48; i += 1) gridSet.add(i * 0.25); // [-12, 12] step 0.25
  for (let v = -100; v <= 100; v += 2) gridSet.add(v);
  for (let v = -1000; v <= 1000; v += 25) gridSet.add(v);
  const grid = Array.from(gridSet).sort((a, b) => a - b);
  const fGrid = grid.map((x) => evalF(x));

  // 1) Sign-change bracketing + bisection + Newton polish
  for (let i = 0; i < grid.length; i += 1) {
    const fCur = fGrid[i];
    if (Number.isFinite(fCur) && Math.abs(fCur) < 1e-8) {
      acceptRoot(grid[i]);
    }
    if (i === grid.length - 1) continue;
    let lo = grid[i];
    let hi = grid[i + 1];
    let fLo = fCur;
    let fHi = fGrid[i + 1];
    if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) continue;
    if (fLo * fHi < 0) {
      for (let iter = 0; iter < 50; iter += 1) {
        const mid = (lo + hi) / 2;
        const fMid = evalF(mid);
        if (!Number.isFinite(fMid)) break;
        if (Math.abs(fMid) < 1e-11 || Math.abs(hi - lo) < 1e-12) {
          lo = mid;
          hi = mid;
          break;
        }
        if (fLo * fMid < 0) {
          hi = mid;
          fHi = fMid;
        } else {
          lo = mid;
          fLo = fMid;
        }
      }
      const mid = (lo + hi) / 2;
      const polished = polishNewton(mid, 15) ?? mid;
      acceptRoot(polished);
    }
  }

  // 2) Even-multiplicity roots & touching zeros (local minima of |f(x)|) + multi-seed Newton
  for (let i = 1; i < grid.length - 1; i += 1) {
    const a = Math.abs(fGrid[i - 1]);
    const b = Math.abs(fGrid[i]);
    const c = Math.abs(fGrid[i + 1]);
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && b <= a && b <= c && b < 2) {
      const polished = polishNewton(grid[i], 60);
      if (polished !== null) acceptRoot(polished);
    }
  }

  const extraSeeds = [initialGuess, 0, 0.5, -0.5, 1, -1, 2, -2, 5, -5, 10, -10];
  for (const seed of extraSeeds) {
    const polished = polishNewton(seed, 60);
    if (polished !== null) acceptRoot(polished);
  }

  if (rawCandidates.length === 0) return null;

  // 3) Deduplicate roots within tolerance 1e-4, keeping the candidate with smallest |f(x)|
  rawCandidates.sort((a, b) => a.x - b.x);
  const merged: { x: number; err: number }[] = [];
  for (const cand of rawCandidates) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(cand.x - last.x) < 1e-4) {
      if (cand.err < last.err) {
        merged[merged.length - 1] = cand;
      }
    } else {
      merged.push(cand);
    }
  }

  // Limit displayed roots if periodic equation has infinitely many roots (e.g. sin(x) = 0)
  const MAX_DISPLAY_ROOTS = 8;
  let hasMoreRoots = false;
  let selected = merged;
  if (merged.length > MAX_DISPLAY_ROOTS) {
    hasMoreRoots = true;
    selected = [...merged]
      .sort((a, b) => Math.abs(a.x) - Math.abs(b.x))
      .slice(0, MAX_DISPLAY_ROOTS)
      .sort((a, b) => a.x - b.x);
  }

  const roots = selected.map((r) => formatCasioExact(r.x, options.normMode, options.fixDigits));

  if (roots.length === 1) {
    const r0 = roots[0];
    return {
      roots,
      exactSummaryLatex: `x = ${r0.hasExactForm ? r0.exactLatex : r0.decimalText}`,
      decimalSummaryLatex: `x = ${r0.decimalText}`,
      hasMoreRoots,
    };
  }

  const exactSummaryLatex = roots
    .map((r, idx) => `x_{${idx + 1}} = ${r.hasExactForm ? r.exactLatex : r.decimalText}`)
    .join(',\\; ');
  const decimalSummaryLatex = roots
    .map((r, idx) => `x_{${idx + 1}} = ${r.decimalText}`)
    .join(',\\; ');

  return {
    roots,
    exactSummaryLatex,
    decimalSummaryLatex,
    hasMoreRoots,
  };
}

/**
 * Numerical equation SOLVE (`SHIFT` + `CALC`):
 * Returns the primary real root of `LHS = RHS` (or `expr = 0`) for backward compatibility.
 */
export function solveCasioEquation(
  equationRaw: string,
  options: CasioEvalOptions,
  initialGuess = 1
): CasioExactRepresentation | null {
  const all = solveCasioEquationAllRoots(equationRaw, options, initialGuess);
  if (!all || all.roots.length === 0) return null;
  // Prefer the root closest to initialGuess
  let best = all.roots[0];
  let bestDist = Math.abs(best.numeric - initialGuess);
  for (const r of all.roots) {
    const d = Math.abs(r.numeric - initialGuess);
    if (d < bestDist) {
      best = r;
      bestDist = d;
    }
  }
  return best;
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

  // Format authentic Casio inverse trig to LaTeX (`sin⁻¹(` or `asin(` -> `\sin^{-1}(`)
  s = s
    .replace(/(?<![a-zA-Z])(?:sin\s*⁻\s*¹|asin)\s*\(/gi, '\\sin^{-1}(')
    .replace(/(?<![a-zA-Z])(?:cos\s*⁻\s*¹|acos)\s*\(/gi, '\\cos^{-1}(')
    .replace(/(?<![a-zA-Z])(?:tan\s*⁻\s*¹|atan)\s*\(/gi, '\\tan^{-1}(')
    .replace(/(?<![a-zA-Z])(?:cot\s*⁻\s*¹|acot)\s*\(/gi, '\\cot^{-1}(');

  if (!/\\[a-zA-Z]+/.test(s)) {
    s = friendlyMathToLatex(s);
  } else {
    // Even if LaTeX commands already exist from multi-arg calls, still convert surrounding sin/cos/sqrt/fractions
    s = s
      .replace(/(?<![\\a-zA-Z])sqrt\s*\(([^()]*)\)/gi, (_, inner: string) => `\\sqrt{${inner.trim() || '\\square'}}`)
      .replace(/(?<![\\a-zA-Z])(sin|cos|tan|cot|ln|log)(?![a-zA-Z])/gi, (m) => `\\${m.toLowerCase()}`)
      .replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}');
  }

  s = s
    .replace(/÷R/gi, '\\;\\div R\\;')
    .replace(/(\d+)\s*C\s*(\d+)/g, 'C_{$1}^{$2}')
    .replace(/(\d+)\s*P\s*(\d+)/g, 'A_{$1}^{$2}')
    .replace(/\bPreAns\b/g, '\\text{PreAns}')
    .replace(/\bAns\b/g, '\\text{Ans}')
    .replace(/×/g, ' \\times ')
    .replace(/\*/g, ' \\times ')
    .replace(/÷/g, ' \\div ')
    .replace(/−/g, '-')
    .replace(/(?:\\times|\\cdot)\s*10\^/g, ' \\times 10^');

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
    const ang = radToAngle(Math.atan2(im, re), angleUnit);
    const angRounded = Number(ang.toFixed(4));
    return `${r}\\angle ${angRounded}${angleUnitSuffixLatex(angleUnit)}`;
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
      const rad = angleToRad(angAtom.re, angleUnit);
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
        return { re: radToAngle(rad, angleUnit), im: 0 };
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
 * Matrix Operations (`MODE 4: MATRIX`) for 2×2, 3×3 & 4×4 matrices.
 */
export function computeMatrixDet(m: number[][]): number {
  const n = m.length;
  if (n === 0 || m.some((row) => row.length !== n)) return NaN;
  if (n === 1) return m[0][0];
  if (n === 2) {
    return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  }
  if (n === 3) {
    return (
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    );
  }
  // Gaussian elimination with partial pivoting for n >= 4
  const a = m.map((row) => [...row]);
  let det = 1;
  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivotRow][col])) pivotRow = r;
    }
    if (Math.abs(a[pivotRow][col]) < 1e-12) return 0;
    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
      det = -det;
    }
    det *= a[col][col];
    for (let r = col + 1; r < n; r += 1) {
      const factor = a[r][col] / a[col][col];
      for (let c = col; c < n; c += 1) {
        a[r][c] -= factor * a[col][c];
      }
    }
  }
  return det;
}

export function computeMatrixInverse(m: number[][]): number[][] | null {
  const n = m.length;
  if (n === 0 || m.some((row) => row.length !== n)) return null;
  const det = computeMatrixDet(m);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10) return null;
  if (n === 2) {
    return [
      [m[1][1] / det, -m[0][1] / det],
      [-m[1][0] / det, m[0][0] / det],
    ];
  }
  // Gauss-Jordan elimination with partial pivoting (supports 3×3, 4×4, ...)
  const aug = m.map((row, ri) => [
    ...row,
    ...Array.from({ length: n }, (_, ci) => (ri === ci ? 1 : 0)),
  ]);
  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivotRow][col])) pivotRow = r;
    }
    if (Math.abs(aug[pivotRow][col]) < 1e-12) return null;
    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];
    }
    const pivot = aug[col][col];
    for (let c = 0; c < 2 * n; c += 1) aug[col][c] /= pivot;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let c = 0; c < 2 * n; c += 1) aug[r][c] -= factor * aug[col][c];
    }
  }
  return aug.map((row) => row.slice(n));
}

export function transposeMatrix(m: number[][]): number[][] {
  if (m.length === 0) return [];
  const cols = m[0].length;
  return Array.from({ length: cols }, (_, c) => m.map((row) => row[c]));
}

export function subtractMatrices(a: number[][], b: number[][]): number[][] {
  return a.map((row, ri) => row.map((v, ci) => v - (b[ri]?.[ci] ?? 0)));
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
    angle = radToAngle(rad, angleUnit);
  }
  const cross =
    len === 3
      ? [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ]
      : [u[0] * v[1] - u[1] * v[0]];
  const diff = u.slice(0, len).map((val, i) => val - v[i]);
  const unitU = magU > 1e-10 ? u.slice(0, len).map((val) => val / magU) : null;
  return { sum, diff, dot, magU, magV, angle, cross, unitU };
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

/**
 * Mode 6 → 2: Linear Regression (`y = a + bx`, correlation `r`, `r²`)
 */
export function computeCasioLinReg(pairs: { x: number; y: number }[]): CasioLinRegResult | null {
  const clean = pairs.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = clean.length;
  if (n < 2) return null;
  const sumX = clean.reduce((acc, p) => acc + p.x, 0);
  const sumY = clean.reduce((acc, p) => acc + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of clean) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (sxx < 1e-12) return null;
  const b = sxy / sxx;
  const a = meanY - b * meanX;
  const r = syy > 1e-12 ? sxy / Math.sqrt(sxx * syy) : 1;
  const r2 = r * r;
  const aStr = Number(a.toFixed(4));
  const bStr = Number(b.toFixed(4));
  const rStr = Number(r.toFixed(4));
  return {
    n,
    a,
    b,
    r,
    r2,
    meanX,
    meanY,
    summaryLatex: `y = ${aStr} ${bStr < 0 ? '-' : '+'} ${Math.abs(bStr)}x,\\; r = ${rStr}`,
  };
}

/**
 * Mode 3: Base-N Arithmetic & Conversion (32-bit signed integers: DEC, HEX, BIN, OCT)
 * Supports +, -, ×, ÷, (), AND, OR, XOR, XNOR, NOT, NEG and 0x/0b/0o prefixes.
 */
export function formatBaseN(int32: number): CasioBaseNResult {
  const v = int32 | 0;
  const u = v >>> 0;
  return {
    value: v,
    dec: String(v),
    hex: u.toString(16).toUpperCase(),
    bin: u.toString(2),
    oct: u.toString(8),
  };
}

export function evaluateCasioBaseN(raw: string, base: CasioBaseMode): CasioBaseNResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const radix = base === 'HEX' ? 16 : base === 'BIN' ? 2 : base === 'OCT' ? 8 : 10;
  const s = trimmed
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−|–/g, '-');

  type Tok =
    | { type: 'num'; val: number }
    | { type: 'op'; val: string }
    | { type: 'lparen' }
    | { type: 'rparen' };

  const tokens: Tok[] = [];
  let i = 0;
  const validDigitForBase = (ch: string, r: number): boolean => {
    const code = ch.toUpperCase();
    if (r === 2) return code === '0' || code === '1';
    if (r === 8) return code >= '0' && code <= '7';
    if (r === 10) return code >= '0' && code <= '9';
    return (code >= '0' && code <= '9') || (code >= 'A' && code <= 'F');
  };

  while (i < s.length) {
    if (/\s/.test(s[i])) {
      i += 1;
      continue;
    }
    if (s[i] === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (s[i] === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (['+', '-', '*', '/', '&', '|', '^', '~'].includes(s[i])) {
      const opMap: Record<string, string> = {
        '&': 'AND',
        '|': 'OR',
        '^': 'XOR',
        '~': 'NOT',
      };
      tokens.push({ type: 'op', val: opMap[s[i]] ?? s[i] });
      i += 1;
      continue;
    }

    // Explicit prefixes: 0x..., 0b..., 0o...
    const prefMatch = /^0([xXbBoO])([0-9a-fA-F]+)/.exec(s.slice(i));
    if (prefMatch) {
      const pChar = prefMatch[1].toLowerCase();
      const pRadix = pChar === 'x' ? 16 : pChar === 'b' ? 2 : 8;
      const digits = prefMatch[2];
      for (const ch of digits) {
        if (!validDigitForBase(ch, pRadix)) return null;
      }
      const parsed = parseInt(digits, pRadix);
      if (!Number.isFinite(parsed)) return null;
      tokens.push({ type: 'num', val: parsed | 0 });
      i += prefMatch[0].length;
      continue;
    }

    // Keyword operators: XNOR, XOR, AND, OR, NOT, NEG (must not consume valid hex digits unless followed by boundary)
    const kwMatch = /^(XNOR|XOR|AND|OR|NOT|NEG)\b/i.exec(s.slice(i));
    if (kwMatch) {
      tokens.push({ type: 'op', val: kwMatch[1].toUpperCase() });
      i += kwMatch[0].length;
      continue;
    }

    // Number in active radix
    let start = i;
    while (i < s.length && validDigitForBase(s[i], radix)) {
      i += 1;
    }
    if (i > start) {
      const parsed = parseInt(s.slice(start, i), radix);
      if (!Number.isFinite(parsed)) return null;
      tokens.push({ type: 'num', val: parsed | 0 });
      continue;
    }
    return null;
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  // Precedence (Casio Base-N): () -> NOT/NEG/unary -> * / -> + - -> AND -> XOR/XNOR -> OR
  const parseOr = (): number | null => {
    let left = parseXor();
    if (left === null) return null;
    while (peek()?.type === 'op' && (peek() as { type: 'op'; val: string }).val === 'OR') {
      consume();
      const right = parseXor();
      if (right === null) return null;
      left = (left | right) | 0;
    }
    return left;
  };

  const parseXor = (): number | null => {
    let left = parseAnd();
    if (left === null) return null;
    while (
      peek()?.type === 'op' &&
      ((peek() as { type: 'op'; val: string }).val === 'XOR' ||
        (peek() as { type: 'op'; val: string }).val === 'XNOR')
    ) {
      const op = (consume() as { type: 'op'; val: string }).val;
      const right = parseAnd();
      if (right === null) return null;
      left = op === 'XOR' ? (left ^ right) | 0 : ~(left ^ right) | 0;
    }
    return left;
  };

  const parseAnd = (): number | null => {
    let left = parseAddSub();
    if (left === null) return null;
    while (peek()?.type === 'op' && (peek() as { type: 'op'; val: string }).val === 'AND') {
      consume();
      const right = parseAddSub();
      if (right === null) return null;
      left = (left & right) | 0;
    }
    return left;
  };

  const parseAddSub = (): number | null => {
    let left = parseMulDiv();
    if (left === null) return null;
    while (
      peek()?.type === 'op' &&
      ((peek() as { type: 'op'; val: string }).val === '+' ||
        (peek() as { type: 'op'; val: string }).val === '-')
    ) {
      const op = (consume() as { type: 'op'; val: string }).val;
      const right = parseMulDiv();
      if (right === null) return null;
      left = op === '+' ? (left + right) | 0 : (left - right) | 0;
    }
    return left;
  };

  const parseMulDiv = (): number | null => {
    let left = parseUnary();
    if (left === null) return null;
    while (
      peek()?.type === 'op' &&
      ((peek() as { type: 'op'; val: string }).val === '*' ||
        (peek() as { type: 'op'; val: string }).val === '/')
    ) {
      const op = (consume() as { type: 'op'; val: string }).val;
      const right = parseUnary();
      if (right === null) return null;
      if (op === '*') {
        left = Math.imul(left, right) | 0;
      } else {
        if (right === 0) return null;
        left = Math.trunc(left / right) | 0;
      }
    }
    return left;
  };

  const parseUnary = (): number | null => {
    const t = peek();
    if (t?.type === 'op') {
      if (t.val === '+') {
        consume();
        return parseUnary();
      }
      if (t.val === '-' || t.val === 'NEG') {
        consume();
        const inner = parseUnary();
        return inner === null ? null : -inner | 0;
      }
      if (t.val === 'NOT') {
        consume();
        const inner = parseUnary();
        return inner === null ? null : ~inner | 0;
      }
    }
    return parsePrimary();
  };

  const parsePrimary = (): number | null => {
    const t = peek();
    if (!t) return null;
    if (t.type === 'lparen') {
      consume();
      const inner = parseOr();
      if (inner === null || peek()?.type !== 'rparen') return null;
      consume();
      return inner;
    }
    if (t.type === 'num') {
      consume();
      return t.val | 0;
    }
    return null;
  };

  const out = parseOr();
  if (out === null || pos !== tokens.length) return null;
  return formatBaseN(out);
}

/**
 * Mode 7: Probability Distributions (Normal PD/CD, Inverse Normal, Binomial PD/CD, Poisson PD/CD)
 */
function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t) *
      Math.exp(-ax * ax);
  return sign * y;
}

function standardNormalCDF(z: number): number {
  return 0.5 * (1 + erfApprox(z / Math.SQRT2));
}

/**
 * Acklam's rational approximation for inverse standard normal CDF (accuracy ~1e-9).
 */
function inverseStandardNormal(p: number): number {
  if (p <= 0 || p >= 1) return NaN;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

function logFactorial(n: number): number {
  let sum = 0;
  for (let i = 2; i <= n; i += 1) sum += Math.log(i);
  return sum;
}

function binomialPMF(k: number, n: number, p: number): number {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n < 0 || k < 0 || k > n || p < 0 || p > 1) {
    return NaN;
  }
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  const logComb = logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  return Math.exp(logComb + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

function poissonPMF(k: number, lambda: number): number {
  if (!Number.isInteger(k) || k < 0 || lambda <= 0) return NaN;
  return Math.exp(k * Math.log(lambda) - lambda - logFactorial(k));
}

export interface CasioDistInput {
  kind: CasioDistKind;
  x?: number;
  lower?: number;
  upper?: number;
  mu?: number;
  sigma?: number;
  area?: number;
  n?: number;
  p?: number;
  lambda?: number;
}

export function computeCasioDistribution(input: CasioDistInput): CasioDistResult | null {
  const { kind } = input;
  let value = NaN;
  let label = '';

  if (kind === 'normalPD') {
    const x = input.x ?? 0;
    const mu = input.mu ?? 0;
    const sigma = input.sigma ?? 1;
    if (!Number.isFinite(sigma) || sigma <= 0) return null;
    const z = (x - mu) / sigma;
    value = Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
    label = `Normal\\;PD(${x})`;
  } else if (kind === 'normalCD') {
    const lower = input.lower ?? -1;
    const upper = input.upper ?? 1;
    const mu = input.mu ?? 0;
    const sigma = input.sigma ?? 1;
    if (!Number.isFinite(sigma) || sigma <= 0 || upper < lower) return null;
    value = standardNormalCDF((upper - mu) / sigma) - standardNormalCDF((lower - mu) / sigma);
    label = `P(${lower} \\le X \\le ${upper})`;
  } else if (kind === 'invNormal') {
    const area = input.area ?? 0.95;
    const mu = input.mu ?? 0;
    const sigma = input.sigma ?? 1;
    if (!Number.isFinite(sigma) || sigma <= 0 || area <= 0 || area >= 1) return null;
    value = mu + sigma * inverseStandardNormal(area);
    label = `\\text{InvNorm}(${area})`;
  } else if (kind === 'binomialPD') {
    const k = Math.round(input.x ?? 0);
    const n = Math.round(input.n ?? 10);
    const p = input.p ?? 0.5;
    if (n > 2000) return null;
    value = binomialPMF(k, n, p);
    label = `P(X = ${k})`;
  } else if (kind === 'binomialCD') {
    const k = Math.round(input.x ?? 0);
    const n = Math.round(input.n ?? 10);
    const p = input.p ?? 0.5;
    if (n < 0 || n > 2000 || k < 0 || k > n || p < 0 || p > 1) return null;
    let sum = 0;
    for (let i = 0; i <= k; i += 1) sum += binomialPMF(i, n, p);
    value = Math.min(1, sum);
    label = `P(X \\le ${k})`;
  } else if (kind === 'poissonPD') {
    const k = Math.round(input.x ?? 0);
    const lambda = input.lambda ?? 1;
    if (k < 0 || k > 2000 || lambda <= 0) return null;
    value = poissonPMF(k, lambda);
    label = `P(X = ${k})`;
  } else if (kind === 'poissonCD') {
    const k = Math.round(input.x ?? 0);
    const lambda = input.lambda ?? 1;
    if (k < 0 || k > 2000 || lambda <= 0) return null;
    let sum = 0;
    for (let i = 0; i <= k; i += 1) sum += poissonPMF(i, lambda);
    value = Math.min(1, sum);
    label = `P(X \\le ${k})`;
  }

  if (!Number.isFinite(value)) return null;
  const formatted = Number(value.toFixed(6));
  return {
    value,
    label,
    summaryLatex: `${label} \\approx ${formatted}`,
  };
}

/**
 * Mode 9: 4×4 Linear System (`Hệ PT 4 ẩn` — đặc trưng của Casio fx-580VN X)
 */
export function solveLinearSystem4x4(rows: number[][]): CasioSystem4x4Result {
  if (rows.length !== 4 || rows.some((r) => r.length !== 5)) {
    return { kind: 'degenerate', summaryLatex: '\\text{Dữ liệu không hợp lệ}' };
  }
  const n = 4;
  const aug = rows.map((r) => [...r]);
  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivotRow][col])) pivotRow = r;
    }
    if (Math.abs(aug[pivotRow][col]) < 1e-10) {
      return { kind: 'degenerate', summaryLatex: '\\text{Hệ vô nghiệm hoặc vô số nghiệm}' };
    }
    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];
    }
    const pivot = aug[col][col];
    for (let c = col; c <= n; c += 1) aug[col][c] /= pivot;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let c = col; c <= n; c += 1) aug[r][c] -= factor * aug[col][c];
    }
  }
  const [x, y, z, t] = [aug[0][4], aug[1][4], aug[2][4], aug[3][4]];
  const xr = formatCasioExact(x);
  const yr = formatCasioExact(y);
  const zr = formatCasioExact(z);
  const tr = formatCasioExact(t);
  return {
    kind: 'unique',
    x,
    y,
    z,
    t,
    summaryLatex: `x=${xr.exactLatex},\\; y=${yr.exactLatex},\\; z=${zr.exactLatex},\\; t=${tr.exactLatex}`,
  };
}

/**
 * Mode 9: Quartic Equation `ax⁴ + bx³ + cx² + dx + e = 0` (`PT bậc 4` — đặc trưng fx-580VN X)
 * Uses Durand-Kerner complex iteration to find all roots accurately, then extracts real roots.
 */
export function solveQuarticEquation(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number
): CasioQuarticResult {
  if (Math.abs(a) < 1e-10) {
    const cub = solveCubicEquation(b, c, d, e);
    return {
      roots: cub.roots,
      complexCount: cub.roots.length === 1 ? 2 : 0,
      summaryLatex: cub.summaryLatex,
    };
  }
  // Normalize to monic: z⁴ + p z³ + q z² + r z + s = 0
  const p = b / a;
  const q = c / a;
  const r = d / a;
  const s = e / a;

  const evalPoly = (z: CasioComplexValue): CasioComplexValue => {
    const mul = (u: CasioComplexValue, v: CasioComplexValue): CasioComplexValue => ({
      re: u.re * v.re - u.im * v.im,
      im: u.re * v.im + u.im * v.re,
    });
    const addR = (u: CasioComplexValue, k: number): CasioComplexValue => ({ re: u.re + k, im: u.im });
    let acc: CasioComplexValue = { re: 1, im: 0 };
    acc = addR(mul(acc, z), p);
    acc = addR(mul(acc, z), q);
    acc = addR(mul(acc, z), r);
    acc = addR(mul(acc, z), s);
    return acc;
  };

  const cSub = (u: CasioComplexValue, v: CasioComplexValue): CasioComplexValue => ({
    re: u.re - v.re,
    im: u.im - v.im,
  });
  const cMul = (u: CasioComplexValue, v: CasioComplexValue): CasioComplexValue => ({
    re: u.re * v.re - u.im * v.im,
    im: u.re * v.im + u.im * v.re,
  });
  const cDiv = (u: CasioComplexValue, v: CasioComplexValue): CasioComplexValue => {
    const den = v.re * v.re + v.im * v.im;
    if (den < 1e-18) return { re: 0, im: 0 };
    return { re: (u.re * v.re + u.im * v.im) / den, im: (u.im * v.re - u.re * v.im) / den };
  };

  // Asymmetric initial guesses on a circle of radius R
  const radius = 1 + Math.max(Math.abs(p), Math.abs(q), Math.abs(r), Math.abs(s));
  const rootsC: CasioComplexValue[] = [0, 1, 2, 3].map((k) => {
    const ang = (2 * Math.PI * k) / 4 + 0.37;
    return { re: radius * Math.cos(ang) - p / 4, im: radius * Math.sin(ang) };
  });

  for (let iter = 0; iter < 120; iter += 1) {
    let maxStep = 0;
    for (let i = 0; i < 4; i += 1) {
      const fz = evalPoly(rootsC[i]);
      let denom: CasioComplexValue = { re: 1, im: 0 };
      for (let j = 0; j < 4; j += 1) {
        if (i !== j) denom = cMul(denom, cSub(rootsC[i], rootsC[j]));
      }
      const step = cDiv(fz, denom);
      rootsC[i] = cSub(rootsC[i], step);
      maxStep = Math.max(maxStep, Math.hypot(step.re, step.im));
    }
    if (maxStep < 1e-12) break;
  }

  const realRaw = rootsC
    .filter((z) => Math.abs(z.im) < 1e-5)
    .map((z) => (Math.abs(z.re) < 1e-9 ? 0 : z.re))
    .sort((u, v) => u - v);

  // Deduplicate repeated roots (within 1e-4)
  const uniqueReal: number[] = [];
  for (const rt of realRaw) {
    if (uniqueReal.length === 0 || Math.abs(rt - uniqueReal[uniqueReal.length - 1]) > 1e-4) {
      uniqueReal.push(rt);
    }
  }
  const complexCount = 4 - realRaw.length;

  if (uniqueReal.length === 0) {
    return { roots: [], complexCount: 4, summaryLatex: '\\text{Vô nghiệm thực}' };
  }

  const summaryLatex = uniqueReal
    .map((rt, idx) => {
      const rep = formatCasioExact(rt);
      return `x_{${idx + 1}} = ${rep.hasExactForm ? rep.exactLatex : rep.decimalText}`;
    })
    .join(',\\; ');

  return {
    roots: uniqueReal,
    complexCount,
    summaryLatex,
  };
}

/**
 * Mode A: Cubic Inequality `ax³ + bx² + cx + d (> | < | >= | <=) 0` (chuẩn Casio fx-580VN X)
 */
export function solveCubicInequality(
  a: number,
  b: number,
  c: number,
  d: number,
  op: '>' | '<' | '>=' | '<='
): CasioInequalityResult {
  if (Math.abs(a) < 1e-10) {
    return solveQuadraticInequality(b, c, d, op);
  }
  const strict = op === '>' || op === '<';
  const wantPositive = op === '>' || op === '>=';
  const f = (x: number) => ((a * x + b) * x + c) * x + d;
  const satisfies = (val: number) => (wantPositive ? val > 1e-9 : val < -1e-9);

  const cub = solveCubicEquation(a, b, c, d);
  const pts: number[] = [];
  for (const r of cub.roots) {
    if (pts.length === 0 || Math.abs(r - pts[pts.length - 1]) > 1e-5) {
      pts.push(r);
    }
  }

  // Test sign in each open interval divided by real roots
  const intervals: { lo: number; hi: number }[] = [];
  const bounds = [-Infinity, ...pts, Infinity];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const lo = bounds[i];
    const hi = bounds[i + 1];
    let sample: number;
    if (lo === -Infinity && hi === Infinity) sample = 0;
    else if (lo === -Infinity) sample = hi - 1;
    else if (hi === Infinity) sample = lo + 1;
    else sample = (lo + hi) / 2;
    if (satisfies(f(sample))) {
      intervals.push({ lo, hi });
    }
  }

  // Merge adjacent intervals if non-strict (<= or >=), and collect isolated roots if non-strict
  const merged: { lo: number; hi: number }[] = [];
  for (const iv of intervals) {
    if (!strict && merged.length > 0 && Math.abs(merged[merged.length - 1].hi - iv.lo) < 1e-5) {
      merged[merged.length - 1].hi = iv.hi;
    } else {
      merged.push({ ...iv });
    }
  }

  const fmt = (v: number) => {
    const rep = formatCasioExact(v);
    return rep.hasExactForm ? rep.exactLatex : rep.decimalText;
  };
  const lt = strict ? '<' : '\\le';
  const gt = strict ? '>' : '\\ge';

  const parts: string[] = [];
  for (const iv of merged) {
    if (iv.lo === -Infinity && iv.hi === Infinity) {
      return { summaryLatex: 'x \\in \\mathbb{R}' };
    }
    if (iv.lo === -Infinity) {
      parts.push(`x ${lt} ${fmt(iv.hi)}`);
    } else if (iv.hi === Infinity) {
      parts.push(`x ${gt} ${fmt(iv.lo)}`);
    } else {
      parts.push(`${fmt(iv.lo)} ${lt} x ${lt} ${fmt(iv.hi)}`);
    }
  }

  if (!strict) {
    for (const r of pts) {
      const covered = merged.some(
        (iv) => (r >= iv.lo - 1e-5 && r <= iv.hi + 1e-5)
      );
      if (!covered) {
        parts.push(`x = ${fmt(r)}`);
      }
    }
  }

  if (parts.length === 0) {
    return { summaryLatex: '\\text{Vô nghiệm}' };
  }
  return { summaryLatex: parts.join('\\;\\text{hoặc}\\;') };
}

/**
 * Mode B: Verify (`Đúng / Sai`) — evaluates LHS and RHS and checks relation
 */
export function evaluateCasioVerify(
  lhsRaw: string,
  op: CasioVerifyOp,
  rhsRaw: string,
  options: CasioEvalOptions
): CasioVerifyResult | null {
  const lhs = evaluateCasioExpression(lhsRaw, options);
  const rhs = evaluateCasioExpression(rhsRaw, options);
  if (!lhs || !rhs) return null;
  const diff = lhs.numeric - rhs.numeric;
  const tol = 1e-8;
  let isTrue = false;
  if (op === '=') isTrue = Math.abs(diff) <= tol;
  else if (op === '!=') isTrue = Math.abs(diff) > tol;
  else if (op === '>') isTrue = diff > tol;
  else if (op === '<') isTrue = diff < -tol;
  else if (op === '>=') isTrue = diff >= -tol;
  else if (op === '<=') isTrue = diff <= tol;

  const opTex =
    op === '!=' ? '\\ne' : op === '>=' ? '\\ge' : op === '<=' ? '\\le' : op;
  const lhsTex = lhs.hasExactForm ? lhs.exactLatex : lhs.decimalText;
  const rhsTex = rhs.hasExactForm ? rhs.exactLatex : rhs.decimalText;
  return {
    isTrue,
    lhsVal: lhs.numeric,
    rhsVal: rhs.numeric,
    lhsLatex: lhsTex,
    rhsLatex: rhsTex,
    summaryLatex: `${lhsTex} ${opTex} ${rhsTex} \\Rightarrow \\text{${isTrue ? 'TRUE (Đúng)' : 'FALSE (Sai)'}}`,
  };
}

/**
 * Mode C: Ratio (`Tỉ lệ thức`) — solves `a : b = X : d` (`unknown = 'c'`) or `a : b = c : X` (`unknown = 'd'`)
 */
export function solveCasioRatio(
  a: number,
  b: number,
  c: number,
  d: number,
  unknown: 'c' | 'd'
): CasioRatioResult {
  if (unknown === 'c') {
    if (!Number.isFinite(b) || Math.abs(b) < 1e-12) {
      return { kind: 'error', summaryLatex: '\\text{Math ERROR (}b = 0\\text{)}' };
    }
    const val = (a * d) / b;
    const rep = formatCasioExact(val);
    const valTex = rep.hasExactForm ? rep.exactLatex : rep.decimalText;
    return {
      kind: 'ok',
      value: val,
      exactLatex: rep.exactLatex,
      decimalText: rep.decimalText,
      summaryLatex: `X = ${valTex}`,
    };
  }
  if (!Number.isFinite(a) || Math.abs(a) < 1e-12) {
    return { kind: 'error', summaryLatex: '\\text{Math ERROR (}a = 0\\text{)}' };
  }
  const val = (b * c) / a;
  const rep = formatCasioExact(val);
  const valTex = rep.hasExactForm ? rep.exactLatex : rep.decimalText;
  return {
    kind: 'ok',
    value: val,
    exactLatex: rep.exactLatex,
    decimalText: rep.decimalText,
    summaryLatex: `X = ${valTex}`,
  };
}

/**
 * Evaluates a coefficient cell in Mode 9 (supports plain decimals as well as fractions/expressions like `1/2`, `-sqrt(2)`).
 */
export function parseCasioCoeff(raw: string): number {
  const cleaned = raw.trim().replace(/−/g, '-');
  if (!cleaned || cleaned === '-') return 0;
  const direct = Number(cleaned);
  if (Number.isFinite(direct)) return direct;
  const evald = evaluateCasioExpression(cleaned, { angleUnit: 'D' });
  return evald && Number.isFinite(evald.numeric) ? evald.numeric : 0;
}

function simplifySquareFree(n: number): { out: number; rad: number } {
  const absN = Math.round(Math.abs(n));
  if (absN <= 1) return { out: absN, rad: absN === 0 ? 0 : 1 };
  let out = 1;
  let rem = absN;
  for (let d = 2; d * d <= rem; d += d === 2 ? 1 : 2) {
    while (rem % (d * d) === 0) {
      out *= d;
      rem /= d * d;
    }
  }
  return { out, rad: rem };
}

function formatQuadraticExactRoot(
  a: number,
  b: number,
  disc: number,
  sign: 1 | -1
): { exactLatex: string; decimalLatex: string } {
  const twoA = 2 * a;
  const isIntCoeff =
    Math.abs(a - Math.round(a)) < 1e-9 &&
    Math.abs(b - Math.round(b)) < 1e-9 &&
    Math.abs(disc - Math.round(disc)) < 1e-9 &&
    Math.abs(disc) <= 1e7;

  if (disc >= 0) {
    const val = (-b + sign * Math.sqrt(disc)) / twoA;
    const dec = formatDecimalForMode(val, 'NORM');
    if (isIntCoeff) {
      const bi = Math.round(b);
      const ai = Math.round(a);
      const di = Math.round(disc);
      const { out, rad } = simplifySquareFree(di);
      if (rad === 1 || rad === 0) {
        const rep = formatCasioExact(val);
        return { exactLatex: rep.hasExactForm ? rep.exactLatex : dec, decimalLatex: dec };
      }
      // (-bi + sign * out * sqrt(rad)) / (2 * ai)
      let p = -bi;
      let q = sign * out;
      let den = 2 * ai;
      if (den < 0) {
        p = -p;
        q = -q;
        den = -den;
      }
      const g = gcdInt(gcdInt(Math.abs(p), Math.abs(q)), den);
      p /= g;
      q /= g;
      den /= g;
      const absQ = Math.abs(q);
      const surdTerm = absQ === 1 ? `\\sqrt{${rad}}` : `${absQ}\\sqrt{${rad}}`;
      let numLatex = '';
      if (p === 0) {
        numLatex = q < 0 ? `-${surdTerm}` : surdTerm;
      } else {
        numLatex = `${p} ${q < 0 ? '-' : '+'} ${surdTerm}`;
      }
      const exactLatex = den === 1 ? numLatex : `\\frac{${numLatex}}{${den}}`;
      return { exactLatex, decimalLatex: dec };
    }
    const rep = formatCasioExact(val);
    return { exactLatex: rep.hasExactForm ? rep.exactLatex : dec, decimalLatex: dec };
  }

  // Complex conjugate root: re ± im·i
  const re = -b / twoA;
  const im = (sign * Math.sqrt(-disc)) / Math.abs(twoA);
  const reDec = Math.abs(re) < 1e-10 ? 0 : Number(re.toFixed(6));
  const imDec = Math.abs(im) < 1e-10 ? 0 : Number(im.toFixed(6));
  const decStr = formatComplexLatex({ re: reDec, im: imDec });

  if (isIntCoeff) {
    const ai = Math.round(a);
    const bi = Math.round(b);
    const absDisc = Math.round(-disc);
    const { out, rad } = simplifySquareFree(absDisc);
    const denRaw = Math.abs(2 * ai);
    const reNumRaw = ai < 0 ? bi : -bi;
    const gRe = gcdInt(Math.abs(reNumRaw), denRaw);
    const reN = reNumRaw / gRe;
    const reD = denRaw / gRe;
    const reTex = reN === 0 ? '' : reD === 1 ? String(reN) : `\\frac{${reN}}{${reD}}`;

    const gIm = gcdInt(out, denRaw);
    const imN = out / gIm;
    const imD = denRaw / gIm;
    let imMagTex = '';
    if (rad === 1) {
      imMagTex = imD === 1 ? (imN === 1 ? '' : String(imN)) : `\\frac{${imN}}{${imD}}`;
    } else {
      const s = imN === 1 ? `\\sqrt{${rad}}` : `${imN}\\sqrt{${rad}}`;
      imMagTex = imD === 1 ? s : `\\frac{${s}}{${imD}}`;
    }
    const imSign = sign > 0 ? '+' : '-';
    const exactLatex = !reTex
      ? `${sign < 0 ? '-' : ''}${imMagTex}i`
      : `${reTex} ${imSign} ${imMagTex}i`;
    return { exactLatex, decimalLatex: decStr };
  }

  const reRep = formatCasioExact(re);
  const imRep = formatCasioExact(Math.abs(im));
  const reTex = Math.abs(re) < 1e-10 ? '' : reRep.hasExactForm ? reRep.exactLatex : reRep.decimalText;
  const imMagTex =
    Math.abs(Math.abs(im) - 1) < 1e-8
      ? ''
      : imRep.hasExactForm
        ? imRep.exactLatex
        : imRep.decimalText;
  const exactLatex = !reTex
    ? `${im < 0 ? '-' : ''}${imMagTex}i`
    : `${reTex} ${im < 0 ? '-' : '+'} ${imMagTex}i`;
  return { exactLatex, decimalLatex: decStr };
}

function makeRealStep(label: string, val: number): CasioEqStepItem {
  const clean = Math.abs(val) < 1e-10 ? 0 : val;
  const rep = formatCasioExact(clean);
  return {
    label,
    exactLatex: rep.hasExactForm ? rep.exactLatex : rep.decimalText,
    decimalLatex: rep.decimalText,
    numeric: clean,
  };
}

function makeComplexStep(label: string, re: number, im: number): CasioEqStepItem {
  const rClean = Math.abs(re) < 1e-9 ? 0 : re;
  const iClean = Math.abs(im) < 1e-9 ? 0 : im;
  if (iClean === 0) return makeRealStep(label, rClean);
  const reRep = formatCasioExact(rClean);
  const imRep = formatCasioExact(Math.abs(iClean));
  const reTex = rClean === 0 ? '' : reRep.hasExactForm ? reRep.exactLatex : reRep.decimalText;
  const imMagTex =
    Math.abs(Math.abs(iClean) - 1) < 1e-7
      ? ''
      : imRep.hasExactForm
        ? imRep.exactLatex
        : imRep.decimalText;
  const exactLatex = !reTex
    ? `${iClean < 0 ? '-' : ''}${imMagTex}i`
    : `${reTex} ${iClean < 0 ? '-' : '+'} ${imMagTex}i`;
  const decimalLatex = formatComplexLatex({ re: rClean, im: iClean });
  return { label, exactLatex, decimalLatex };
}

/**
 * Mode 9 → 2 → 2: Authentic Casio fx-580VN X Quadratic Equation Solver (`ax² + bx + c = 0`)
 * Returns exact surd/complex roots + parabola extremum (GTNN if a > 0, GTLN if a < 0).
 */
export function solveCasioQuadraticFull(a: number, b: number, c: number): CasioEqFullResult {
  if (Math.abs(a) < 1e-12) {
    return {
      kind: 'error',
      message: 'Cần hệ số a ≠ 0',
      steps: [],
      summaryLatex: '\\text{Cần hệ số } a \\ne 0',
    };
  }
  const disc = b * b - 4 * a * c;
  const steps: CasioEqStepItem[] = [];

  if (Math.abs(disc) < 1e-10) {
    const x0 = -b / (2 * a);
    steps.push(makeRealStep('x =', x0));
  } else if (disc > 0) {
    const r1 = formatQuadraticExactRoot(a, b, disc, 1);
    const r2 = formatQuadraticExactRoot(a, b, disc, -1);
    const v1 = (-b + Math.sqrt(disc)) / (2 * a);
    const v2 = (-b - Math.sqrt(disc)) / (2 * a);
    steps.push({ label: 'x₁ =', exactLatex: r1.exactLatex, decimalLatex: r1.decimalLatex, numeric: v1 });
    steps.push({ label: 'x₂ =', exactLatex: r2.exactLatex, decimalLatex: r2.decimalLatex, numeric: v2 });
  } else {
    const r1 = formatQuadraticExactRoot(a, b, disc, 1);
    const r2 = formatQuadraticExactRoot(a, b, disc, -1);
    steps.push({ label: 'x₁ =', exactLatex: r1.exactLatex, decimalLatex: r1.decimalLatex });
    steps.push({ label: 'x₂ =', exactLatex: r2.exactLatex, decimalLatex: r2.decimalLatex });
  }

  // Authentic fx-580VN X feature: Min/Max vertex of y = ax² + bx + c
  const vx = -b / (2 * a);
  const vy = a * vx * vx + b * vx + c;
  const extTag = a > 0 ? 'GTNN của y' : 'GTLN của y';
  steps.push(makeRealStep(`${extTag} · x =`, vx));
  steps.push(makeRealStep(`${extTag} · y =`, vy));

  const rootSteps = steps.filter((s) => s.label.startsWith('x'));
  const summaryLatex = rootSteps
    .map((s) => `${s.label.replace('₁', '_{1}').replace('₂', '_{2}')} ${s.exactLatex}`)
    .join(',\\; ');

  return { kind: 'ok', steps, summaryLatex };
}

/**
 * Mode 9 → 2 → 3: Authentic Casio fx-580VN X Cubic Equation Solver (`ax³ + bx² + cx + d = 0`)
 * Returns all 3 roots (including complex conjugate pair) + local Max/Min if derivative has 2 real roots.
 */
export function solveCasioCubicFull(a: number, b: number, c: number, d: number): CasioEqFullResult {
  if (Math.abs(a) < 1e-12) {
    return solveCasioQuadraticFull(b, c, d);
  }
  const p = (3 * a * c - b * b) / (3 * a * a);
  const q = (2 * b ** 3 - 9 * a * b * c + 27 * a * a * d) / (27 * a ** 3);
  const disc = (q * q) / 4 + (p * p * p) / 27;
  const shift = -b / (3 * a);

  const steps: CasioEqStepItem[] = [];

  if (disc > 1e-10) {
    // 1 real root + 2 complex conjugate roots
    const sqrtD = Math.sqrt(disc);
    const r1 = Math.cbrt(-q / 2 + sqrtD) + Math.cbrt(-q / 2 - sqrtD) + shift;
    steps.push(makeRealStep('x₁ =', r1));
    // Factor out (x - r1): a x² + (b + a r1) x + (c + b r1 + a r1²) = 0
    const qa = a;
    const qb = b + a * r1;
    const qc = c + qb * r1;
    const qDisc = qb * qb - 4 * qa * qc;
    const re = -qb / (2 * qa);
    const im = Math.sqrt(Math.max(0, -qDisc)) / Math.abs(2 * qa);
    steps.push(makeComplexStep('x₂ =', re, im));
    steps.push(makeComplexStep('x₃ =', re, -im));
  } else if (Math.abs(disc) <= 1e-10) {
    if (Math.abs(q) < 1e-10) {
      steps.push(makeRealStep('x =', shift));
    } else {
      const t1 = 2 * Math.cbrt(-q / 2) + shift;
      const t2 = -Math.cbrt(-q / 2) + shift;
      const sorted = [t1, t2].sort((u, v) => v - u);
      steps.push(makeRealStep('x₁ =', sorted[0]));
      steps.push(makeRealStep('x₂ =', sorted[1]));
    }
  } else {
    const r = Math.sqrt((-p * p * p) / 27);
    const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const m = 2 * Math.cbrt(r);
    const roots = [
      m * Math.cos(phi / 3) + shift,
      m * Math.cos((phi + 2 * Math.PI) / 3) + shift,
      m * Math.cos((phi + 4 * Math.PI) / 3) + shift,
    ].sort((u, v) => v - u);
    steps.push(makeRealStep('x₁ =', roots[0]));
    steps.push(makeRealStep('x₂ =', roots[1]));
    steps.push(makeRealStep('x₃ =', roots[2]));
  }

  // Authentic fx-580VN X feature: Local Maximum & Local Minimum of y = ax³ + bx² + cx + d
  // y' = 3ax² + 2bx + c = 0 => Δ' = b² - 3ac
  const dPrime = b * b - 3 * a * c;
  if (dPrime > 1e-10) {
    const sD = Math.sqrt(dPrime);
    const xA = (-b - sD) / (3 * a);
    const xB = (-b + sD) / (3 * a);
    const evalY = (xv: number) => ((a * xv + b) * xv + c) * xv + d;
    // Second derivative y'' = 6ax + 2b: < 0 is local max, > 0 is local min
    const y2A = 6 * a * xA + 2 * b;
    const xMax = y2A < 0 ? xA : xB;
    const xMin = y2A < 0 ? xB : xA;
    steps.push(makeRealStep('Cực đại · x =', xMax));
    steps.push(makeRealStep('Cực đại · y =', evalY(xMax)));
    steps.push(makeRealStep('Cực tiểu · x =', xMin));
    steps.push(makeRealStep('Cực tiểu · y =', evalY(xMin)));
  }

  const rootSteps = steps.filter((s) => s.label.startsWith('x'));
  const summaryLatex = rootSteps
    .map((s) => `${s.label.replace('₁', '_{1}').replace('₂', '_{2}').replace('₃', '_{3}')} ${s.exactLatex}`)
    .join(',\\; ');

  return { kind: 'ok', steps, summaryLatex };
}

/**
 * Mode 9 → 2 → 4: Authentic Casio fx-580VN X Quartic Equation Solver (`ax⁴ + bx³ + cx² + dx + e = 0`)
 * Returns all 4 roots (real + complex conjugate pairs).
 */
export function solveCasioQuarticFull(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number
): CasioEqFullResult {
  if (Math.abs(a) < 1e-12) {
    return solveCasioCubicFull(b, c, d, e);
  }
  const p = b / a;
  const q = c / a;
  const r = d / a;
  const s = e / a;

  const cSub = (u: CasioComplexValue, v: CasioComplexValue): CasioComplexValue => ({
    re: u.re - v.re,
    im: u.im - v.im,
  });
  const cMul = (u: CasioComplexValue, v: CasioComplexValue): CasioComplexValue => ({
    re: u.re * v.re - u.im * v.im,
    im: u.re * v.im + u.im * v.re,
  });
  const cDiv = (u: CasioComplexValue, v: CasioComplexValue): CasioComplexValue => {
    const den = v.re * v.re + v.im * v.im;
    if (den < 1e-18) return { re: 0, im: 0 };
    return { re: (u.re * v.re + u.im * v.im) / den, im: (u.im * v.re - u.re * v.im) / den };
  };
  const evalPoly = (z: CasioComplexValue): CasioComplexValue => {
    let acc: CasioComplexValue = { re: 1, im: 0 };
    acc = { re: cMul(acc, z).re + p, im: cMul(acc, z).im };
    acc = { re: cMul(acc, z).re + q, im: cMul(acc, z).im };
    acc = { re: cMul(acc, z).re + r, im: cMul(acc, z).im };
    acc = { re: cMul(acc, z).re + s, im: cMul(acc, z).im };
    return acc;
  };

  const radius = 1 + Math.max(Math.abs(p), Math.abs(q), Math.abs(r), Math.abs(s));
  const rootsC: CasioComplexValue[] = [0, 1, 2, 3].map((k) => {
    const ang = (2 * Math.PI * k) / 4 + 0.37;
    return { re: radius * Math.cos(ang) - p / 4, im: radius * Math.sin(ang) };
  });

  for (let iter = 0; iter < 140; iter += 1) {
    let maxStep = 0;
    for (let i = 0; i < 4; i += 1) {
      const fz = evalPoly(rootsC[i]);
      let denom: CasioComplexValue = { re: 1, im: 0 };
      for (let j = 0; j < 4; j += 1) {
        if (i !== j) denom = cMul(denom, cSub(rootsC[i], rootsC[j]));
      }
      const step = cDiv(fz, denom);
      rootsC[i] = cSub(rootsC[i], step);
      maxStep = Math.max(maxStep, Math.hypot(step.re, step.im));
    }
    if (maxStep < 1e-12) break;
  }

  // Sort real roots descending first, then complex pairs by real part then positive imaginary first
  const cleaned = rootsC.map((z) => ({
    re: Math.abs(z.re) < 1e-8 ? 0 : z.re,
    im: Math.abs(z.im) < 1e-5 ? 0 : z.im,
  }));
  cleaned.sort((u, v) => {
    const uReal = u.im === 0 ? 0 : 1;
    const vReal = v.im === 0 ? 0 : 1;
    if (uReal !== vReal) return uReal - vReal;
    if (Math.abs(u.re - v.re) > 1e-4) return v.re - u.re;
    return v.im - u.im;
  });

  // Deduplicate identical roots (e.g. multiple roots)
  const uniqueRoots: CasioComplexValue[] = [];
  for (const rt of cleaned) {
    const dup = uniqueRoots.some(
      (u) => Math.abs(u.re - rt.re) < 1e-4 && Math.abs(u.im - rt.im) < 1e-4
    );
    if (!dup) uniqueRoots.push(rt);
  }

  const subDigits = ['₁', '₂', '₃', '₄'];
  const steps: CasioEqStepItem[] = uniqueRoots.map((rt, idx) => {
    const lbl = uniqueRoots.length === 1 ? 'x =' : `x${subDigits[idx] ?? idx + 1} =`;
    return makeComplexStep(lbl, rt.re, rt.im);
  });

  const summaryLatex = steps
    .map(
      (st) =>
        `${st.label
          .replace('₁', '_{1}')
          .replace('₂', '_{2}')
          .replace('₃', '_{3}')
          .replace('₄', '_{4}')} ${st.exactLatex}`
    )
    .join(',\\; ');

  return { kind: 'ok', steps, summaryLatex };
}

/**
 * Mode 9 → 1 → (2|3|4): Authentic Casio fx-580VN X Simultaneous Linear System Solver (RREF)
 * Accurately distinguishes Unique Solution, No Solution (`Vô nghiệm`), and Infinite Solutions (`Vô số nghiệm`).
 */
export function solveCasioLinearSystemFull(rows: number[][]): CasioEqFullResult {
  const n = rows.length;
  if (n < 2 || n > 4 || rows.some((r) => r.length !== n + 1)) {
    return {
      kind: 'error',
      message: 'Dữ liệu không hợp lệ',
      steps: [],
      summaryLatex: '\\text{Dữ liệu không hợp lệ}',
    };
  }

  const aug = rows.map((r) => [...r]);
  let pivotRow = 0;
  for (let col = 0; col < n && pivotRow < n; col += 1) {
    let best = pivotRow;
    for (let r = pivotRow + 1; r < n; r += 1) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[best][col])) best = r;
    }
    if (Math.abs(aug[best][col]) < 1e-10) continue;
    if (best !== pivotRow) [aug[pivotRow], aug[best]] = [aug[best], aug[pivotRow]];
    const pv = aug[pivotRow][col];
    for (let c = col; c <= n; c += 1) aug[pivotRow][c] /= pv;
    for (let r = 0; r < n; r += 1) {
      if (r === pivotRow) continue;
      const factor = aug[r][col];
      for (let c = col; c <= n; c += 1) aug[r][c] -= factor * aug[pivotRow][c];
    }
    pivotRow += 1;
  }

  // Check for inconsistency (0 = k != 0)
  for (let r = 0; r < n; r += 1) {
    const allZeroCoeff = aug[r].slice(0, n).every((v) => Math.abs(v) < 1e-9);
    if (allZeroCoeff && Math.abs(aug[r][n]) > 1e-8) {
      return {
        kind: 'none',
        message: 'Vô nghiệm',
        steps: [],
        summaryLatex: '\\text{Vô nghiệm}',
      };
    }
  }

  if (pivotRow < n) {
    return {
      kind: 'infinite',
      message: 'Vô số nghiệm',
      steps: [],
      summaryLatex: '\\text{Vô số nghiệm}',
    };
  }

  const varNames = ['x', 'y', 'z', 't'];
  const steps: CasioEqStepItem[] = Array.from({ length: n }, (_, i) =>
    makeRealStep(`${varNames[i]} =`, aug[i][n])
  );
  const summaryLatex = steps.map((st) => `${st.label} ${st.exactLatex}`).join(',\\; ');
  return { kind: 'ok', steps, summaryLatex };
}
