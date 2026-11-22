import React, { useMemo, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  buildBarChartElements,
  buildPrimeFactorTreeElements,
  buildProbabilityTreeElements,
  buildVennDiagramElements,
  computeGcdLcm,
  computeStatistics,
  factorizePrime,
} from '../../engine/mathEngine';
import { formatPrimeFactorizationLatex } from '../../engine/mathDisplay';
import { MathTex } from './MathTex';
import { MathGradeMode } from '../../types/board';
import { BarChart3, Dices, GitBranch, Plus, RotateCcw } from 'lucide-react';

interface StatsAndProbTabProps {
  gradeMode: MathGradeMode;
  getWorldCenter: () => { x: number; y: number };
}

type SimKind = 'coin' | 'dice1' | 'dice2';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const StatsAndProbTab: React.FC<StatsAndProbTabProps> = ({
  gradeMode,
  getWorldCenter,
}) => {
  const addElementsBatch = useBoardStore((s) => s.addElementsBatch);
  const addToast = useBoardStore((s) => s.addToast);

  // Prime factor & GCD/LCM (THCS)
  const [primeN, setPrimeN] = useState('120');
  const [gcdA, setGcdA] = useState('24');
  const [gcdB, setGcdB] = useState('36');

  // Statistics sample input
  const [sampleInput, setSampleInput] = useState('5, 6, 7, 7, 8, 9, 10, 8, 7');

  // Probability Lab Simulator
  const [simKind, setSimKind] = useState<SimKind>('coin');
  const [simCounts, setSimCounts] = useState<Record<string, number>>({});
  const [simTotal, setSimTotal] = useState(0);

  // Probability Tree (Bayes)
  const [pA, setPA] = useState('0.4');
  const [pBGivenA, setPBGivenA] = useState('0.8');
  const [pBGivenNotA, setPBGivenNotA] = useState('0.3');

  const primeFactors = useMemo(() => factorizePrime(Number(primeN) || 2), [primeN]);
  const gcdLcm = useMemo(() => computeGcdLcm(Number(gcdA) || 0, Number(gcdB) || 0), [gcdA, gcdB]);

  const parsedNumbers = useMemo(
    () =>
      sampleInput
        .split(/[\s,;]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n)),
    [sampleInput]
  );

  const stats = useMemo(() => computeStatistics(parsedNumbers), [parsedNumbers]);

  const getStartZ = () =>
    useBoardStore.getState().elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);

  const runSimulation = (trials: number) => {
    const next = { ...simCounts };
    for (let i = 0; i < trials; i += 1) {
      let outcome = '';
      if (simKind === 'coin') {
        outcome = Math.random() < 0.5 ? 'Ngửa (N)' : 'Sấp (S)';
      } else if (simKind === 'dice1') {
        outcome = `${Math.floor(Math.random() * 6) + 1} chấm`;
      } else {
        const sum = Math.floor(Math.random() * 6) + 1 + (Math.floor(Math.random() * 6) + 1);
        outcome = `Tổng ${sum}`;
      }
      next[outcome] = (next[outcome] || 0) + 1;
    }
    setSimCounts(next);
    setSimTotal((t) => t + trials);
  };

  const resetSimulation = (nextKind?: SimKind) => {
    if (nextKind) setSimKind(nextKind);
    setSimCounts({});
    setSimTotal(0);
  };

  const handleInsertPrimeTree = () => {
    const n = Number(primeN);
    if (!Number.isFinite(n) || n < 2) {
      addToast('Nhập số tự nhiên lớn hơn hoặc bằng 2.', 'error');
      return;
    }
    const els = buildPrimeFactorTreeElements(
      n,
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast(`Đã chèn sơ đồ cây thừa số nguyên tố của ${Math.floor(n)}`, 'success');
  };

  const handleInsertBarChart = () => {
    if (parsedNumbers.length === 0) return;
    // Group frequencies for clean bar chart
    const freq = new Map<number, number>();
    for (const v of parsedNumbers) freq.set(v, (freq.get(v) || 0) + 1);
    const items = Array.from(freq.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([val, count]) => ({ label: String(val), value: count }));
    const els = buildBarChartElements(
      items,
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast('Đã chèn Biểu đồ cột tần số lên bảng', 'success');
  };

  const handleInsertProbTree = () => {
    const els = buildProbabilityTreeElements(
      Number(pA) || 0.5,
      Number(pBGivenA) || 0.7,
      Number(pBGivenNotA) || 0.2,
      getWorldCenter(),
      useBoardStore.getState().color,
      getStartZ(),
      uid
    );
    addElementsBatch(els, true);
    addToast('Đã chèn Sơ đồ cây Xác suất (Bayes) lên bảng', 'success');
  };

  const handleInsertVenn = () => {
    const els = buildVennDiagramElements('Tập A', 'Tập B', getWorldCenter(), getStartZ(), uid);
    addElementsBatch(els, true);
    addToast('Đã chèn Biểu đồ Ven (A ∩ B) lên bảng', 'success');
  };

  const simEntries = Object.entries(simCounts).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-3.5">
      {/* THCS: Prime Factor Tree & GCD/LCM */}
      {gradeMode === 'middle' && (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
          <div className="text-xs font-bold">Số học: Thừa số nguyên tố &amp; ƯCLN / BCNN</div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={2}
              max={9999}
              value={primeN}
              onChange={(e) => setPrimeN(e.target.value)}
              aria-label="Số cần phân tích thừa số nguyên tố"
              className="w-24 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums"
            />
            <button
              type="button"
              onClick={handleInsertPrimeTree}
              className="flex-1 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Vẽ cây thừa số</span>
            </button>
          </div>
          <div className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-xs text-indigo-700 dark:text-indigo-300 overflow-x-auto">
            <MathTex latex={formatPrimeFactorizationLatex(Number(primeN) || 2, primeFactors)} />
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/70 dark:border-slate-800">
            <input
              type="number"
              value={gcdA}
              onChange={(e) => setGcdA(e.target.value)}
              aria-label="Số a tính ƯCLN"
              className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
            <input
              type="number"
              value={gcdB}
              onChange={(e) => setGcdB(e.target.value)}
              aria-label="Số b tính ƯCLN"
              className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </div>
          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">
            ƯCLN = <strong>{gcdLcm.gcd}</strong> · BCNN = <strong>{gcdLcm.lcm}</strong>
          </div>
        </div>
      )}

      {/* Statistics Summary + Bar Chart */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
        <div className="text-xs font-bold">Thống kê mẫu số liệu &amp; Biểu đồ cột</div>
        <input
          type="text"
          aria-label="Dãy số liệu thống kê"
          value={sampleInput}
          onChange={(e) => setSampleInput(e.target.value)}
          placeholder="Nhập dãy số cách nhau bằng dấu phẩy..."
          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
        />
        {stats && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11.5px] tabular-nums bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-1"><MathTex latex="\bar{x} =" /> <strong>{stats.mean.toFixed(2)}</strong></div>
            <div className="flex items-center gap-1"><MathTex latex="M_e =" /> <strong>{stats.median.toFixed(2)}</strong></div>
            <div className="flex items-center gap-1"><MathTex latex="Q_1 =" /> <strong>{stats.q1.toFixed(2)}</strong></div>
            <div className="flex items-center gap-1"><MathTex latex="Q_3 =" /> <strong>{stats.q3.toFixed(2)}</strong></div>
            <div className="flex items-center gap-1"><MathTex latex="\Delta_Q =" /> <strong>{stats.iqr.toFixed(2)}</strong></div>
            <div className="flex items-center gap-1"><MathTex latex="M_o =" /> <strong>{stats.mode.slice(0, 2).join(', ')}</strong></div>
            <div className="flex items-center gap-1"><MathTex latex="s^2 =" /> <strong>{stats.variance.toFixed(2)}</strong></div>
            <div className="flex items-center gap-1"><MathTex latex="s =" /> <strong>{stats.stdDev.toFixed(2)}</strong></div>
          </div>
        )}
        <button
          type="button"
          onClick={handleInsertBarChart}
          disabled={!stats}
          className="w-full h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Vẽ Biểu đồ cột tần số lên bảng</span>
        </button>
      </div>

      {/* Probability Lab Simulator */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold inline-flex items-center gap-1.5">
            <Dices className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Thí nghiệm Xác suất ({simTotal} lần)</span>
          </span>
          {simTotal > 0 && (
            <button
              type="button"
              onClick={() => resetSimulation()}
              className="text-[11px] text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: 'coin', lbl: 'Đồng xu' },
              { id: 'dice1', lbl: '1 Xúc xắc' },
              { id: 'dice2', lbl: '2 Xúc xắc' },
            ] as const
          ).map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => resetSimulation(k.id)}
              className={`h-7 rounded-lg text-[11px] font-semibold cursor-pointer ${
                simKind === k.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {k.lbl}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[1, 10, 100, 1000].map((n) => (
            <button
              key={n}
              type="button"
              data-testid={`prob-sim-${n}`}
              onClick={() => runSimulation(n)}
              className="h-7 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-[11px] font-mono font-bold cursor-pointer"
            >
              +{n}
            </button>
          ))}
        </div>
        {simEntries.length > 0 && (
          <div className="space-y-1 pt-1 max-h-32 overflow-y-auto">
            {simEntries.map(([label, cnt]) => {
              const pct = simTotal > 0 ? (cnt / simTotal) * 100 : 0;
              return (
                <div key={label} className="space-y-0.5 text-[10.5px] font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span>{label}</span>
                    <span>
                      {cnt} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Probability Tree (Bayes) & Venn Diagram */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-950/50 space-y-2">
        <div className="text-xs font-bold">Sơ đồ cây Xác suất (Bayes) &amp; Biểu đồ Ven</div>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="space-y-0.5">
            <span className="block text-[10.5px] text-slate-600 dark:text-slate-300"><MathTex latex="P(A)" /></span>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={pA}
              onChange={(e) => setPA(e.target.value)}
              className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </label>
          <label className="space-y-0.5">
            <span className="block text-[10.5px] text-slate-600 dark:text-slate-300"><MathTex latex="P(B \mid A)" /></span>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={pBGivenA}
              onChange={(e) => setPBGivenA(e.target.value)}
              className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </label>
          <label className="space-y-0.5">
            <span className="block text-[10.5px] text-slate-600 dark:text-slate-300"><MathTex latex="P(B \mid \overline{A})" /></span>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={pBGivenNotA}
              onChange={(e) => setPBGivenNotA(e.target.value)}
              className="w-full h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleInsertProbTree}
            className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Sơ đồ cây</span>
          </button>
          <button
            type="button"
            onClick={handleInsertVenn}
            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Biểu đồ Ven</span>
          </button>
        </div>
      </div>
    </div>
  );
};
