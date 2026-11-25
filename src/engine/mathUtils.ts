import { BoardElement, FormulaElement, Point, ShapeElement, StrokeElement, TextElement } from '../types/board';
import { getElementBounds } from './geometry';
import { friendlyMathToLatex } from './mathDisplay';
import { AppLanguage, getAppLanguage, tr } from '../i18n';

/** 1 mathematical unit = 40 world pixels on the Oxy coordinate plane */
export const MATH_UNIT_PX = 40;

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

const FUNCTIONS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: (v: number) => Math.log10(v),
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
};

/**
 * Normalizes friendly Vietnamese / Unicode math input into canonical ASCII expression syntax.
 * Example: "y = 2x² - 3×x + √x" -> "2*x^2 - 3*x + sqrt(x)"
 */
export function normalizeMathInput(raw: string): string {
  let s = raw.trim();
  // Strip leading "y =" or "f(x) ="
  s = s.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
  s = s
    .replace(/×|·/g, '*')
    .replace(/÷/g, '/')
    .replace(/−|–|—/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/π/g, 'pi')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([a-zA-Z0-9_.]+)/g, 'sqrt($1)')
    .replace(/,/g, '.');
  return s.trim();
}

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let start = i;
      let dotCount = 0;
      while (i < len && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        if (expr[i] === '.') dotCount += 1;
        i += 1;
      }
      if (dotCount > 1) return null;
      // Support scientific notation like `1.5e-7` or `2.3E+10` (only when `e`/`E` is followed by `[+-]\d`)
      if (
        i < len &&
        (expr[i] === 'e' || expr[i] === 'E') &&
        i + 2 < len &&
        (expr[i + 1] === '+' || expr[i + 1] === '-') &&
        expr[i + 2] >= '0' &&
        expr[i + 2] <= '9'
      ) {
        i += 2;
        while (i < len && expr[i] >= '0' && expr[i] <= '9') {
          i += 1;
        }
      }
      const numStr = expr.slice(start, i);
      if (numStr === '.') return null;
      tokens.push({ type: 'number', value: Number(numStr) });
      continue;
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      const start = i;
      while (i < len && ((expr[i] >= 'a' && expr[i] <= 'z') || (expr[i] >= 'A' && expr[i] <= 'Z'))) {
        i += 1;
      }
      const ident = expr.slice(start, i).toLowerCase();
      tokens.push({ type: 'ident', value: ident });
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }

    return null;
  }

  // Insert implicit multiplication tokens (e.g., 2x -> 2*x, 2(x+1) -> 2*(x+1), (x)(x+1), 2sin(x), x pi)
  const withImplicit: Token[] = [];
  for (let idx = 0; idx < tokens.length; idx += 1) {
    const curr = tokens[idx];
    const prev = withImplicit[withImplicit.length - 1];
    if (prev) {
      const prevEndsValue =
        prev.type === 'number' ||
        prev.type === 'rparen' ||
        (prev.type === 'ident' && !(prev.value in FUNCTIONS));
      const currStartsValue =
        curr.type === 'number' || curr.type === 'ident' || curr.type === 'lparen';
      if (prevEndsValue && currStartsValue) {
        withImplicit.push({ type: 'op', value: '*' });
      }
    }
    withImplicit.push(curr);
  }

  return withImplicit;
}

export type CompiledMathFn = (x: number) => number;

/**
 * Safely compiles a mathematical expression into a pure JavaScript function f(x)
 * using a recursive-descent parser (no eval / no Function constructor).
 * Returns null if the syntax is invalid or uses unknown identifiers.
 */
