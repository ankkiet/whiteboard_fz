import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { resolveColor } from '../../engine/renderer';
import { friendlyMathToLatex } from '../../engine/mathDisplay';
import { FormulaElement, RevealElement } from '../../types/board';
import { MathTex, renderKatexSafe } from '../math/MathTex';
import { useI18n } from '../../i18n/useI18n';
import { Check, Code2 } from 'lucide-react';

export const MathFormulaLayer: React.FC = () => {
  const { t } = useI18n();
  const elements = useBoardStore((s) => s.elements);
  const camera = useBoardStore((s) => s.camera);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);
  const editingElementId = useBoardStore((s) => s.editingElementId);
  const updateElement = useBoardStore((s) => s.updateElement);
  const setEditingElementId = useBoardStore((s) => s.setEditingElementId);
  const commitHistory = useBoardStore((s) => s.commitHistory);

  const inlineQuickKeys = useMemo(
    () => [
      { title: t('Phân số', 'Fraction'), display: '\\frac{a}{b}', insert: '\\frac{a}{b}' },
      { title: t('Căn bậc hai', 'Square root'), display: '\\sqrt{x}', insert: '\\sqrt{x}' },
      { title: t('Lũy thừa', 'Power'), display: 'x^{2}', insert: 'x^{2}' },
      { title: t('Cộng trừ', 'Plus-minus'), display: '\\pm', insert: ' \\pm ' },
      { title: t('Nhân', 'Multiply'), display: '\\times', insert: ' \\times ' },
      { title: t('Số Pi', 'Pi'), display: '\\pi', insert: '\\pi' },
      {
        title: t('Tích phân', 'Integral'),
        display: '\\int_{a}^{b}',
        insert: '\\int_{a}^{b} f(x)\\,dx',
      },
    ],
    [t]
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [friendlyText, setFriendlyText] = useState('');
  const [showRawCode, setShowRawCode] = useState(false);

  const formulaElements = useMemo(
    () => elements.filter((el): el is FormulaElement => el.type === 'formula'),
    [elements]
  );

  const closedReveals = useMemo(
    () => elements.filter((el): el is RevealElement => el.type === 'reveal' && !el.revealed),
    [elements]
  );

  const editingFormula = useMemo(
    () => formulaElements.find((el) => el.id === editingElementId) || null,
    [formulaElements, editingElementId]
  );

  useEffect(() => {
    if (!editingFormula) return;
    setFriendlyText('');
    setShowRawCode(false);
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [editingFormula?.id]);

  if (formulaElements.length === 0 && closedReveals.length === 0) return null;

  const commitFormulaEdit = () => {
    setEditingElementId(null);
    commitHistory();
  };

  const applyLatexUpdate = (nextLatex: string) => {
    if (!editingFormula) return;
    updateElement(
      editingFormula.id,
      {
        latex: nextLatex,
        width: Math.max(150, Math.min(540, nextLatex.length * (editingFormula.fontSize * 0.56) + 56)),
      },
      false
    );
  };

  return (
    <div
      data-testid="math-formula-layer"
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
    >
      {formulaElements.map((el) => {
        const left = el.x * camera.zoom + camera.x;
        const top = el.y * camera.zoom + camera.y;
        const width = el.width * camera.zoom;
        const height = el.height * camera.zoom;
        const ink = resolveColor(el.color, isDarkMode);
        const html = renderKatexSafe(el.latex, true);

        return (
          <div
            key={el.id}
            data-testid="canvas-formula-item"
            data-formula-id={el.id}
            style={{
              left,
              top,
              width,
              height,
              color: ink,
              fontSize: `${Math.max(10, el.fontSize * camera.zoom)}px`,
            }}
            className="absolute flex items-center justify-center leading-none select-none overflow-visible"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}

      {/* Opaque pointer-events-none covers for closed Reveal curtains so they also mask KaTeX HTML formulas */}
      {closedReveals.map((el) => {
        const left = el.x * camera.zoom + camera.x;
        const top = el.y * camera.zoom + camera.y;
        const width = el.width * camera.zoom;
        const height = el.height * camera.zoom;
        const accent = resolveColor(el.color || '#4f46e5', isDarkMode);

        return (
          <div
            key={`reveal-mask-${el.id}`}
            data-testid="reveal-curtain-mask"
            style={{
              left,
              top,
              width,
              height,
              borderColor: accent,
              borderRadius: `${Math.max(6, 12 * camera.zoom)}px`,
              backgroundImage: isDarkMode
                ? 'repeating-linear-gradient(-45deg, rgba(30,41,59,0.98) 0px, rgba(30,41,59,0.98) 10px, rgba(51,65,85,0.98) 10px, rgba(51,65,85,0.98) 12px)'
                : 'repeating-linear-gradient(-45deg, rgba(238,242,255,0.98) 0px, rgba(238,242,255,0.98) 10px, rgba(224,231,255,0.98) 10px, rgba(224,231,255,0.98) 12px)',
              fontSize: `${Math.max(10, Math.min(15, 13 * camera.zoom))}px`,
            }}
            className="pointer-events-none absolute border-2 border-dashed flex items-center justify-center px-3 text-center font-semibold text-slate-800 dark:text-slate-100 select-none shadow-sm"
          >
            <span className="truncate">
              {el.label || t('Che lời giải', 'Solution curtain')} ·{' '}
              {t('Nhấp đúp để mở', 'Double-click to reveal')}
            </span>
          </div>
        );
      })}

      {/* Inline Visual Formula Editor popover when double-clicking a FormulaElement */}
      {editingFormula && (
        <div
          data-testid="inline-formula-editor"
          className="pointer-events-auto absolute z-30 w-84 rounded-xl bg-white/98 dark:bg-slate-900/98 border border-indigo-500 shadow-xl p-2.5 space-y-2"
          style={{
            left: Math.max(
              16,
              Math.min(
                typeof window !== 'undefined' ? window.innerWidth - 356 : 600,
                editingFormula.x * camera.zoom + camera.x
              )
            ),
            top: Math.max(
              72,
              editingFormula.y * camera.zoom + camera.y + editingFormula.height * camera.zoom + 10
            ),
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              {t('Chỉnh sửa công thức toán học', 'Edit math formula')}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title={t('Bật/tắt mã nguồn nâng cao', 'Toggle advanced LaTeX source')}
                onClick={() => setShowRawCode((v) => !v)}
                className={`h-6 px-1.5 rounded-md text-[10.5px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                  showRawCode
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Code2 className="w-3 h-3" />
                <span>{t('Mã', 'Code')}</span>
              </button>
              <button
                type="button"
                onClick={commitFormulaEdit}
                className="h-6 px-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>{t('Xong', 'Done')}</span>
              </button>
            </div>
          </div>

          <div className="min-h-12 px-2.5 py-1.5 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/60 flex items-center justify-center text-sm text-slate-900 dark:text-slate-100 overflow-x-auto">
            <MathTex latex={editingFormula.latex} displayMode />
          </div>

          {!showRawCode ? (
            <input
              ref={inputRef}
              type="text"
              aria-label={t('Nhập biểu thức toán học mới', 'Enter new math expression')}
              value={friendlyText}
              placeholder={t(
                'Gõ biểu thức thay thế (VD: (a+b)/2, x^2 - 4 = 0)...',
                'Type expression (e.g. (a+b)/2, x^2 - 4 = 0)...'
              )}
              onChange={(e) => {
                const val = e.target.value;
                setFriendlyText(val);
                if (val.trim()) {
                  applyLatexUpdate(friendlyMathToLatex(val));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  commitFormulaEdit();
                }
              }}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              aria-label={t('Chỉnh sửa mã nguồn LaTeX', 'Edit LaTeX source')}
              value={editingFormula.latex}
              onChange={(e) => applyLatexUpdate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault();
                  commitFormulaEdit();
                }
              }}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
            />
          )}

          <div className="flex items-center gap-1 flex-wrap">
            {inlineQuickKeys.map((k) => (
              <button
                key={k.title}
                type="button"
                title={k.title}
                onClick={() => applyLatexUpdate(`${editingFormula.latex} ${k.insert}`.trim())}
                className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-indigo-400 text-slate-800 dark:text-slate-100 flex items-center justify-center cursor-pointer"
              >
                <MathTex latex={k.display} className="text-[11px]" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
