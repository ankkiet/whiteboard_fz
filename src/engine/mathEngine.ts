import {
  BoardElement,
  FormulaElement,
  Point,
  ShapeElement,
  StrokeElement,
  TextElement,
} from '../types/board';
import { getElementBounds } from './geometry';
import {
  MATH_UNIT_PX,
  compileMathExpression,
  normalizeMathInput,
} from './mathUtils';
import { formatPrimeFactorizationLatex } from './mathDisplay';

function makeFormula(
  createId: (p: string) => string,
  x: number,
  y: number,
  latex: string,
  color: string,
  fontSize: number,
  groupId: string,
  zIndex: number,
  width = 160,
  height = 46
): FormulaElement {
  return {
    id: createId('el'),
    type: 'formula',
    x,
    y,
    width,
    height,
    latex,
    color,
    fontSize,
    groupIds: [groupId],
    zIndex,
  };
}

function makeLine(
  createId: (p: string) => string,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
  groupId: string,
  zIndex: number,
  options?: { type?: 'line' | 'arrow'; dashed?: boolean }
): ShapeElement {
  return {
    id: createId('el'),
    type: options?.type ?? 'line',
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    startPoint: start,
    endPoint: end,
    color,
    strokeWidth,
    dashed: options?.dashed,
    groupIds: [groupId],
    zIndex,
  };
}

function makeRect(
  createId: (p: string) => string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  fillColor: string,
  strokeWidth: number,
  groupId: string,
  zIndex: number
): ShapeElement {
  return {
    id: createId('el'),
    type: 'rectangle',
    x,
    y,
    width,
    height,
    color,
    fillColor,
    strokeWidth,
    groupIds: [groupId],
    zIndex,
  };
}

function makeEllipse(
  createId: (p: string) => string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  fillColor: string,
  strokeWidth: number,
  groupId: string,
  zIndex: number
): ShapeElement {
  return {
    id: createId('el'),
    type: 'ellipse',
    x: cx - rx,
    y: cy - ry,
    width: rx * 2,
    height: ry * 2,
    color,
    fillColor,
    strokeWidth,
    groupIds: [groupId],
    zIndex,
  };
}

function makeText(
  createId: (p: string) => string,
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize: number,
  groupId: string,
  zIndex: number,
  minWidth = 32
): TextElement {
  return {
    id: createId('el'),
    type: 'text',
    x,
    y,
    width: Math.max(minWidth, text.length * (fontSize * 0.65) + 14),
    height: Math.round(fontSize * 1.65),
    text,
    color,
    fontSize,
    groupIds: [groupId],
    zIndex,
  };
}

/* ============================================================================
 * 1. PARAMETRIC GRAPHING, EXTREMA, ASYMPTOTES & DEFINITE INTEGRALS (THCS/THPT)
 * ============================================================================ */

export function expressionUsesParamM(raw: string): boolean {
  const normalized = normalizeMathInput(raw);
  // Match standalone `m` or implicit product with `x` (e.g. `3mx`, `mx`, `xm`)
  return /(^|[^a-wyzA-WYZ])m([^a-wyzA-WYZ]|$)/i.test(normalized);
}

/**
 * Substitutes parameter `m` safely into a math expression before compiling.
 */
export function substituteParamM(raw: string, mValue: number): string {
  const normalized = normalizeMathInput(raw);
  const safeVal = Number.isFinite(mValue) ? `(${mValue})` : '(0)';
  // Handle implicit multiplication before and after m (e.g., 3mx -> 3*(2)*x, mx -> (2)*x)
  return normalized
    .replace(/(\d|\)|x)(?=\s*m(?![a-wyzA-WYZ]))/gi, '$1*')
    .replace(/(^|[^a-wyzA-WYZ])m(?=\s*x)/gi, `$1${safeVal}*`)
    .replace(/(^|[^a-wyzA-WYZ])m(?![a-wyzA-WYZ])/gi, `$1${safeVal}`);
}

export function compileParametricExpression(raw: string, mValue = 1): ((x: number) => number) | null {
  return compileMathExpression(substituteParamM(raw, mValue));
}

export interface FunctionFeaturePoint {
  x: number;
  y: number;
  kind: 'max' | 'min' | 'root' | 'y-intercept';
}

export interface FunctionAnalysisResult {
  extrema: FunctionFeaturePoint[];
  roots: FunctionFeaturePoint[];
  yIntercept: FunctionFeaturePoint | null;
  verticalAsymptotes: number[];
  horizontalAsymptote: number | null;
}

export function analyzeFunctionFeatures(
  raw: string,
  xMin: number,
  xMax: number,
  mValue = 1
): FunctionAnalysisResult {
  const empty: FunctionAnalysisResult = {
    extrema: [],
    roots: [],
    yIntercept: null,
    verticalAsymptotes: [],
    horizontalAsymptote: null,
  };
  const fn = compileParametricExpression(raw, mValue);
  if (!fn || xMax <= xMin) return empty;

  const samples = 400;
  const dx = (xMax - xMin) / samples;
  const xs: number[] = [];
  const ys: number[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const x = xMin + i * dx;
    xs.push(x);
    ys.push(fn(x));
  }

  const extrema: FunctionFeaturePoint[] = [];
  const roots: FunctionFeaturePoint[] = [];
  const verticalAsymptotes: number[] = [];

  const pushUniqueX = <T extends { x: number }>(arr: T[], item: T, tol = 0.15) => {
    if (!arr.some((p) => Math.abs(p.x - item.x) < tol)) arr.push(item);
  };

  for (let i = 1; i < samples; i += 1) {
    const yPrev = ys[i - 1];
    const yCurr = ys[i];
    const yNext = ys[i + 1];

    // Vertical asymptote heuristic: huge opposite-sign jump or non-finite spike
    if (
      (!Number.isFinite(yCurr) && Number.isFinite(yPrev) && Number.isFinite(yNext)) ||
      (Number.isFinite(yPrev) &&
        Number.isFinite(yCurr) &&
        Math.abs(yCurr - yPrev) > 25 &&
        Math.sign(yCurr) !== Math.sign(yPrev))
    ) {
      const asymX = Math.round(((xs[i - 1] + xs[i]) / 2) * 10) / 10;
      if (!verticalAsymptotes.some((vx) => Math.abs(vx - asymX) < 0.25)) {
        verticalAsymptotes.push(asymX);
      }
      continue;
    }

    if (!Number.isFinite(yPrev) || !Number.isFinite(yCurr) || !Number.isFinite(yNext)) continue;
    if (Math.abs(yCurr) > 14) continue;

    // Local extremum with 3-point parabolic refinement + half-integer snapping
    const isMax = yCurr > yPrev && yCurr > yNext && yCurr - yPrev > 1e-6 && yCurr - yNext > 1e-6;
    const isMin = yCurr < yPrev && yCurr < yNext && yPrev - yCurr > 1e-6 && yNext - yCurr > 1e-6;
    if (isMax || isMin) {
      const denom = yPrev - 2 * yCurr + yNext;
      const offset = Math.abs(denom) > 1e-9 ? 0.5 * ((yPrev - yNext) / denom) : 0;
      let exactX = xs[i] + Math.max(-0.5, Math.min(0.5, offset)) * dx;
      const nearestHalf = Math.round(exactX * 2) / 2;
      if (Math.abs(exactX - nearestHalf) < 0.025) exactX = nearestHalf;
      let exactY = fn(exactX);
      if (!Number.isFinite(exactY)) exactY = yCurr;
      const nearestHalfY = Math.round(exactY * 2) / 2;
      if (Math.abs(exactY - nearestHalfY) < 0.025) exactY = nearestHalfY;
      pushUniqueX(extrema, {
        x: Number(exactX.toFixed(2)),
        y: Number(exactY.toFixed(2)),
        kind: isMax ? 'max' : 'min',
      });
    }

    // Root crossing (avoid counting asymptotes)
    if (Math.abs(yCurr) < 0.03) {
      pushUniqueX(roots, { x: Number(xs[i].toFixed(2)), y: 0, kind: 'root' });
    } else if (
      Math.sign(yPrev) !== Math.sign(yCurr) &&
      Math.abs(yCurr - yPrev) < 12
    ) {
      const t = Math.abs(yPrev) / (Math.abs(yPrev) + Math.abs(yCurr));
      const rootX = xs[i - 1] + t * dx;
      pushUniqueX(roots, { x: Number(rootX.toFixed(2)), y: 0, kind: 'root' });
    }
  }

  let yIntercept: FunctionFeaturePoint | null = null;
  if (xMin <= 0 && xMax >= 0) {
    const y0 = fn(0);
    if (Number.isFinite(y0) && Math.abs(y0) <= 14) {
      yIntercept = { x: 0, y: Number(y0.toFixed(2)), kind: 'y-intercept' };
    }
  }

  // Horizontal asymptote check at large |x|
  let horizontalAsymptote: number | null = null;
  const fPos1 = fn(200);
  const fPos2 = fn(800);
  const fNeg1 = fn(-200);
  const fNeg2 = fn(-800);
  if (
    Number.isFinite(fPos1) &&
    Number.isFinite(fPos2) &&
    Math.abs(fPos1 - fPos2) < 0.02 &&
    Math.abs(fPos2) < 12
  ) {
    horizontalAsymptote = Number(fPos2.toFixed(2));
  } else if (
    Number.isFinite(fNeg1) &&
    Number.isFinite(fNeg2) &&
    Math.abs(fNeg1 - fNeg2) < 0.02 &&
    Math.abs(fNeg2) < 12
  ) {
    horizontalAsymptote = Number(fNeg2.toFixed(2));
  }

  return {
    extrema: extrema.slice(0, 6),
    roots: roots.slice(0, 8),
    yIntercept,
    verticalAsymptotes: verticalAsymptotes.slice(0, 4),
    horizontalAsymptote,
  };
}