export function compileMathExpression(raw: string): CompiledMathFn | null {
  const normalized = normalizeMathInput(raw);
  if (!normalized) return null;
  const tokens = tokenize(normalized);
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpression(): CompiledMathFn | null {
    let left: CompiledMathFn | null = parseTerm();
    if (!left) return null;
    while (peek()?.type === 'op' && (peek() as { value: string }).value.match(/^[+-]$/)) {
      const op = (consume() as { type: 'op'; value: '+' | '-' }).value;
      const right = parseTerm();
      if (!right) return null;
      const prevLeft: CompiledMathFn = left;
      left = op === '+' ? (x: number) => prevLeft(x) + right(x) : (x: number) => prevLeft(x) - right(x);
    }
    return left;
  }

  function parseTerm(): CompiledMathFn | null {
    let left: CompiledMathFn | null = parseUnary();
    if (!left) return null;
    while (peek()?.type === 'op' && ((peek() as { value: string }).value === '*' || (peek() as { value: string }).value === '/')) {
      const op = (consume() as { type: 'op'; value: '*' | '/' }).value;
      const right = parseUnary();
      if (!right) return null;
      const prevLeft: CompiledMathFn = left;
      left = op === '*' ? (x: number) => prevLeft(x) * right(x) : (x: number) => prevLeft(x) / right(x);
    }
    return left;
  }

  function parseUnary(): CompiledMathFn | null {
    if (peek()?.type === 'op' && (peek() as { value: string }).value === '+') {
      consume();
      return parseUnary();
    }
    if (peek()?.type === 'op' && (peek() as { value: string }).value === '-') {
      consume();
      const inner = parseUnary();
      if (!inner) return null;
      return (x) => -inner(x);
    }
    return parsePower();
  }

  function parsePower(): CompiledMathFn | null {
    const base = parsePrimary();
    if (!base) return null;
    if (peek()?.type === 'op' && (peek() as { value: string }).value === '^') {
      consume();
      // Right-associative exponentiation (supports x^-2 and 2^3^2)
      const exponent = parseUnary();
      if (!exponent) return null;
      return (x) => Math.pow(base(x), exponent(x));
    }
    return base;
  }

  function parsePrimary(): CompiledMathFn | null {
    const tok = peek();
    if (!tok) return null;

    if (tok.type === 'number') {
      consume();
      const val = tok.value;
      return () => val;
    }

    if (tok.type === 'lparen') {
      consume();
      const inner = parseExpression();
      if (!inner || peek()?.type !== 'rparen') return null;
      consume();
      return inner;
    }

    if (tok.type === 'ident') {
      consume();
      if (tok.value === 'x') {
        return (x) => x;
      }
      if (tok.value in CONSTANTS) {
        const c = CONSTANTS[tok.value];
        return () => c;
      }
      if (tok.value in FUNCTIONS) {
        const fn = FUNCTIONS[tok.value];
        if (peek()?.type === 'lparen') {
          consume();
          const arg = parseExpression();
          if (!arg || peek()?.type !== 'rparen') return null;
          consume();
          return (x) => fn(arg(x));
        }
        // Allow shorthand like "sin x" or "sqrt x"
        const arg = parseUnary();
        if (!arg) return null;
        return (x) => fn(arg(x));
      }
      return null;
    }

    return null;
  }

  const ast = parseExpression();
  if (!ast || pos !== tokens.length) return null;
  return ast;
}

export function evaluateMathExpression(raw: string, x = 0): number | null {
  const fn = compileMathExpression(raw);
  if (!fn) return null;
  const val = fn(x);
  if (!Number.isFinite(val)) return null;
  return val;
}

/**
 * Samples y = f(x) over [xMin, xMax] into continuous world-coordinate polyline segments,
 * breaking segments cleanly across undefined domains (e.g. sqrt(x) for x < 0) and vertical
 * asymptotes (e.g. 1/x at x = 0, tan(x) at pi/2).
 */
export function sampleFunctionSegments(
  expression: string,
  options: {
    xMin: number;
    xMax: number;
    yClamp?: number;
    steps?: number;
    unitPx?: number;
    origin?: Point;
  }
): [number, number, number][][] | null {
  const fn = compileMathExpression(expression);
  if (!fn) return null;

  const {
    xMin,
    xMax,
    yClamp = 12,
    steps = 260,
    unitPx = MATH_UNIT_PX,
    origin = { x: 0, y: 0 },
  } = options;

  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) return null;

  const segments: [number, number, number][][] = [];
  let current: [number, number, number][] = [];
  let prevMathY: number | null = null;
  const dx = (xMax - xMin) / Math.max(steps, 20);
  const jumpThreshold = Math.max(yClamp * 0.85, 6);

  for (let i = 0; i <= steps; i += 1) {
    const mathX = xMin + i * dx;
    const mathY = fn(mathX);

    if (!Number.isFinite(mathY) || Math.abs(mathY) > yClamp) {
      if (current.length >= 2) segments.push(current);
      current = [];
      prevMathY = null;
      continue;
    }

    if (prevMathY !== null && Math.abs(mathY - prevMathY) > jumpThreshold) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }

    const worldX = origin.x + mathX * unitPx;
    // Canvas Y increases downward, mathematical Y increases upward
    const worldY = origin.y - mathY * unitPx;
    current.push([worldX, worldY, 0.5]);
    prevMathY = mathY;
  }

  if (current.length >= 2) {
    segments.push(current);
  }

  return segments;
}

