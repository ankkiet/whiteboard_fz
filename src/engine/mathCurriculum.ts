import { MathGradeMode, Point } from '../types/board';
import { AppLanguage, getAppLanguage, tr } from '../i18n';

export interface GradeModeMeta {
  id: MathGradeMode;
  label: string;
  range: string;
  summary: string;
}

export function getMathGradeModes(lang: AppLanguage = getAppLanguage()): GradeModeMeta[] {
  return [
    {
      id: 'primary',
      label: tr('Tiểu học', 'Primary', lang),
      range: tr('Lớp 1–5', 'Grades 1–5', lang),
      summary: tr(
        'Học cụ kéo-thả, đặt tính, sơ đồ đoạn thẳng, phân số, đồng hồ & thước đo.',
        'Manipulatives, vertical arithmetic, bar models, fractions, clock & ruler.'
      ),
    },
    {
      id: 'middle',
      label: tr('THCS', 'Middle', lang),
      range: tr('Lớp 6–9', 'Grades 6–9', lang),
      summary: tr(
        'Hình học phẳng & compa/ê-ke, đồ thị bậc 1–2, thừa số nguyên tố, trải hình 3D & thống kê.',
        'Plane geometry & compass/set square, linear/quadratic graphs, prime factors, 3D nets & stats.'
      ),
    },
    {
      id: 'high',
      label: tr('THPT', 'High school', lang),
      range: tr('Lớp 10–12', 'Grades 10–12', lang),
      summary: tr(
        'Công thức chuẩn SGK, đồ thị tham số m & tích phân, bảng biến thiên, lượng giác, 3D/Oxyz & xác suất.',
        'Textbook formulas, parametric graphs & integrals, variation tables, trig, 3D/Oxyz & probability.'
      ),
    },
  ];
}

export const MATH_GRADE_MODES: GradeModeMeta[] = getMathGradeModes('vi');

export interface LatexKeypadKey {
  label: string;
  /** Crisp KaTeX formula rendered on the keycap */
  displayLatex: string;
  insert: string;
  title: string;
}

