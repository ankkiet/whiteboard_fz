import React, { useMemo, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  MATH_GRAPH_PRESETS,
  buildGraphPlotElements,
} from '../../engine/mathUtils';
import {
  analyzeFunctionFeatures,
  autoGenerateVariationTable,
  buildFeatureAnnotationElements,
  buildIntegralShadingElements,
  buildNumberLineIntervalElements,
  buildUnitCircleElements,
  buildVariationTableElements,
  compileParametricExpression,
  computeDefiniteIntegral,
  expressionUsesParamM,
  getExactTrigInfo,
  substituteParamM,
} from '../../engine/mathEngine';
import { formatTrigValueToLatex, friendlyMathToLatex } from '../../engine/mathDisplay';
import { getSafeMathViewport } from '../../engine/mathViewport';
import { MathTex } from './MathTex';
import { MathGradeMode } from '../../types/board';
import {
  Crosshair,
  Eye,
  EyeOff,
  Plus,
  Sparkles,
  Table2,
  TrendingUp,
} from 'lucide-react';

interface GraphAndCalculusTabProps {
  gradeMode: MathGradeMode;
  getWorldCenter: () => { x: number; y: number };
}

const GRAPH_COLORS = ['#4f46e5', '#059669', '#e11d48', '#2563eb', '#d97706', '#7c3aed'];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const GraphAndCalculusTab: React.FC<GraphAndCalculusTabProps> = ({
  gradeMode,
  getWorldCenter,
}) => {
  const addElementsBatch = useBoardStore((s) => s.addElementsBatch);
  const setCamera = useBoardStore((s) => s.setCamera);
  const setBoardPattern = useBoardStore((s) => s.setBoardPattern);
  const addToast = useBoardStore((s) => s.addToast);
  const boardPattern = useBoardStore((s) => s.boardPattern);

  const [expression, setExpression] = useState(
    gradeMode === 'high' ? 'x^3 - 3*m*x + 1' : '0.25*x^2 - 2'
  );
  const [paramM, setParamM] = useState(1);
  const [graphColor, setGraphColor] = useState(GRAPH_COLORS[0]);
  const [xMinStr, setXMinStr] = useState('-6');
  const [xMaxStr, setXMaxStr] = useState('6');
  const [annotateFeatures, setAnnotateFeatures] = useState(true);

  // Definite integral state
  const [intA, setIntA] = useState('0');
  const [intB, setIntB] = useState('2');

  // Number line interval state
  const [intLeft, setIntLeft] = useState('-2');
  const [intRight, setIntRight] = useState('5');
  const [leftClosed, setLeftClosed] = useState(true);
  const [rightClosed, setRightClosed] = useState(false);

  // Unit circle state
  const [trigDeg, setTrigDeg] = useState(45);

  const usesM = useMemo(() => expressionUsesParamM(expression), [expression]);

  const parsedStatus = useMemo(() => {
    const trimmed = expression.trim();
    if (!trimmed) return { valid: false, summary: 'Nhập hàm số theo biến x (hỗ trợ tham số m).' };
    const fn = compileParametricExpression(trimmed, paramM);
    if (!fn) {
      return { valid: false, summary: 'Cú pháp chưa hợp lệ. VD: x^3 - 3*m*x + 1, (2x+1)/(x-1)' };
    }
    const analysis = analyzeFunctionFeatures(trimmed, -6, 6, paramM);
    const parts: string[] = [];
    if (analysis.extrema.length > 0) {
      parts.push(
        analysis.extrema
          .slice(0, 2)
          .map((e) => `${e.kind === 'max' ? 'CĐ' : 'CT'}(${e.x};${e.y})`)
          .join(', ')
      );
    }
    if (analysis.verticalAsymptotes.length > 0) {
      parts.push(`TCĐ x=${analysis.verticalAsymptotes[0]}`);
    }
    if (analysis.horizontalAsymptote !== null) {
      parts.push(`TCN y=${analysis.horizontalAsymptote}`);
    }
    return {
      valid: true,
      summary: parts.length > 0 ? parts.join(' · ') : 'Hợp lệ trên miền xác định',
    };
  }, [expression, paramM]);

  const integralRes = useMemo(() => {
    if (gradeMode !== 'high') return null;
    const a = Number(intA);
    const b = Number(intB);
    return computeDefiniteIntegral(expression, a, b, paramM);
  }, [expression, intA, intB, paramM, gradeMode]);

  const trigInfo = useMemo(() => getExactTrigInfo(trigDeg), [trigDeg]);

  const isAxesVisible = boardPattern === 'coordinate';

  const getStartZ = () =>
    useBoardStore.getState().elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);

  const getCurrentSafeRect = () => {
    const state = useBoardStore.getState();
    const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
    return getSafeMathViewport({
      viewW,
      viewH,
      isMathPanelOpen: true,
      isMathPanelCollapsed: state.isMathPanelCollapsed,
      isCalculatorOpen: state.isCalculatorOpen,
      isCalculatorMinimized: state.isCalculatorMinimized,
      hasPinnedProblem: Boolean(state.pinnedProblem),
      isPinnedProblemCollapsed: Boolean(state.pinnedProblem?.collapsed),
    });
  };

  const ensureOriginInSafeViewport = (forceCenter = false) => {
    const safeRect = getCurrentSafeRect();
    const { camera } = useBoardStore.getState();
    const outOfSafeCenter =
      Math.abs(camera.x - safeRect.centerX) > 65 || Math.abs(camera.y - safeRect.centerY) > 65;
    if (forceCenter || outOfSafeCenter) {
      setCamera({ x: safeRect.centerX, y: safeRect.centerY, zoom: forceCenter ? 1 : camera.zoom });
    }
  };

  const handleToggleAxes = () => {
    const nextIsCoord = !isAxesVisible;
    setBoardPattern(nextIsCoord ? 'coordinate' : 'grid');
    if (nextIsCoord) {
      ensureOriginInSafeViewport(false);
    }
  };

  const handleRecenterOrigin = () => {
    ensureOriginInSafeViewport(true);
    if (boardPattern !== 'coordinate') {
      setBoardPattern('coordinate');
    }
  };

  const handlePlotFunction = (e: React.FormEvent) => {
    e.preventDefault();
    const xMin = Number(xMinStr);
    const xMax = Number(xMaxStr);
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) {
      addToast('Miền vẽ x chưa hợp lệ (x từ phải nhỏ hơn x đến).', 'error');
      return;
    }

    const substituted = usesM ? substituteParamM(expression, paramM) : expression;
    const maxZ = getStartZ();
    const built = buildGraphPlotElements({
      expression: substituted,
      color: graphColor,
      xMin,
      xMax,
      startZIndex: maxZ,
      createId: uid,
    });

    if (!built || built.length === 0) {
      addToast('Không thể vẽ hàm số trong khoảng đã chọn.', 'error');
      return;
    }

    // Relabel parametric expression cleanly in KaTeX with current m value
    if (usesM) {
      const labelEl = built.find((el) => el.type === 'formula');
      if (labelEl && labelEl.type === 'formula') {
        labelEl.latex = `y = ${friendlyMathToLatex(expression)}\\;(m = ${paramM})`;
        labelEl.width = Math.max(180, Math.min(340, labelEl.latex.length * 9 + 48));
      }
    }

    const combined = [...built];
    if (annotateFeatures && gradeMode === 'high') {
      const analysis = analyzeFunctionFeatures(expression, xMin, xMax, paramM);
      const annotations = buildFeatureAnnotationElements({
        analysis,
        xMin,
        xMax,
        color: graphColor,
        startZIndex: maxZ + built.length,
        createId: uid,
      });
      combined.push(...annotations);
    }

    if (useBoardStore.getState().boardPattern !== 'coordinate') {
      setBoardPattern('coordinate');
    }
    ensureOriginInSafeViewport(false);

    addElementsBatch(combined, true);
    addToast('Đã vẽ đồ thị hàm số lên hệ trục Oxy', 'success');
  };

  const handleShadeIntegral = () => {
    const a = Number(intA);
    const b = Number(intB);
    const els = buildIntegralShadingElements({
      expression,
      mValue: paramM,
      a,
      b,
      color: graphColor,
      startZIndex: getStartZ(),
      createId: uid,
    });
    if (!els) {
      addToast('Không thể tính tích phân trên đoạn [a; b] này.', 'error');
      return;
    }
    if (useBoardStore.getState().boardPattern !== 'coordinate') {
      setBoardPattern('coordinate');
    }
    ensureOriginInSafeViewport(false);
    addElementsBatch(els, true);
    addToast(`Đã tô miền tích phân [${a}; ${b}] trên hệ trục Oxy`, 'success');
  };

  const handleInsertVariationTable = () => {
    const data = autoGenerateVariationTable(expression, paramM);
    if (!data) {
      addToast('Không thể tự sinh bảng biến thiên cho biểu thức này.', 'error');
      return;
    }
    const els = buildVariationTableElements(
      data,
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast('Đã chèn bảng biến thiên lên bảng', 'success');
  };

  const handleInsertInterval = () => {
    const lb = intLeft.trim() === '' ? null : Number(intLeft);
    const rb = intRight.trim() === '' ? null : Number(intRight);
    const els = buildNumberLineIntervalElements(
      {
        leftBound: lb !== null && Number.isFinite(lb) ? lb : null,
        rightBound: rb !== null && Number.isFinite(rb) ? rb : null,
        leftClosed,
        rightClosed,
      },
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast('Đã chèn Trục số tập hợp lên bảng', 'success');
  };

  const handleInsertUnitCircle = () => {
    const els = buildUnitCircleElements(
      trigDeg,
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast(`Đã chèn Vòng tròn lượng giác (${trigInfo.deg}° = ${trigInfo.radLabel})`, 'success');
  };

  return (
    <div className="space-y-3.5">
      <form onSubmit={handlePlotFunction} className="space-y-3">
        {/* On-demand Oxy Coordinate Plane Toggle */}
        <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
          <button
            type="button"
            data-testid="toggle-oxy-axes-button"
            aria-pressed={isAxesVisible}
            onClick={handleToggleAxes}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          >
            {isAxesVisible ? (
              <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span>{isAxesVisible ? 'Đang hiện trục Oxy' : 'Hiện trục tọa độ Oxy'}</span>
          </button>
          {isAxesVisible && (
            <button
              type="button"
              onClick={handleRecenterOrigin}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Crosshair className="w-3 h-3" />
              <span>Về tâm O</span>
            </button>
          )}
        </div>

        {/* Function Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="math-graph-input"
            className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
          >
            Hàm số y = f(x) {gradeMode === 'high' ? '(hỗ trợ tham số m)' : ''}
          </label>
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus-within:border-indigo-500 overflow-hidden">
            <span className="pl-3 pr-1.5 text-xs font-serif italic font-semibold text-slate-500 dark:text-slate-400 select-none whitespace-nowrap shrink-0">
              y =
            </span>
            <input
              id="math-graph-input"
              data-testid="math-graph-input"
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="x^3 - 3mx + 1"
              className="w-full min-w-0 h-9 pr-3 bg-transparent text-xs font-mono text-slate-900 dark:text-slate-100 outline-none"
            />
          </div>
          {expression.trim() && (
            <div className="px-2.5 py-1.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50 flex items-center justify-between gap-2 overflow-x-auto">
              <MathTex
                latex={`y = ${friendlyMathToLatex(expression)}${usesM ? `\\;(m = ${paramM})` : ''}`}
                className="text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          )}
          <p
            className={`text-[11px] font-mono tabular-nums leading-snug ${
              parsedStatus.valid
                ? 'text-slate-500 dark:text-slate-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {parsedStatus.summary}
          </p>
        </div>

        {/* Dynamic Parameter m Slider */}
        {usesM && (
          <div className="px-2.5 py-2 rounded-xl border border-indigo-200/80 dark:border-indigo-800/70 bg-indigo-50/60 dark:bg-indigo-950/30 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
              <span>Tham số <MathTex latex="m" className="ml-0.5" /></span>
              <span className="tabular-nums"><MathTex latex={`m = ${paramM}`} /></span>
            </div>
            <input
              type="range"
              min={-5}
              max={5}
              step={0.5}
              aria-label="Thanh trượt tham số m"
              value={paramM}
              onChange={(e) => setParamM(Number(e.target.value))}
              className="w-full h-1.5 accent-indigo-600 cursor-pointer"
            />
          </div>
        )}

        {/* Quick Function Presets (Rendered in KaTeX) */}
        <div className="flex flex-wrap gap-1.5">
          {[
            ...MATH_GRAPH_PRESETS.slice(0, 4).map((p) => ({
              ...p,
              latex: `y = ${friendlyMathToLatex(p.expr)}`,
            })),
            ...(gradeMode === 'high'
              ? [
                  {
                    label: 'x³−3mx+1',
                    latex: 'x^{3} - 3mx + 1',
                    expr: 'x^3 - 3*m*x + 1',
                    color: '#4f46e5',
                  },
                  {
                    label: '(2x+1)/(x−1)',
                    latex: '\\frac{2x+1}{x-1}',
                    expr: '(2*x+1)/(x-1)',
                    color: '#e11d48',
                  },
                ]
              : []),
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setExpression(preset.expr);
                setGraphColor(preset.color);
              }}
              className="min-h-8 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-indigo-400 text-[11px] text-slate-800 dark:text-slate-100 cursor-pointer flex items-center justify-center"
            >
              <MathTex latex={preset.latex} />
            </button>
          ))}
        </div>

        {/* Domain & Color */}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="block text-[10.5px] text-slate-500">x từ</span>
            <input
              type="number"
              step="1"
              value={xMinStr}
              onChange={(e) => setXMinStr(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono tabular-nums"
            />
          </label>
          <label className="space-y-0.5">
            <span className="block text-[10.5px] text-slate-500">x đến</span>
            <input
              type="number"
              step="1"
              value={xMaxStr}
              onChange={(e) => setXMaxStr(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono tabular-nums"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2">
          {gradeMode === 'high' ? (
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={annotateFeatures}
                onChange={(e) => setAnnotateFeatures(e.target.checked)}
                className="accent-indigo-600 rounded"
              />
              <span>Đánh dấu cực trị &amp; tiệm cận</span>
            </label>
          ) : (
            <span className="text-[11px] text-slate-500">Màu đồ thị</span>
          )}
          <div className="flex items-center gap-1.5">
            {GRAPH_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                aria-label={`Chọn màu đồ thị ${col}`}
                onClick={() => setGraphColor(col)}
                className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                  graphColor === col
                    ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: col }}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          data-testid="plot-function-button"
          disabled={!parsedStatus.valid}
          className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Vẽ đồ thị lên bảng</span>
        </button>
      </form>

      {/* THPT-Only Calculus & Analysis Modules */}
      {gradeMode === 'high' && (
        <>
          {/* Definite Integral & Variation Table */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
            <div className="text-xs font-medium">Tích phân xác định &amp; bảng biến thiên</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-1.5 px-2 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono">
                <span className="text-slate-500">a =</span>
                <input
                  type="number"
                  step="0.5"
                  value={intA}
                  onChange={(e) => setIntA(e.target.value)}
                  className="w-full min-w-0 bg-transparent outline-none"
                />
              </label>
              <label className="flex items-center gap-1.5 px-2 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono">
                <span className="text-slate-500">b =</span>
                <input
                  type="number"
                  step="0.5"
                  value={intB}
                  onChange={(e) => setIntB(e.target.value)}
                  className="w-full min-w-0 bg-transparent outline-none"
                />
              </label>
            </div>
            {integralRes && (
              <div className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200/60 dark:border-indigo-900/50 text-[11.5px] text-indigo-700 dark:text-indigo-300 overflow-x-auto">
                <MathTex
                  latex={`\\int_{${intA || 'a'}}^{${intB || 'b'}} f(x)\\,dx \\approx ${integralRes.signedIntegral.toFixed(2)},\\; S \\approx ${integralRes.areaS.toFixed(2)},\\; V \\approx ${integralRes.volumeV.toFixed(2)}`}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleShadeIntegral}
                disabled={!integralRes}
                className="h-8 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3 h-3" />
                <span>Tô miền ∫</span>
              </button>
              <button
                type="button"
                data-testid="insert-variation-table-button"
                onClick={handleInsertVariationTable}
                disabled={!parsedStatus.valid}
                className="h-8 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-40 text-white dark:text-slate-900 text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>Bảng biến thiên</span>
              </button>
            </div>
          </div>

          {/* Number Line Interval */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
            <div className="text-xs font-bold">Trục số tập hợp &amp; xét dấu</div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLeftClosed((v) => !v)}
                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm cursor-pointer"
                title="Đổi ngoặc vuông/tròn đầu trái"
              >
                {leftClosed ? '[' : '('}
              </button>
              <input
                type="text"
                value={intLeft}
                onChange={(e) => setIntLeft(e.target.value)}
                placeholder="-∞"
                aria-label="Đầu mút trái"
                className="w-full min-w-0 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
              />
              <span className="text-xs font-mono text-slate-400">;</span>
              <input
                type="text"
                value={intRight}
                onChange={(e) => setIntRight(e.target.value)}
                placeholder="+∞"
                aria-label="Đầu mút phải"
                className="w-full min-w-0 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
              />
              <button
                type="button"
                onClick={() => setRightClosed((v) => !v)}
                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm cursor-pointer"
                title="Đổi ngoặc vuông/tròn đầu phải"
              >
                {rightClosed ? ']' : ')'}
              </button>
            </div>
            <button
              type="button"
              onClick={handleInsertInterval}
              className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Chèn Trục số tập hợp (có gạch bỏ)</span>
            </button>
          </div>

          {/* Interactive Unit Circle (Lượng giác) */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Vòng tròn lượng giác</span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums inline-flex items-center gap-1">
                <span>{trigInfo.deg}°</span>
                <span>(</span>
                <MathTex latex={formatTrigValueToLatex(trigInfo.radLabel)} />
                <span>)</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              aria-label="Chọn góc lượng giác"
              value={trigDeg}
              onChange={(e) => setTrigDeg(Number(e.target.value))}
              className="w-full h-1.5 accent-indigo-600 cursor-pointer"
            />
            <div className="flex flex-wrap gap-1">
              {[0, 30, 45, 60, 90, 120, 135, 180].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setTrigDeg(a)}
                  className={`h-6 px-1.5 rounded text-[10.5px] font-mono font-semibold cursor-pointer ${
                    trigDeg === a
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {a}°
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-2 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
              <MathTex latex={`\\cos = ${formatTrigValueToLatex(trigInfo.cosLabel)}`} />
              <MathTex latex={`\\sin = ${formatTrigValueToLatex(trigInfo.sinLabel)}`} />
              <MathTex latex={`\\tan = ${formatTrigValueToLatex(trigInfo.tanLabel)}`} />
            </div>
            <button
              type="button"
              onClick={handleInsertUnitCircle}
              className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Chèn Vòng tròn lượng giác lên bảng</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