export interface DefiniteIntegralResult {
  signedIntegral: number;
  areaS: number;
  volumeV: number;
}

/**
 * Composite Simpson's rule integration for f(x) over [a, b].
 */
export function computeDefiniteIntegral(
  raw: string,
  a: number,
  b: number,
  mValue = 1
): DefiniteIntegralResult | null {
  const fn = compileParametricExpression(raw, mValue);
  if (!fn || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b - a) < 1e-6) return null;

  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const sign = b >= a ? 1 : -1;
  const n = 200; // even
  const h = (hi - lo) / n;

  let sumSigned = 0;
  let sumArea = 0;
  let sumVol = 0;

  for (let i = 0; i <= n; i += 1) {
    const x = lo + i * h;
    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > 1e5) return null;
    const weight = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    sumSigned += weight * y;
    sumArea += weight * Math.abs(y);
    sumVol += weight * y * y;
  }

  const factor = h / 3;
  return {
    signedIntegral: sign * sumSigned * factor,
    areaS: sumArea * factor,
    volumeV: Math.PI * sumVol * factor,
  };
}

export function buildIntegralShadingElements(options: {
  expression: string;
  mValue?: number;
  a: number;
  b: number;
  color: string;
  startZIndex: number;
  createId: (p: string) => string;
  unitPx?: number;
}): BoardElement[] | null {
  const { expression, mValue = 1, a, b, color, startZIndex, createId, unitPx = MATH_UNIT_PX } = options;
  const fn = compileParametricExpression(expression, mValue);
  const result = computeDefiniteIntegral(expression, a, b, mValue);
  if (!fn || !result) return null;

  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  // Vertical hatching strokes inside [lo, hi]
  const strips = Math.max(12, Math.min(48, Math.round((hi - lo) * 8)));
  const dx = (hi - lo) / strips;
  for (let i = 0; i <= strips; i += 1) {
    const x = lo + i * dx;
    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > 12) continue;
    const wx = x * unitPx;
    const wy = -y * unitPx;
    els.push(
      makeLine(createId, { x: wx, y: 0 }, { x: wx, y: wy }, color, 1.5, groupId, nextZ(), {
        dashed: i === 0 || i === strips,
      })
    );
  }

  const midX = ((lo + hi) / 2) * unitPx;
  const labelLatex = `\\int_{${lo}}^{${hi}} f(x)\\,dx \\approx ${result.signedIntegral.toFixed(2)},\\; S \\approx ${result.areaS.toFixed(2)}`;
  els.push(makeFormula(createId, midX - 115, 16, labelLatex, color, 15, groupId, nextZ(), 240, 48));
  return els;
}

export function buildFeatureAnnotationElements(options: {
  analysis: FunctionAnalysisResult;
  xMin: number;
  xMax: number;
  color: string;
  startZIndex: number;
  createId: (p: string) => string;
  unitPx?: number;
}): BoardElement[] {
  const { analysis, xMin, xMax, color, startZIndex, createId, unitPx = MATH_UNIT_PX } = options;
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  // Dashed vertical asymptotes
  for (const vx of analysis.verticalAsymptotes) {
    const wx = vx * unitPx;
    els.push(
      makeLine(createId, { x: wx, y: -10 * unitPx }, { x: wx, y: 10 * unitPx }, '#e11d48', 1.8, groupId, nextZ(), {
        dashed: true,
      }),
      makeText(createId, wx + 6, -9 * unitPx, `TCĐ: x = ${vx}`, '#e11d48', 12, groupId, nextZ())
    );
  }

  // Dashed horizontal asymptote
  if (analysis.horizontalAsymptote !== null) {
    const wy = -analysis.horizontalAsymptote * unitPx;
    els.push(
      makeLine(createId, { x: xMin * unitPx, y: wy }, { x: xMax * unitPx, y: wy }, '#0284c7', 1.8, groupId, nextZ(), {
        dashed: true,
      }),
      makeText(
        createId,
        xMax * unitPx - 95,
        wy - 22,
        `TCN: y = ${analysis.horizontalAsymptote}`,
        '#0284c7',
        12,
        groupId,
        nextZ()
      )
    );
  }

  // Extrema dots + coordinates
  for (const pt of analysis.extrema) {
    const wx = pt.x * unitPx;
    const wy = -pt.y * unitPx;
    els.push(
      makeEllipse(createId, wx, wy, 5, 5, color, color, 2, groupId, nextZ()),
      makeText(
        createId,
        wx + 8,
        pt.kind === 'max' ? wy - 24 : wy + 6,
        `${pt.kind === 'max' ? 'CĐ' : 'CT'}(${pt.x}; ${pt.y})`,
        color,
        12,
        groupId,
        nextZ()
      )
    );
  }

  return els;
}

/* ============================================================================
 * 2. BẢNG BIẾN THIÊN & TRỤC SỐ XÉT DẤU (THPT VIỆT NAM)
 * ============================================================================ */

export interface VariationTableData {
  xValues: string[];     // e.g. ['-∞', '-1', '1', '+∞']
  yPrimeMarks: string[]; // length = 2*xValues.length - 3 (signs between xValues, marks under inner xValues)
  yValues: string[];     // length = xValues.length
}

export function autoGenerateVariationTable(raw: string, mValue = 1): VariationTableData | null {
  const fn = compileParametricExpression(raw, mValue);
  if (!fn) return null;

  const analysis = analyzeFunctionFeatures(raw, -8, 8, mValue);
  const criticalPoints = [
    ...analysis.extrema.map((e) => ({ x: e.x, isAsym: false })),
    ...analysis.verticalAsymptotes.map((vx) => ({ x: vx, isAsym: true })),
  ].sort((a, b) => a.x - b.x);

  const uniqueCrits: { x: number; isAsym: boolean }[] = [];
  for (const c of criticalPoints) {
    if (!uniqueCrits.some((u) => Math.abs(u.x - c.x) < 0.25)) {
      uniqueCrits.push(c);
    }
  }
  const limited = uniqueCrits.slice(0, 4);

  const xValues = ['-∞', ...limited.map((c) => String(c.x)), '+∞'];
  const intervals: [number, number][] = [];
  const boundaries = [-10, ...limited.map((c) => c.x), 10];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    intervals.push([boundaries[i], boundaries[i + 1]]);
  }

  const yPrimeMarks: string[] = [];
  for (let i = 0; i < intervals.length; i += 1) {
    const mid = (intervals[i][0] + intervals[i][1]) / 2;
    const h = 0.01;
    const deriv = (fn(mid + h) - fn(mid - h)) / (2 * h);
    yPrimeMarks.push(deriv >= 0 ? '+' : '−');
    if (i < limited.length) {
      yPrimeMarks.push(limited[i].isAsym ? '∥' : '0');
    }
  }

  const formatEdgeVal = (v: number): string => {
    if (!Number.isFinite(v)) return '∞';
    if (v > 30) return '+∞';
    if (v < -30) return '-∞';
    return String(Number(v.toFixed(1)));
  };

  const yValues = [
    formatEdgeVal(fn(-15)),
    ...limited.map((c) => (c.isAsym ? '∥' : String(Number(fn(c.x).toFixed(2))))),
    formatEdgeVal(fn(15)),
  ];

  return { xValues, yPrimeMarks, yValues };
}

