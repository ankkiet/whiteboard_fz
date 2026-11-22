import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  MATH_GEOMETRY_PRESETS,
  MathGeometryPresetId,
  buildGeometryPresetElements,
} from '../../engine/mathUtils';
import {
  FORMULA_HANDBOOK,
  LATEX_KEYPAD_BY_GRADE,
  MATH_GRADE_MODES,
} from '../../engine/mathCurriculum';
import { friendlyMathToLatex } from '../../engine/mathDisplay';
import { computeSafeWorldCenter, getSafeMathViewport } from '../../engine/mathViewport';
import { BoardPattern, FormulaElement, MathGradeMode, RevealElement } from '../../types/board';
import { PrimaryManipulativesTab } from './PrimaryManipulativesTab';
import { GraphAndCalculusTab } from './GraphAndCalculusTab';
import { StatsAndProbTab } from './StatsAndProbTab';
import { Solid3DPreview } from './Solid3DPreview';
import { MathTex } from './MathTex';
import {
  BarChart3,
  Blocks,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  Eraser,
  EyeOff,
  FunctionSquare,
  Grid3X3,
  ImagePlus,
  LayoutGrid,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Plus,
  Ruler,
  Sigma,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react';

interface MathPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type StudioTab = 'primary' | 'graph' | 'formula' | 'geometry' | 'stats' | 'tools';
type VisualBuilderKind = 'quick' | 'frac' | 'root' | 'integral';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const DEFAULT_LATEX_BY_GRADE: Record<MathGradeMode, string> = {
  primary: 'S = \\frac{(a + b) \\times h}{2}',
  middle: '\\Delta = b^2 - 4ac, \\quad x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}',
  high: 'I = \\int_{0}^{2} x^2\\,dx = \\frac{8}{3}',
};

export const MathPanel: React.FC<MathPanelProps> = ({ isOpen, onClose }) => {
  const addElement = useBoardStore((s) => s.addElement);
  const addElementsBatch = useBoardStore((s) => s.addElementsBatch);
  const setBoardPattern = useBoardStore((s) => s.setBoardPattern);
  const setCurrentTool = useBoardStore((s) => s.setCurrentTool);
  const addToast = useBoardStore((s) => s.addToast);
  const boardPattern = useBoardStore((s) => s.boardPattern);
  const mathGradeMode = useBoardStore((s) => s.mathGradeMode);
  const setMathGradeMode = useBoardStore((s) => s.setMathGradeMode);
  const virtualTools = useBoardStore((s) => s.virtualTools);
  const toggleVirtualTool = useBoardStore((s) => s.toggleVirtualTool);
  const arrangeVirtualTools = useBoardStore((s) => s.arrangeVirtualTools);
  const hideAllVirtualTools = useBoardStore((s) => s.hideAllVirtualTools);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const setIsCalculatorOpen = useBoardStore((s) => s.setIsCalculatorOpen);
  const isMathPanelCollapsed = useBoardStore((s) => s.isMathPanelCollapsed);
  const setIsMathPanelCollapsed = useBoardStore((s) => s.setIsMathPanelCollapsed);
  const pinnedProblem = useBoardStore((s) => s.pinnedProblem);
  const setPinnedProblem = useBoardStore((s) => s.setPinnedProblem);

  const tabsForGrade = useMemo(() => {
    if (mathGradeMode === 'primary') {
      return [
        { id: 'primary' as const, label: 'Học cụ', icon: Blocks },
        { id: 'formula' as const, label: 'Công thức', icon: FunctionSquare },
        { id: 'geometry' as const, label: 'Đo vẽ', icon: Ruler },
        { id: 'tools' as const, label: 'Tiện ích', icon: Wrench },
      ];
    }
    if (mathGradeMode === 'middle') {
      return [
        { id: 'graph' as const, label: 'Đồ thị', icon: TrendingUp },
        { id: 'formula' as const, label: 'Công thức', icon: FunctionSquare },
        { id: 'geometry' as const, label: 'Hình & 3D', icon: Compass },
        { id: 'stats' as const, label: 'ĐS & TK', icon: BarChart3 },
        { id: 'tools' as const, label: 'Tiện ích', icon: Wrench },
      ];
    }
    return [
      { id: 'graph' as const, label: 'Đồ thị', icon: TrendingUp },
      { id: 'formula' as const, label: 'Công thức', icon: FunctionSquare },
      { id: 'geometry' as const, label: 'Hình & 3D', icon: Compass },
      { id: 'stats' as const, label: 'XS & TK', icon: BarChart3 },
      { id: 'tools' as const, label: 'Tiện ích', icon: Wrench },
    ];
  }, [mathGradeMode]);

  const [activeTab, setActiveTab] = useState<StudioTab>(
    mathGradeMode === 'primary' ? 'primary' : 'graph'
  );
  const [latexInput, setLatexInput] = useState(DEFAULT_LATEX_BY_GRADE[mathGradeMode]);
  const [friendlyDraft, setFriendlyDraft] = useState('');
  const [builderKind, setBuilderKind] = useState<VisualBuilderKind>('quick');
  const [showAdvancedLatex, setShowAdvancedLatex] = useState(false);

  // Visual structured builder fields (no raw LaTeX needed)
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
  const [problemDraft, setProblemDraft] = useState(
    'Cho hàm số y = x³ - 3mx + 1. Tìm m để hàm số có 2 điểm cực trị.'
  );
  const [revealLabel, setRevealLabel] = useState('Bước 1: Tính đạo hàm y\'');
  const insertOffsetStepRef = useRef(0);
  const problemImageInputRef = useRef<HTMLInputElement>(null);

  // Keep activeTab valid whenever Grade Mode switches
  useEffect(() => {
    const allowed = tabsForGrade.map((t) => t.id);
    if (!allowed.includes(activeTab)) {
      setActiveTab(allowed[0]);
    }
  }, [tabsForGrade, activeTab]);

  const handbookForGrade = useMemo(
    () => FORMULA_HANDBOOK.filter((item) => item.grade === mathGradeMode),
    [mathGradeMode]
  );

  const keypadForGrade = useMemo(
    () => LATEX_KEYPAD_BY_GRADE[mathGradeMode],
    [mathGradeMode]
  );

  if (!isOpen) return null;

  const getViewportWorldCenter = () => {
    const state = useBoardStore.getState();
    const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const safeRect = getSafeMathViewport({
      viewW,
      viewH,
      isMathPanelOpen: isOpen,
      isMathPanelCollapsed: state.isMathPanelCollapsed,
      isCalculatorOpen: state.isCalculatorOpen,
      isCalculatorMinimized: state.isCalculatorMinimized,
      hasPinnedProblem: Boolean(state.pinnedProblem),
      isPinnedProblemCollapsed: Boolean(state.pinnedProblem?.collapsed),
    });
    if (state.elements.length === 0) {
      insertOffsetStepRef.current = 0;
    }
    const step = insertOffsetStepRef.current;
    insertOffsetStepRef.current += 1;
    return computeSafeWorldCenter(state.camera, safeRect, step);
  };

  const handleGradeChange = (mode: MathGradeMode) => {
    setMathGradeMode(mode);
    setLatexInput(DEFAULT_LATEX_BY_GRADE[mode]);
    setFriendlyDraft('');
    setActiveTab(mode === 'primary' ? 'primary' : 'graph');
  };

  const insertLatexFormula = (rawLatex: string) => {
    const cleaned = rawLatex.trim();
    if (!cleaned) {
      addToast('Vui lòng nhập hoặc chọn công thức trước khi chèn.', 'info');
      return;
    }
    const state = useBoardStore.getState();
    const center = getViewportWorldCenter();
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

  const handleInsertFormula = () => {
    insertLatexFormula(latexInput);
  };

  const appendLatexSnippet = (snippet: string) => {
    setLatexInput((prev) => (prev.trim() ? `${prev} ${snippet}` : snippet));
  };

  const handleInsertGeometry = (presetId: MathGeometryPresetId, label: string) => {
    const state = useBoardStore.getState();
    const center = getViewportWorldCenter();
    const maxZ = state.elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);
    const items = buildGeometryPresetElements(presetId, center, state.color, maxZ, uid);
    addElementsBatch(items, true);
    addToast(`Đã chèn "${label}" (đã nhóm sẵn)`, 'success');
  };

  const handleInsertRevealCurtain = () => {
    const state = useBoardStore.getState();
    const center = getViewportWorldCenter();
    const maxZ = state.elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);
    const curtain: RevealElement = {
      id: uid('el'),
      type: 'reveal',
      x: Math.round(center.x - 165),
      y: Math.round(center.y - 32),
      width: 330,
      height: 64,
      label: revealLabel.trim() || 'Che lời giải từng bước',
      revealed: false,
      color: '#4f46e5',
      zIndex: maxZ + 1,
    };
    addElement(curtain, true);
    setCurrentTool('select');
    addToast('Đã chèn Rèm che lời giải (kéo đặt lên dòng giải, nhấp đúp để mở)', 'success');
  };

  const handlePinProblemImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) {
        setPinnedProblem({
          text: problemDraft.trim(),
          imageUrl: url,
          collapsed: false,
        });
        addToast('Đã ghim ảnh đề bài lên đầu màn hình', 'success');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const patternChoices: { id: BoardPattern; label: string }[] = [
    { id: 'grid', label: 'Ô ly vuông' },
    { id: 'coordinate', label: 'Trục Oxy' },
    { id: 'isometric', label: 'Lưới 3D Iso' },
    { id: 'polar', label: 'Tọa độ cực' },
  ];

  const activeVirtualCount = (
    ['ruler', 'setSquare', 'protractor', 'compass'] as const
  ).filter((k) => virtualTools[k].active).length;

  // Compact Docked Vertical Rail Mode (frees ~275px of horizontal canvas space)
  if (isMathPanelCollapsed) {
    return (
      <aside
        data-testid="math-panel"
        data-grade-mode={mathGradeMode}
        data-collapsed="true"
        aria-label="Thanh công cụ Toán học thu gọn"
        className="pointer-events-auto absolute top-16 right-2.5 sm:right-3 z-20 w-12 py-2 px-1.5 flex flex-col items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 select-none"
      >
        <button
          type="button"
          data-testid="expand-math-panel-button"
          onClick={() => setIsMathPanelCollapsed(false)}
          title="Mở rộng bảng Toán học 1–12"
          aria-label="Mở rộng bảng Toán học"
          className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>

        <div className="w-7 h-px bg-slate-200 dark:bg-slate-800 my-0.5" />

        {tabsForGrade.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`math-tab-${tab.id}`}
              title={`Mở mục ${tab.label}`}
              aria-label={tab.label}
              onClick={() => {
                setActiveTab(tab.id);
                setIsMathPanelCollapsed(false);
              }}
              className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                active
                  ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[8px] font-bold leading-none truncate max-w-[34px]">
                {tab.label.split(' ')[0]}
              </span>
            </button>
          );
        })}

        <div className="w-7 h-px bg-slate-200 dark:bg-slate-800 my-0.5" />

        <button
          type="button"
          data-testid="header-toggle-casio-button"
          aria-pressed={isCalculatorOpen}
          onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
          title="Bật / Tắt Máy tính Casio fx-580VN X"
          aria-label="Bật / Tắt Máy tính Casio fx-580VN X"
          className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center gap-0.5 border transition-colors cursor-pointer ${
            isCalculatorOpen
              ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span className="text-[8px] font-extrabold leading-none">580</span>
        </button>

        {activeVirtualCount > 0 && (
          <button
            type="button"
            onClick={hideAllVirtualTools}
            title={`Ẩn ${activeVirtualCount} dụng cụ đo vẽ đang bật`}
            aria-label="Ẩn tất cả dụng cụ đo vẽ"
            className="w-9 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[9px] font-bold flex items-center justify-center cursor-pointer"
          >
            {activeVirtualCount} thước
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          title="Ẩn hoàn toàn bảng công cụ Toán (mở lại ở nút Toán trên thanh đầu)"
          aria-label="Đóng bảng Toán học"
          className="w-9 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      data-testid="math-panel"
      data-grade-mode={mathGradeMode}
      data-collapsed="false"
      aria-label="Xưởng Toán học Lớp 1 đến 12"
      className="pointer-events-auto absolute top-15 right-2.5 sm:right-3 z-20 w-[306px] sm:w-[322px] max-h-[calc(100vh-9.25rem)] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-900/8 dark:shadow-black/40 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 overflow-hidden select-text"
    >
      {/* Header + Grade Mode Switcher (Tiểu học | THCS | THPT) */}
      <div className="px-3 pt-2 pb-1.5 border-b border-slate-200/80 dark:border-slate-800 space-y-1.5 shrink-0">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6.5 h-6.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sigma className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold tracking-tight truncate leading-tight">
                Bảng Toán Học 1–12
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                {MATH_GRADE_MODES.find((g) => g.id === mathGradeMode)?.range}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              data-testid="header-toggle-casio-button"
              aria-pressed={isCalculatorOpen}
              onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
              title="Bật / Tắt Máy tính Casio fx-580VN X"
              className={`h-6.5 px-2 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 border transition-colors cursor-pointer whitespace-nowrap ${
                isCalculatorOpen
                  ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
              }`}
            >
              <Calculator className="w-3 h-3" />
              <span>fx-580</span>
            </button>
            <button
              type="button"
              data-testid="collapse-math-panel-button"
              onClick={() => setIsMathPanelCollapsed(true)}
              aria-label="Thu gọn thành thanh dọc bên phải"
              title="Thu gọn thành thanh dọc bên phải để mở rộng vùng vẽ"
              className="w-6.5 h-6.5 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng bảng công cụ Toán học"
              title="Đóng bảng Toán học"
              className="w-6.5 h-6.5 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Grade Mode Switcher */}
        <div
          role="group"
          aria-label="Chế độ cấp học"
          className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-950"
        >
          {MATH_GRADE_MODES.map((g) => {
            const active = mathGradeMode === g.id;
            return (
              <button
                key={g.id}
                type="button"
                data-testid={`grade-mode-${g.id}`}
                aria-pressed={active}
                onClick={() => handleGradeChange(g.id)}
                className={`h-6.5 rounded-lg text-[10.5px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade-Filtered Feature Tabs — All tabs fit in 100% width with zero clipping */}
      <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
        <div
          role="tablist"
          aria-label="Nhóm công cụ Toán học"
          className={`grid gap-1 ${
            tabsForGrade.length === 4 ? 'grid-cols-4' : 'grid-cols-5'
          }`}
        >
          {tabsForGrade.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`math-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`h-9 px-0.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[9.5px] tracking-tight font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200/80 dark:ring-indigo-800/80'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Body */}
      <div className="p-3 overflow-y-auto space-y-3">
        {activeTab === 'primary' && (
          <PrimaryManipulativesTab getWorldCenter={getViewportWorldCenter} />
        )}

        {activeTab === 'graph' && (
          <GraphAndCalculusTab
            gradeMode={mathGradeMode}
            getWorldCenter={getViewportWorldCenter}
          />
        )}

        {activeTab === 'formula' && (
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
                  <span className="text-xs text-slate-400 italic">
                    Chọn mẫu bên dưới hoặc gõ biểu thức để tạo công thức...
                  </span>
                )}
              </div>
            </div>

            {/* Visual Formula Builder (No Raw LaTeX Needed) */}
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
                  .filter((b) => mathGradeMode === 'high' || b.id !== 'integral')
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
                    Tự động chuyển phân số (<span className="font-semibold">a/b</span>), căn (<span className="font-semibold">√x</span>), lũy thừa (<span className="font-semibold">x^2</span>) sang ký hiệu chuẩn.
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
                      <MathTex latex={`\\frac{${friendlyMathToLatex(fracNum) || 'a'}}{${friendlyMathToLatex(fracDen) || 'b'}}`} />
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
                      <MathTex latex={rootDeg.trim() && rootDeg.trim() !== '2' ? `\\sqrt[${rootDeg.trim()}]{x}` : '\\sqrt{x}'} />
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
                      <MathTex latex={`${friendlyMathToLatex(powBase) || 'x'}^{${friendlyMathToLatex(powExp) || '2'}}`} />
                    </button>
                  </div>
                </div>
              )}

              {builderKind === 'integral' && mathGradeMode === 'high' && (
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

            {/* Grade-Filtered Virtual Math Keypad (KaTeX-Rendered Glyphs) */}
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
              onClick={handleInsertFormula}
              className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Chèn công thức lên bảng</span>
            </button>

            {/* Optional Advanced Code Drawer (Collapsed by default so raw LaTeX is never forced on users) */}
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

            {/* Formula Handbook (Sổ tay công thức — Rendered in True KaTeX!) */}
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
                        <div className="text-[10px] text-slate-400 truncate">
                          {entry.chapter}
                        </div>
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
        )}

        {activeTab === 'geometry' && (
          <div className="space-y-4">
            {/* Virtual Measuring & Drafting Tools */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-1">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Dụng cụ đo vẽ ảo (Hút nét bút)
                </div>
                {activeVirtualCount > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid="arrange-virtual-tools-button"
                      onClick={arrangeVirtualTools}
                      title="Tự động xếp gọn các dụng cụ đang bật không chồng lấp nhau"
                      className="h-6 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <LayoutGrid className="w-3 h-3" />
                      <span>Xếp gọn</span>
                    </button>
                    <button
                      type="button"
                      data-testid="hide-all-virtual-tools-button"
                      onClick={hideAllVirtualTools}
                      title="Ẩn tất cả dụng cụ đo vẽ"
                      className="h-6 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 text-slate-600 dark:text-slate-300 text-[10px] font-semibold cursor-pointer"
                    >
                      Ẩn hết
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'ruler' as const, label: 'Thước kẻ cm', show: true },
                    { id: 'setSquare' as const, label: 'Thước Ê-ke 90°', show: true },
                    {
                      id: 'protractor' as const,
                      label: 'Thước đo độ 180°',
                      show: mathGradeMode !== 'primary',
                    },
                    {
                      id: 'compass' as const,
                      label: 'Compa vẽ tròn',
                      show: mathGradeMode !== 'primary',
                    },
                  ] as const
                )
                  .filter((item) => item.show)
                  .map((tool) => {
                    const active = virtualTools[tool.id].active;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        data-testid={`toggle-virtual-${tool.id}`}
                        aria-pressed={active}
                        onClick={() => toggleVirtualTool(tool.id)}
                        className={`h-8 px-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
                        }`}
                      >
                        {tool.label}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Interactive 3D Solids & Oxyz (THCS & THPT) */}
            {mathGradeMode !== 'primary' && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <Solid3DPreview getWorldCenter={getViewportWorldCenter} />
              </div>
            )}

            {/* Quick 2D Geometric Constructions */}
            <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Dựng hình phẳng chuẩn SGK
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {MATH_GEOMETRY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`math-geometry-${preset.id}`}
                    onClick={() => handleInsertGeometry(preset.id, preset.label)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-indigo-400 text-left transition-colors cursor-pointer"
                  >
                    <div className="text-[11.5px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                      {preset.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <StatsAndProbTab
            gradeMode={mathGradeMode}
            getWorldCenter={getViewportWorldCenter}
          />
        )}

        {activeTab === 'tools' && (
          <div className="space-y-3.5">
            {/* Casio fx-580VN X Scientific Calculator */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
              <div className="text-xs font-bold">Máy tính Casio fx-580VN X</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Giao diện ClassWiz Natural-V.P.A.M., phím SHIFT/ALPHA, chuyển S⇔D phân số/căn, bảng f(x), giải PT bậc 2 &amp; Hệ 2 ẩn.
              </p>
              <button
                type="button"
                data-testid="toggle-calculator-button"
                aria-pressed={isCalculatorOpen}
                onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
                className={`w-full h-9 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isCalculatorOpen
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{isCalculatorOpen ? 'Đóng Casio fx-580VN X' : 'Mở Casio fx-580VN X'}</span>
              </button>
            </div>

            {/* Pinned Problem Bar */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
              <div className="text-xs font-bold">Khung ghim đề bài cố định</div>
              <textarea
                rows={2}
                aria-label="Nội dung đề bài muốn ghim"
                value={problemDraft}
                onChange={(e) => setProblemDraft(e.target.value)}
                placeholder="Nhập đề bài để ghim cố định ở đỉnh màn hình..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:border-indigo-500 resize-none"
              />
              <input
                ref={problemImageInputRef}
                type="file"
                accept="image/*"
                onChange={handlePinProblemImage}
                className="hidden"
                aria-hidden="true"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-testid="pin-problem-button"
                  onClick={() => {
                    if (!problemDraft.trim()) return;
                    setPinnedProblem({
                      text: problemDraft.trim(),
                      imageUrl: pinnedProblem?.imageUrl,
                      collapsed: false,
                    });
                    addToast('Đã ghim đề bài ở đầu màn hình', 'success');
                  }}
                  className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Pin className="w-3 h-3" />
                  <span>Ghim đề bài</span>
                </button>
                <button
                  type="button"
                  onClick={() => problemImageInputRef.current?.click()}
                  className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <ImagePlus className="w-3 h-3" />
                  <span>Ghim ảnh đề</span>
                </button>
              </div>
            </div>

            {/* Step-by-Step Reveal Curtain */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
              <div className="text-xs font-bold">Che lời giải từng bước (Reveal Curtain)</div>
              <input
                type="text"
                aria-label="Nhãn rèm che lời giải"
                value={revealLabel}
                onChange={(e) => setRevealLabel(e.target.value)}
                placeholder="VD: Bước 1: Tính đạo hàm"
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
              <button
                type="button"
                data-testid="insert-reveal-curtain-button"
                onClick={handleInsertRevealCurtain}
                className="w-full h-8 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Chèn Rèm che lời giải</span>
              </button>
            </div>

            {/* Quick Math Grid Patterns */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Grid3X3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Nền lưới Toán học chuyên dụng</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {patternChoices.map((pat) => (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => setBoardPattern(pat.id)}
                    className={`h-8 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                      boardPattern === pat.id
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    {pat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