/**
 * Builds grouped native whiteboard elements (curve strokes + function label) for a plotted graph.
 */
export function buildGraphPlotElements(options: {
  expression: string;
  color: string;
  xMin: number;
  xMax: number;
  startZIndex: number;
  createId: (prefix: string) => string;
  origin?: Point;
  unitPx?: number;
}): BoardElement[] | null {
  const {
    expression,
    color,
    xMin,
    xMax,
    startZIndex,
    createId,
    origin = { x: 0, y: 0 },
    unitPx = MATH_UNIT_PX,
  } = options;

  const segments = sampleFunctionSegments(expression, {
    xMin,
    xMax,
    origin,
    unitPx,
  });
  if (!segments || segments.length === 0) return null;

  const groupId = createId('grp');
  const created: BoardElement[] = [];
  let z = startZIndex;

  for (const pts of segments) {
    z += 1;
    const base: StrokeElement = {
      id: createId('el'),
      type: 'stroke',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      points: pts,
      color,
      strokeWidth: 3,
      groupIds: [groupId],
      zIndex: z,
    };
    const bounds = getElementBounds(base);
    created.push({
      ...base,
      x: bounds.minX,
      y: bounds.minY,
      width: Math.max(bounds.maxX - bounds.minX, 1),
      height: Math.max(bounds.maxY - bounds.minY, 1),
    });
  }

  // Place a crisp KaTeX function label near the rightmost visible sample point
  const lastSeg = segments[segments.length - 1];
  const anchor = lastSeg[Math.min(lastSeg.length - 1, Math.floor(lastSeg.length * 0.78))];
  const normalizedDisplay = normalizeMathInput(expression);
  const labelLatex = `y = ${friendlyMathToLatex(normalizedDisplay)}`;
  z += 1;
  const labelEl: FormulaElement = {
    id: createId('el'),
    type: 'formula',
    x: anchor[0] + 10,
    y: anchor[1] - 32,
    width: Math.max(130, Math.min(labelLatex.length * 9 + 44, 300)),
    height: 44,
    latex: labelLatex,
    color,
    fontSize: 16,
    groupIds: [groupId],
    zIndex: z,
  };
  created.push(labelEl);

  return created;
}

export type MathGeometryPresetId =
  | 'right-triangle'
  | 'equilateral-triangle'
  | 'circle-radius'
  | 'oxy-axes'
  | 'parallelogram'
  | 'number-line';

export interface MathGeometryPreset {
  id: MathGeometryPresetId;
  label: string;
  description: string;
}

export function getMathGeometryPresets(
  lang: AppLanguage = getAppLanguage()
): MathGeometryPreset[] {
  return [
    {
      id: 'right-triangle',
      label: tr('Tam giác vuông', 'Right triangle', lang),
      description: tr('Đỉnh A, B, C kèm ký hiệu góc vuông 90°', 'Vertices A, B, C with 90° right-angle mark', lang),
    },
    {
      id: 'equilateral-triangle',
      label: tr('Tam giác đều', 'Equilateral triangle', lang),
      description: tr('Ba cạnh bằng nhau chuẩn tỷ lệ hình học', 'Three equal sides in accurate proportion', lang),
    },
    {
      id: 'circle-radius',
      label: tr('Đường tròn tâm O', 'Circle (center O)', lang),
      description: tr('Hình tròn kèm tâm O và bán kính R', 'Circle with center O and radius R', lang),
    },
    {
      id: 'oxy-axes',
      label: tr('Hệ trục Oxy di động', 'Movable Oxy axes', lang),
      description: tr('Cặp trục tọa độ có thể di chuyển & nhóm', 'Movable and groupable coordinate axes', lang),
    },
    {
      id: 'parallelogram',
      label: tr('Hình bình hành', 'Parallelogram', lang),
      description: tr('Bốn đỉnh A, B, C, D song song đối xứng', 'Four vertices A, B, C, D with parallel sides', lang),
    },
    {
      id: 'number-line',
      label: tr('Trục số (-4 đến 4)', 'Number line (-4 to 4)', lang),
      description: tr('Trục số chia đều có vạch nguyên', 'Evenly spaced number line with integer ticks', lang),
    },
  ];
}

export const MATH_GEOMETRY_PRESETS: MathGeometryPreset[] = getMathGeometryPresets('vi');