export function buildVariationTableElements(
  data: VariationTableData,
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const colCount = Math.max(data.xValues.length, 2);
  const labelColW = 58;
  const stepW = 108;
  const totalW = labelColW + (colCount - 1) * stepW + 64;
  const row1H = 40;
  const row2H = 40;
  const row3H = 88;
  const totalH = row1H + row2H + row3H;

  const left = center.x - totalW / 2;
  const top = center.y - totalH / 2;

  // Outer table frame & row/column dividers
  els.push(
    makeRect(createId, left, top, totalW, totalH, color, 'transparent', 2, groupId, nextZ()),
    makeLine(createId, { x: left + labelColW, y: top }, { x: left + labelColW, y: top + totalH }, color, 2, groupId, nextZ()),
    makeLine(createId, { x: left, y: top + row1H }, { x: left + totalW, y: top + row1H }, color, 1.8, groupId, nextZ()),
    makeLine(createId, { x: left, y: top + row1H + row2H }, { x: left + totalW, y: top + row1H + row2H }, color, 1.8, groupId, nextZ())
  );

  // Row headers
  els.push(
    makeText(createId, left + 20, top + 8, 'x', color, 17, groupId, nextZ()),
    makeText(createId, left + 18, top + row1H + 8, "y'", color, 17, groupId, nextZ()),
    makeText(createId, left + 20, top + row1H + row2H + 30, 'y', color, 17, groupId, nextZ())
  );

  const colXs = data.xValues.map((_, idx) => left + labelColW + 32 + idx * stepW);

  // Row 1: x values
  data.xValues.forEach((val, idx) => {
    els.push(makeText(createId, colXs[idx] - 14, top + 9, val, color, 15, groupId, nextZ()));
  });

  // Row 2: y' marks (alternating interval sign, boundary mark, interval sign...)
  for (let i = 0; i < data.yPrimeMarks.length; i += 1) {
    const mark = data.yPrimeMarks[i];
    if (i % 2 === 0) {
      // Interval sign between colXs[k] and colXs[k+1]
      const k = i / 2;
      const midX = (colXs[k] + colXs[k + 1]) / 2;
      els.push(makeText(createId, midX - 8, top + row1H + 8, mark, color, 17, groupId, nextZ()));
    } else {
      // Point mark under colXs[k]
      const k = (i + 1) / 2;
      if (mark === '∥') {
        els.push(
          makeLine(createId, { x: colXs[k] - 2.5, y: top + row1H + 4 }, { x: colXs[k] - 2.5, y: top + totalH - 4 }, color, 1.5, groupId, nextZ()),
          makeLine(createId, { x: colXs[k] + 2.5, y: top + row1H + 4 }, { x: colXs[k] + 2.5, y: top + totalH - 4 }, color, 1.5, groupId, nextZ())
        );
      } else {
        els.push(makeText(createId, colXs[k] - 7, top + row1H + 9, mark, color, 15, groupId, nextZ()));
      }
    }
  }

  // Row 3: y arrows & endpoint values
  const yRowTop = top + row1H + row2H + 10;
  const yRowBot = top + totalH - 30;
  const intervalCount = colCount - 1;
  const signs: boolean[] = [];
  for (let k = 0; k < intervalCount; k += 1) {
    signs.push(data.yPrimeMarks[k * 2] !== '−' && data.yPrimeMarks[k * 2] !== '-');
  }

  // Place y endpoint values
  for (let idx = 0; idx < colCount; idx += 1) {
    const yStr = data.yValues[idx] ?? '';
    if (yStr === '∥') continue;
    const prevUp = idx > 0 ? signs[idx - 1] : null;
    const nextUp = idx < intervalCount ? signs[idx] : null;
    let yPos = (yRowTop + yRowBot) / 2;
    if ((prevUp === true && nextUp === false) || (prevUp === null && nextUp === false) || (prevUp === true && nextUp === null)) {
      yPos = yRowTop;
    } else if ((prevUp === false && nextUp === true) || (prevUp === null && nextUp === true) || (prevUp === false && nextUp === null)) {
      yPos = yRowBot;
    }
    els.push(makeText(createId, colXs[idx] - 16, yPos, yStr, color, 14, groupId, nextZ()));
  }

  // Draw monotonicity arrows
  for (let k = 0; k < intervalCount; k += 1) {
    const isUp = signs[k];
    const startX = colXs[k] + 22;
    const endX = colXs[k + 1] - 22;
    const startY = isUp ? yRowBot + 14 : yRowTop + 14;
    const endY = isUp ? yRowTop + 14 : yRowBot + 14;
    els.push(
      makeLine(createId, { x: startX, y: startY }, { x: endX, y: endY }, color, 2, groupId, nextZ(), {
        type: 'arrow',
      })
    );
  }

  return els;
}

export function buildNumberLineIntervalElements(
  options: {
    leftBound: number | null;
    rightBound: number | null;
    leftClosed: boolean;
    rightClosed: boolean;
    label?: string;
  },
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const halfW = 190;
  const y = center.y;
  const xStart = center.x - halfW;
  const xEnd = center.x + halfW;

  // Main axis arrow
  els.push(
    makeLine(createId, { x: xStart, y }, { x: xEnd, y }, color, 2.2, groupId, nextZ(), {
      type: 'arrow',
    })
  );

  const leftPos = options.leftBound !== null ? center.x - 76 : xStart;
  const rightPos = options.rightBound !== null ? center.x + 76 : xEnd - 18;

  // Hatch excluded left region
  if (options.leftBound !== null) {
    for (let hx = xStart + 14; hx < leftPos - 6; hx += 16) {
      els.push(makeLine(createId, { x: hx - 6, y: y + 9 }, { x: hx + 6, y: y - 9 }, '#94a3b8', 1.6, groupId, nextZ()));
    }
    els.push(
      makeText(createId, leftPos - 8, y - 16, options.leftClosed ? '[' : '(', color, 22, groupId, nextZ()),
      makeText(createId, leftPos - 10, y + 14, String(options.leftBound), color, 14, groupId, nextZ())
    );
  }

  // Hatch excluded right region
  if (options.rightBound !== null) {
    for (let hx = rightPos + 14; hx < xEnd - 18; hx += 16) {
      els.push(makeLine(createId, { x: hx - 6, y: y + 9 }, { x: hx + 6, y: y - 9 }, '#94a3b8', 1.6, groupId, nextZ()));
    }
    els.push(
      makeText(createId, rightPos - 6, y - 16, options.rightClosed ? ']' : ')', color, 22, groupId, nextZ()),
      makeText(createId, rightPos - 10, y + 14, String(options.rightBound), color, 14, groupId, nextZ())
    );
  }

  // Highlight kept interval
  els.push(
    makeLine(createId, { x: leftPos + 2, y }, { x: rightPos - 2, y }, '#4f46e5', 4.5, groupId, nextZ())
  );

  const intervalLabel =
    options.label ||
    `${options.leftBound === null ? '(-∞' : `${options.leftClosed ? '[' : '('}${options.leftBound}`}; ${
      options.rightBound === null ? '+∞)' : `${options.rightBound}${options.rightClosed ? ']' : ')'}`
    }`;
  els.push(makeText(createId, center.x - 55, y - 46, intervalLabel, '#4f46e5', 15, groupId, nextZ(), 110));

  return els;
}

/* ============================================================================
 * 3. PRIMARY SCHOOL MANIPULATIVES (LỚP 1–5)
 * ============================================================================ */

export function buildBase10Elements(
  counts: { hundreds: number; tens: number; ones: number },
  center: Point,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  let cursorX = center.x - 160;
  const baseY = center.y - 45;

  // Hundreds flats (green 10x10 tiles)
  for (let h = 0; h < Math.min(counts.hundreds, 5); h += 1) {
    els.push(
      makeRect(createId, cursorX, baseY, 72, 72, '#059669', '#10b98126', 2, groupId, nextZ()),
      makeText(createId, cursorX + 19, baseY + 24, '100', '#047857', 14, groupId, nextZ())
    );
    cursorX += 82;
  }

  // Tens rods (blue 1x10 vertical rods)
  for (let t = 0; t < Math.min(counts.tens, 9); t += 1) {
    els.push(makeRect(createId, cursorX, baseY, 16, 72, '#2563eb', '#3b82f62b', 1.8, groupId, nextZ()));
    cursorX += 22;
  }
  if (counts.tens > 0) cursorX += 10;

  // Ones unit cubes (amber 1x1 squares arranged in 2 rows of 5)
  for (let o = 0; o < Math.min(counts.ones, 15); o += 1) {
    const col = o % 5;
    const row = Math.floor(o / 5);
    els.push(
      makeRect(createId, cursorX + col * 20, baseY + row * 22, 16, 16, '#d97706', '#f59e0b36', 1.8, groupId, nextZ())
    );
  }

  const total = counts.hundreds * 100 + counts.tens * 10 + counts.ones;
  els.push(
    makeText(
      createId,
      center.x - 160,
      baseY + 84,
      `Tổng = ${total} (${counts.hundreds} trăm, ${counts.tens} chục, ${counts.ones} đơn vị)`,
      '#1e293b',
      15,
      groupId,
      nextZ(),
      240
    )
  );

  return els;
}

export function buildVerticalArithmeticElements(
  a: number,
  b: number,
  op: '+' | '-' | '*' | '/',
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  if (op === '/') {
    // Vietnamese textbook T-shaped division layout
    const safeB = b === 0 ? 1 : Math.abs(Math.trunc(b));
    const safeA = Math.abs(Math.trunc(a));
    const quotient = Math.floor(safeA / safeB);
    const remainder = safeA % safeB;
    const x0 = center.x - 85;
    const y0 = center.y - 55;

    els.push(
      makeText(createId, x0, y0, String(safeA), color, 24, groupId, nextZ(), 70),
      makeLine(createId, { x: x0 + 82, y: y0 - 4 }, { x: x0 + 82, y: y0 + 102 }, color, 2.2, groupId, nextZ()),
      makeLine(createId, { x: x0 + 82, y: y0 + 36 }, { x: x0 + 178, y: y0 + 36 }, color, 2.2, groupId, nextZ()),
      makeText(createId, x0 + 94, y0, String(safeB), color, 24, groupId, nextZ(), 60),
      makeText(createId, x0 + 94, y0 + 44, String(quotient), '#4f46e5', 24, groupId, nextZ(), 60),
      makeText(
        createId,
        x0 + 16,
        y0 + 54,
        `Dư ${remainder}`,
        '#64748b',
        16,
        groupId,
        nextZ(),
        60
      )
    );
    return els;
  }

  const symbol = op === '*' ? '×' : op === '-' ? '−' : '+';
  const result = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const sA = String(a);
  const sB = String(b);
  const sR = String(result);
  const maxLen = Math.max(sA.length, sB.length, sR.length);
  const cellW = 24;
  const rightX = center.x + (maxLen * cellW) / 2;
  const topY = center.y - 58;

  const placeDigits = (str: string, y: number, col: string) => {
    for (let i = 0; i < str.length; i += 1) {
      const ch = str[str.length - 1 - i];
      els.push(makeText(createId, rightX - (i + 1) * cellW, y, ch, col, 24, groupId, nextZ(), 22));
    }
  };

  placeDigits(sA, topY, color);
  els.push(makeText(createId, rightX - (maxLen + 1) * cellW - 8, topY + 20, symbol, color, 24, groupId, nextZ(), 24));
  placeDigits(sB, topY + 34, color);
  els.push(
    makeLine(
      createId,
      { x: rightX - (maxLen + 1) * cellW - 10, y: topY + 72 },
      { x: rightX + 8, y: topY + 72 },
      color,
      2.4,
      groupId,
      nextZ()
    )
  );
  placeDigits(sR, topY + 80, '#4f46e5');

  return els;
}

