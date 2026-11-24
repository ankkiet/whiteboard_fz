import React, { useMemo, useState } from 'react';
import {
  Casio2dNode,
  Casio2dSlotNode,
  Casio2dTemplateKind,
  Casio2dTemplateNode,
  parseCasio2dNodes,
} from '../../engine/casio2dParser';

export interface CasioNaturalEditorProps {
  expr: string;
  activeFieldId: string;
  activeCaret: number | null;
  onSelectSlot: (slotId: string, caret: number | null) => void;
  onChangeSlotValue: (slot: Casio2dSlotNode, nextValue: string, nextCaret: number | null) => void;
  onNavigateHorizontal: (dir: -1 | 1) => void;
  onNavigateVertical: (dir: 'up' | 'down', currentSlot: Casio2dSlotNode) => void;
  onDeleteFromEmptySlot: (slot: Casio2dSlotNode) => void;
  onInsertSmartFraction: () => void;
  onInsertSmartPower: (defaultExp?: string) => void;
  onEvaluate: () => void;
}

function getSlotAriaLabel(templateKind?: Casio2dTemplateKind, argIndex?: number, role?: string): string {
  if (!templateKind) {
    return role === 'root' ? 'Biểu thức máy tính' : 'Phần biểu thức';
  }
  switch (templateKind) {
    case 'int':
      if (argIndex === 0) return 'Hàm dưới dấu tích phân';
      if (argIndex === 1) return 'Cận dưới tích phân';
      if (argIndex === 2) return 'Cận trên tích phân';
      return 'Biến tích phân';
    case 'frac':
      return argIndex === 0 ? 'Tử số' : 'Mẫu số';
    case 'mixfrac':
      return argIndex === 0 ? 'Phần nguyên hỗn số' : argIndex === 1 ? 'Tử số hỗn số' : 'Mẫu số hỗn số';
    case 'sqrt':
      return 'Biểu thức trong căn bậc hai';
    case 'cbrt':
      return 'Biểu thức trong căn bậc ba';
    case 'nroot':
      return argIndex === 0 ? 'Bậc căn' : 'Biểu thức trong căn';
    case 'pow':
      return argIndex === 0 ? 'Cơ số lũy thừa' : 'Số mũ lũy thừa';
    case 'logb':
      return argIndex === 0 ? 'Cơ số logarit' : 'Biểu thức logarit';
    case 'ddx':
      return argIndex === 0 ? 'Hàm lấy đạo hàm' : 'Điểm tính đạo hàm x';
    case 'sum':
      return argIndex === 0 ? 'Biểu thức tổng Sigma' : argIndex === 1 ? 'Cận dưới tổng' : 'Cận trên tổng';
    case 'prod':
      return argIndex === 0 ? 'Biểu thức tích Pi' : argIndex === 1 ? 'Cận dưới tích' : 'Cận trên tích';
    case 'lim':
      return argIndex === 0 ? 'Hàm tính giới hạn' : 'Giá trị tiến tới của giới hạn';
    default:
      return `Tham số ${templateKind} ${(argIndex ?? 0) + 1}`;
  }
}