export function getLatexKeypadByGrade(
  lang: AppLanguage = getAppLanguage()
): Record<MathGradeMode, LatexKeypadKey[]> {
  return {
    primary: [
      { label: '+', displayLatex: '+', insert: ' + ', title: tr('Cộng', 'Add', lang) },
      { label: '−', displayLatex: '-', insert: ' - ', title: tr('Trừ', 'Subtract', lang) },
      { label: '×', displayLatex: '\\times', insert: ' \\times ', title: tr('Nhân', 'Multiply', lang) },
      { label: ':', displayLatex: ':', insert: ' : ', title: tr('Chia', 'Divide', lang) },
      { label: '=', displayLatex: '=', insert: ' = ', title: tr('Bằng', 'Equals', lang) },
      { label: '<', displayLatex: '<', insert: ' < ', title: tr('Nhỏ hơn', 'Less than', lang) },
      { label: '>', displayLatex: '>', insert: ' > ', title: tr('Lớn hơn', 'Greater than', lang) },
      { label: '≤', displayLatex: '\\le', insert: ' \\le ', title: tr('Nhỏ hơn hoặc bằng', 'Less than or equal', lang) },
      { label: '≥', displayLatex: '\\ge', insert: ' \\ge ', title: tr('Lớn hơn hoặc bằng', 'Greater than or equal', lang) },
      { label: 'a/b', displayLatex: '\\frac{a}{b}', insert: '\\frac{a}{b}', title: tr('Phân số', 'Fraction', lang) },
      { label: 'a b/c', displayLatex: '1\\frac{1}{2}', insert: '1\\frac{1}{2}', title: tr('Hỗn số', 'Mixed number', lang) },
      { label: 'cm', displayLatex: '\\text{cm}', insert: '\\text{ cm}', title: tr('Đơn vị cm', 'Centimeter (cm)', lang) },
      { label: 'dm', displayLatex: '\\text{dm}', insert: '\\text{ dm}', title: tr('Đơn vị dm', 'Decimeter (dm)', lang) },
      { label: 'm', displayLatex: '\\text{m}', insert: '\\text{ m}', title: tr('Đơn vị m', 'Meter (m)', lang) },
      { label: 'cm²', displayLatex: '\\text{cm}^2', insert: '\\text{ cm}^2', title: tr('Xăng-ti-mét vuông', 'Square centimeter', lang) },
      { label: 'kg', displayLatex: '\\text{kg}', insert: '\\text{ kg}', title: tr('Ki-lô-gam', 'Kilogram', lang) },
    ],
    middle: [
      { label: 'a/b', displayLatex: '\\frac{a}{b}', insert: '\\frac{a}{b}', title: tr('Phân số', 'Fraction', lang) },
      { label: '√x', displayLatex: '\\sqrt{x}', insert: '\\sqrt{x}', title: tr('Căn bậc hai', 'Square root', lang) },
      { label: 'xⁿ', displayLatex: 'x^{2}', insert: 'x^{2}', title: tr('Lũy thừa', 'Power', lang) },
      { label: '|x|', displayLatex: '|x|', insert: '|x|', title: tr('Giá trị tuyệt đối', 'Absolute value', lang) },
      { label: 'π', displayLatex: '\\pi', insert: '\\pi', title: tr('Số Pi', 'Pi', lang) },
      { label: '≈', displayLatex: '\\approx', insert: ' \\approx ', title: tr('Xấp xỉ', 'Approximately', lang) },
      { label: '±', displayLatex: '\\pm', insert: ' \\pm ', title: tr('Cộng trừ', 'Plus-minus', lang) },
      { label: '≠', displayLatex: '\\ne', insert: ' \\ne ', title: tr('Khác', 'Not equal', lang) },
      { label: '⊥', displayLatex: '\\perp', insert: ' \\perp ', title: tr('Vuông góc', 'Perpendicular', lang) },
      { label: '∥', displayLatex: '\\parallel', insert: ' \\parallel ', title: tr('Song song', 'Parallel', lang) },
      { label: '△', displayLatex: '\\triangle', insert: '\\triangle ABC', title: tr('Tam giác', 'Triangle', lang) },
      { label: '∼', displayLatex: '\\sim', insert: ' \\sim ', title: tr('Đồng dạng', 'Similar', lang) },
      { label: '∠', displayLatex: '\\widehat{A}', insert: '\\widehat{ABC}', title: tr('Ký hiệu góc', 'Angle', lang) },
      { label: '°', displayLatex: '^{\\circ}', insert: '^{\\circ}', title: tr('Độ', 'Degrees', lang) },
      { label: '⇒', displayLatex: '\\Rightarrow', insert: ' \\Rightarrow ', title: tr('Suy ra', 'Implies', lang) },
      { label: '⇔', displayLatex: '\\Leftrightarrow', insert: ' \\Leftrightarrow ', title: tr('Tương đương', 'Equivalent', lang) },
      {
        label: tr('{hệ}', '{sys}', lang),
        displayLatex: '\\{\\begin{smallmatrix}\\cdot\\\\\\cdot\\end{smallmatrix}',
        insert: '\\begin{cases} x + y = 5 \\\\ x - y = 1 \\end{cases}',
        title: tr('Hệ phương trình', 'System of equations', lang),
      },
      {
        label: tr('[tuyển]', '[cases]', lang),
        displayLatex: '[\\begin{smallmatrix}\\cdot\\\\\\cdot\\end{smallmatrix}',
        insert: '\\left[\\begin{array}{l} x = 1 \\\\ x = -2 \\end{array}\\right.',
        title: tr('Phương trình tuyển', 'Disjunction / or cases', lang),
      },
    ],
    high: [
      { label: 'a/b', displayLatex: '\\frac{a}{b}', insert: '\\frac{a}{b}', title: tr('Phân số', 'Fraction', lang) },
      { label: '√x', displayLatex: '\\sqrt{x}', insert: '\\sqrt{x}', title: tr('Căn bậc hai', 'Square root', lang) },
      { label: 'ⁿ√x', displayLatex: '\\sqrt[n]{x}', insert: '\\sqrt[n]{x}', title: tr('Căn bậc n', 'nth root', lang) },
      { label: 'xⁿ', displayLatex: 'x^{n}', insert: 'x^{n}', title: tr('Lũy thừa', 'Power', lang) },
      { label: 'uₙ', displayLatex: 'u_{n}', insert: 'u_{n}', title: tr('Chỉ số dưới', 'Subscript', lang) },
      { label: 'lim', displayLatex: '\\lim', insert: '\\lim_{x \\to +\\infty} f(x)', title: tr('Giới hạn', 'Limit', lang) },
      { label: '∫', displayLatex: '\\int_{a}^{b}', insert: '\\int_{a}^{b} f(x)\\,dx', title: tr('Tích phân xác định', 'Definite integral', lang) },
      { label: '∑', displayLatex: '\\sum', insert: '\\sum_{i=1}^{n} u_i', title: tr('Tổng Sigma', 'Sigma sum', lang) },
      { label: "f'(x)", displayLatex: "f'(x)", insert: "f'(x)", title: tr('Đạo hàm', 'Derivative', lang) },
      { label: 'log', displayLatex: '\\log_{a} b', insert: '\\log_{a} b', title: tr('Logarit cơ số a', 'Log base a', lang) },
      { label: 'ln', displayLatex: '\\ln x', insert: '\\ln x', title: tr('Logarit tự nhiên', 'Natural logarithm', lang) },
      { label: 'sin', displayLatex: '\\sin x', insert: '\\sin x', title: 'Sin' },
      { label: 'cos', displayLatex: '\\cos x', insert: '\\cos x', title: 'Cos' },
      { label: 'Cₙᵏ', displayLatex: 'C_{n}^{k}', insert: 'C_{n}^{k}', title: tr('Tổ hợp', 'Combination', lang) },
      { label: 'Aₙᵏ', displayLatex: 'A_{n}^{k}', insert: 'A_{n}^{k}', title: tr('Chỉnh hợp', 'Permutation', lang) },
      { label: 'AB⃗', displayLatex: '\\overrightarrow{AB}', insert: '\\overrightarrow{AB}', title: tr('Vectơ AB', 'Vector AB', lang) },
      { label: '∈', displayLatex: '\\in', insert: ' \\in ', title: tr('Thuộc tập hợp', 'Element of', lang) },
      { label: '∪/∩', displayLatex: '\\cap', insert: ' \\cap ', title: tr('Giao tập hợp', 'Set intersection', lang) },
      { label: '∀', displayLatex: '\\forall', insert: '\\forall x \\in \\mathbb{R}', title: tr('Với mọi', 'For all', lang) },
      {
        label: tr('{hệ}', '{sys}', lang),
        displayLatex: '\\{\\begin{smallmatrix}\\cdot\\\\\\cdot\\end{smallmatrix}',
        insert: '\\begin{cases} x + 2y = 3 \\\\ 2x - y = 1 \\end{cases}',
        title: tr('Hệ phương trình', 'System of equations', lang),
      },
    ],
  };
}