export function buildBarModelElements(
  options: {
    labelA: string;
    partsA: number;
    labelB: string;
    partsB: number;
    summaryLabel: string;
  },
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const partW = 48;
  const pA = Math.max(1, Math.min(8, options.partsA));
  const pB = Math.max(1, Math.min(8, options.partsB));
  const left = center.x - 140;
  const yA = center.y - 36;
  const yB = center.y + 24;

  // Labels
  els.push(
    makeText(createId, left - 96, yA - 12, options.labelA || 'Số bé', color, 15, groupId, nextZ(), 86),
    makeText(createId, left - 96, yB - 12, options.labelB || 'Số lớn', color, 15, groupId, nextZ(), 86)
  );

  // Row A segments
  for (let i = 0; i < pA; i += 1) {
    els.push(makeRect(createId, left + i * partW, yA - 14, partW, 28, '#2563eb', '#3b82f620', 2, groupId, nextZ()));
  }

  // Row B segments
  for (let i = 0; i < pB; i += 1) {
    els.push(makeRect(createId, left + i * partW, yB - 14, partW, 28, '#059669', '#10b98120', 2, groupId, nextZ()));
  }

  // Right summary brace / annotation
  const maxX = left + Math.max(pA, pB) * partW + 18;
  els.push(
    makeLine(createId, { x: maxX, y: yA - 14 }, { x: maxX + 10, y: yA - 14 }, color, 2, groupId, nextZ()),
    makeLine(createId, { x: maxX + 10, y: yA - 14 }, { x: maxX + 10, y: yB + 14 }, color, 2, groupId, nextZ()),
    makeLine(createId, { x: maxX, y: yB + 14 }, { x: maxX + 10, y: yB + 14 }, color, 2, groupId, nextZ()),
    makeText(createId, maxX + 18, (yA + yB) / 2 - 12, options.summaryLabel || 'Tổng = ?', '#4f46e5', 15, groupId, nextZ(), 90)
  );

  return els;
}

export function buildFractionModelElements(
  numerator: number,
  denominator: number,
  shape: 'bar' | 'circle',
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const den = Math.max(2, Math.min(12, Math.round(denominator)));
  const num = Math.max(0, Math.min(den, Math.round(numerator)));
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  if (shape === 'bar') {
    const totalW = 280;
    const cellW = totalW / den;
    const h = 52;
    const left = center.x - totalW / 2;
    const top = center.y - h / 2;
    for (let i = 0; i < den; i += 1) {
      els.push(
        makeRect(
          createId,
          left + i * cellW,
          top,
          cellW,
          h,
          color,
          i < num ? '#4f46e555' : 'transparent',
          2,
          groupId,
          nextZ()
        )
      );
    }
    els.push(makeFormula(createId, center.x - 42, top + h + 8, `\\frac{${num}}{${den}}`, '#4f46e5', 22, groupId, nextZ(), 84, 54));
    return els;
  }

  // Circle pie model with crisp filled sector
  const r = 74;
  if (num > 0) {
    const startAng = -Math.PI / 2;
    const endAng = startAng + (num / den) * Math.PI * 2;
    els.push({
      id: createId('el'),
      type: 'ellipse',
      x: center.x - r,
      y: center.y - r,
      width: r * 2,
      height: r * 2,
      color: '#4f46e5',
      fillColor: 'rgba(79, 70, 229, 0.34)',
      strokeWidth: 0,
      ...(num < den ? { sectorStartAngle: startAng, sectorEndAngle: endAng } : {}),
      groupIds: [groupId],
      zIndex: nextZ(),
    });
  }
  els.push(makeEllipse(createId, center.x, center.y, r, r, color, 'transparent', 2.4, groupId, nextZ()));
  for (let i = 0; i < den; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / den;
    els.push(
      makeLine(
        createId,
        center,
        { x: center.x + r * Math.cos(ang), y: center.y + r * Math.sin(ang) },
        color,
        1.8,
        groupId,
        nextZ()
      )
    );
  }
  els.push(makeFormula(createId, center.x - 40, center.y + r + 8, `\\frac{${num}}{${den}}`, '#4f46e5', 22, groupId, nextZ(), 80, 54));
  return els;
}

export function buildClockElements(
  hours: number,
  minutes: number,
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const r = 84;
  els.push(makeEllipse(createId, center.x, center.y, r, r, color, '#ffffff14', 2.6, groupId, nextZ()));

  for (let h = 1; h <= 12; h += 1) {
    const ang = -Math.PI / 2 + (h * Math.PI) / 6;
    const tx = center.x + (r - 18) * Math.cos(ang) - (h >= 10 ? 10 : 6);
    const ty = center.y + (r - 18) * Math.sin(ang) - 9;
    els.push(makeText(createId, tx, ty, String(h), color, 13, groupId, nextZ(), 22));
  }

  const minAng = -Math.PI / 2 + (minutes * Math.PI) / 30;
  const hourAng = -Math.PI / 2 + (((hours % 12) + minutes / 60) * Math.PI) / 6;

  // Minute hand (longer, blue) & Hour hand (shorter, bold)
  els.push(
    makeLine(
      createId,
      center,
      { x: center.x + (r - 24) * Math.cos(minAng), y: center.y + (r - 24) * Math.sin(minAng) },
      '#2563eb',
      3,
      groupId,
      nextZ(),
      { type: 'arrow' }
    ),
    makeLine(
      createId,
      center,
      { x: center.x + (r - 40) * Math.cos(hourAng), y: center.y + (r - 40) * Math.sin(hourAng) },
      color,
      4.2,
      groupId,
      nextZ(),
      { type: 'arrow' }
    ),
    makeEllipse(createId, center.x, center.y, 4.5, 4.5, color, color, 1.5, groupId, nextZ()),
    makeText(
      createId,
      center.x - 36,
      center.y + r + 10,
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      '#4f46e5',
      18,
      groupId,
      nextZ(),
      76
    )
  );

  return els;
}

export function buildJumpNumberLineElements(
  startVal: number,
  jump: number,
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const endVal = startVal + jump;
  const lo = Math.min(startVal, endVal) - 2;
  const hi = Math.max(startVal, endVal) + 2;
  const span = Math.max(6, Math.min(14, hi - lo));
  const stepPx = 38;
  const left = center.x - (span * stepPx) / 2;
  const y = center.y + 18;

  els.push(
    makeLine(createId, { x: left - 18, y }, { x: left + span * stepPx + 24, y }, color, 2.2, groupId, nextZ(), {
      type: 'arrow',
    })
  );

  for (let i = 0; i <= span; i += 1) {
    const val = lo + i;
    const x = left + i * stepPx;
    els.push(
      makeLine(createId, { x, y: y - 6 }, { x, y: y + 6 }, color, 1.8, groupId, nextZ()),
      makeText(createId, x - 8, y + 10, String(val), color, 13, groupId, nextZ(), 24)
    );
  }

  const sx = left + (startVal - lo) * stepPx;
  const ex = left + (endVal - lo) * stepPx;
  const midX = (sx + ex) / 2;
  const arcTopY = y - 54;
  // Curved jump arc stroke
  const arcPts: [number, number, number][] = [];
  for (let t = 0; t <= 20; t += 1) {
    const u = t / 20;
    const px = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * midX + u * u * ex;
    const py = (1 - u) * (1 - u) * (y - 6) + 2 * (1 - u) * u * arcTopY + u * u * (y - 6);
    arcPts.push([px, py, 0.5]);
  }
  const strokeBase: StrokeElement = {
    id: createId('el'),
    type: 'stroke',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: arcPts,
    color: '#4f46e5',
    strokeWidth: 2.8,
    groupIds: [groupId],
    zIndex: nextZ(),
  };
  const b = getElementBounds(strokeBase);
  els.push(
    { ...strokeBase, x: b.minX, y: b.minY, width: Math.max(1, b.maxX - b.minX), height: Math.max(1, b.maxY - b.minY) },
    makeEllipse(createId, sx, y, 4.5, 4.5, '#059669', '#059669', 1.5, groupId, nextZ()),
    makeEllipse(createId, ex, y, 5, 5, '#4f46e5', '#4f46e5', 1.5, groupId, nextZ()),
    makeText(
      createId,
      midX - 24,
      arcTopY - 8,
      `${jump >= 0 ? '+' : ''}${jump}`,
      '#4f46e5',
      16,
      groupId,
      nextZ(),
      48
    )
  );

  return els;
}

