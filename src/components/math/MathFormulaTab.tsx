import React, { useEffect, useMemo, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  FORMULA_HANDBOOK,
  LATEX_KEYPAD_BY_GRADE,
} from '../../engine/mathCurriculum';
import { friendlyMathToLatex } from '../../engine/mathDisplay';
import { FormulaElement, MathGradeMode } from '../../types/board';
import { MathTex } from './MathTex';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Code2,
  Eraser,
  Plus,
} from 'lucide-react';

interface MathFormulaTabProps {
  gradeMode: MathGradeMode;
  getWorldCenter: () => { x: number; y: number };
}

type VisualBuilderKind = 'quick' | 'frac' | 'root' | 'integral';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_LATEX_BY_GRADE: Record<MathGradeMode, string> = {
  primary: 'S = \\frac{(a + b) \\times h}{2}',
  middle: '\\Delta = b^2 - 4ac, \\quad x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}',
  high: 'I = \\int_{0}^{2} x^2\\,dx = \\frac{8}{3}',
};

export const MathFormulaTab: React.FC<MathFormulaTabProps> = ({
  gradeMode,
  getWorldCenter,
}) => {
  const addElement = useBoardStore((s) => s.addElement);
  const setCurrentTool = useBoardStore((s) => s.setCurrentTool);
  const addToast = useBoardStore((s) => s.addToast);

  const [latexInput, setLatexInput] = useState(DEFAULT_LATEX_BY_GRADE[gradeMode]);
  const [friendlyDraft, setFriendlyDraft] = useState('');
  const [builderKind, setBuilderKind] = useState<VisualBuilderKind>('quick');
  const [showAdvancedLatex, setShowAdvancedLatex] = useState(false);

  const [fracNum, setFracNum] = useState('a + b');
  const [fracDen, setFracDen] = useState('2');
  const [rootDeg, setRootDeg] = useState('');
  const [rootBody, setRootBody] = useState('x + 1');
  const [powBase, setPowBase] = useState('x');
  const [powExp, setPowExp] = useState('2');
  const [intLower, setIntLower] = useState('0');
  const [intUpper, setIntUpper] = useState('2');
  const [intBody, setIntBody] = useState('x^2');
  const [formulaSize, setFormulaSize] = useState(22);

  useEffect(() => {
    setLatexInput(DEFAULT_LATEX_BY_GRADE[gradeMode]);
    setFriendlyDraft('');
    if (gradeMode !== 'high' && builderKind === 'integral') {
      setBuilderKind('quick');
    }
  }, [gradeMode]);

  const handbookForGrade = useMemo(
    () => FORMULA_HANDBOOK.filter((item) => item.grade === gradeMode),
    [gradeMode]
  );

  const keypadForGrade = useMemo(() => LATEX_KEYPAD_BY_GRADE[gradeMode], [gradeMode]);

  const appendLatexSnippet = (snippet: string) => {
    setLatexInput((prev) => (prev.trim() ? `${prev} ${snippet}` : snippet));
  };

  const insertLatexFormula = (rawLatex: string) => {
    const cleaned = rawLatex.trim();
    if (!cleaned) {
      addToast('Vui lòng nhập hoặc chọn công thức trước khi chèn.', 'info');
      return;
    }
    const state = useBoardStore.getState();
    const center = getWorldCenter();
    const maxZ = state.elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);
    const estWidth = Math.max(160, Math.min(500, cleaned.length * (formulaSize * 0.42) + 84));
    const estHeight = Math.max(58, Math.round(formulaSize * 3.1));
    const el: FormulaElement = {
      id: uid('el'),
      type: 'formula',
      x: Math.round(center.x - estWidth / 2),
      y: Math.round(center.y - estHeight / 2 - 40),
      width: Math.round(estWidth),
      height: estHeight,
      latex: cleaned,
      color: state.color,
      fontSize: formulaSize,
      zIndex: maxZ + 1,
    };
    addElement(el, true);
    setCurrentTool('select');
    addToast('Đã chèn công thức toán học lên bảng (nhấp đúp để sửa)', 'success');
  };

  return (
    <div className="space-y-3">
      {/* Live Standard Math Preview Box */}
      <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/70 bg-indigo-50/40 dark:bg-indigo-950/30 overflow-hidden">
        <div className="px-2.5 py-1.5 border-b border-indigo-100/80 dark:border-indigo-900/50 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
            Xem trước công thức chuẩn
          </span>
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Cỡ chữ công thức"
              value={formulaSize}
              onChange={(e) => setFormulaSize(Number(e.target.value))}
              className="h-6 px-1.5 rounded-md bg-white/90 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-indigo-200/70 dark:border-indigo-900 text-[10.5px] font-semibold cursor-pointer"
            >
              <option value={18}>Cỡ 18</option>
              <option value={22}>Cỡ 22</option>
              <option value={28}>Cỡ 28</option>
              <option value={34}>Cỡ 34</option>
            </select>
            <button
              type="button"
              title="Xóa công thức đang soạn"
              aria-label="Xóa công thức đang soạn"
              onClick={() => {
                setLatexInput('');
                setFriendlyDraft('');
              }}
              className="h-6 w-6 rounded-md bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500 flex items-center justify-center cursor-pointer"
            >
              <Eraser className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div
          data-testid="katex-live-preview"
          className="min-h-16 px-3 py-2.5 flex items-center justify-center text-slate-900 dark:text-slate-100 overflow-x-auto"
        >
          {latexInput.trim() ? (
            <MathTex latex={latexInput} displayMode />
          ) : (
            <span className="text-xs text-slate-400">
              Chọn mẫu bên dưới hoặc gõ biểu thức để tạo công thức
            </span>
          )}
        </div>
      </div>

      {/* Visual Formula Builder */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
          {(
            [
              { id: 'quick' as const, label: 'Nhập nhanh' },
              { id: 'frac' as const, label: 'Phân số' },
              { id: 'root' as const, label: 'Căn · Mũ' },
              { id: 'integral' as const, label: 'Tích phân' },
            ] as const
          )
            .filter((b) => gradeMode === 'high' || b.id !== 'integral')
            .map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBuilderKind(b.id)}
                className={`h-6 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  builderKind === b.id
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                {b.label}
              </button>
            ))}
        </div>

        {builderKind === 'quick' && (
          <div className="space-y-1">
            <input
              id="math-formula-input"
              data-testid="math-formula-input"
              type="text"
              aria-label="Nhập biểu thức toán học tự nhiên"
              value={friendlyDraft}
              onChange={(e) => {
                const val = e.target.value;
                setFriendlyDraft(val);
                if (val.trim()) {
                  setLatexInput(friendlyMathToLatex(val));
                }
              }}
              placeholder="Gõ tự nhiên: (a + b)/2, x² - 3x + 2 = 0, √(x+1)..."
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 outline-none"
            />
            <p className="text-[10.5px] text-slate-400 dark:text-slate-500">
              Tự động chuyển phân số (<span className="font-semibold">a/b</span>), căn (
              <span className="font-semibold">√x</span>), lũy thừa (
              <span className="font-semibold">x^2</span>) sang ký hiệu chuẩn.
            </p>
          </div>
        )}

        {builderKind === 'frac' && (
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <label className="space-y-0.5">
                <span className="text-[10.5px] text-slate-500">Tử số</span>
                <input
                  type="text"
                  value={fracNum}
                  onChange={(e) => setFracNum(e.target.value)}
                  className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10.5px] text-slate-500">Mẫu số</span>
                <input
                  type="text"
                  value={fracDen}
                  onChange={(e) => setFracDen(e.target.value)}
                  className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-indigo-700 dark:text-indigo-300 px-1">
                <MathTex
                  latex={`\\frac{${friendlyMathToLatex(fracNum) || 'a'}}{${friendlyMathToLatex(fracDen) || 'b'}}`}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  appendLatexSnippet(
                    `\\frac{${friendlyMathToLatex(fracNum) || 'a'}}{${friendlyMathToLatex(fracDen) || 'b'}}`
                  )
                }
                className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer"
              >
                + Thêm phân số
              </button>
            </div>
          </div>
        )}

        {builderKind === 'root' && (
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <label className="space-y-0.5">
                <span className="text-[10px] text-slate-500">Bậc căn</span>
                <input
                  type="text"
                  value={rootDeg}
                  onChange={(e) => setRootDeg(e.target.value)}
                  placeholder="2"
                  className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </label>
              <label className="col-span-2 space-y-0.5">
                <span className="text-[10px] text-slate-500">Biểu thức trong căn</span>
                <input
                  type="text"
                  value={rootBody}
                  onChange={(e) => setRootBody(e.target.value)}
                  className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="grid grid-cols-2 gap-1.5 flex-1">
                <input
                  type="text"
                  aria-label="Cơ số lũy thừa"
                  value={powBase}
                  onChange={(e) => setPowBase(e.target.value)}
                  placeholder="Cơ số"
                  className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <input
                  type="text"
                  aria-label="Số mũ"
                  value={powExp}
                  onChange={(e) => setPowExp(e.target.value)}
                  placeholder="Số mũ"
                  className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const deg = rootDeg.trim();
                  const body = friendlyMathToLatex(rootBody) || 'x';
                  appendLatexSnippet(deg && deg !== '2' ? `\\sqrt[${deg}]{${body}}` : `\\sqrt{${body}}`);
                }}
                className="h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer inline-flex items-center justify-center gap-1"
              >
                <span>+ Thêm</span>
                <MathTex
                  latex={rootDeg.trim() && rootDeg.trim() !== '2' ? `\\sqrt[${rootDeg.trim()}]{x}` : '\\sqrt{x}'}
                />
              </button>
              <button
                type="button"
                onClick={() =>
                  appendLatexSnippet(
                    `${friendlyMathToLatex(powBase) || 'x'}^{${friendlyMathToLatex(powExp) || '2'}}`
                  )
                }
                className="h-7 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold cursor-pointer inline-flex items-center justify-center gap-1"
              >
                <span>+ Thêm</span>
                <MathTex
                  latex={`${friendlyMathToLatex(powBase) || 'x'}^{${friendlyMathToLatex(powExp) || '2'}}`}
                />
              </button>
            </div>
          </div>
        )}

        {builderKind === 'integral' && gradeMode === 'high' && (
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <label className="space-y-0.5">
                <span className="text-[10px] text-slate-500">Cận dưới</span>
                <input
                  type="text"
                  value={intLower}
                  onChange={(e) => setIntLower(e.target.value)}
                  className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-slate-500">Cận trên</span>
                <input
                  type="text"
                  value={intUpper}
                  onChange={(e) => setIntUpper(e.target.value)}
                  className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-slate-500">Hàm f(x)</span>
                <input
                  type="text"
                  value={intBody}
                  onChange={(e) => setIntBody(e.target.value)}
                  className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-indigo-700 dark:text-indigo-300 px-1">
                <MathTex
                  latex={`\\int_{${friendlyMathToLatex(intLower) || 'a'}}^{${friendlyMathToLatex(intUpper) || 'b'}} ${friendlyMathToLatex(intBody) || 'f(x)'}\\,dx`}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  appendLatexSnippet(
                    `\\int_{${friendlyMathToLatex(intLower) || 'a'}}^{${friendlyMathToLatex(intUpper) || 'b'}} ${friendlyMathToLatex(intBody) || 'f(x)'}\\,dx`
                  )
                }
                className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer"
              >
                + Thêm tích phân
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Virtual Math Keypad */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Bàn phím ký hiệu toán học
        </div>
        <div className="grid grid-cols-4 gap-1">
          {keypadForGrade.map((k) => (
            <button
              key={k.label}
              type="button"
              title={k.title}
              aria-label={k.title}
              onClick={() => appendLatexSnippet(k.insert)}
              className="h-8 px-1 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:border-indigo-300 text-xs text-slate-800 dark:text-slate-100 transition-colors cursor-pointer flex items-center justify-center overflow-hidden"
            >
              <MathTex latex={k.displayLatex} className="text-[12px]" />
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        data-testid="insert-formula-button"
        onClick={() => insertLatexFormula(latexInput)}
        className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Chèn công thức lên bảng</span>
      </button>

      {/* Optional Advanced LaTeX Drawer */}
      <div>
        <button
          type="button"
          data-testid="toggle-advanced-latex"
          aria-expanded={showAdvancedLatex}
          onClick={() => setShowAdvancedLatex((v) => !v)}
          className="w-full flex items-center justify-between px-2 py-1 rounded-lg text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5" />
            <span>Chỉnh mã nguồn nâng cao (LaTeX)</span>
          </span>
          {showAdvancedLatex ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
        {showAdvancedLatex && (
          <textarea
            data-testid="advanced-latex-textarea"
            rows={2}
            aria-label="Mã nguồn LaTeX nâng cao"
            value={latexInput}
            onChange={(e) => setLatexInput(e.target.value)}
            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:border-indigo-500 outline-none resize-none"
          />
        )}
      </div>

      {/* Formula Handbook */}
      <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Sổ tay công thức chuẩn SGK</span>
        </div>
        <div className="space-y-1.5">
          {handbookForGrade.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 hover:border-indigo-400/80 transition-colors overflow-hidden"
            >
              <div className="px-2.5 pt-2 pb-1 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLatexInput(entry.latex);
                    setFriendlyDraft('');
                  }}
                  className="text-left min-w-0 flex-1 cursor-pointer"
                >
                  <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {entry.title}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{entry.chapter}</div>
                </button>
                <button
                  type="button"
                  onClick={() => insertLatexFormula(entry.latex)}
                  className="h-6 px-2 rounded-md bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 text-[10.5px] font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  + Chèn
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLatexInput(entry.latex);
                  setFriendlyDraft('');
                }}
                className="w-full px-2.5 pb-2 pt-0.5 text-left overflow-x-auto text-slate-900 dark:text-slate-100 cursor-pointer"
              >
                <MathTex latex={entry.latex} className="text-[12.5px]" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
