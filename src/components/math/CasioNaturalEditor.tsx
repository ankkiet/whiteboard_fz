import React, { useMemo } from 'react';
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

export const CasioNaturalEditor: React.FC<CasioNaturalEditorProps> = ({
  expr,
  activeFieldId,
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

  const renderSlot = (
    slot: Casio2dSlotNode,
    isTrailingRootGap: boolean,
    templateKind?: Casio2dTemplateKind,
    argIndex?: number
  ) => {
    const isActive = activeFieldId === slot.id;
    const isEmpty = slot.value.length === 0;
    const ariaLabel = getSlotAriaLabel(templateKind, argIndex, slot.role);

    // Non-trailing empty gap between or before 2D templates: render zero-width invisible input unless focused
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
          onFocus={(e) => onSelectSlot(slot.id, e.currentTarget.selectionStart)}
          onChange={(e) => onChangeSlotValue(slot, e.target.value, e.target.selectionStart)}
          className="w-0 h-4 opacity-0 pointer-events-none"
        />
      );
    }

    // Root expression (when no 2D template exists yet) or gap text outside templates
    if (slot.role === 'root' || slot.role === 'gap') {
      const charWidthCh = Math.max(isTrailingRootGap ? 2 : 1, slot.value.length + 1);
      return (
        <input
          key={slot.id}
          type="text"
          data-casio-field={slot.id}
          data-slot-start={slot.start}
          data-slot-end={slot.end}
          data-slot-role={slot.role}
          data-slot-up={slot.upSlotId ?? ''}
          data-slot-down={slot.downSlotId ?? ''}
          aria-label={ariaLabel}
          value={slot.value}
          placeholder={slot.role === 'root' ? 'Nhập phép tính hoặc bấm nút ∫, □/□, √□...' : ''}
          style={
            slot.role === 'root'
              ? undefined
              : { width: `${charWidthCh}ch` }
          }
          onFocus={(e) => onSelectSlot(slot.id, e.currentTarget.selectionStart)}
          onClick={(e) => onSelectSlot(slot.id, e.currentTarget.selectionStart)}
          onChange={(e) => onChangeSlotValue(slot, e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEvaluate();
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
          }}
          className={
            slot.role === 'root'
              ? 'w-full min-w-[120px] h-7 px-1 rounded bg-transparent font-serif text-[16px] text-slate-950 placeholder:font-sans placeholder:text-[10.5px] placeholder:text-slate-600/80 outline-none'
              : 'inline-block h-6 px-0.5 bg-transparent font-serif text-[16px] text-slate-950 outline-none'
          }
        />
      );
    }

    // Template Argument Box (`role === 'arg'`) — Matches uploaded Casio Natural-V.P.A.M. reference screenshot!
    const isSub = slot.size === 'sub';
    const boxSizeClass = isEmpty
      ? isSub
        ? 'w-[14px] h-[15px]'
        : 'w-[17px] h-[22px]'
      : isSub
        ? 'min-w-[14px] h-[16px] px-[2px]'
        : 'min-w-[18px] h-[23px] px-[3px]';

    const boxStyleClass = isEmpty
      ? isActive
        ? 'border-[1.5px] border-[#1b6ec2] bg-[#82b1df]/75 shadow-[0_0_0_1px_rgba(27,110,194,0.22)]'
        : 'border border-[#6c9bc3] bg-[#bdd2e2]/45 hover:border-[#1b6ec2] hover:bg-[#95bee3]/55'
      : isActive
        ? 'border-[1.5px] border-[#1b6ec2] bg-[#82b1df]/55 shadow-[0_0_0_1px_rgba(27,110,194,0.2)]'
        : 'border border-dashed border-[#4378a8] bg-[#b2c9dc]/40 hover:border-solid hover:border-[#1b6ec2]';

    const inputWidthStyle = isEmpty
      ? { width: '100%' }
      : { width: `${Math.max(1.1, slot.value.length * 0.72 + 0.35)}em` };

    return (
      <span
        key={slot.id}
        onClick={() => {
          const el = document.querySelector<HTMLInputElement>(`input[data-casio-field="${slot.id}"]`);
          el?.focus();
        }}
        className={`relative inline-flex items-center justify-center align-middle rounded-[2.5px] transition-colors cursor-text ${boxSizeClass} ${boxStyleClass}`}
      >
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
          style={inputWidthStyle}
          onFocus={(e) => {
            onSelectSlot(slot.id, e.currentTarget.selectionStart);
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSlot(slot.id, e.currentTarget.selectionStart);
          }}
          onChange={(e) => onChangeSlotValue(slot, e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEvaluate();
              return;
            }
            if (e.key === 'Tab') {
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
          }}
          className={`bg-transparent text-center font-serif italic font-semibold text-slate-950 outline-none leading-none ${
            isSub ? 'text-[11px]' : 'text-[15.5px]'
          }`}
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
            className="inline-flex items-center align-middle my-0.5 mx-0.5"
          >
            {/* Integral symbol ∫ + Upper limit (arg 2) & Lower limit (arg 1) matching user screenshot */}
            <span className="inline-flex items-center mr-1">
              <span className="font-serif italic text-[34px] leading-none text-slate-950 select-none">
                ∫
              </span>
              <span className="flex flex-col justify-between h-[38px] -ml-1 py-[1px]">
                <span className="-mt-1 ml-1">{renderArgNodes(node, 2)}</span>
                <span className="-mb-1 -ml-0.5">{renderArgNodes(node, 1)}</span>
              </span>
            </span>

            {/* Main integrand box (arg 0) */}
            <span className="inline-flex items-center">{renderArgNodes(node, 0)}</span>

            {/* Differential d[x] (arg 3) */}
            <span className="inline-flex items-center ml-[2px] font-serif text-[16px] text-slate-950">
              <span className="not-italic font-medium select-none">d</span>
              <span className="text-slate-600 font-normal select-none">[</span>
              {renderArgNodes(node, 3)}
              <span className="text-slate-600 font-normal select-none">]</span>
            </span>
          </span>
        );

      case 'frac':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-fraction"
            className="inline-flex flex-col items-center justify-center align-middle mx-1 my-0.5"
          >
            <span className="px-1 pb-[2px]">{renderArgNodes(node, 0)}</span>
            <span className="w-full min-w-[20px] h-[1.5px] bg-slate-900" />
            <span className="px-1 pt-[2px]">{renderArgNodes(node, 1)}</span>
          </span>
        );

      case 'mixfrac':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-mixfrac"
            className="inline-flex items-center align-middle mx-1 my-0.5 gap-0.5"
          >
            <span>{renderArgNodes(node, 0)}</span>
            <span className="inline-flex flex-col items-center justify-center">
              <span className="px-1 pb-[2px]">{renderArgNodes(node, 1)}</span>
              <span className="w-full min-w-[18px] h-[1.5px] bg-slate-900" />
              <span className="px-1 pt-[2px]">{renderArgNodes(node, 2)}</span>
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
            className="inline-flex items-center align-middle mx-0.5 my-0.5"
          >
            {node.kind === 'cbrt' && (
              <span className="text-[10px] font-serif font-bold text-slate-900 -mr-1 -mt-3 select-none">
                3
              </span>
            )}
            {node.kind === 'nroot' && (
              <span className="-mr-1 -mt-3.5 z-10">{renderArgNodes(node, 0)}</span>
            )}
            <span className="font-serif text-[23px] leading-none text-slate-950 select-none">√</span>
            <span className="border-t-[1.5px] border-slate-900 pt-[2px] px-0.5 inline-flex items-center">
              {renderArgNodes(node, node.kind === 'nroot' ? 1 : 0)}
            </span>
          </span>
        );

      case 'pow':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-power"
            className="inline-flex items-start align-middle mx-0.5"
          >
            <span className="inline-flex items-center">{renderArgNodes(node, 0)}</span>
            <span className="-mt-2 ml-[1px]">{renderArgNodes(node, 1)}</span>
          </span>
        );

      case 'logb':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-logb"
            className="inline-flex items-center align-middle mx-0.5 my-0.5"
          >
            <span className="font-serif font-semibold text-[15px] text-slate-950 select-none">log</span>
            <span className="mt-3 mr-0.5">{renderArgNodes(node, 0)}</span>
            <span className="font-serif text-[16px] text-slate-800 select-none">(</span>
            {renderArgNodes(node, 1)}
            <span className="font-serif text-[16px] text-slate-800 select-none">)</span>
          </span>
        );

      case 'ddx':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-ddx"
            className="inline-flex items-center align-middle mx-0.5 my-0.5"
          >
            <span className="inline-flex flex-col items-center justify-center mr-0.5 text-[10.5px] font-serif leading-tight select-none text-slate-950">
              <span className="px-0.5">d</span>
              <span className="w-full h-[1.2px] bg-slate-900" />
              <span className="px-0.5">
                d<i className="italic">x</i>
              </span>
            </span>
            <span className="font-serif text-[16px] text-slate-800 select-none">(</span>
            {renderArgNodes(node, 0)}
            <span className="font-serif text-[16px] text-slate-800 select-none">)</span>
            <span className="inline-flex items-end border-l-[1.5px] border-slate-800 h-[25px] ml-0.5 pl-0.5">
              <span className="text-[10.5px] font-serif italic text-slate-900 mr-0.5 mb-0.5 select-none">
                x=
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
            className="inline-flex items-center align-middle mx-0.5 my-0.5"
          >
            <span className="inline-flex flex-col items-center mr-1">
              {renderArgNodes(node, 2)}
              <span className="font-serif text-[21px] leading-none text-slate-950 select-none my-[1px]">
                {node.kind === 'sum' ? '∑' : '∏'}
              </span>
              <span className="inline-flex items-center text-[10px] font-serif text-slate-950">
                <i className="italic mr-0.5 select-none">x=</i>
                {renderArgNodes(node, 1)}
              </span>
            </span>
            <span className="font-serif text-[16px] text-slate-800 select-none">(</span>
            {renderArgNodes(node, 0)}
            <span className="font-serif text-[16px] text-slate-800 select-none">)</span>
          </span>
        );

      case 'lim':
        return (
          <span
            key={node.id}
            data-testid="casio-2d-lim"
            className="inline-flex items-center align-middle mx-0.5 my-0.5"
          >
            <span className="inline-flex flex-col items-center mr-1">
              <span className="font-serif font-semibold text-[13.5px] leading-tight text-slate-950 select-none">
                lim
              </span>
              <span className="inline-flex items-center text-[9.5px] font-serif text-slate-950">
                <i className="italic select-none">x→</i>
                {renderArgNodes(node, 1)}
              </span>
            </span>
            <span className="font-serif text-[16px] text-slate-800 select-none">(</span>
            {renderArgNodes(node, 0)}
            <span className="font-serif text-[16px] text-slate-800 select-none">)</span>
          </span>
        );

      default:
        // GCD, LCM, Pol, Rec, RanInt
        return (
          <span
            key={node.id}
            data-testid={`casio-2d-${node.kind}`}
            className="inline-flex items-center align-middle mx-0.5 my-0.5"
          >
            <span className="font-serif font-bold text-[13.5px] text-slate-950 select-none">
              {node.kind === 'RanInt' ? 'RanInt#' : node.kind}(
            </span>
            {renderArgNodes(node, 0)}
            <span className="font-serif font-bold text-[14px] text-slate-800 mx-0.5 select-none">;</span>
            {renderArgNodes(node, 1)}
            <span className="font-serif font-bold text-[13.5px] text-slate-950 select-none">)</span>
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
        // Clicking the empty LCD canvas focuses the last editable slot
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
      className="min-h-[54px] w-full flex flex-wrap items-center gap-y-1 overflow-x-auto py-1 px-0.5 cursor-text"
    >
      {nodes.map((node, idx) => renderNode(node, idx === nodes.length - 1))}
    </div>
  );
};
