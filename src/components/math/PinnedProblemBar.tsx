import React from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { getSafeMathViewport } from '../../engine/mathViewport';
import { RichMathText } from './MathTex';
import { ChevronDown, ChevronUp, Pin, X } from 'lucide-react';

export const PinnedProblemBar: React.FC = () => {
  const pinnedProblem = useBoardStore((s) => s.pinnedProblem);
  const setPinnedProblem = useBoardStore((s) => s.setPinnedProblem);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const isCalculatorMinimized = useBoardStore((s) => s.isCalculatorMinimized);
  const boardType = useBoardStore((s) => s.boardType);
  const isMathPanelCollapsed = useBoardStore((s) => s.isMathPanelCollapsed);

  if (!pinnedProblem) return null;

  const safeRect = getSafeMathViewport({
    viewW: typeof window !== 'undefined' ? window.innerWidth : 1280,
    viewH: typeof window !== 'undefined' ? window.innerHeight : 800,
    isCalculatorOpen,
    isCalculatorMinimized,
    isMathPanelOpen: boardType === 'math',
    isMathPanelCollapsed,
    hasPinnedProblem: false,
    hasContextualToolbar: false,
  });

  return (
    <div
      data-testid="pinned-problem-bar"
      style={{
        left: safeRect.centerX,
        width: Math.min(480, Math.max(260, safeRect.width - 16)),
      }}
      className="pointer-events-auto fixed top-16 -translate-x-1/2 z-20 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-none text-slate-900 dark:text-slate-100 overflow-hidden select-text"
    >
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Pin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" strokeWidth={1.75} />
          <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
            Đề bài đang ghim
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label={pinnedProblem.collapsed ? 'Mở rộng đề bài' : 'Thu gọn đề bài'}
            onClick={() =>
              setPinnedProblem({ ...pinnedProblem, collapsed: !pinnedProblem.collapsed })
            }
            className="w-6 h-6 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center cursor-pointer"
          >
            {pinnedProblem.collapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Bỏ ghim đề bài"
            onClick={() => setPinnedProblem(null)}
            className="w-6 h-6 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-slate-500 flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!pinnedProblem.collapsed && (
        <div className="px-3.5 py-2.5 max-h-44 overflow-y-auto space-y-2">
          {pinnedProblem.text && (
            <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
              <RichMathText text={pinnedProblem.text} />
            </p>
          )}
          {pinnedProblem.imageUrl && (
            <img
              src={pinnedProblem.imageUrl}
              alt="Ảnh đề bài đã ghim"
              className="max-h-32 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
};