function makeLine(
  createId: (p: string) => string,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
  groupId: string,
  zIndex: number,
  type: 'line' | 'arrow' = 'line'
): ShapeElement {
  return {
    id: createId('el'),
    type,
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    startPoint: start,
    endPoint: end,
    color,
    strokeWidth,
    groupIds: [groupId],
    zIndex,
  };
}

function makeLabel(
  createId: (p: string) => string,
  x: number,
  y: number,
  text: string,
  color: string,
  groupId: string,
  zIndex: number,
  fontSize = 16
): TextElement {
  return {
    id: createId('el'),
    type: 'text',
    x,
    y,
    width: Math.max(32, text.length * 12 + 12),
    height: 30,
    text,
    color,
    fontSize,
    groupIds: [groupId],
    zIndex,
  };
}

/**
 * Generates clean, native, pre-grouped geometric constructions centered at `center`.
 */
export function buildGeometryPresetElements(
  presetId: MathGeometryPresetId,
  center: Point,
  color: string,
  startZIndex: number,
  createId: (prefix: string) => string
): BoardElement[] {
  const groupId = createId('grp');
  let z = startZIndex;
  const nextZ = () => {
    z += 1;
    return z;
  };

  if (presetId === 'right-triangle') {
    const a: Point = { x: center.x - 100, y: center.y - 80 };
    const b: Point = { x: center.x - 100, y: center.y + 80 };
    const c: Point = { x: center.x + 120, y: center.y + 80 };
    const sq = 20;
    return [
      makeLine(createId, a, b, color, 3, groupId, nextZ()),
      makeLine(createId, b, c, color, 3, groupId, nextZ()),
      makeLine(createId, c, a, color, 3, groupId, nextZ()),
      // Right-angle corner square at B
      makeLine(createId, { x: b.x + sq, y: b.y }, { x: b.x + sq, y: b.y - sq }, color, 2, groupId, nextZ()),
      makeLine(createId, { x: b.x, y: b.y - sq }, { x: b.x + sq, y: b.y - sq }, color, 2, groupId, nextZ()),
      makeLabel(createId, a.x - 24, a.y - 24, 'A', color, groupId, nextZ()),
      makeLabel(createId, b.x - 26, b.y + 4, 'B', color, groupId, nextZ()),
      makeLabel(createId, c.x + 8, c.y + 4, 'C', color, groupId, nextZ()),
    ];
  }

  if (presetId === 'equilateral-triangle') {
    const side = 200;
    const h = (side * Math.sqrt(3)) / 2;
    const top: Point = { x: center.x, y: center.y - h / 2 };
    const bl: Point = { x: center.x - side / 2, y: center.y + h / 2 };
    const br: Point = { x: center.x + side / 2, y: center.y + h / 2 };
    return [
      makeLine(createId, top, bl, color, 3, groupId, nextZ()),
      makeLine(createId, bl, br, color, 3, groupId, nextZ()),
      makeLine(createId, br, top, color, 3, groupId, nextZ()),
      makeLabel(createId, top.x - 10, top.y - 30, 'A', color, groupId, nextZ()),
      makeLabel(createId, bl.x - 24, bl.y + 4, 'B', color, groupId, nextZ()),
      makeLabel(createId, br.x + 8, br.y + 4, 'C', color, groupId, nextZ()),
    ];
  }

  if (presetId === 'circle-radius') {
    const r = 90;
    const circle: ShapeElement = {
      id: createId('el'),
      type: 'ellipse',
      x: center.x - r,
      y: center.y - r,
      width: r * 2,
      height: r * 2,
      color,
      fillColor: `${color}14`,
      strokeWidth: 3,
      groupIds: [groupId],
      zIndex: nextZ(),
    };
    const dot: ShapeElement = {
      id: createId('el'),
      type: 'ellipse',
      x: center.x - 4,
      y: center.y - 4,
      width: 8,
      height: 8,
      color,
      fillColor: color,
      strokeWidth: 2,
      groupIds: [groupId],
      zIndex: nextZ(),
    };
    const rimPt: Point = { x: center.x + r * Math.cos(-Math.PI / 6), y: center.y + r * Math.sin(-Math.PI / 6) };
    return [
      circle,
      makeLine(createId, center, rimPt, color, 2, groupId, nextZ()),
      dot,
      makeLabel(createId, center.x - 22, center.y + 2, 'O', color, groupId, nextZ()),
      makeLabel(createId, center.x + r * 0.42, center.y - r * 0.42, 'R', color, groupId, nextZ()),
    ];
  }

  if (presetId === 'oxy-axes') {
    const span = 160;
    return [
      makeLine(createId, { x: center.x - span, y: center.y }, { x: center.x + span, y: center.y }, color, 2.5, groupId, nextZ(), 'arrow'),
      makeLine(createId, { x: center.x, y: center.y + span }, { x: center.x, y: center.y - span }, color, 2.5, groupId, nextZ(), 'arrow'),
      makeLabel(createId, center.x + span - 8, center.y + 8, 'x', color, groupId, nextZ()),
      makeLabel(createId, center.x + 12, center.y - span - 6, 'y', color, groupId, nextZ()),
      makeLabel(createId, center.x - 24, center.y + 6, 'O', color, groupId, nextZ()),
    ];
  }

  if (presetId === 'parallelogram') {
    const offset = 48;
    const w = 180;
    const h = 110;
    const a: Point = { x: center.x - w / 2 + offset, y: center.y - h / 2 };
    const b: Point = { x: center.x + w / 2 + offset, y: center.y - h / 2 };
    const c: Point = { x: center.x + w / 2 - offset, y: center.y + h / 2 };
    const d: Point = { x: center.x - w / 2 - offset, y: center.y + h / 2 };
    return [
      makeLine(createId, a, b, color, 3, groupId, nextZ()),
      makeLine(createId, b, c, color, 3, groupId, nextZ()),
      makeLine(createId, c, d, color, 3, groupId, nextZ()),
      makeLine(createId, d, a, color, 3, groupId, nextZ()),
      makeLabel(createId, a.x - 20, a.y - 24, 'A', color, groupId, nextZ()),
      makeLabel(createId, b.x + 6, b.y - 24, 'B', color, groupId, nextZ()),
      makeLabel(createId, c.x + 8, c.y + 4, 'C', color, groupId, nextZ()),
      makeLabel(createId, d.x - 22, d.y + 4, 'D', color, groupId, nextZ()),
    ];
  }

  // number-line (-4 to 4)
  const step = 44;
  const halfLen = step * 4.7;
  const items: BoardElement[] = [
    makeLine(
      createId,
      { x: center.x - halfLen, y: center.y },
      { x: center.x + halfLen, y: center.y },
      color,
      2.5,
      groupId,
      nextZ(),
      'arrow'
    ),
  ];
  for (let n = -4; n <= 4; n += 1) {
    const tx = center.x + n * step;
    items.push(
      makeLine(createId, { x: tx, y: center.y - 7 }, { x: tx, y: center.y + 7 }, color, 2, groupId, nextZ()),
      makeLabel(createId, tx - (n < 0 ? 13 : 8), center.y + 12, String(n), color, groupId, nextZ(), 14)
    );
  }
  return items;
}

