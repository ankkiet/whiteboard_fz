import React from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { ToolType } from '../../types/board';
import {
  MousePointer2,
  Hand,
  PenTool,
  Highlighter,
  Eraser,
  Square,
  Circle,
  ArrowUpRight,
  Type,
  StickyNote,
  Image as ImageIcon,
  Wand2,
} from 'lucide-react';

interface ToolItem {
  id: ToolType;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  group: number;
}

interface BottomDockProps {
  onTriggerImageUpload: () => void;
}

const TOOLS: ToolItem[] = [
  { id: 'select', label: 'Chọn', shortcut: 'V', icon: MousePointer2, group: 0 },
  { id: 'hand', label: 'Kéo bảng', shortcut: 'H', icon: Hand, group: 0 },
  { id: 'pen', label: 'Bút vẽ', shortcut: 'P', icon: PenTool, group: 1 },
  { id: 'highlighter', label: 'Bút dạ quang', shortcut: 'M', icon: Highlighter, group: 1 },
  { id: 'eraser', label: 'Tẩy', shortcut: 'E', icon: Eraser, group: 1 },
  { id: 'rectangle', label: 'Hình chữ nhật', shortcut: 'R', icon: Square, group: 2 },
  { id: 'ellipse', label: 'Hình tròn', shortcut: 'O', icon: Circle, group: 2 },
  { id: 'arrow', label: 'Mũi tên', shortcut: 'A', icon: ArrowUpRight, group: 2 },
  { id: 'text', label: 'Văn bản', shortcut: 'T', icon: Type, group: 2 },
  { id: 'sticky', label: 'Ghi chú dán', shortcut: 'S', icon: StickyNote, group: 2 },
  { id: 'image', label: 'Chèn ảnh / PDF / Word', shortcut: 'I', icon: ImageIcon, group: 2 },
  { id: 'laser', label: 'Bút tia Laser', shortcut: 'L', icon: Wand2, group: 3 },
];

export const BottomDock: React.FC<BottomDockProps> = ({ onTriggerImageUpload }) => {
  const currentTool = useBoardStore((s) => s.currentTool);
  const setCurrentTool = useBoardStore((s) => s.setCurrentTool);
  const color = useBoardStore((s) => s.color);
  const highlighterColor = useBoardStore((s) => s.highlighterColor);
  const isDarkMode = useBoardStore((s) => s.isDarkMode);

  const handleToolClick = (tool: ToolType) => {
    if (tool === 'image') {
      onTriggerImageUpload();
      return;
    }
    setCurrentTool(tool);
  };

  const resolvedPenInk =
    isDarkMode && color.toLowerCase() === '#1e293b' ? '#f1f5f9' : color;

  return (
    <nav
      aria-label="Thanh công cụ vẽ"
      className="absolute bottom-3.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-20px)]"
    >
      <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-2xl shadow-xl shadow-slate-900/12 dark:shadow-black/45 border border-slate-200/85 dark:border-slate-800 overflow-x-auto sm:overflow-visible">
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          const isActive = currentTool === tool.id;
          const showDivider = index > 0 && TOOLS[index - 1].group !== tool.group;
          const inkDotColor =
            tool.id === 'pen'
              ? resolvedPenInk
              : tool.id === 'highlighter'
              ? highlighterColor
              : null;

          return (
            <React.Fragment key={tool.id}>
              {showDivider && (
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => handleToolClick(tool.id)}
                title={`${tool.label} (${tool.shortcut})`}
                aria-label={`${tool.label} (${tool.shortcut})`}
                aria-pressed={isActive}
                className={`relative group shrink-0 w-10 h-10 rounded-xl transition-all duration-150 flex items-center justify-center ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {inkDotColor && (
                  <span
                    aria-hidden="true"
                    className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border ${
                      isActive
                        ? 'border-white/90'
                        : 'border-slate-300/90 dark:border-slate-700'
                    }`}
                    style={{ backgroundColor: inkDotColor }}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0.5 right-1 text-[9px] font-mono font-semibold leading-none ${
                    isActive
                      ? 'text-indigo-200'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {tool.shortcut}
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none hidden sm:flex items-center gap-1.5 absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-medium whitespace-nowrap shadow-md opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150"
                >
                  <span>{tool.label}</span>
                  <span className="font-mono text-[10px] opacity-70">{tool.shortcut}</span>
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