export const LATEX_KEYPAD_BY_GRADE: Record<MathGradeMode, LatexKeypadKey[]> =
  getLatexKeypadByGrade('vi');

export interface FormulaHandbookEntry {
  id: string;
  grade: MathGradeMode;
  chapter: string;
  title: string;
  latex: string;
}

export function getFormulaHandbook(lang: AppLanguage = getAppLanguage()): FormulaHandbookEntry[] {
  return [
    // Primary (Lớp 1–5)
    {
      id: 'p-rect-area',
      grade: 'primary',
      chapter: tr('Hình học Tiểu học', 'Primary geometry', lang),
      title: tr('Diện tích & Chu vi HCN', 'Rectangle area & perimeter', lang),
      latex: 'S = a \\times b, \\quad P = (a + b) \\times 2',
    },
    {
      id: 'p-tri-area',
      grade: 'primary',
      chapter: tr('Hình học Tiểu học', 'Primary geometry', lang),
      title: tr('Diện tích hình tam giác', 'Triangle area', lang),
      latex: 'S = \\frac{a \\times h}{2}',
    },
    {
      id: 'p-trap-area',
      grade: 'primary',
      chapter: tr('Hình học Tiểu học', 'Primary geometry', lang),
      title: tr('Diện tích hình thang', 'Trapezoid area', lang),
      latex: 'S = \\frac{(a + b) \\times h}{2}',
    },
    {
      id: 'p-circle',
      grade: 'primary',
      chapter: tr('Hình học Tiểu học', 'Primary geometry', lang),
      title: tr('Chu vi & Diện tích hình tròn', 'Circle circumference & area', lang),
      latex: 'C = 2 \\times r \\times 3{,}14, \\quad S = r \\times r \\times 3{,}14',
    },
    {
      id: 'p-speed',
      grade: 'primary',
      chapter: tr('Toán chuyển động', 'Motion problems', lang),
      title: tr('Vận tốc – Quãng đường – Thời gian', 'Speed – Distance – Time', lang),
      latex: 'v = \\frac{s}{t}, \\quad s = v \\times t, \\quad t = \\frac{s}{v}',
    },
    {
      id: 'p-sum-diff',
      grade: 'primary',
      chapter: tr('Toán có lời văn', 'Word problems', lang),
      title: tr('Tìm hai số khi biết Tổng và Hiệu', 'Find two numbers given Sum and Difference', lang),
      latex: tr(
        '\\text{Số lớn} = \\frac{\\text{Tổng} + \\text{Hiệu}}{2}',
        '\\text{Larger} = \\frac{\\text{Sum} + \\text{Diff}}{2}',
        lang
      ),
    },

    // Middle (Lớp 6–9)
    {
      id: 'm-id-1',
      grade: 'middle',
      chapter: tr('7 Hằng đẳng thức', 'Algebraic identities', lang),
      title: tr('Bình phương của một tổng / hiệu', 'Square of a sum / difference', lang),
      latex: '(a \\pm b)^2 = a^2 \\pm 2ab + b^2',
    },
    {
      id: 'm-id-2',
      grade: 'middle',
      chapter: tr('7 Hằng đẳng thức', 'Algebraic identities', lang),
      title: tr('Hiệu hai bình phương', 'Difference of two squares', lang),
      latex: 'a^2 - b^2 = (a - b)(a + b)',
    },
    {
      id: 'm-id-3',
      grade: 'middle',
      chapter: tr('7 Hằng đẳng thức', 'Algebraic identities', lang),
      title: tr('Tổng & Hiệu hai lập phương', 'Sum & difference of cubes', lang),
      latex: 'a^3 \\pm b^3 = (a \\pm b)(a^2 \\mp ab + b^2)',
    },
    {
      id: 'm-pythagoras',
      grade: 'middle',
      chapter: tr('Hình học THCS', 'Middle school geometry', lang),
      title: tr('Định lý Pytago', 'Pythagorean theorem', lang),
      latex: 'AB^2 + AC^2 = BC^2',
    },
    {
      id: 'm-quad',
      grade: 'middle',
      chapter: tr('Phương trình bậc 2', 'Quadratic equations', lang),
      title: tr('Công thức nghiệm & Định lý Vi-ét', 'Quadratic formula', lang),
      latex: '\\Delta = b^2 - 4ac, \\quad x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}',
    },
    {
      id: 'm-viet',
      grade: 'middle',
      chapter: tr('Phương trình bậc 2', 'Quadratic equations', lang),
      title: tr('Hệ thức Vi-ét', "Vieta's formulas", lang),
      latex: '\\begin{cases} x_1 + x_2 = -\\frac{b}{a} \\\\ x_1 x_2 = \\frac{c}{a} \\end{cases}',
    },

    // High (Lớp 10–12)
    {
      id: 'h-trig-1',
      grade: 'high',
      chapter: tr('Lượng giác', 'Trigonometry', lang),
      title: tr('Công thức cộng & nhân đôi', 'Identities & double-angle', lang),
      latex: '\\sin^2 x + \\cos^2 x = 1, \\quad \\sin 2x = 2\\sin x\\cos x',
    },
    {
      id: 'h-deriv',
      grade: 'high',
      chapter: tr('Đạo hàm – Tích phân', 'Derivatives & Integrals', lang),
      title: tr('Đạo hàm hàm hợp & thương', 'Quotient rule', lang),
      latex: '\\left(\\frac{u}{v}\\right)\' = \\frac{u\'v - uv\'}{v^2}',
    },
    {
      id: 'h-integral-area',
      grade: 'high',
      chapter: tr('Đạo hàm – Tích phân', 'Derivatives & Integrals', lang),
      title: tr('Diện tích hình phẳng & Thể tích tròn xoay', 'Area & solid of revolution', lang),
      latex: 'S = \\int_{a}^{b} |f(x) - g(x)|\\,dx, \\quad V = \\pi \\int_{a}^{b} [f(x)]^2\\,dx',
    },
    {
      id: 'h-solid-vol',
      grade: 'high',
      chapter: tr('Hình học Không gian', '3D Geometry', lang),
      title: tr('Thể tích khối chóp & lăng trụ', 'Pyramid & sphere volume', lang),
      latex: tr(
        'V_{\\text{chóp}} = \\frac{1}{3} S_{\\text{đáy}} \\cdot h, \\quad V_{\\text{cầu}} = \\frac{4}{3}\\pi R^3',
        'V_{\\text{pyramid}} = \\frac{1}{3} B \\cdot h, \\quad V_{\\text{sphere}} = \\frac{4}{3}\\pi R^3',
        lang
      ),
    },
    {
      id: 'h-oxyz-dist',
      grade: 'high',
      chapter: tr('Tọa độ Oxyz', '3D Coordinates (Oxyz)', lang),
      title: tr('Khoảng cách từ điểm đến mặt phẳng', 'Distance from point to plane', lang),
      latex: 'd(M, (P)) = \\frac{|Ax_0 + By_0 + Cz_0 + D|}{\\sqrt{A^2 + B^2 + C^2}}',
    },
    {
      id: 'h-bayes',
      grade: 'high',
      chapter: tr('Xác suất Lớp 12', 'Probability (Grade 12)', lang),
      title: tr('Công thức Bayes & Xác suất có điều kiện', "Bayes' theorem & conditional prob.", lang),
      latex: 'P(A|B) = \\frac{P(A) \\cdot P(B|A)}{P(B)}',
    },
  ];
}