export const MATH_SYMBOLS = [
  '√',
  'π',
  '∞',
  '±',
  '×',
  '÷',
  '≤',
  '≥',
  '≠',
  '≈',
  '∈',
  '∉',
  '⊂',
  '∪',
  '∩',
  '∀',
  '∃',
  '⇒',
  '⇔',
  '∫',
  '∑',
  'Δ',
  'α',
  'β',
  'θ',
  '∠',
  '⊥',
  '∥',
  '°',
  '²',
  '³',
  'ⁿ',
];

export function getMathFormulaTemplates(lang: AppLanguage = getAppLanguage()) {
  return [
    { label: tr('Biệt thức Δ', 'Discriminant Δ', lang), formula: 'Δ = b² - 4ac' },
    { label: tr('Nghiệm bậc 2', 'Quadratic root', lang), formula: 'x = (-b ± √Δ) / (2a)' },
    { label: tr('Pytago', 'Pythagoras', lang), formula: 'a² + b² = c²' },
    { label: tr('Lượng giác', 'Trigonometry', lang), formula: 'sin²α + cos²α = 1' },
    { label: tr('Diện tích tròn', 'Circle area', lang), formula: 'S = π · r²' },
    { label: tr('Tích phân', 'Integral', lang), formula: '∫ f(x) dx = F(x) + C' },
  ];
}

export const MATH_FORMULA_TEMPLATES = getMathFormulaTemplates('vi');

export const MATH_GRAPH_PRESETS = [
  { label: 'y = x²', expr: '0.25*x^2 - 2', color: '#4f46e5' },
  { label: 'y = sin(x)', expr: '2*sin(x)', color: '#059669' },
  { label: 'y = 2x + 1', expr: '2*x + 1', color: '#2563eb' },
  { label: 'y = 1/x', expr: '3/x', color: '#e11d48' },
  { label: 'y = √x', expr: '2*sqrt(x)', color: '#d97706' },
];
