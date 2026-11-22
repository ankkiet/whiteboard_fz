import { MathGradeMode, Point } from '../types/board';

export interface GradeModeMeta {
  id: MathGradeMode;
  label: string;
  range: string;
  summary: string;
}

export const MATH_GRADE_MODES: GradeModeMeta[] = [
  {
    id: 'primary',
    label: 'Tiểu học',
    range: 'Lớp 1–5',
    summary: 'Học cụ kéo-thả, đặt tính, sơ đồ đoạn thẳng, phân số, đồng hồ & thước đo.',
  },
  {
    id: 'middle',
    label: 'THCS',
    range: 'Lớp 6–9',
    summary: 'Hình học phẳng & compa/ê-ke, đồ thị bậc 1–2, thừa số nguyên tố, trải hình 3D & thống kê.',
  },
  {
    id: 'high',
    label: 'THPT',
    range: 'Lớp 10–12',
    summary: 'Công thức chuẩn SGK, đồ thị tham số m & tích phân, bảng biến thiên, lượng giác, 3D/Oxyz & xác suất.',
  },
];

export interface LatexKeypadKey {
  label: string;
  /** Crisp KaTeX formula rendered on the keycap */
  displayLatex: string;
  insert: string;
  title: string;
}

export const LATEX_KEYPAD_BY_GRADE: Record<MathGradeMode, LatexKeypadKey[]> = {
  primary: [
    { label: '+', displayLatex: '+', insert: ' + ', title: 'Cộng' },
    { label: '−', displayLatex: '-', insert: ' - ', title: 'Trừ' },
    { label: '×', displayLatex: '\\times', insert: ' \\times ', title: 'Nhân' },
    { label: ':', displayLatex: ':', insert: ' : ', title: 'Chia' },
    { label: '=', displayLatex: '=', insert: ' = ', title: 'Bằng' },
    { label: '<', displayLatex: '<', insert: ' < ', title: 'Nhỏ hơn' },
    { label: '>', displayLatex: '>', insert: ' > ', title: 'Lớn hơn' },
    { label: '≤', displayLatex: '\\le', insert: ' \\le ', title: 'Nhỏ hơn hoặc bằng' },
    { label: '≥', displayLatex: '\\ge', insert: ' \\ge ', title: 'Lớn hơn hoặc bằng' },
    { label: 'a/b', displayLatex: '\\frac{a}{b}', insert: '\\frac{a}{b}', title: 'Phân số' },
    { label: 'a b/c', displayLatex: '1\\frac{1}{2}', insert: '1\\frac{1}{2}', title: 'Hỗn số' },
    { label: 'cm', displayLatex: '\\text{cm}', insert: '\\text{ cm}', title: 'Đơn vị cm' },
    { label: 'dm', displayLatex: '\\text{dm}', insert: '\\text{ dm}', title: 'Đơn vị dm' },
    { label: 'm', displayLatex: '\\text{m}', insert: '\\text{ m}', title: 'Đơn vị m' },
    { label: 'cm²', displayLatex: '\\text{cm}^2', insert: '\\text{ cm}^2', title: 'Xăng-ti-mét vuông' },
    { label: 'kg', displayLatex: '\\text{kg}', insert: '\\text{ kg}', title: 'Ki-lô-gam' },
  ],
  middle: [
    { label: 'a/b', displayLatex: '\\frac{a}{b}', insert: '\\frac{a}{b}', title: 'Phân số' },
    { label: '√x', displayLatex: '\\sqrt{x}', insert: '\\sqrt{x}', title: 'Căn bậc hai' },
    { label: 'xⁿ', displayLatex: 'x^{2}', insert: 'x^{2}', title: 'Lũy thừa' },
    { label: '|x|', displayLatex: '|x|', insert: '|x|', title: 'Giá trị tuyệt đối' },
    { label: 'π', displayLatex: '\\pi', insert: '\\pi', title: 'Số Pi' },
    { label: '≈', displayLatex: '\\approx', insert: ' \\approx ', title: 'Xấp xỉ' },
    { label: '±', displayLatex: '\\pm', insert: ' \\pm ', title: 'Cộng trừ' },
    { label: '≠', displayLatex: '\\ne', insert: ' \\ne ', title: 'Khác' },
    { label: '⊥', displayLatex: '\\perp', insert: ' \\perp ', title: 'Vuông góc' },
    { label: '∥', displayLatex: '\\parallel', insert: ' \\parallel ', title: 'Song song' },
    { label: '△', displayLatex: '\\triangle', insert: '\\triangle ABC', title: 'Tam giác' },
    { label: '∼', displayLatex: '\\sim', insert: ' \\sim ', title: 'Đồng dạng' },
    { label: '∠', displayLatex: '\\widehat{A}', insert: '\\widehat{ABC}', title: 'Ký hiệu góc' },
    { label: '°', displayLatex: '^{\\circ}', insert: '^{\\circ}', title: 'Độ' },
    { label: '⇒', displayLatex: '\\Rightarrow', insert: ' \\Rightarrow ', title: 'Suy ra' },
    { label: '⇔', displayLatex: '\\Leftrightarrow', insert: ' \\Leftrightarrow ', title: 'Tương đương' },
    { label: '{hệ}', displayLatex: '\\{\\begin{smallmatrix}\\cdot\\\\\\cdot\\end{smallmatrix}', insert: '\\begin{cases} x + y = 5 \\\\ x - y = 1 \\end{cases}', title: 'Hệ phương trình' },
    { label: '[tuyển]', displayLatex: '[\\begin{smallmatrix}\\cdot\\\\\\cdot\\end{smallmatrix}', insert: '\\left[\\begin{array}{l} x = 1 \\\\ x = -2 \\end{array}\\right.', title: 'Phương trình tuyển' },
  ],
  high: [
    { label: 'a/b', displayLatex: '\\frac{a}{b}', insert: '\\frac{a}{b}', title: 'Phân số' },
    { label: '√x', displayLatex: '\\sqrt{x}', insert: '\\sqrt{x}', title: 'Căn bậc hai' },
    { label: 'ⁿ√x', displayLatex: '\\sqrt[n]{x}', insert: '\\sqrt[n]{x}', title: 'Căn bậc n' },
    { label: 'xⁿ', displayLatex: 'x^{n}', insert: 'x^{n}', title: 'Lũy thừa' },
    { label: 'uₙ', displayLatex: 'u_{n}', insert: 'u_{n}', title: 'Chỉ số dưới' },
    { label: 'lim', displayLatex: '\\lim', insert: '\\lim_{x \\to +\\infty} f(x)', title: 'Giới hạn' },
    { label: '∫', displayLatex: '\\int_{a}^{b}', insert: '\\int_{a}^{b} f(x)\\,dx', title: 'Tích phân xác định' },
    { label: '∑', displayLatex: '\\sum', insert: '\\sum_{i=1}^{n} u_i', title: 'Tổng Sigma' },
    { label: "f'(x)", displayLatex: "f'(x)", insert: "f'(x)", title: 'Đạo hàm' },
    { label: 'log', displayLatex: '\\log_{a} b', insert: '\\log_{a} b', title: 'Logarit cơ số a' },
    { label: 'ln', displayLatex: '\\ln x', insert: '\\ln x', title: 'Logarit tự nhiên' },
    { label: 'sin', displayLatex: '\\sin x', insert: '\\sin x', title: 'Sin' },
    { label: 'cos', displayLatex: '\\cos x', insert: '\\cos x', title: 'Cos' },
    { label: 'Cₙᵏ', displayLatex: 'C_{n}^{k}', insert: 'C_{n}^{k}', title: 'Tổ hợp' },
    { label: 'Aₙᵏ', displayLatex: 'A_{n}^{k}', insert: 'A_{n}^{k}', title: 'Chỉnh hợp' },
    { label: 'AB⃗', displayLatex: '\\overrightarrow{AB}', insert: '\\overrightarrow{AB}', title: 'Vectơ AB' },
    { label: '∈', displayLatex: '\\in', insert: ' \\in ', title: 'Thuộc tập hợp' },
    { label: '∪/∩', displayLatex: '\\cap', insert: ' \\cap ', title: 'Giao tập hợp' },
    { label: '∀', displayLatex: '\\forall', insert: '\\forall x \\in \\mathbb{R}', title: 'Với mọi' },
    { label: '{hệ}', displayLatex: '\\{\\begin{smallmatrix}\\cdot\\\\\\cdot\\end{smallmatrix}', insert: '\\begin{cases} x + 2y = 3 \\\\ 2x - y = 1 \\end{cases}', title: 'Hệ phương trình' },
  ],
};

