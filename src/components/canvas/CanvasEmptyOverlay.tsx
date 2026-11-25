import React from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { getSafeMathViewport } from '../../engine/mathViewport';
import { useI18n } from '../../i18n/useI18n';
import { ImagePlus } from 'lucide-react';

interface CanvasEmptyOverlayProps {
  viewportSize: { width: number; height: number };
  isDraggingFile: boolean;
}

export const CanvasEmptyOverlay: React.FC<CanvasEmptyOverlayProps> = ({
  viewportSize,
  isDraggingFile,
}) => {
  const { t } = useI18n();
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
                  ? t('Bảng toán học — Hệ trục tọa độ Oxy', 'Math board — Oxy coordinate axes')
                  : t('Bảng toán học — Sẵn sàng viết vẽ & tính toán', 'Math board — Ready to write & calculate')
                : t('Bắt đầu viết vẽ trên không gian vô tận', 'Start writing and drawing on an infinite canvas')}
            </p>
            {boardType === 'math' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t(
                  'Viết tay tự do, chèn công thức, dựng hình học hoặc vẽ đồ thị ở bảng bên phải',
                  'Sketch freely, insert formulas, construct geometry, or plot graphs from the right panel'
                )}
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
                  <span>
                    {t('Giữ', 'Hold')} <kbd className="kbd-keycap">Shift</kbd> {t('kẻ thẳng', 'straight line')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    <kbd className="kbd-keycap">[</kbd> <kbd className="kbd-keycap">]</kbd>{' '}
                    {t('chỉnh cỡ nét', 'stroke width')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    <kbd className="kbd-keycap">F</kbd> {t('tập trung', 'focus')}
                  </span>
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
                  <span>{t('Lăn chuột thu phóng', 'Scroll to zoom')}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t('Giữ', 'Hold')} <kbd className="kbd-keycap">Space</kbd> {t('kéo bảng', 'to pan')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{t('Kéo-thả ảnh, PDF, Word', 'Drop images, PDF, Word')}</span>
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
            <span>{t('Thả ảnh, PDF hoặc Word (.docx) vào bảng', 'Drop images, PDF, or Word (.docx) onto board')}</span>
          </div>
        </div>
      )}
    </>
  );
};