export const FORMULA_HANDBOOK: FormulaHandbookEntry[] = getFormulaHandbook('vi');

export interface VirtualRulerState {
  active: boolean;
  /** World-space origin of top-left corner of ruler */
  x: number;
  y: number;
  /** Rotation angle in radians */
  angle: number;
  /** Length in world pixels (1 cm = 40 px) */
  length: number;
  height: number;
}

export interface VirtualSetSquareState {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  legA: number;
  legB: number;
}

export interface VirtualProtractorState {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  radius: number;
  measureDeg: number;
}

export interface VirtualCompassState {
  active: boolean;
  /** Center O in world coordinates */
  cx: number;
  cy: number;
  /** Radius in world pixels */
  radius: number;
  /** Pencil arm angle in radians */
  angle: number;
}

export interface VirtualGeometryToolsState {
  ruler: VirtualRulerState;
  setSquare: VirtualSetSquareState;
  protractor: VirtualProtractorState;
  compass: VirtualCompassState;
}

export interface SnapEdgeResult {
  point: Point;
  snapped: boolean;
}

function projectPointOntoSegment(
  p: Point,
  a: Point,
  b: Point
): { proj: Point; dist: number; t: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-6) {
    return { proj: a, dist: Math.hypot(p.x - a.x, p.y - a.y), t: 0 };
  }
  const rawT = ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));
  const proj = { x: a.x + vx * t, y: a.y + vy * t };
  return { proj, dist: Math.hypot(p.x - proj.x, p.y - proj.y), t };
}

