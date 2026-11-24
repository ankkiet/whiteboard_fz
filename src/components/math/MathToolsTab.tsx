import React, { useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { BoardPattern, RevealElement } from '../../types/board';
import { Calculator, EyeOff, Grid3X3, ImagePlus, Pin } from 'lucide-react';

interface MathToolsTabProps {
  getWorldCenter: () => { x: number; y: number };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const PATTERN_CHOICES: { id: BoardPattern; label: string }[] = [
  { id: 'grid', label: 'Ô ly vuông' },
  { id: 'coordinate', label: 'Trục Oxy' },
  { id: 'isometric', label: 'Lưới 3D Iso' },
  { id: 'polar', label: 'Tọa độ cực' },
];

export const MathToolsTab: React.FC<MathToolsTabProps> = ({ getWorldCenter }) => {
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const setIsCalculatorOpen = useBoardStore((s) => s.setIsCalculatorOpen);
  const pinnedProblem = useBoardStore((s) => s.pinnedProblem);
  const setPinnedProblem = useBoardStore((s) => s.setPinnedProblem);
  const boardPattern = useBoardStore((s) => s.boardPattern);
  const setBoardPattern = useBoardStore((s) => s.setBoardPattern);
  const addElement = useBoardStore((s) => s.addElement);
  const setCurrentTool = useBoardStore((s) => s.setCurrentTool);
  const addToast = useBoardStore((s) => s.addToast);

  const [problemDraft, setProblemDraft] = useState(
    'Cho hàm số y = x³ - 3mx + 1. Tìm m để hàm số có 2 điểm cực trị.'
  );
  const [revealLabel, setRevealLabel] = useState("Bước 1: Tính đạo hàm y'");
  const problemImageInputRef = useRef<HTMLInputElement>(null);

  const handleInsertRevealCurtain = () => {
    const state = useBoardStore.getState();
    const center = getWorldCenter();
    const maxZ = state.elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);
    const curtain: RevealElement = {
      id: uid('el'),
      type: 'reveal',
      x: Math.round(center.x - 165),
      y: Math.round(center.y - 32),
      width: 330,
      height: 64,
      label: revealLabel.trim() || 'Che lời giải từng bước',
      revealed: false,
      color: '#4f46e5',
      zIndex: maxZ + 1,
    };
    addElement(curtain, true);
    setCurrentTool('select');
    addToast('Đã chèn rèm che lời giải (kéo đặt lên dòng giải, nhấp đúp để mở)', 'success');
  };

  const handlePinProblemImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) {
        setPinnedProblem({
          text: problemDraft.trim(),
          imageUrl: url,
          collapsed: false,
        });
        addToast('Đã ghim ảnh đề bài lên đầu màn hình', 'success');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-3.5">
      {/* Casio fx-580VN X Scientific Calculator */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
        <div className="text-xs font-medium">Máy tính Casio fx-580VN X</div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Giao diện ClassWiz Natural-V.P.A.M., phím SHIFT/ALPHA, chuyển S⇔D phân số/căn, bảng f(x), giải PT bậc 2 &amp; Hệ 2 ẩn.
        </p>
        <button
          type="button"
          data-testid="toggle-calculator-button"
          aria-pressed={isCalculatorOpen}
          onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
          className={`w-full h-9 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            isCalculatorOpen
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>{isCalculatorOpen ? 'Đóng Casio fx-580VN X' : 'Mở Casio fx-580VN X'}</span>
        </button>
      </div>

      {/* Pinned Problem Bar */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
        <div className="text-xs font-medium">Khung ghim đề bài cố định</div>
        <textarea
          rows={2}
          aria-label="Nội dung đề bài muốn ghim"
          value={problemDraft}
          onChange={(e) => setProblemDraft(e.target.value)}
          placeholder="Nhập đề bài để ghim cố định ở đỉnh màn hình..."
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs outline-none focus:border-indigo-500 resize-none"
        />
        <input
          ref={problemImageInputRef}
          type="file"
          accept="image/*"
          onChange={handlePinProblemImage}
          className="hidden"
          aria-hidden="true"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="pin-problem-button"
            onClick={() => {
              if (!problemDraft.trim()) return;
              setPinnedProblem({
                text: problemDraft.trim(),
                imageUrl: pinnedProblem?.imageUrl,
                collapsed: false,
              });
              addToast('Đã ghim đề bài ở đầu màn hình', 'success');
            }}
            className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Pin className="w-3 h-3" />
            <span>Ghim đề bài</span>
          </button>
          <button
            type="button"
            onClick={() => problemImageInputRef.current?.click()}
            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <ImagePlus className="w-3 h-3" />
            <span>Ghim ảnh đề</span>
          </button>
        </div>
      </div>

      {/* Step-by-Step Reveal Curtain */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
        <div className="text-xs font-medium">Che lời giải từng bước (Reveal Curtain)</div>
        <input
          type="text"
          aria-label="Nhãn rèm che lời giải"
          value={revealLabel}
          onChange={(e) => setRevealLabel(e.target.value)}
          placeholder="VD: Bước 1: Tính đạo hàm"
          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
        />
        <button
          type="button"
          data-testid="insert-reveal-curtain-button"
          onClick={handleInsertRevealCurtain}
          className="w-full h-8 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>Chèn rèm che lời giải</span>
        </button>
      </div>

      {/* Quick Math Grid Patterns */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Grid3X3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Nền lưới toán học chuyên dụng</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PATTERN_CHOICES.map((pat) => (
            <button
              key={pat.id}
              type="button"
              onClick={() => setBoardPattern(pat.id)}
              className={`h-8 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                boardPattern === pat.id
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              }`}
            >
              {pat.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
