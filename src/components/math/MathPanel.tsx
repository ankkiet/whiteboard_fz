import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { MATH_GRADE_MODES } from '../../engine/mathCurriculum';
import { computeSafeWorldCenter, getSafeMathViewport } from '../../engine/mathViewport';
import { MathGradeMode } from '../../types/board';
import { PrimaryManipulativesTab } from './PrimaryManipulativesTab';
import { GraphAndCalculusTab } from './GraphAndCalculusTab';
import { StatsAndProbTab } from './StatsAndProbTab';
import { MathFormulaTab } from './MathFormulaTab';
import { MathGeometryTab } from './MathGeometryTab';
import { MathToolsTab } from './MathToolsTab';
import {
  BarChart3,
  Blocks,
  Calculator,
  Compass,
  FunctionSquare,
  PanelRightClose,
  PanelRightOpen,
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

export const MathPanel: React.FC<MathPanelProps> = ({ isOpen, onClose }) => {
  const mathGradeMode = useBoardStore((s) => s.mathGradeMode);
  const setMathGradeMode = useBoardStore((s) => s.setMathGradeMode);
  const virtualTools = useBoardStore((s) => s.virtualTools);
  const hideAllVirtualTools = useBoardStore((s) => s.hideAllVirtualTools);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const setIsCalculatorOpen = useBoardStore((s) => s.setIsCalculatorOpen);
  const isMathPanelCollapsed = useBoardStore((s) => s.isMathPanelCollapsed);
  const setIsMathPanelCollapsed = useBoardStore((s) => s.setIsMathPanelCollapsed);

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
  const insertOffsetStepRef = useRef(0);

  useEffect(() => {
    const allowed = tabsForGrade.map((t) => t.id);
    if (!allowed.includes(activeTab)) {
      setActiveTab(allowed[0]);
    }
  }, [tabsForGrade, activeTab]);

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
    setActiveTab(mode === 'primary' ? 'primary' : 'graph');
  };

  const activeVirtualCount = (
    ['ruler', 'setSquare', 'protractor', 'compass'] as const
  ).filter((k) => virtualTools[k].active).length;

  // Compact Docked Vertical Rail Mode
  if (isMathPanelCollapsed) {
    return (
      <aside
        data-testid="math-panel"
        data-grade-mode={mathGradeMode}
        data-collapsed="true"
        aria-label="Thanh công cụ toán học thu gọn"
        className="pointer-events-auto absolute top-16 right-3 z-20 w-12 py-2 px-1.5 flex flex-col items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 select-none"
      >
        <button
          type="button"
          data-testid="expand-math-panel-button"
          onClick={() => setIsMathPanelCollapsed(false)}
          title="Mở rộng bảng toán học 1–12"
          aria-label="Mở rộng bảng toán học"
          className="w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors duration-150 cursor-pointer"
        >
          <PanelRightOpen className="w-4 h-4" strokeWidth={1.75} />
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
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                active
                  ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
            </button>
          );
        })}

        <div className="w-7 h-px bg-slate-200 dark:bg-slate-800 my-0.5" />

        <button
          type="button"
          data-testid="header-toggle-casio-button"
          aria-pressed={isCalculatorOpen}
          onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
          title="Bật / tắt máy tính Casio fx-580VN X"
          aria-label="Bật / tắt máy tính Casio fx-580VN X"
          className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors duration-150 cursor-pointer ${
            isCalculatorOpen
              ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <Calculator className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {activeVirtualCount > 0 && (
          <button
            type="button"
            onClick={hideAllVirtualTools}
            title={`Ẩn ${activeVirtualCount} dụng cụ đo vẽ đang bật`}
            aria-label="Ẩn tất cả dụng cụ đo vẽ"
            className="w-9 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-mono font-medium flex items-center justify-center cursor-pointer"
          >
            {activeVirtualCount}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          title="Ẩn hoàn toàn bảng công cụ toán (mở lại ở nút Bảng toán)"
          aria-label="Đóng bảng toán học"
          className="w-9 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors duration-150 cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      data-testid="math-panel"
      data-grade-mode={mathGradeMode}
      data-collapsed="false"
      aria-label="Bảng toán học lớp 1 đến 12"
      className="pointer-events-auto absolute top-16 right-3 z-20 w-80 max-h-[calc(100vh-5rem)] flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 overflow-hidden select-text"
    >
      {/* Header + Grade Mode Switcher */}
      <div className="px-3 py-2.5 border-b border-slate-200/80 dark:border-slate-800 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Sigma className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate leading-tight text-slate-900 dark:text-slate-100">
                Bảng toán học 1–12
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate leading-tight tabular-nums">
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
              title="Bật / tắt máy tính Casio fx-580VN X"
              className={`h-7 px-2 rounded-lg text-xs font-mono font-medium inline-flex items-center gap-1 border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                isCalculatorOpen
                  ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>580</span>
            </button>
            <button
              type="button"
              data-testid="collapse-math-panel-button"
              onClick={() => setIsMathPanelCollapsed(true)}
              aria-label="Thu gọn thành thanh dọc bên phải"
              title="Thu gọn thành thanh dọc bên phải để mở rộng vùng vẽ"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-150 cursor-pointer shrink-0"
            >
              <PanelRightClose className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng bảng công cụ toán học"
              title="Đóng bảng toán học"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-150 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Grade Mode Switcher */}
        <div
          role="group"
          aria-label="Chế độ cấp học"
          className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950"
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
                className={`h-7 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade-Filtered Feature Tabs */}
      <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div
          role="tablist"
          aria-label="Nhóm công cụ toán học"
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
                className={`h-10 px-0.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
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
          <MathFormulaTab
            gradeMode={mathGradeMode}
            getWorldCenter={getViewportWorldCenter}
          />
        )}
        {activeTab === 'geometry' && (
          <MathGeometryTab
            gradeMode={mathGradeMode}
            getWorldCenter={getViewportWorldCenter}
          />
        )}
        {activeTab === 'stats' && (
          <StatsAndProbTab
            gradeMode={mathGradeMode}
            getWorldCenter={getViewportWorldCenter}
          />
        )}
        {activeTab === 'tools' && (
          <MathToolsTab getWorldCenter={getViewportWorldCenter} />
        )}
      </div>
    </aside>
  );
};

export default MathPanel;