/* ============================================================================
 * 4. ALGEBRA, TRIGONOMETRY, STATISTICS & PROBABILITY (LỚP 6–12)
 * ============================================================================ */

export function factorizePrime(n: number): number[] {
  let num = Math.floor(Math.abs(n));
  if (num < 2) return [];
  const factors: number[] = [];
  let d = 2;
  while (d * d <= num) {
    while (num % d === 0) {
      factors.push(d);
      num = Math.floor(num / d);
    }
    d += d === 2 ? 1 : 2;
  }
  if (num > 1) factors.push(num);
  return factors;
}

export function computeGcdLcm(a: number, b: number): { gcd: number; lcm: number } {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  if (x === 0 && y === 0) return { gcd: 0, lcm: 0 };
  const origX = x;
  const origY = y;
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  const gcd = x;
  const lcm = gcd === 0 ? 0 : Math.abs(origX * origY) / gcd;
  return { gcd, lcm };
}

export function solveQuadratic(a: number, b: number, c: number): {
  delta: number;
  summary: string;
  roots: number[];
} {
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) {
      return { delta: 0, summary: Math.abs(c) < 1e-12 ? 'Vô số nghiệm' : 'Vô nghiệm', roots: [] };
    }
    const r = -c / b;
    return { delta: 0, summary: `Nghiệm bậc nhất: x = ${Number(r.toFixed(4))}`, roots: [r] };
  }
  const delta = b * b - 4 * a * c;
  if (delta < -1e-12) {
    return { delta, summary: `Δ = ${Number(delta.toFixed(3))} < 0 → Phương trình vô nghiệm thực`, roots: [] };
  }
  if (Math.abs(delta) <= 1e-12) {
    const r = -b / (2 * a);
    return { delta: 0, summary: `Δ = 0 → Nghiệm kép x₁ = x₂ = ${Number(r.toFixed(4))}`, roots: [r] };
  }
  const sqrtD = Math.sqrt(delta);
  const x1 = (-b - sqrtD) / (2 * a);
  const x2 = (-b + sqrtD) / (2 * a);
  return {
    delta,
    summary: `Δ = ${Number(delta.toFixed(3))} → x₁ = ${Number(x1.toFixed(4))}, x₂ = ${Number(x2.toFixed(4))}`,
    roots: [x1, x2],
  };
}

export function buildPrimeFactorTreeElements(
  n: number,
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const num = Math.max(2, Math.min(9999, Math.floor(Math.abs(n))));
  const factors = factorizePrime(num);
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  let remaining = num;
  let cx = center.x;
  let cy = center.y - 90;

  els.push(
    makeEllipse(createId, cx, cy, 26, 20, color, '#4f46e518', 2, groupId, nextZ()),
    makeText(createId, cx - 14, cy - 11, String(remaining), color, 15, groupId, nextZ(), 32)
  );

  for (let i = 0; i < factors.length - 1; i += 1) {
    const p = factors[i];
    const nextRem = Math.floor(remaining / p);
    const leftX = cx - 54;
    const rightX = cx + 54;
    const nextY = cy + 62;

    els.push(
      makeLine(createId, { x: cx - 10, y: cy + 18 }, { x: leftX + 6, y: nextY - 18 }, color, 1.8, groupId, nextZ()),
      makeLine(createId, { x: cx + 10, y: cy + 18 }, { x: rightX - 6, y: nextY - 18 }, color, 1.8, groupId, nextZ()),
      // Prime leaf (emerald)
      makeEllipse(createId, leftX, nextY, 20, 18, '#059669', '#10b98126', 2, groupId, nextZ()),
      makeText(createId, leftX - 8, nextY - 10, String(p), '#047857', 15, groupId, nextZ(), 24),
      // Quotient node
      makeEllipse(
        createId,
        rightX,
        nextY,
        24,
        18,
        i === factors.length - 2 ? '#059669' : color,
        i === factors.length - 2 ? '#10b98126' : '#4f46e518',
        2,
        groupId,
        nextZ()
      ),
      makeText(
        createId,
        rightX - 12,
        nextY - 10,
        String(nextRem),
        i === factors.length - 2 ? '#047857' : color,
        15,
        groupId,
        nextZ(),
        28
      )
    );

    remaining = nextRem;
    cx = rightX;
    cy = nextY;
  }

  // Canonical power summary rendered in textbook KaTeX
  const factorLatex = formatPrimeFactorizationLatex(num, factors);
  els.push(makeFormula(createId, center.x - 105, cy + 28, factorLatex, '#4f46e5', 17, groupId, nextZ(), 210, 44));

  return els;
}

const EXACT_TRIG_TABLE: Record<number, { rad: string; cos: string; sin: string; tan: string }> = {
  0: { rad: '0', cos: '1', sin: '0', tan: '0' },
  30: { rad: 'π/6', cos: '√3/2', sin: '1/2', tan: '√3/3' },
  45: { rad: 'π/4', cos: '√2/2', sin: '√2/2', tan: '1' },
  60: { rad: 'π/3', cos: '1/2', sin: '√3/2', tan: '√3' },
  90: { rad: 'π/2', cos: '0', sin: '1', tan: 'KXĐ' },
  120: { rad: '2π/3', cos: '-1/2', sin: '√3/2', tan: '-√3' },
  135: { rad: '3π/4', cos: '-√2/2', sin: '√2/2', tan: '-1' },
  150: { rad: '5π/6', cos: '-√3/2', sin: '1/2', tan: '-√3/3' },
  180: { rad: 'π', cos: '-1', sin: '0', tan: '0' },
  210: { rad: '7π/6', cos: '-√3/2', sin: '-1/2', tan: '√3/3' },
  225: { rad: '5π/4', cos: '-√2/2', sin: '-√2/2', tan: '1' },
  240: { rad: '4π/3', cos: '-1/2', sin: '-√3/2', tan: '√3' },
  270: { rad: '3π/2', cos: '0', sin: '-1', tan: 'KXĐ' },
  300: { rad: '5π/3', cos: '1/2', sin: '-√3/2', tan: '-√3' },
  315: { rad: '7π/4', cos: '√2/2', sin: '-√2/2', tan: '-1' },
  330: { rad: '11π/6', cos: '√3/2', sin: '-1/2', tan: '-√3/3' },
  360: { rad: '2π', cos: '1', sin: '0', tan: '0' },
};

export function getExactTrigInfo(degInput: number): {
  deg: number;
  radLabel: string;
  cosLabel: string;
  sinLabel: string;
  tanLabel: string;
  cosVal: number;
  sinVal: number;
} {
  const deg = ((Math.round(degInput) % 360) + 360) % 360;
  const rad = (deg * Math.PI) / 180;
  const cosVal = Math.cos(rad);
  const sinVal = Math.sin(rad);
  const exact = EXACT_TRIG_TABLE[deg];
  if (exact) {
    return {
      deg,
      radLabel: exact.rad,
      cosLabel: exact.cos,
      sinLabel: exact.sin,
      tanLabel: exact.tan,
      cosVal,
      sinVal,
    };
  }
  return {
    deg,
    radLabel: `${(deg / 180).toFixed(2)}π`,
    cosLabel: cosVal.toFixed(3),
    sinLabel: sinVal.toFixed(3),
    tanLabel: Math.abs(cosVal) < 1e-4 ? 'KXĐ' : (sinVal / cosVal).toFixed(3),
    cosVal,
    sinVal,
  };
}

export function buildUnitCircleElements(
  deg: number,
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const info = getExactTrigInfo(deg);
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const r = 110;
  const span = 148;
  const mx = center.x + r * info.cosVal;
  const my = center.y - r * info.sinVal;

  els.push(
    makeEllipse(createId, center.x, center.y, r, r, color, 'transparent', 2.2, groupId, nextZ()),
    makeLine(createId, { x: center.x - span, y: center.y }, { x: center.x + span, y: center.y }, color, 2, groupId, nextZ(), { type: 'arrow' }),
    makeLine(createId, { x: center.x, y: center.y + span }, { x: center.x, y: center.y - span }, color, 2, groupId, nextZ(), { type: 'arrow' }),
    makeText(createId, center.x + span - 24, center.y + 8, 'cos', color, 14, groupId, nextZ()),
    makeText(createId, center.x + 10, center.y - span, 'sin', color, 14, groupId, nextZ()),
    // Dashed projections
    makeLine(createId, { x: mx, y: my }, { x: mx, y: center.y }, '#2563eb', 1.8, groupId, nextZ(), { dashed: true }),
    makeLine(createId, { x: mx, y: my }, { x: center.x, y: my }, '#059669', 1.8, groupId, nextZ(), { dashed: true }),
    // Radius OM
    makeLine(createId, center, { x: mx, y: my }, '#4f46e5', 2.8, groupId, nextZ()),
    makeEllipse(createId, mx, my, 5.5, 5.5, '#4f46e5', '#4f46e5', 2, groupId, nextZ()),
    makeText(createId, mx + 10, my - 22, `M (${info.deg}° = ${info.radLabel})`, '#4f46e5', 14, groupId, nextZ(), 120),
    makeText(
      createId,
      center.x - 135,
      center.y + span + 8,
      `cos = ${info.cosLabel} · sin = ${info.sinLabel} · tan = ${info.tanLabel}`,
      color,
      14,
      groupId,
      nextZ(),
      270
    )
  );

  return els;
}

