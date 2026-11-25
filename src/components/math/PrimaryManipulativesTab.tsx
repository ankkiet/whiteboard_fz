import React, { useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  buildBarModelElements,
  buildBase10Elements,
  buildClockElements,
  buildFractionModelElements,
  buildJumpNumberLineElements,
  buildVerticalArithmeticElements,
} from '../../engine/mathEngine';
import { BoardElement, ShapeElement, TextElement } from '../../types/board';
import { useI18n } from '../../i18n/useI18n';
import { MathTex } from './MathTex';
import { Plus, RotateCcw } from 'lucide-react';

interface PrimaryManipulativesTabProps {
  getWorldCenter: () => { x: number; y: number };
}

type PrimarySubTool = 'base10' | 'tenframe' | 'arithmetic' | 'barmodel' | 'fraction' | 'numberline' | 'clock';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const PrimaryManipulativesTab: React.FC<PrimaryManipulativesTabProps> = ({
  getWorldCenter,
}) => {
  const { language, t } = useI18n();
  const addElementsBatch = useBoardStore((s) => s.addElementsBatch);
  const addToast = useBoardStore((s) => s.addToast);

  const [subTool, setSubTool] = useState<PrimarySubTool>('base10');

  // Base-10 state
  const [hundreds, setHundreds] = useState(1);
  const [tens, setTens] = useState(2);
  const [ones, setOnes] = useState(13);

  // Ten-Frame state (10 clickable slots)
  const [tenFrameCells, setTenFrameCells] = useState<boolean[]>([
    true, true, true, true, true, true, true, false, false, false,
  ]);

  // Vertical arithmetic state
  const [arithA, setArithA] = useState('248');
  const [arithB, setArithB] = useState('135');
  const [arithOp, setArithOp] = useState<'+' | '-' | '*' | '/'>('+');

  // Bar model state
  const [barLabelA, setBarLabelA] = useState(language === 'en' ? 'Smaller' : 'Số bé');
  const [barPartsA, setBarPartsA] = useState(2);
  const [barLabelB, setBarLabelB] = useState(language === 'en' ? 'Larger' : 'Số lớn');
  const [barPartsB, setBarPartsB] = useState(5);
  const [barSummary, setBarSummary] = useState(language === 'en' ? 'Sum = 56' : 'Tổng = 56');

  // Fraction model state
  const [fracNum, setFracNum] = useState(3);
  const [fracDen, setFracDen] = useState(5);
  const [fracShape, setFracShape] = useState<'bar' | 'circle'>('circle');

  // Jump number line state
  const [jumpStart, setJumpStart] = useState('3');
  const [jumpStep, setJumpStep] = useState('5');

  // Clock state
  const [clockH, setClockH] = useState(9);
  const [clockM, setClockM] = useState(15);

  const getStartZ = () =>
    useBoardStore.getState().elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);

  const base10Total = hundreds * 100 + tens * 10 + ones;
  const tenFrameCount = tenFrameCells.filter(Boolean).length;

  const handleRegroupUp = () => {
    if (ones >= 10) {
      setOnes((v) => v - 10);
      setTens((v) => v + 1);
    } else if (tens >= 10) {
      setTens((v) => v - 10);
      setHundreds((v) => v + 1);
    }
  };

  const handleRegroupDown = () => {
    if (tens >= 1) {
      setTens((v) => v - 1);
      setOnes((v) => v + 10);
    } else if (hundreds >= 1) {
      setHundreds((v) => v - 1);
      setTens((v) => v + 10);
    }
  };

  const handleInsertBase10 = () => {
    const els = buildBase10Elements({ hundreds, tens, ones }, getWorldCenter(), getStartZ(), uid);
    addElementsBatch(els, true);
    addToast(
      t(`Đã chèn khối Base-10 (Tổng = ${base10Total})`, `Inserted Base-10 blocks (Total = ${base10Total})`),
      'success'
    );
  };

  const handleInsertTenFrame = () => {
    const center = getWorldCenter();
    const groupId = uid('grp');
    let z = getStartZ();
    const nextZ = () => {
      z += 1;
      return z;
    };
    const cellSize = 46;
    const left = center.x - (5 * cellSize) / 2;
    const top = center.y - cellSize;
    const color = useBoardStore.getState().color;
    const els: BoardElement[] = [];

    for (let i = 0; i < 10; i += 1) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = left + col * cellSize;
      const y = top + row * cellSize;
      const box: ShapeElement = {
        id: uid('el'),
        type: 'rectangle',
        x,
        y,
        width: cellSize,
        height: cellSize,
        color,
        fillColor: 'transparent',
        strokeWidth: 2,
        groupIds: [groupId],
        zIndex: nextZ(),
      };
      els.push(box);
      if (tenFrameCells[i]) {
        const dot: ShapeElement = {
          id: uid('el'),
          type: 'ellipse',
          x: x + 10,
          y: y + 10,
          width: cellSize - 20,
          height: cellSize - 20,
          color: '#e11d48',
          fillColor: '#f43f5e',
          strokeWidth: 2,
          groupIds: [groupId],
          zIndex: nextZ(),
        };
        els.push(dot);
      }
    }
    const label: TextElement = {
      id: uid('el'),
      type: 'text',
      x: left,
      y: top + cellSize * 2 + 10,
      width: 230,
      height: 28,
      text: `${t('Khung 10 ô', 'Ten-frame')}: ${tenFrameCount} + ${10 - tenFrameCount} = 10`,
      color: '#4f46e5',
      fontSize: 15,
      groupIds: [groupId],
      zIndex: nextZ(),
    };
    els.push(label);
    addElementsBatch(els, true);
    addToast(
      t(`Đã chèn Khung 10 ô (${tenFrameCount}/10)`, `Inserted Ten-Frame (${tenFrameCount}/10)`),
      'success'
    );
  };

  const handleInsertArithmetic = () => {
    const a = Number(arithA);
    const b = Number(arithB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      addToast(t('Vui lòng nhập hai số hợp lệ.', 'Please enter two valid numbers.'), 'error');
      return;
    }
    if (arithOp === '/' && b === 0) {
      addToast(t('Không thể chia cho 0.', 'Cannot divide by zero.'), 'error');
      return;
    }
    const els = buildVerticalArithmeticElements(
      a,
      b,
      arithOp,
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast(t('Đã chèn phép Đặt tính rồi tính lên bảng', 'Inserted vertical arithmetic onto board'), 'success');
  };

  const handleInsertBarModel = () => {
    const els = buildBarModelElements(
      {
        labelA: barLabelA,
        partsA: barPartsA,
        labelB: barLabelB,
        partsB: barPartsB,
        summaryLabel: barSummary,
      },
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast(t('Đã chèn Sơ đồ đoạn thẳng lên bảng', 'Inserted bar model onto board'), 'success');
  };

  const handleInsertFraction = () => {
    const els = buildFractionModelElements(
      fracNum,
      fracDen,
      fracShape,
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast(
      t(`Đã chèn mô hình phân số ${fracNum}/${fracDen}`, `Inserted fraction model ${fracNum}/${fracDen}`),
      'success'
    );
  };

  const handleInsertJumpLine = () => {
    const s = Number(jumpStart);
    const j = Number(jumpStep);
    if (!Number.isFinite(s) || !Number.isFinite(j)) return;
    const els = buildJumpNumberLineElements(
      s,
      j,
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast(
      t(
        `Đã chèn trục số bước nhảy (${s} ${j >= 0 ? '+' : ''}${j} = ${s + j})`,
        `Inserted jump number line (${s} ${j >= 0 ? '+' : ''}${j} = ${s + j})`
      ),
      'success'
    );
  };

  const handleInsertClock = () => {
    const els = buildClockElements(
      clockH,
      clockM,
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast(
      t(
        `Đã chèn đồng hồ ${String(clockH).padStart(2, '0')}:${String(clockM).padStart(2, '0')}`,
        `Inserted clock ${String(clockH).padStart(2, '0')}:${String(clockM).padStart(2, '0')}`
      ),
      'success'
    );
  };

  const subTools: { id: PrimarySubTool; label: string }[] = [
    { id: 'base10', label: 'Base-10' },
    { id: 'tenframe', label: t('Khung 10 ô', 'Ten-frame') },
    { id: 'arithmetic', label: t('Đặt tính', 'Arithmetic') },
    { id: 'barmodel', label: t('Đoạn thẳng', 'Bar model') },
    { id: 'fraction', label: t('Phân số', 'Fractions') },
    { id: 'numberline', label: t('Bước nhảy', 'Number line') },
    { id: 'clock', label: t('Đồng hồ', 'Clock') },
  ];

  return (
    <div className="space-y-3">
      {/* Compact Selector Grid */}
      <div className="flex flex-wrap gap-1.5">
        {subTools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            data-testid={`primary-tool-${tool.id}`}
            onClick={() => setSubTool(tool.id)}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              subTool === tool.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
            }`}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {/* 1. Base-10 Blocks */}
      {subTool === 'base10' && (
        <div className="space-y-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{t('Khối trục thập phân (Base-10)', 'Base-10 place value blocks')}</span>
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
              = {base10Total}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { lbl: t('Trăm (100)', 'Hundreds'), val: hundreds, set: setHundreds, max: 5, col: 'text-emerald-600' },
              { lbl: t('Chục (10)', 'Tens'), val: tens, set: setTens, max: 12, col: 'text-blue-600' },
              { lbl: t('Đơn vị (1)', 'Ones'), val: ones, set: setOnes, max: 19, col: 'text-amber-600' },
            ].map((item) => (
              <div key={item.lbl} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-center space-y-1">
                <div className={`text-[10.5px] font-semibold ${item.col}`}>{item.lbl}</div>
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => item.set((v) => Math.max(0, v - 1))}
                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 font-bold text-xs cursor-pointer"
                  >
                    −
                  </button>
                  <span className="font-mono font-bold text-sm tabular-nums">{item.val}</span>
                  <button
                    type="button"
                    onClick={() => item.set((v) => Math.min(item.max, v + 1))}
                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 font-bold text-xs cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleRegroupUp}
              disabled={ones < 10 && tens < 10}
              className="h-7 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 disabled:opacity-40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold cursor-pointer"
            >
              {t('Gộp 10 → 1 (Nhớ)', 'Group 10 → 1 (Carry)')}
            </button>
            <button
              type="button"
              onClick={handleRegroupDown}
              disabled={tens < 1 && hundreds < 1}
              className="h-7 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 disabled:opacity-40 text-amber-700 dark:text-amber-300 text-[11px] font-semibold cursor-pointer"
            >
              {t('Tách 1 → 10 (Mượn)', 'Split 1 → 10 (Borrow)')}
            </button>
          </div>
          <button
            type="button"
            data-testid="insert-base10-button"
            onClick={handleInsertBase10}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Chèn bộ khối Base-10 lên bảng', 'Insert Base-10 blocks onto board')}</span>
          </button>
        </div>
      )}

      {/* 2. Ten-Frame */}
      {subTool === 'tenframe' && (
        <div className="space-y-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{t('Khung 10 ô (Bấm để bật/tắt chấm)', 'Ten-frame (Click to toggle dots)')}</span>
            <button
              type="button"
              onClick={() => setTenFrameCells(Array(10).fill(false))}
              className="text-[11px] text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('Xóa hết', 'Clear')}</span>
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1.5 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
            {tenFrameCells.map((filled, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={t(`Ô số ${idx + 1}`, `Cell ${idx + 1}`)}
                aria-pressed={filled}
                onClick={() =>
                  setTenFrameCells((prev) => prev.map((v, i) => (i === idx ? !v : v)))
                }
                className="aspect-square rounded-lg border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-indigo-400"
              >
                {filled && <span className="w-5 h-5 rounded-full bg-rose-500 shadow-xs" />}
              </button>
            ))}
          </div>
          <div className="text-center text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
            {tenFrameCount} + {10 - tenFrameCount} = 10
          </div>
          <button
            type="button"
            onClick={handleInsertTenFrame}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Chèn Khung 10 ô lên bảng', 'Insert Ten-frame onto board')}</span>
          </button>
        </div>
      )}

      {/* 3. Vertical Arithmetic */}
      {subTool === 'arithmetic' && (
        <div className="space-y-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50">
          <div className="text-xs font-bold">
            {t('Đặt tính rồi tính (Cộng / Trừ / Nhân / Chia chữ T)', 'Vertical arithmetic (Add / Sub / Mul / Division)')}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { op: '+', lbl: '+' },
                { op: '-', lbl: '−' },
                { op: '*', lbl: '×' },
                { op: '/', lbl: t(': (Chữ T)', '÷ (Long)') },
              ] as const
            ).map((item) => (
              <button
                key={item.op}
                type="button"
                data-testid={`arith-op-${item.op === '/' ? 'div' : item.op === '*' ? 'mul' : item.op === '-' ? 'sub' : 'add'}`}
                onClick={() => setArithOp(item.op)}
                className={`h-8 rounded-lg text-xs font-bold cursor-pointer ${
                  arithOp === item.op
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {item.lbl}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-slate-500">{t('Số thứ nhất', 'First number')}</span>
              <input
                type="number"
                value={arithA}
                onChange={(e) => setArithA(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-500">{t('Số thứ hai', 'Second number')}</span>
              <input
                type="number"
                value={arithB}
                onChange={(e) => setArithB(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums"
              />
            </label>
          </div>
          <button
            type="button"
            data-testid="insert-arithmetic-button"
            onClick={handleInsertArithmetic}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Chèn phép Đặt tính lên bảng', 'Insert vertical arithmetic')}</span>
          </button>
        </div>
      )}

      {/* 4. Bar Model */}
      {subTool === 'barmodel' && (
        <div className="space-y-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50">
          <div className="text-xs font-bold">{t('Sơ đồ đoạn thẳng (Tổng – Hiệu – Tỷ)', 'Bar model diagram (Sum – Diff – Ratio)')}</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={barLabelA}
              onChange={(e) => setBarLabelA(e.target.value)}
              placeholder={t('Nhãn 1', 'Label 1')}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
            <label className="flex items-center justify-between px-2 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
              <span className="text-slate-500">{t('Phần:', 'Parts:')}</span>
              <input
                type="number"
                min={1}
                max={8}
                value={barPartsA}
                onChange={(e) => setBarPartsA(Number(e.target.value))}
                className="w-10 text-right font-mono font-bold bg-transparent outline-none"
              />
            </label>
            <input
              type="text"
              value={barLabelB}
              onChange={(e) => setBarLabelB(e.target.value)}
              placeholder={t('Nhãn 2', 'Label 2')}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
            <label className="flex items-center justify-between px-2 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
              <span className="text-slate-500">{t('Phần:', 'Parts:')}</span>
              <input
                type="number"
                min={1}
                max={8}
                value={barPartsB}
                onChange={(e) => setBarPartsB(Number(e.target.value))}
                className="w-10 text-right font-mono font-bold bg-transparent outline-none"
              />
            </label>
          </div>
          <input
            type="text"
            value={barSummary}
            onChange={(e) => setBarSummary(e.target.value)}
            placeholder={t('Nhãn ngoặc nhọn (VD: Tổng = 56)', 'Brace label (e.g. Sum = 56)')}
            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
          />
          <button
            type="button"
            onClick={handleInsertBarModel}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Chèn Sơ đồ đoạn thẳng', 'Insert bar model')}</span>
          </button>
        </div>
      )}

      {/* 5. Fraction Model */}
      {subTool === 'fraction' && (
        <div className="space-y-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{t('Mô hình Phân số trực quan', 'Visual fraction model')}</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              <MathTex latex={`\\frac{${fracNum}}{${fracDen}}`} />
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setFracShape('circle')}
              className={`h-8 rounded-lg text-xs font-semibold cursor-pointer ${
                fracShape === 'circle'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('Hình tròn (Bánh)', 'Pie / Circle')}
            </button>
            <button
              type="button"
              onClick={() => setFracShape('bar')}
              className={`h-8 rounded-lg text-xs font-semibold cursor-pointer ${
                fracShape === 'bar'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('Thanh phân số', 'Fraction bar')}
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[11px]">
              <span>{t(`Tử số (phần tô màu): ${fracNum}`, `Numerator (shaded): ${fracNum}`)}</span>
              <input
                type="range"
                min={0}
                max={fracDen}
                value={fracNum}
                onChange={(e) => setFracNum(Number(e.target.value))}
                className="w-32 accent-indigo-600"
              />
            </label>
            <label className="flex items-center justify-between text-[11px]">
              <span>{t(`Mẫu số (tổng phần): ${fracDen}`, `Denominator (total): ${fracDen}`)}</span>
              <input
                type="range"
                min={2}
                max={12}
                value={fracDen}
                onChange={(e) => {
                  const nextD = Number(e.target.value);
                  setFracDen(nextD);
                  if (fracNum > nextD) setFracNum(nextD);
                }}
                className="w-32 accent-indigo-600"
              />
            </label>
          </div>
          <button
            type="button"
            data-testid="insert-fraction-button"
            onClick={handleInsertFraction}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t(`Chèn hình phân số ${fracNum}/${fracDen}`, `Insert fraction ${fracNum}/${fracDen}`)}</span>
          </button>
        </div>
      )}

      {/* 6. Jump Number Line */}
      {subTool === 'numberline' && (
        <div className="space-y-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50">
          <div className="text-xs font-bold">{t('Trục số bước nhảy (Cộng / Trừ)', 'Jump number line (Add / Subtract)')}</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-slate-500">{t('Điểm bắt đầu', 'Start point')}</span>
              <input
                type="number"
                value={jumpStart}
                onChange={(e) => setJumpStart(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-500">{t('Bước nhảy (+ / −)', 'Jump step (+ / −)')}</span>
              <input
                type="number"
                value={jumpStep}
                onChange={(e) => setJumpStep(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleInsertJumpLine}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Chèn Trục số bước nhảy', 'Insert jump number line')}</span>
          </button>
        </div>
      )}

      {/* 7. Analog + 24h Clock */}
      {subTool === 'clock' && (
        <div className="space-y-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{t('Đồng hồ kim & 24 giờ', 'Analog & 24h clock')}</span>
            <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {String(clockH).padStart(2, '0')}:{String(clockM).padStart(2, '0')}
            </span>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[11px]">
              <span>{t(`Giờ (0–23): ${clockH}h`, `Hour (0–23): ${clockH}h`)}</span>
              <input
                type="range"
                min={0}
                max={23}
                value={clockH}
                onChange={(e) => setClockH(Number(e.target.value))}
                className="w-36 accent-indigo-600"
              />
            </label>
            <label className="flex items-center justify-between text-[11px]">
              <span>{t(`Phút (0–55): ${clockM}p`, `Minute (0–55): ${clockM}m`)}</span>
              <input
                type="range"
                min={0}
                max={55}
                step={5}
                value={clockM}
                onChange={(e) => setClockM(Number(e.target.value))}
                className="w-36 accent-indigo-600"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleInsertClock}
            className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Chèn Đồng hồ lên bảng', 'Insert clock onto board')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