export interface FormulaHandbookEntry {
  id: string;
  grade: MathGradeMode;
  chapter: string;
  title: string;
  latex: string;
}

export const FORMULA_HANDBOOK: FormulaHandbookEntry[] = [
  // Primary (Lớp 1–5)
  {
    id: 'p-rect-area',
    grade: 'primary',
    chapter: 'Hình học Tiểu học',
    title: 'Diện tích & Chu vi HCN',
    latex: 'S = a \\times b, \\quad P = (a + b) \\times 2',
  },
  {
    id: 'p-tri-area',
    grade: 'primary',
    chapter: 'Hình học Tiểu học',
    title: 'Diện tích hình tam giác',
    latex: 'S = \\frac{a \\times h}{2}',
  },
  {
    id: 'p-trap-area',
    grade: 'primary',
    chapter: 'Hình học Tiểu học',
    title: 'Diện tích hình thang',
    latex: 'S = \\frac{(a + b) \\times h}{2}',
  },
  {
    id: 'p-circle',
    grade: 'primary',
    chapter: 'Hình học Tiểu học',
    title: 'Chu vi & Diện tích hình tròn',
    latex: 'C = 2 \\times r \\times 3{,}14, \\quad S = r \\times r \\times 3{,}14',
  },
  {
    id: 'p-speed',
    grade: 'primary',
    chapter: 'Toán chuyển động',
    title: 'Vận tốc – Quãng đường – Thời gian',
    latex: 'v = \\frac{s}{t}, \\quad s = v \\times t, \\quad t = \\frac{s}{v}',
  },
  {
    id: 'p-sum-diff',
    grade: 'primary',
    chapter: 'Toán có lời văn',
    title: 'Tìm hai số khi biết Tổng và Hiệu',
    latex: '\\text{Số lớn} = \\frac{\\text{Tổng} + \\text{Hiệu}}{2}',
  },

  // Middle (Lớp 6–9)
  {
    id: 'm-id-1',
    grade: 'middle',
    chapter: '7 Hằng đẳng thức',
    title: 'Bình phương của một tổng / hiệu',
    latex: '(a \\pm b)^2 = a^2 \\pm 2ab + b^2',
  },
  {
    id: 'm-id-2',
    grade: 'middle',
    chapter: '7 Hằng đẳng thức',
    title: 'Hiệu hai bình phương',
    latex: 'a^2 - b^2 = (a - b)(a + b)',
  },
  {
    id: 'm-id-3',
    grade: 'middle',
    chapter: '7 Hằng đẳng thức',
    title: 'Tổng & Hiệu hai lập phương',
    latex: 'a^3 \\pm b^3 = (a \\pm b)(a^2 \\mp ab + b^2)',
  },
  {
    id: 'm-pythagoras',
    grade: 'middle',
    chapter: 'Hình học THCS',
    title: 'Định lý Pytago',
    latex: 'AB^2 + AC^2 = BC^2',
  },
  {
    id: 'm-quad',
    grade: 'middle',
    chapter: 'Phương trình bậc 2',
    title: 'Công thức nghiệm & Định lý Vi-ét',
    latex: '\\Delta = b^2 - 4ac, \\quad x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}',
  },
  {
    id: 'm-viet',
    grade: 'middle',
    chapter: 'Phương trình bậc 2',
    title: 'Hệ thức Vi-ét',
    latex: '\\begin{cases} x_1 + x_2 = -\\frac{b}{a} \\\\ x_1 x_2 = \\frac{c}{a} \\end{cases}',
  },

  // High (Lớp 10–12)
  {
    id: 'h-trig-1',
    grade: 'high',
    chapter: 'Lượng giác',
    title: 'Công thức cộng & nhân đôi',
    latex: '\\sin^2 x + \\cos^2 x = 1, \\quad \\sin 2x = 2\\sin x\\cos x',
  },
  {
    id: 'h-deriv',
    grade: 'high',
    chapter: 'Đạo hàm – Tích phân',
    title: 'Đạo hàm hàm hợp & thương',
    latex: '\\left(\\frac{u}{v}\\right)\' = \\frac{u\'v - uv\'}{v^2}',
  },
  {
    id: 'h-integral-area',
    grade: 'high',
    chapter: 'Đạo hàm – Tích phân',
    title: 'Diện tích hình phẳng & Thể tích tròn xoay',
    latex: 'S = \\int_{a}^{b} |f(x) - g(x)|\\,dx, \\quad V = \\pi \\int_{a}^{b} [f(x)]^2\\,dx',
  },
  {
    id: 'h-solid-vol',
    grade: 'high',
    chapter: 'Hình học Không gian',
    title: 'Thể tích khối chóp & lăng trụ',
    latex: 'V_{\\text{chóp}} = \\frac{1}{3} S_{\\text{đáy}} \\cdot h, \\quad V_{\\text{cầu}} = \\frac{4}{3}\\pi R^3',
  },
  {
    id: 'h-oxyz-dist',
    grade: 'high',
    chapter: 'Tọa độ Oxyz',
    title: 'Khoảng cách từ điểm đến mặt phẳng',
    latex: 'd(M, (P)) = \\frac{|Ax_0 + By_0 + Cz_0 + D|}{\\sqrt{A^2 + B^2 + C^2}}',
  },
  {
    id: 'h-bayes',
    grade: 'high',
    chapter: 'Xác suất Lớp 12',
    title: 'Công thức Bayes & Xác suất có điều kiện',
    latex: 'P(A|B) = \\frac{P(A) \\cdot P(B|A)}{P(B)}',
  },
];

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