export interface StatisticsSummary {
  count: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  range: number;
  mode: number[];
  variance: number;
  stdDev: number;
}

function computeMedianSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeStatistics(values: number[]): StatisticsSummary | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const median = computeMedianSorted(sorted);

  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));
  const q1 = lowerHalf.length > 0 ? computeMedianSorted(lowerHalf) : sorted[0];
  const q3 = upperHalf.length > 0 ? computeMedianSorted(upperHalf) : sorted[n - 1];
  const iqr = q3 - q1;
  const range = sorted[n - 1] - sorted[0];

  const freq = new Map<number, number>();
  let maxFreq = 0;
  for (const v of sorted) {
    const f = (freq.get(v) || 0) + 1;
    freq.set(v, f);
    if (f > maxFreq) maxFreq = f;
  }
  const mode = Array.from(freq.entries())
    .filter(([, f]) => f === maxFreq)
    .map(([v]) => v);

  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return { count: n, mean, median, q1, q3, iqr, range, mode, variance, stdDev };
}

export function buildBarChartElements(
  items: { label: string; value: number }[],
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const safeItems = items.filter((it) => Number.isFinite(it.value) && it.value >= 0).slice(0, 10);
  if (safeItems.length === 0) return [];

  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const chartW = Math.max(240, safeItems.length * 52 + 30);
  const chartH = 160;
  const left = center.x - chartW / 2;
  const bottom = center.y + chartH / 2;
  const maxVal = Math.max(...safeItems.map((it) => it.value), 1);
  const palette = ['#4f46e5', '#2563eb', '#059669', '#d97706', '#e11d48', '#7c3aed'];

  // Axes
  els.push(
    makeLine(createId, { x: left, y: bottom }, { x: left + chartW, y: bottom }, color, 2, groupId, nextZ(), { type: 'arrow' }),
    makeLine(createId, { x: left, y: bottom }, { x: left, y: bottom - chartH - 18 }, color, 2, groupId, nextZ(), { type: 'arrow' })
  );

  safeItems.forEach((it, idx) => {
    const barW = 30;
    const bx = left + 22 + idx * 50;
    const bh = Math.max(4, Math.round((it.value / maxVal) * (chartH - 18)));
    const barCol = palette[idx % palette.length];
    els.push(
      makeRect(createId, bx, bottom - bh, barW, bh, barCol, `${barCol}33`, 2, groupId, nextZ()),
      makeText(createId, bx + 4, bottom - bh - 22, String(it.value), barCol, 12, groupId, nextZ(), 28),
      makeText(createId, bx, bottom + 8, it.label.slice(0, 6), color, 12, groupId, nextZ(), 36)
    );
  });

  return els;
}

export function buildVennDiagramElements(
  labelA: string,
  labelB: string,
  center: Point,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const groupId = createId('grp');
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const r = 82;
  const shift = 46;
  return [
    makeEllipse(createId, center.x - shift, center.y, r, r, '#2563eb', '#3b82f61e', 2.4, groupId, nextZ()),
    makeEllipse(createId, center.x + shift, center.y, r, r, '#059669', '#10b9811e', 2.4, groupId, nextZ()),
    makeText(createId, center.x - shift - 48, center.y - 12, labelA || 'Tập A', '#2563eb', 16, groupId, nextZ(), 64),
    makeText(createId, center.x + shift + 8, center.y - 12, labelB || 'Tập B', '#059669', 16, groupId, nextZ(), 64),
    makeText(createId, center.x - 18, center.y - 12, 'A∩B', '#4f46e5', 14, groupId, nextZ(), 42),
  ];
}

export function buildProbabilityTreeElements(
  pA: number,
  pBGivenA: number,
  pBGivenNotA: number,
  center: Point,
  color: string,
  startZIndex: number,
  createId: (p: string) => string
): BoardElement[] {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const a = clamp01(pA);
  const notA = Number((1 - a).toFixed(4));
  const ba = clamp01(pBGivenA);
  const notBa = Number((1 - ba).toFixed(4));
  const bna = clamp01(pBGivenNotA);
  const notBna = Number((1 - bna).toFixed(4));

  const groupId = createId('grp');
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  const root: Point = { x: center.x - 190, y: center.y };
  const nA: Point = { x: center.x - 50, y: center.y - 68 };
  const nNotA: Point = { x: center.x - 50, y: center.y + 68 };

  const leaves: { from: Point; to: Point; edgeLabel: string; nodeLabel: string; prob: number }[] = [
    { from: nA, to: { x: center.x + 110, y: center.y - 102 }, edgeLabel: String(ba), nodeLabel: 'B', prob: a * ba },
    { from: nA, to: { x: center.x + 110, y: center.y - 34 }, edgeLabel: String(notBa), nodeLabel: 'B̄', prob: a * notBa },
    { from: nNotA, to: { x: center.x + 110, y: center.y + 34 }, edgeLabel: String(bna), nodeLabel: 'B', prob: notA * bna },
    { from: nNotA, to: { x: center.x + 110, y: center.y + 102 }, edgeLabel: String(notBna), nodeLabel: 'B̄', prob: notA * notBna },
  ];

  const els: BoardElement[] = [
    makeEllipse(createId, root.x, root.y, 5, 5, color, color, 2, groupId, nextZ()),
    makeLine(createId, root, nA, '#2563eb', 2.2, groupId, nextZ()),
    makeLine(createId, root, nNotA, '#64748b', 2.2, groupId, nextZ()),
    makeText(createId, (root.x + nA.x) / 2 - 14, (root.y + nA.y) / 2 - 22, String(a), '#2563eb', 13, groupId, nextZ()),
    makeText(createId, (root.x + nNotA.x) / 2 - 14, (root.y + nNotA.y) / 2 + 4, String(notA), '#64748b', 13, groupId, nextZ()),
    makeText(createId, nA.x - 10, nA.y - 26, 'A', '#2563eb', 15, groupId, nextZ()),
    makeText(createId, nNotA.x - 10, nNotA.y + 6, 'Ā', '#64748b', 15, groupId, nextZ()),
  ];

  for (const lf of leaves) {
    els.push(
      makeLine(createId, lf.from, lf.to, color, 1.8, groupId, nextZ()),
      makeText(createId, (lf.from.x + lf.to.x) / 2 - 12, (lf.from.y + lf.to.y) / 2 - 18, lf.edgeLabel, color, 12, groupId, nextZ()),
      makeText(
        createId,
        lf.to.x + 10,
        lf.to.y - 11,
        `${lf.nodeLabel}  →  P = ${lf.prob.toFixed(3)}`,
        '#4f46e5',
        13,
        groupId,
        nextZ(),
        118
      )
    );
  }

  return els;
}

/* ============================================================================
 * 5. 3D SOLID GEOMETRY ENGINE (HIDDEN-LINE DASHED + UNFOLDING NETS + Oxyz)
 * ============================================================================ */

export type Solid3DType =
  | 'square-pyramid'
  | 'tetrahedron'
  | 'cube'
  | 'cuboid'
  | 'triangular-prism'
  | 'cylinder'
  | 'cone'
  | 'sphere'
  | 'oxyz';

export interface Solid3DDefinition {
  id: Solid3DType;
  label: string;
  supportsUnfold: boolean;
}

export const SOLID_3D_CATALOG: Solid3DDefinition[] = [
  { id: 'square-pyramid', label: 'Chóp tứ giác đều S.ABCD', supportsUnfold: true },
  { id: 'tetrahedron', label: 'Chóp tam giác S.ABC', supportsUnfold: true },
  { id: 'cube', label: 'Hình lập phương', supportsUnfold: true },
  { id: 'cuboid', label: 'Hình hộp chữ nhật', supportsUnfold: false },
  { id: 'triangular-prism', label: 'Lăng trụ đứng tam giác', supportsUnfold: false },
  { id: 'cylinder', label: 'Hình trụ tròn xoay', supportsUnfold: false },
  { id: 'cone', label: 'Hình nón tròn xoay', supportsUnfold: false },
  { id: 'sphere', label: 'Hình cầu tâm O', supportsUnfold: false },
  { id: 'oxyz', label: 'Hệ trục tọa độ Oxyz', supportsUnfold: false },
];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedEdge2D {
  from: Point;
  to: Point;
  dashed: boolean;
  isArrow?: boolean;
  color?: string;
}

export interface ProjectedLabel2D {
  pos: Point;
  text: string;
  color?: string;
}

export interface ProjectedSolid2D {
  edges: ProjectedEdge2D[];
  labels: ProjectedLabel2D[];
}

function rotate3D(v: Vec3, yaw: number, pitch: number): Vec3 {
  // Rotate around Y (yaw), then around X (pitch)
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = v.x * cosY + v.z * sinY;
  const z1 = -v.x * sinY + v.z * cosY;

  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = v.y * cosP - z1 * sinP;
  const z2 = v.y * sinP + z1 * cosP;
  return { x: x1, y: y2, z: z2 };
}

