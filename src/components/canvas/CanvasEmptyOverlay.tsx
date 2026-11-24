import React from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { getSafeMathViewport } from '../../engine/mathViewport';
import { ImagePlus } from 'lucide-react';

interface CanvasEmptyOverlayProps {
  viewportSize: { width: number; height: number };
  isDraggingFile: boolean;
}

export const CanvasEmptyOverlay: React.FC<CanvasEmptyOverlayProps> = ({
  viewportSize,
  isDraggingFile,
}) => {
  const hasLoaded = useBoardStore((s) => s.hasLoaded);
  const elementCount = useBoardStore((s) => s.elements.length);
  const pinnedProblem = useBoardStore((s) => s.pinnedProblem);
  const virtualTools = useBoardStore((s) => s.virtualTools);
  const boardType = useBoardStore((s) => s.boardType);
  const boardPattern = useBoardStore((s) => s.boardPattern);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const isCalculatorMinimized = useBoardStore((s) => s.isCalculatorMinimized);
  const isMathPanelCollapsed = useBoardStore((s) => s.isMathPanelCollapsed);

  const showOnboarding =
    hasLoaded &&
    elementCount === 0 &&
    !pinnedProblem &&
    !virtualTools.ruler.active &&
    !virtualTools.setSquare.active &&
    !virtualTools.protractor.active &&
    !virtualTools.compass.active;

  const safe =
    showOnboarding && boardType === 'math'
      ? getSafeMathViewport({
          viewW: viewportSize.width,
          viewH: viewportSize.height,
          isCalculatorOpen,
          isCalculatorMinimized,
          isMathPanelOpen: true,
          isMathPanelCollapsed,
          hasPinnedProblem: false,
          hasContextualToolbar: false,
        })
      : null;

  return (
    <>
      {showOnboarding && (
        <div
          style={
            safe
              ? {
                  left: safe.left,
                  top: safe.top,
                  width: safe.width,
                  height: safe.height,
                }
              : undefined
          }
          className={`pointer-events-none absolute ${
            safe ? '' : 'inset-0'
          } flex justify-center p-4 ${
            boardPattern === 'coordinate' ? 'items-end pb-8' : 'items-center'
          }`}
        >
          <div className="max-w-md text-center space-y-2 select-none opacity-70 dark:opacity-60">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {boardType === 'math'
                ? boardPattern === 'coordinate'
                  ? 'Bảng toán học — Hệ trục tọa độ Oxy'
                  : 'Bảng toán học — Sẵn sàng viết vẽ & tính toán'
                : 'Bắt đầu viết vẽ trên không gian vô tận'}
            </p>
            {boardType === 'math' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Viết tay tự do, chèn công thức, dựng hình học hoặc vẽ đồ thị ở bảng bên phải
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
                  <span>Giữ <kbd className="kbd-keycap">Shift</kbd> kẻ thẳng</span>
                  <span aria-hidden="true">·</span>
                  <span><kbd className="kbd-keycap">[</kbd> <kbd className="kbd-keycap">]</kbd> chỉnh cỡ nét</span>
                  <span aria-hidden="true">·</span>
                  <span><kbd className="kbd-keycap">F</kbd> tập trung</span>
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
                  <span>Lăn chuột thu phóng</span>
                  <span aria-hidden="true">·</span>
                  <span>Giữ <kbd className="kbd-keycap">Space</kbd> kéo bảng</span>
                  <span aria-hidden="true">·</span>
                  <span>Kéo-thả ảnh, PDF, Word</span>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-4 z-40 rounded-3xl border-2 border-dashed border-indigo-500 bg-indigo-500/10 backdrop-blur-[2px] flex items-center justify-center">
          <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
            <ImagePlus className="w-5 h-5" />
            <span>Thả ảnh, PDF hoặc Word (.docx) vào bảng</span>
          </div>
        </div>
      )}
    </>
  );
};
