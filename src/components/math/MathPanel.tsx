import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { getMathGradeModes } from '../../engine/mathCurriculum';
import { computeSafeWorldCenter, getSafeMathViewport } from '../../engine/mathViewport';
import { MathGradeMode } from '../../types/board';
import { useI18n } from '../../i18n/useI18n';
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
  const { language, t } = useI18n();
  const mathGradeMode = useBoardStore((s) => s.mathGradeMode);
  const setMathGradeMode = useBoardStore((s) => s.setMathGradeMode);
  const virtualTools = useBoardStore((s) => s.virtualTools);
  const hideAllVirtualTools = useBoardStore((s) => s.hideAllVirtualTools);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const setIsCalculatorOpen = useBoardStore((s) => s.setIsCalculatorOpen);
  const isMathPanelCollapsed = useBoardStore((s) => s.isMathPanelCollapsed);
  const setIsMathPanelCollapsed = useBoardStore((s) => s.setIsMathPanelCollapsed);

  const gradeModes = useMemo(() => getMathGradeModes(language), [language]);

  const tabsForGrade = useMemo(() => {
    if (mathGradeMode === 'primary') {
      return [
        { id: 'primary' as const, label: t('Học cụ', 'Blocks'), icon: Blocks },
        { id: 'formula' as const, label: t('Công thức', 'Formulas'), icon: FunctionSquare },
        { id: 'geometry' as const, label: t('Đo vẽ', 'Tools'), icon: Ruler },
        { id: 'tools' as const, label: t('Tiện ích', 'Utilities'), icon: Wrench },
      ];
    }
    if (mathGradeMode === 'middle') {
      return [
        { id: 'graph' as const, label: t('Đồ thị', 'Graphs'), icon: TrendingUp },
        { id: 'formula' as const, label: t('Công thức', 'Formulas'), icon: FunctionSquare },
        { id: 'geometry' as const, label: t('Hình & 3D', 'Geom & 3D'), icon: Compass },
        { id: 'stats' as const, label: t('ĐS & TK', 'Alg & Stats'), icon: BarChart3 },
        { id: 'tools' as const, label: t('Tiện ích', 'Utilities'), icon: Wrench },
      ];
    }
    return [
      { id: 'graph' as const, label: t('Đồ thị', 'Graphs'), icon: TrendingUp },
      { id: 'formula' as const, label: t('Công thức', 'Formulas'), icon: FunctionSquare },
      { id: 'geometry' as const, label: t('Hình & 3D', 'Geom & 3D'), icon: Compass },
      { id: 'stats' as const, label: t('XS & TK', 'Prob & Stats'), icon: BarChart3 },
      { id: 'tools' as const, label: t('Tiện ích', 'Utilities'), icon: Wrench },
    ];
  }, [mathGradeMode, t]);

  const [activeTab, setActiveTab] = useState<StudioTab>(
    mathGradeMode === 'primary' ? 'primary' : 'graph'
  );
  const insertOffsetStepRef = useRef(0);

  useEffect(() => {
    const allowed = tabsForGrade.map((tab) => tab.id);
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
        aria-label={t('Thanh công cụ toán học thu gọn', 'Collapsed math toolbar')}
        className="pointer-events-auto absolute top-16 right-3 z-20 w-12 py-2 px-1.5 flex flex-col items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 select-none"
      >
        <button
          type="button"
          data-testid="expand-math-panel-button"
          onClick={() => setIsMathPanelCollapsed(false)}
          title={t('Mở rộng bảng toán học 1–12', 'Expand Math Studio (Grades 1–12)')}
          aria-label={t('Mở rộng bảng toán học', 'Expand Math Studio')}
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
              title={t(`Mở mục ${tab.label}`, `Open ${tab.label}`)}
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
          title={t('Bật / tắt máy tính Casio fx-580VN X', 'Toggle Casio fx-580VN X calculator')}
          aria-label={t('Bật / tắt máy tính Casio fx-580VN X', 'Toggle Casio fx-580VN X calculator')}
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
            title={t(`Ẩn ${activeVirtualCount} dụng cụ đo vẽ đang bật`, `Hide ${activeVirtualCount} active drafting tools`)}
            aria-label={t('Ẩn tất cả dụng cụ đo vẽ', 'Hide all drafting tools')}
            className="w-9 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-mono font-medium flex items-center justify-center cursor-pointer"
          >
            {activeVirtualCount}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          title={t('Ẩn hoàn toàn bảng công cụ toán (mở lại ở nút Bảng toán)', 'Hide Math Studio (reopen from Math panel button)')}
          aria-label={t('Đóng bảng toán học', 'Close Math Studio')}
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
      aria-label={t('Bảng toán học lớp 1 đến 12', 'Math Studio grades 1 to 12')}
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
                {t('Bảng toán học 1–12', 'Math Studio 1–12')}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate leading-tight tabular-nums">
                {gradeModes.find((g) => g.id === mathGradeMode)?.range}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              data-testid="header-toggle-casio-button"
              aria-pressed={isCalculatorOpen}
              onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
              title={t('Bật / tắt máy tính Casio fx-580VN X', 'Toggle Casio fx-580VN X calculator')}
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
              aria-label={t('Thu gọn thành thanh dọc bên phải', 'Collapse into right rail')}
              title={t('Thu gọn thành thanh dọc bên phải để mở rộng vùng vẽ', 'Collapse to right rail to widen canvas')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-150 cursor-pointer shrink-0"
            >
              <PanelRightClose className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('Đóng bảng công cụ toán học', 'Close Math Studio')}
              title={t('Đóng bảng toán học', 'Close Math Studio')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-150 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Grade Mode Switcher */}
        <div
          role="group"
          aria-label={t('Chế độ cấp học', 'Grade level mode')}
          className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950"
        >
          {gradeModes.map((g) => {
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
          aria-label={t('Nhóm công cụ toán học', 'Math tool categories')}
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