function projectPolyhedron(
  vertices: { pos: Vec3; label?: string }[],
  faces: number[][],
  yaw: number,
  pitch: number,
  scale: number
): ProjectedSolid2D {
  const rotated = vertices.map((v) => rotate3D(v.pos, yaw, pitch));
  const pts2D: Point[] = rotated.map((r) => ({ x: r.x * scale, y: -r.y * scale }));

  // Face normal Z in camera space (viewer looks along -Z toward origin, +Z is toward viewer)
  const faceVisible: boolean[] = faces.map((face) => {
    const a = rotated[face[0]];
    const b = rotated[face[1]];
    const c = rotated[face[2]];
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const nz = ux * vy - uy * vx;
    return nz > 0.0001;
  });

  // Collect unique edges and determine if at least one adjacent face is visible
  const edgeMap = new Map<string, { i: number; j: number; visible: boolean }>();
  faces.forEach((face, fIdx) => {
    const vis = faceVisible[fIdx];
    for (let k = 0; k < face.length; k += 1) {
      const i = face[k];
      const j = face[(k + 1) % face.length];
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.visible = existing.visible || vis;
      } else {
        edgeMap.set(key, { i, j, visible: vis });
      }
    }
  });

  const edges: ProjectedEdge2D[] = Array.from(edgeMap.values()).map((e) => ({
    from: pts2D[e.i],
    to: pts2D[e.j],
    dashed: !e.visible,
  }));

  const labels: ProjectedLabel2D[] = vertices
    .map((v, idx) =>
      v.label
        ? {
            pos: {
              x: pts2D[idx].x + (pts2D[idx].x >= 0 ? 10 : -18),
              y: pts2D[idx].y + (pts2D[idx].y >= 0 ? 6 : -20),
            },
            text: v.label,
          }
        : null
    )
    .filter((l): l is ProjectedLabel2D => l !== null);

  return { edges, labels };
}

function projectUnfoldedNet(solidType: Solid3DType, unfoldT: number, scale: number): ProjectedSolid2D {
  // Smoothly interpolate from 3D folded state to flat 2D net for cube, square-pyramid, tetrahedron
  const t = Math.max(0, Math.min(1, unfoldT));
  const edges: ProjectedEdge2D[] = [];
  const labels: ProjectedLabel2D[] = [];

  if (solidType === 'cube') {
    const s = scale * 0.62;
    const angle = (Math.PI / 2) * (1 - t); // 0 = flat net, pi/2 = folded
    // Draw clean 2D cross net with subtle fold-angle perspective foreshortening
    const foreshorten = Math.cos(angle * 0.65);
    const rects: [number, number, string][] = [
      [0, 0, 'Đáy'],
      [0, -s * foreshorten, 'Sau'],
      [0, s * foreshorten, 'Trước'],
      [-s * foreshorten, 0, 'Trái'],
      [s * foreshorten, 0, 'Phải'],
      [0, s * foreshorten * 2, 'Nắp'],
    ];
    for (const [cx, cy, lbl] of rects) {
      const hw = (lbl === 'Trái' || lbl === 'Phải' ? s * foreshorten : s) / 2;
      const hh = (lbl === 'Trái' || lbl === 'Phải' || lbl === 'Đáy' ? s : s * foreshorten) / 2;
      const p1 = { x: cx - hw, y: cy - hh };
      const p2 = { x: cx + hw, y: cy - hh };
      const p3 = { x: cx + hw, y: cy + hh };
      const p4 = { x: cx - hw, y: cy + hh };
      edges.push(
        { from: p1, to: p2, dashed: false },
        { from: p2, to: p3, dashed: false },
        { from: p3, to: p4, dashed: false },
        { from: p4, to: p1, dashed: false }
      );
      if (t > 0.35) {
        labels.push({ pos: { x: cx - 14, y: cy - 8 }, text: lbl });
      }
    }
    return { edges, labels };
  }

  // Square pyramid & tetrahedron star-net
  const r = scale * 0.52;
  const petalLen = r * (0.35 + 0.95 * t);
  if (solidType === 'square-pyramid') {
    const p = [
      { x: -r, y: -r },
      { x: r, y: -r },
      { x: r, y: r },
      { x: -r, y: r },
    ];
    for (let i = 0; i < 4; i += 1) {
      const a = p[i];
      const b = p[(i + 1) % 4];
      edges.push({ from: a, to: b, dashed: false });
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const nx = mx === 0 ? 0 : Math.sign(mx);
      const ny = my === 0 ? 0 : Math.sign(my);
      const tip = { x: mx + nx * petalLen, y: my + ny * petalLen };
      edges.push({ from: a, to: tip, dashed: false }, { from: b, to: tip, dashed: false });
    }
    labels.push(
      { pos: { x: -r - 16, y: -r - 16 }, text: 'A' },
      { pos: { x: r + 6, y: -r - 16 }, text: 'B' },
      { pos: { x: r + 6, y: r + 4 }, text: 'C' },
      { pos: { x: -r - 16, y: r + 4 }, text: 'D' }
    );
    return { edges, labels };
  }

  // Tetrahedron triangular net
  const h = r * Math.sqrt(3);
  const v = [
    { x: 0, y: -h * 0.55 },
    { x: -r, y: h * 0.45 },
    { x: r, y: h * 0.45 },
  ];
  for (let i = 0; i < 3; i += 1) {
    const a = v[i];
    const b = v[(i + 1) % 3];
    const opp = v[(i + 2) % 3];
    edges.push({ from: a, to: b, dashed: false });
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = mx - opp.x;
    const dy = my - opp.y;
    const tip = { x: mx + dx * t, y: my + dy * t };
    edges.push({ from: a, to: tip, dashed: false }, { from: b, to: tip, dashed: false });
  }
  return { edges, labels };
}

