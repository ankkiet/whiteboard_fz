import React from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  MATH_GEOMETRY_PRESETS,
  MathGeometryPresetId,
  buildGeometryPresetElements,
} from '../../engine/mathUtils';
import { MathGradeMode } from '../../types/board';
import { Solid3DPreview } from './Solid3DPreview';
import { LayoutGrid } from 'lucide-react';

interface MathGeometryTabProps {
  gradeMode: MathGradeMode;
  getWorldCenter: () => { x: number; y: number };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const MathGeometryTab: React.FC<MathGeometryTabProps> = ({
  gradeMode,
  getWorldCenter,
}) => {
  const virtualTools = useBoardStore((s) => s.virtualTools);
  const toggleVirtualTool = useBoardStore((s) => s.toggleVirtualTool);
  const arrangeVirtualTools = useBoardStore((s) => s.arrangeVirtualTools);
  const hideAllVirtualTools = useBoardStore((s) => s.hideAllVirtualTools);
  const addElementsBatch = useBoardStore((s) => s.addElementsBatch);
  const addToast = useBoardStore((s) => s.addToast);

  const activeVirtualCount = (
    ['ruler', 'setSquare', 'protractor', 'compass'] as const
  ).filter((k) => virtualTools[k].active).length;

  const handleInsertGeometry = (presetId: MathGeometryPresetId, label: string) => {
    const state = useBoardStore.getState();
    const center = getWorldCenter();
    const maxZ = state.elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);
    const items = buildGeometryPresetElements(presetId, center, state.color, maxZ, uid);
    addElementsBatch(items, true);
    addToast(`Đã chèn "${label}" (đã nhóm sẵn)`, 'success');
  };

  return (
    <div className="space-y-4">
      {/* Virtual Measuring & Drafting Tools */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-1">
          <div className="text-xs font-medium text-slate-800 dark:text-slate-100">
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
                show: gradeMode !== 'primary',
              },
              {
                id: 'compass' as const,
                label: 'Compa vẽ tròn',
                show: gradeMode !== 'primary',
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
      {gradeMode !== 'primary' && (
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
          <Solid3DPreview getWorldCenter={getWorldCenter} />
        </div>
      )}

      {/* Quick 2D Geometric Constructions */}
      <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
        <div className="text-xs font-medium text-slate-800 dark:text-slate-100">
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
  );
};