function normalizeSlotInput(raw: string, caret: number | null): { val: string; caret: number | null } {
  let val = raw.replace(/\*/g, '×');
  let nextCaret = caret;
  if (val.includes('√')) {
    const vIdx = val.indexOf('√');
    val = val.replace(/√/g, 'sqrt()');
    if (nextCaret !== null && nextCaret > vIdx) {
      nextCaret = vIdx + 5;
    }
  }
  if (val.includes('sqrt(') && !val.includes('sqrt()')) {
    const sIdx = val.indexOf('sqrt(');
    val = val.replace(/sqrt\(/g, 'sqrt()');
    if (nextCaret !== null && nextCaret > sIdx) {
      nextCaret = sIdx + 5;
    }
  }
  return { val, caret: nextCaret };
}

/**
 * Renders plain math text with authentic Casio fx-580VN X ClassWiz typography:
 * - Italic KaTeX_Math for variables (`x`, `y`, `z`, `t`, `A..F`, `M`, `e`, `π`) so `x` never looks like `×`
 * - Upright KaTeX_Main for digits, parentheses, and function names
 * - Authentic `sin⁻¹`, `cos⁻¹`, `tan⁻¹`, `cot⁻¹` superscripts (even if user typed `asin`/`acos`/`atan`)
 */
const MATH_TOKEN_RE =
  /(sin⁻¹|cos⁻¹|tan⁻¹|cot⁻¹|asin|acos|atan|acot|PreAns|Ans|sin|cos|tan|cot|log|ln|Abs|abs|Ceil|Intg|Ran|mod|pi|π|÷R|[+\-−×*÷=]|(?<![a-zA-Z])[xyztabcdefABCDFMT](?![a-zA-Z]))/g;

function renderCasioMathSegment(text: string, keyPrefix: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  MATH_TOKEN_RE.lastIndex = 0;

  while ((match = MATH_TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(
        <span key={`${keyPrefix}-t-${lastIdx}`} className="casio-math-font">
          {text.slice(lastIdx, match.index)}
        </span>
      );
    }

    const tok = match[0];
    const k = `${keyPrefix}-m-${match.index}`;

    if (tok === 'sin⁻¹' || tok === 'asin') {
      parts.push(
        <span key={k} className="casio-math-font">
          sin<sup className="text-[0.64em] leading-none relative -top-[0.42em]">−1</sup>
        </span>
      );
    } else if (tok === 'cos⁻¹' || tok === 'acos') {
      parts.push(
        <span key={k} className="casio-math-font">
          cos<sup className="text-[0.64em] leading-none relative -top-[0.42em]">−1</sup>
        </span>
      );
    } else if (tok === 'tan⁻¹' || tok === 'atan') {
      parts.push(
        <span key={k} className="casio-math-font">
          tan<sup className="text-[0.64em] leading-none relative -top-[0.42em]">−1</sup>
        </span>
      );
    } else if (tok === 'cot⁻¹' || tok === 'acot') {
      parts.push(
        <span key={k} className="casio-math-font">
          cot<sup className="text-[0.64em] leading-none relative -top-[0.42em]">−1</sup>
        </span>
      );
    } else if (tok === 'pi' || tok === 'π') {
      parts.push(
        <span key={k} className="casio-math-var">
          π
        </span>
      );
    } else if (tok === 'abs') {
      parts.push(
        <span key={k} className="casio-math-font">
          Abs
        </span>
      );
    } else if (tok === '+' || tok === '-' || tok === '−' || tok === '×' || tok === '*' || tok === '÷' || tok === '=') {
      const symbol = tok === '-' ? '−' : tok === '*' ? '×' : tok;
      parts.push(
        <span key={k} className="casio-math-font px-[1.5px]">
          {symbol}
        </span>
      );
    } else if (tok === '÷R') {
      parts.push(
        <span key={k} className="casio-math-font px-[2px]">
          ÷R
        </span>
      );
    } else if (
      tok === 'PreAns' ||
      tok === 'Ans' ||
      tok === 'sin' ||
      tok === 'cos' ||
      tok === 'tan' ||
      tok === 'cot' ||
      tok === 'log' ||
      tok === 'ln' ||
      tok === 'Abs' ||
      tok === 'Ceil' ||
      tok === 'Intg' ||
      tok === 'Ran' ||
      tok === 'mod'
    ) {
      parts.push(
        <span key={k} className="casio-math-font">
          {tok}
        </span>
      );
    } else {
      // Single mathematical variable (`x`, `y`, `z`, `t`, `A..F`, `M`, `e`) -> authentic italic KaTeX_Math!
      parts.push(
        <span key={k} className="casio-math-var pr-[0.5px]">
          {tok}
        </span>
      );
    }

    lastIdx = match.index + tok.length;
  }

  if (lastIdx < text.length) {
    parts.push(
      <span key={`${keyPrefix}-e-${lastIdx}`} className="casio-math-font">
        {text.slice(lastIdx)}
      </span>
    );
  }

  return parts;
}

export const CasioNaturalEditor: React.FC<CasioNaturalEditorProps> = ({
  expr,
  activeFieldId,
  activeCaret,
  onSelectSlot,
  onChangeSlotValue,
  onNavigateHorizontal,
  onNavigateVertical,
  onDeleteFromEmptySlot,
  onInsertSmartFraction,
  onInsertSmartPower,
  onEvaluate,
}) => {
  const nodes = useMemo(() => parseCasio2dNodes(expr), [expr]);
  const [focusedSlotId, setFocusedSlotId] = useState<string | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  const renderVisualWithCaret = (slot: Casio2dSlotNode, showCaret: boolean) => {
    const val = slot.value;
    if (!showCaret) {
      return renderCasioMathSegment(val, slot.id);
    }

    const rawCaret = activeCaret ?? selectionRange.start;
    const clampedStart = Math.max(0, Math.min(val.length, rawCaret));
    const clampedEnd =
      focusedSlotId === slot.id
        ? Math.max(clampedStart, Math.min(val.length, selectionRange.end))
        : clampedStart;

    if (clampedEnd > clampedStart) {
      return (
        <>
          {renderCasioMathSegment(val.slice(0, clampedStart), `${slot.id}-b`)}
          <span className="bg-indigo-500/25 rounded-[1px]">
            {renderCasioMathSegment(val.slice(clampedStart, clampedEnd), `${slot.id}-s`)}
          </span>
          {renderCasioMathSegment(val.slice(clampedEnd), `${slot.id}-a`)}
        </>
      );
    }

    return (
      <>
        {renderCasioMathSegment(val.slice(0, clampedStart), `${slot.id}-b`)}
        <span className="casio-caret" aria-hidden="true" />
        {renderCasioMathSegment(val.slice(clampedStart), `${slot.id}-a`)}
      </>
    );
  };

  const syncSelectionFromInput = (slot: Casio2dSlotNode, el: HTMLInputElement) => {
    const start = el.selectionStart ?? slot.value.length;
    const end = el.selectionEnd ?? start;
    setSelectionRange({ start, end });
    onSelectSlot(slot.id, start);
  };

  const renderSlot = (
    slot: Casio2dSlotNode,
    isTrailingRootGap: boolean,
    templateKind?: Casio2dTemplateKind,
    argIndex?: number
  ) => {
    const isActive = activeFieldId === slot.id;
    const isEmpty = slot.value.length === 0;
    const ariaLabel = getSlotAriaLabel(templateKind, argIndex, slot.role);

    // Non-trailing empty gap between or before 2D templates: zero-width invisible input unless focused
    if (slot.role === 'gap' && isEmpty && !isTrailingRootGap && !isActive) {
      return (
        <input
          key={slot.id}
          type="text"
          data-casio-field={slot.id}
          data-slot-start={slot.start}
          data-slot-end={slot.end}
          data-slot-role="gap-empty"
          data-slot-up={slot.upSlotId ?? ''}
          data-slot-down={slot.downSlotId ?? ''}
          aria-label={ariaLabel}
          tabIndex={-1}
          value=""
          onFocus={(e) => {
            setFocusedSlotId(slot.id);
            syncSelectionFromInput(slot, e.currentTarget);
          }}
          onChange={(e) => onChangeSlotValue(slot, e.target.value, e.target.selectionStart)}
          className="w-0 h-4 opacity-0 pointer-events-none"
        />
      );
    }

    const handleSlotKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEvaluate();
        return;
      }
      if (e.key === '*') {
        e.preventDefault();
        const selStart = e.currentTarget.selectionStart ?? slot.value.length;
        const selEnd = e.currentTarget.selectionEnd ?? selStart;
        const nextVal = slot.value.slice(0, selStart) + '×' + slot.value.slice(selEnd);
        setSelectionRange({ start: selStart + 1, end: selStart + 1 });
        onChangeSlotValue(slot, nextVal, selStart + 1);
        return;
      }
      if (e.key === 'Tab' && slot.role === 'arg') {
        e.preventDefault();
        onNavigateHorizontal(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === '^') {
        e.preventDefault();
        onInsertSmartPower();
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        onInsertSmartFraction();
        return;
      }
      if (e.key === 'Backspace' && slot.value.length === 0) {
        e.preventDefault();
        onDeleteFromEmptySlot(slot);
        return;
      }
      if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === slot.value.length) {
        e.preventDefault();
        onNavigateHorizontal(1);
        return;
      }
      if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
        e.preventDefault();
        onNavigateHorizontal(-1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigateVertical('up', slot);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigateVertical('down', slot);
      }
    };

    // Root expression (no 2D template yet) or gap text outside/between 2D templates
    if (slot.role === 'root' || slot.role === 'gap') {
      const isRoot = slot.role === 'root';
      const showCaret = isActive;

      return (
        <span
          key={slot.id}
          className={
            isRoot
              ? 'relative inline-flex items-center w-full min-w-[120px] min-h-[28px] px-0.5 cursor-text'
              : `relative inline-flex items-center min-h-[24px] cursor-text ${
                  isTrailingRootGap && isEmpty ? 'min-w-[14px]' : ''
                }`
          }
        >
          {/* Visual math layer (sets exact natural width — zero extra gap before √ or ^) */}
          <span
            aria-hidden="true"
            className="casio-math-font text-[19px] leading-[1.2] text-[#1e345a] whitespace-pre inline-flex items-center pointer-events-none"
          >
            {renderVisualWithCaret(slot, showCaret)}
          </span>

          {/* Transparent native input overlay for full keyboard/caret/IME/accessibility support */}
          <input
            type="text"
            data-casio-field={slot.id}
            data-slot-start={slot.start}
            data-slot-end={slot.end}
            data-slot-role={slot.role}
            data-slot-up={slot.upSlotId ?? ''}
            data-slot-down={slot.downSlotId ?? ''}
            aria-label={ariaLabel}
            value={slot.value}
            onFocus={(e) => {
              setFocusedSlotId(slot.id);
              syncSelectionFromInput(slot, e.currentTarget);
            }}
            onBlur={() => {
              setFocusedSlotId((prev) => (prev === slot.id ? null : prev));
            }}
            onClick={(e) => syncSelectionFromInput(slot, e.currentTarget)}
            onSelect={(e) => syncSelectionFromInput(slot, e.currentTarget)}
            onKeyUp={(e) => syncSelectionFromInput(slot, e.currentTarget)}
            onChange={(e) => {
              const { val, caret } = normalizeSlotInput(e.target.value, e.target.selectionStart);
              const c = caret ?? val.length;
              setSelectionRange({ start: c, end: c });
              onChangeSlotValue(slot, val, c);
            }}
            onKeyDown={handleSlotKeyDown}
            className="casio-math-font absolute inset-0 w-full h-full opacity-0 text-[19px] cursor-text outline-none"
          />
        </span>
      );
    }

    // Template Argument Box (`role === 'arg'`) — Authentic Casio Natural-V.P.A.M. dotted box when empty, crisp math when filled
    const isSub = slot.size === 'sub';
    const boxSizeClass = isEmpty
      ? isSub
        ? 'w-[12px] h-[14px]'
        : 'w-[15px] h-[20px]'
      : 'min-w-0 h-auto px-0';

    const boxStyleClass = isEmpty
      ? isActive
        ? 'border border-[#1e345a] bg-[#1e345a]/12 rounded-[1px]'
        : 'border border-dashed border-[#1e345a]/65 bg-[#1e345a]/[0.03] rounded-[1px]'
      : 'border-0 bg-transparent shadow-none';

    const fontSizeClass = isSub ? 'text-[13px]' : 'text-[19px]';

    return (
      <span
        key={slot.id}
        onClick={(e) => {
          e.stopPropagation();
          const el = document.querySelector<HTMLInputElement>(`input[data-casio-field="${slot.id}"]`);
          el?.focus();
        }}
        className={`relative inline-flex items-center justify-center align-middle transition-colors cursor-text ${boxSizeClass} ${boxStyleClass}`}
      >
        <span
          aria-hidden="true"
          className={`casio-math-font ${fontSizeClass} leading-[1.15] text-[#1e345a] whitespace-pre inline-flex items-center justify-center pointer-events-none`}
        >
          {renderVisualWithCaret(slot, isActive)}
        </span>

        <input
          type="text"
          data-casio-field={slot.id}
          data-slot-start={slot.start}
          data-slot-end={slot.end}
          data-slot-role="arg"
          data-slot-up={slot.upSlotId ?? ''}
          data-slot-down={slot.downSlotId ?? ''}
          aria-label={ariaLabel}
          value={slot.value}
          onFocus={(e) => {
            setFocusedSlotId(slot.id);
            syncSelectionFromInput(slot, e.currentTarget);
          }}
          onBlur={() => {
            setFocusedSlotId((prev) => (prev === slot.id ? null : prev));
          }}
          onClick={(e) => {
            e.stopPropagation();
            syncSelectionFromInput(slot, e.currentTarget);
          }}
          onSelect={(e) => syncSelectionFromInput(slot, e.currentTarget)}
          onKeyUp={(e) => syncSelectionFromInput(slot, e.currentTarget)}
          onChange={(e) => {
            const { val, caret } = normalizeSlotInput(e.target.value, e.target.selectionStart);
            const c = caret ?? val.length;
            setSelectionRange({ start: c, end: c });
            onChangeSlotValue(slot, val, c);
          }}
          onKeyDown={handleSlotKeyDown}
          className={`casio-math-font absolute inset-0 w-full h-full opacity-0 ${fontSizeClass} cursor-text outline-none`}
        />
      </span>
    );
  };

  const renderArgNodes = (
    template: Casio2dTemplateNode,
    argIdx: number
  ): React.ReactNode => {
    const argNodes = template.args[argIdx] ?? [];
    return (
      <span className="inline-flex items-center">
        {argNodes.map((child, idx) =>
          renderNode(
            child,
            idx === argNodes.length - 1 && argNodes.length > 1,
            template.kind,
            argIdx
          )
        )}
      </span>
    );
  };

  const renderTemplate = (node: Casio2dTemplateNode): React.ReactNode => {
    switch (node.kind) {
      case 'int':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-integral"
            className="inline-flex items-center align-middle my-0.5 mx-[1px] text-[#1e345a]"
          >
            <span className="inline-flex items-center mr-1">
              <span className="casio-math-font italic text-[32px] leading-none select-none">
                ∫
              </span>
              <span className="flex flex-col justify-between h-[36px] -ml-1 py-[1px]">
                <span className="-mt-1 ml-1">{renderArgNodes(node, 2)}</span>
                <span className="-mb-1 -ml-0.5">{renderArgNodes(node, 1)}</span>
              </span>
            </span>

            <span className="inline-flex items-center">{renderArgNodes(node, 0)}</span>

            <span className="inline-flex items-center ml-[2px] casio-math-font text-[17px]">
              <span className="select-none">d</span>
              {renderArgNodes(node, 3)}
            </span>
          </span>
        );

      case 'frac':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-fraction"
            className="inline-flex flex-col items-center justify-center align-middle mx-[2px] my-0.5 text-[#1e345a]"
          >
            <span className="px-[2px] pb-[1px] inline-flex items-center justify-center">
              {renderArgNodes(node, 0)}
            </span>
            <span className="w-full min-w-[15px] h-[1.3px] bg-[#1e345a]" />
            <span className="px-[2px] pt-[1px] inline-flex items-center justify-center">
              {renderArgNodes(node, 1)}
            </span>
          </span>
        );

      case 'mixfrac':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-mixfrac"
            className="inline-flex items-center align-middle mx-[2px] my-0.5 gap-[2px] text-[#1e345a]"
          >
            <span className="inline-flex items-center">{renderArgNodes(node, 0)}</span>
            <span className="inline-flex flex-col items-center justify-center">
              <span className="px-[2px] pb-[1px] inline-flex items-center justify-center">
                {renderArgNodes(node, 1)}
              </span>
              <span className="w-full min-w-[15px] h-[1.3px] bg-[#1e345a]" />
              <span className="px-[2px] pt-[1px] inline-flex items-center justify-center">
                {renderArgNodes(node, 2)}
              </span>
            </span>
          </span>
        );

      case 'sqrt':
      case 'cbrt':
      case 'nroot':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-root"
            className="inline-flex items-stretch align-middle ml-[1px] mr-[1px] my-0.5 text-[#1e345a]"
          >
            {node.kind === 'cbrt' && (
              <span className="casio-math-font text-[11px] -mr-[2px] -mt-[3px] self-start select-none">
                3
              </span>
            )}
            {node.kind === 'nroot' && (
              <span className="-mr-[2px] -mt-[4px] z-10 self-start">{renderArgNodes(node, 0)}</span>
            )}
            <span className="inline-flex items-center self-stretch shrink-0">
              <svg
                className="w-[10px] h-full min-h-[22px] text-[#1e345a] shrink-0"
                viewBox="0 0 10 24"
                preserveAspectRatio="none"
                fill="none"
              >
                <path
                  d="M0.6 14 L2.8 14 L5.4 22.5 L9.4 0.8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </svg>
            </span>
            <span className="border-t-[1.5px] border-[#1e345a] pt-[1px] pl-[1px] pr-[2px] -ml-[0.5px] inline-flex items-center min-h-[22px]">
              {renderArgNodes(node, node.kind === 'nroot' ? 1 : 0)}
            </span>
          </span>
        );

      case 'pow':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-power"
            className="inline-flex items-baseline align-middle text-[#1e345a]"
          >
            <span className="inline-flex items-center">{renderArgNodes(node, 0)}</span>
            <span className="relative -top-[0.48em] ml-[0.5px] inline-flex items-center">
              {renderArgNodes(node, 1)}
            </span>
          </span>
        );

      case 'logb':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-logb"
            className="inline-flex items-center align-middle mx-[1px] my-0.5 text-[#1e345a]"
          >
            <span className="casio-math-font text-[17px] select-none">log</span>
            <span className="relative top-[0.35em] mr-[1px] inline-flex items-center">
              {renderArgNodes(node, 0)}
            </span>
            <span className="casio-math-font text-[18px] select-none">(</span>
            {renderArgNodes(node, 1)}
            <span className="casio-math-font text-[18px] select-none">)</span>
          </span>
        );

      case 'ddx':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-ddx"
            className="inline-flex items-center align-middle mx-[1px] my-0.5 text-[#1e345a]"
          >
            <span className="inline-flex flex-col items-center justify-center mr-[2px] text-[11px] casio-math-font leading-tight select-none">
              <span className="px-0.5">d</span>
              <span className="w-full h-[1.1px] bg-[#1e345a]" />
              <span className="px-0.5">
                d<span className="casio-math-var">x</span>
              </span>
            </span>
            <span className="casio-math-font text-[18px] select-none">(</span>
            {renderArgNodes(node, 0)}
            <span className="casio-math-font text-[18px] select-none">)</span>
            <span className="inline-flex items-end border-l-[1.3px] border-[#1e345a] h-[24px] ml-0.5 pl-0.5">
              <span className="text-[11px] casio-math-font mr-0.5 mb-0.5 select-none">
                <span className="casio-math-var">x</span>=
              </span>
              <span className="mb-0.5">{renderArgNodes(node, 1)}</span>
            </span>
          </span>
        );

      case 'sum':
      case 'prod':
        return (
          <span
            key={node.id}
            data-testid={`casio-2d-${node.kind}`}
            className="inline-flex items-center align-middle mx-[1px] my-0.5 text-[#1e345a]"
          >
            <span className="inline-flex flex-col items-center mr-1">
              {renderArgNodes(node, 2)}
              <span className="casio-math-font text-[22px] leading-none select-none my-[1px]">
                {node.kind === 'sum' ? '∑' : '∏'}
              </span>
              <span className="inline-flex items-center text-[11px] casio-math-font">
                <span className="mr-0.5 select-none">
                  <span className="casio-math-var">x</span>=
                </span>
                {renderArgNodes(node, 1)}
              </span>
            </span>
            <span className="casio-math-font text-[18px] select-none">(</span>
            {renderArgNodes(node, 0)}
            <span className="casio-math-font text-[18px] select-none">)</span>
          </span>
        );

      case 'lim':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-lim"
            className="inline-flex items-center align-middle mx-[1px] my-0.5 text-[#1e345a]"
          >
            <span className="inline-flex flex-col items-center mr-1">
              <span className="casio-math-font text-[14px] leading-tight select-none">lim</span>
              <span className="inline-flex items-center text-[10.5px] casio-math-font">
                <span className="select-none">
                  <span className="casio-math-var">x</span>→
                </span>
                {renderArgNodes(node, 1)}
              </span>
            </span>
            <span className="casio-math-font text-[18px] select-none">(</span>
            {renderArgNodes(node, 0)}
            <span className="casio-math-font text-[18px] select-none">)</span>
          </span>
        );

      default:
        // GCD, LCM, Pol, Rec, RanInt
        return (
          <span
            key={node.id}
            data-testid={`casio-2d-${node.kind}`}
            className="inline-flex items-center align-middle mx-[1px] my-0.5 text-[#1e345a]"
          >
            <span className="casio-math-font text-[16px] select-none">
              {node.kind === 'RanInt' ? 'RanInt#' : node.kind}(
            </span>
            {renderArgNodes(node, 0)}
            <span className="casio-math-font text-[16px] mx-0.5 select-none">;</span>
            {renderArgNodes(node, 1)}
            <span className="casio-math-font text-[16px] select-none">)</span>
          </span>
        );
    }
  };

  const renderNode = (
    node: Casio2dNode,
    isTrailingRootGap: boolean,
    templateKind?: Casio2dTemplateKind,
    argIndex?: number
  ): React.ReactNode => {
    if (node.type === 'slot') {
      return renderSlot(node, isTrailingRootGap, templateKind, argIndex);
    }
    return renderTemplate(node);
  };

  return (
    <div
      data-testid="casio-natural-2d-editor"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const allInputs = Array.from(
            e.currentTarget.querySelectorAll<HTMLInputElement>(
              'input[data-casio-field]:not([data-slot-role="gap-empty"])'
            )
          );
          const last = allInputs[allInputs.length - 1];
          if (last) {
            last.focus();
          }
        }
      }}
      className="min-h-[50px] w-full flex flex-wrap items-center gap-y-1 overflow-x-auto overflow-y-hidden casio-lcd-no-scrollbar py-1 px-0.5 cursor-text select-none"
    >
      {nodes.map((node, idx) => renderNode(node, idx === nodes.length - 1))}
    </div>
  );
};