/**
 * Snaps a freehand pen point directly onto the active Virtual Ruler or Set Square edge
 * when the pointer is within `thresholdWorld` of the straight edge.
 */
export function snapPointToVirtualToolEdge(
  worldPt: Point,
  tools: VirtualGeometryToolsState,
  thresholdWorld = 16
): SnapEdgeResult {
  const edges: [Point, Point][] = [];

  if (tools.ruler.active) {
    const { x, y, angle, length, height } = tools.ruler;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Top measuring edge
    edges.push([
      { x, y },
      { x: x + cos * length, y: y + sin * length },
    ]);
    // Bottom edge
    const bx = x - sin * height;
    const by = y + cos * height;
    edges.push([
      { x: bx, y: by },
      { x: bx + cos * length, y: by + sin * length },
    ]);
  }

  if (tools.setSquare.active) {
    const { x, y, angle, legA, legB } = tools.setSquare;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Right-angle corner at (x, y), legA along +localX, legB along -localY (upward)
    const pO = { x, y };
    const pA = { x: x + cos * legA, y: y + sin * legA };
    const pB = { x: x + sin * legB, y: y - cos * legB };
    edges.push([pO, pA], [pO, pB], [pA, pB]);
  }

  let bestDist = thresholdWorld;
  let bestPt: Point | null = null;

  for (const [a, b] of edges) {
    const res = projectPointOntoSegment(worldPt, a, b);
    if (res.dist <= bestDist) {
      bestDist = res.dist;
      bestPt = res.proj;
    }
  }

  if (bestPt) {
    return { point: bestPt, snapped: true };
  }
  return { point: worldPt, snapped: false };
}