export function projectSolid3D(
  solidType: Solid3DType,
  yaw: number,
  pitch: number,
  scale = 95,
  unfoldProgress = 0,
  oxyzPoint?: Vec3
): ProjectedSolid2D {
  if (
    unfoldProgress > 0.02 &&
    (solidType === 'cube' || solidType === 'square-pyramid' || solidType === 'tetrahedron')
  ) {
    return projectUnfoldedNet(solidType, unfoldProgress, scale);
  }

  if (solidType === 'cube' || solidType === 'cuboid') {
    const sx = solidType === 'cuboid' ? 1.25 : 0.9;
    const sy = 0.85;
    const sz = 0.8;
    const verts = [
      { pos: { x: -sx, y: -sy, z: sz }, label: 'A' },
      { pos: { x: sx, y: -sy, z: sz }, label: 'B' },
      { pos: { x: sx, y: -sy, z: -sz }, label: 'C' },
      { pos: { x: -sx, y: -sy, z: -sz }, label: 'D' },
      { pos: { x: -sx, y: sy, z: sz }, label: "A'" },
      { pos: { x: sx, y: sy, z: sz }, label: "B'" },
      { pos: { x: sx, y: sy, z: -sz }, label: "C'" },
      { pos: { x: -sx, y: sy, z: -sz }, label: "D'" },
    ];
    // Outward-facing CCW vertex order
    const faces = [
      [0, 3, 2, 1], // bottom
      [4, 5, 6, 7], // top
      [0, 1, 5, 4], // front
      [1, 2, 6, 5], // right
      [2, 3, 7, 6], // back
      [3, 0, 4, 7], // left
    ];
    return projectPolyhedron(verts, faces, yaw, pitch, scale);
  }

  if (solidType === 'square-pyramid') {
    const s = 1.0;
    const verts = [
      { pos: { x: 0, y: 1.25, z: 0 }, label: 'S' },
      { pos: { x: -s, y: -0.75, z: s }, label: 'A' },
      { pos: { x: s, y: -0.75, z: s }, label: 'B' },
      { pos: { x: s, y: -0.75, z: -s }, label: 'C' },
      { pos: { x: -s, y: -0.75, z: -s }, label: 'D' },
    ];
    const faces = [
      [1, 4, 3, 2], // base
      [0, 1, 2],
      [0, 2, 3],
      [0, 3, 4],
      [0, 4, 1],
    ];
    return projectPolyhedron(verts, faces, yaw, pitch, scale);
  }

  if (solidType === 'tetrahedron') {
    const verts = [
      { pos: { x: 0, y: 1.2, z: 0 }, label: 'S' },
      { pos: { x: -1.1, y: -0.75, z: 0.65 }, label: 'A' },
      { pos: { x: 1.1, y: -0.75, z: 0.65 }, label: 'B' },
      { pos: { x: 0, y: -0.75, z: -1.15 }, label: 'C' },
    ];
    const faces = [
      [1, 3, 2],
      [0, 1, 2],
      [0, 2, 3],
      [0, 3, 1],
    ];
    return projectPolyhedron(verts, faces, yaw, pitch, scale);
  }

  if (solidType === 'triangular-prism') {
    const verts = [
      { pos: { x: -1.0, y: -0.9, z: 0.6 }, label: 'A' },
      { pos: { x: 1.0, y: -0.9, z: 0.6 }, label: 'B' },
      { pos: { x: 0, y: -0.9, z: -1.0 }, label: 'C' },
      { pos: { x: -1.0, y: 0.9, z: 0.6 }, label: "A'" },
      { pos: { x: 1.0, y: 0.9, z: 0.6 }, label: "B'" },
      { pos: { x: 0, y: 0.9, z: -1.0 }, label: "C'" },
    ];
    const faces = [
      [0, 2, 1],
      [3, 4, 5],
      [0, 1, 4, 3],
      [1, 2, 5, 4],
      [2, 0, 3, 5],
    ];
    return projectPolyhedron(verts, faces, yaw, pitch, scale);
  }

  if (solidType === 'cylinder' || solidType === 'cone') {
    const edges: ProjectedEdge2D[] = [];
    const segs = 28;
    const r = 0.92;
    const yBot = -0.95;
    const yTop = 0.95;

    const projectPt = (v: Vec3) => {
      const rv = rotate3D(v, yaw, pitch);
      return { x: rv.x * scale, y: -rv.y * scale, z: rv.z };
    };

    // Bottom circle
    const botPts = Array.from({ length: segs }, (_, i) => {
      const a = (i * Math.PI * 2) / segs;
      return projectPt({ x: r * Math.cos(a), y: yBot, z: r * Math.sin(a) });
    });
    const botMinZ = Math.min(...botPts.map((p) => p.z));
    const botMaxZ = Math.max(...botPts.map((p) => p.z));
    const botMidZ = (botMinZ + botMaxZ) / 2;

    for (let i = 0; i < segs; i += 1) {
      const p1 = botPts[i];
      const p2 = botPts[(i + 1) % segs];
      edges.push({ from: p1, to: p2, dashed: (p1.z + p2.z) / 2 < botMidZ });
    }

    // Extreme silhouette left/right points on bottom circle
    let leftIdx = 0;
    let rightIdx = 0;
    botPts.forEach((p, idx) => {
      if (p.x < botPts[leftIdx].x) leftIdx = idx;
      if (p.x > botPts[rightIdx].x) rightIdx = idx;
    });

    if (solidType === 'cone') {
      const apex = projectPt({ x: 0, y: yTop + 0.15, z: 0 });
      const centerBot = projectPt({ x: 0, y: yBot, z: 0 });
      edges.push(
        { from: apex, to: botPts[leftIdx], dashed: false },
        { from: apex, to: botPts[rightIdx], dashed: false },
        { from: apex, to: centerBot, dashed: true },
        { from: centerBot, to: botPts[rightIdx], dashed: true }
      );
      return {
        edges,
        labels: [
          { pos: { x: apex.x - 6, y: apex.y - 24 }, text: 'S' },
          { pos: { x: centerBot.x - 16, y: centerBot.y + 4 }, text: 'O' },
        ],
      };
    }

    // Cylinder top circle
    const topPts = Array.from({ length: segs }, (_, i) => {
      const a = (i * Math.PI * 2) / segs;
      return projectPt({ x: r * Math.cos(a), y: yTop, z: r * Math.sin(a) });
    });
    for (let i = 0; i < segs; i += 1) {
      edges.push({ from: topPts[i], to: topPts[(i + 1) % segs], dashed: false });
    }
    edges.push(
      { from: topPts[leftIdx], to: botPts[leftIdx], dashed: false },
      { from: topPts[rightIdx], to: botPts[rightIdx], dashed: false }
    );
    const cTop = projectPt({ x: 0, y: yTop, z: 0 });
    const cBot = projectPt({ x: 0, y: yBot, z: 0 });
    edges.push({ from: cTop, to: cBot, dashed: true });
    return {
      edges,
      labels: [
        { pos: { x: cTop.x - 16, y: cTop.y - 18 }, text: "O'" },
        { pos: { x: cBot.x - 16, y: cBot.y + 4 }, text: 'O' },
      ],
    };
  }

  if (solidType === 'sphere') {
    const edges: ProjectedEdge2D[] = [];
    const segs = 32;
    const r = 1.05;
    // Outer silhouette circle
    for (let i = 0; i < segs; i += 1) {
      const a1 = (i * Math.PI * 2) / segs;
      const a2 = ((i + 1) * Math.PI * 2) / segs;
      edges.push({
        from: { x: r * scale * Math.cos(a1), y: r * scale * Math.sin(a1) },
        to: { x: r * scale * Math.cos(a2), y: r * scale * Math.sin(a2) },
        dashed: false,
      });
    }
    // Equator ellipse with hidden back half dashed
    const eqPts = Array.from({ length: segs }, (_, i) => {
      const a = (i * Math.PI * 2) / segs;
      const rv = rotate3D({ x: r * Math.cos(a), y: 0, z: r * Math.sin(a) }, yaw, pitch);
      return { x: rv.x * scale, y: -rv.y * scale, z: rv.z };
    });
    for (let i = 0; i < segs; i += 1) {
      const p1 = eqPts[i];
      const p2 = eqPts[(i + 1) % segs];
      edges.push({ from: p1, to: p2, dashed: (p1.z + p2.z) / 2 < 0 });
    }
    edges.push({ from: { x: 0, y: 0 }, to: { x: r * scale * 0.82, y: -r * scale * 0.2 }, dashed: true });
    return {
      edges,
      labels: [
        { pos: { x: -16, y: 4 }, text: 'O' },
        { pos: { x: r * scale * 0.42, y: -r * scale * 0.28 }, text: 'R' },
      ],
    };
  }

  // Oxyz 3D Coordinate Space (Lớp 12)
  const proj = (v: Vec3): Point => {
    const rv = rotate3D(v, yaw, pitch);
    return { x: rv.x * scale, y: -rv.y * scale };
  };
  const O = proj({ x: 0, y: 0, z: 0 });
  // Textbook convention: x forward-left, y right, z up
  const X = proj({ x: 0, y: 0, z: 1.45 });
  const Y = proj({ x: 1.45, y: 0, z: 0 });
  const Z = proj({ x: 0, y: 1.45, z: 0 });

  const edges: ProjectedEdge2D[] = [
    { from: O, to: X, dashed: false, isArrow: true, color: '#e11d48' },
    { from: O, to: Y, dashed: false, isArrow: true, color: '#059669' },
    { from: O, to: Z, dashed: false, isArrow: true, color: '#2563eb' },
  ];
  const labels: ProjectedLabel2D[] = [
    { pos: { x: O.x - 16, y: O.y + 4 }, text: 'O' },
    { pos: { x: X.x - 14, y: X.y + 4 }, text: 'x', color: '#e11d48' },
    { pos: { x: Y.x + 8, y: Y.y - 8 }, text: 'y', color: '#059669' },
    { pos: { x: Z.x + 8, y: Z.y - 14 }, text: 'z', color: '#2563eb' },
  ];

  if (oxyzPoint) {
    const s = 0.32;
    // Map textbook (x, y, z) -> our 3D space (y -> +X, z -> +Y, x -> +Z)
    const px = oxyzPoint.y * s;
    const py = oxyzPoint.z * s;
    const pz = oxyzPoint.x * s;
    const pA = proj({ x: px, y: py, z: pz });
    const pFoot = proj({ x: px, y: 0, z: pz });
    const pOnX = proj({ x: 0, y: 0, z: pz });
    const pOnY = proj({ x: px, y: 0, z: 0 });
    edges.push(
      { from: O, to: pA, dashed: false, isArrow: true, color: '#4f46e5' },
      { from: pA, to: pFoot, dashed: true, color: '#4f46e5' },
      { from: pFoot, to: pOnX, dashed: true, color: '#94a3b8' },
      { from: pFoot, to: pOnY, dashed: true, color: '#94a3b8' }
    );
    labels.push({
      pos: { x: pA.x + 8, y: pA.y - 18 },
      text: `A(${oxyzPoint.x}; ${oxyzPoint.y}; ${oxyzPoint.z})`,
      color: '#4f46e5',
    });
  }

  return { edges, labels };
}

/**
 * Snapshots the live 3D projection into native grouped 2D vector lines (solid + dashed) & vertex labels on canvas.
 */
export function buildSolid3DSnapshotElements(options: {
  solidType: Solid3DType;
  yaw: number;
  pitch: number;
  unfoldProgress?: number;
  oxyzPoint?: Vec3;
  center: Point;
  color: string;
  startZIndex: number;
  createId: (p: string) => string;
}): BoardElement[] {
  const {
    solidType,
    yaw,
    pitch,
    unfoldProgress = 0,
    oxyzPoint,
    center,
    color,
    startZIndex,
    createId,
  } = options;
  const projected = projectSolid3D(solidType, yaw, pitch, 118, unfoldProgress, oxyzPoint);
  const groupId = createId('grp');
  const els: BoardElement[] = [];
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  for (const edge of projected.edges) {
    els.push(
      makeLine(
        createId,
        { x: center.x + edge.from.x, y: center.y + edge.from.y },
        { x: center.x + edge.to.x, y: center.y + edge.to.y },
        edge.color || color,
        edge.dashed ? 2 : 2.6,
        groupId,
        nextZ(),
        { type: edge.isArrow ? 'arrow' : 'line', dashed: edge.dashed }
      )
    );
  }

  for (const lbl of projected.labels) {
    els.push(
      makeText(
        createId,
        center.x + lbl.pos.x,
        center.y + lbl.pos.y,
        lbl.text,
        lbl.color || color,
        15,
        groupId,
        nextZ(),
        28
      )
    );
  }

  return els;
}
