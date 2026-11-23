import React from 'react';
import {
  CASIO_CONSTANTS,
  CASIO_CONVERSIONS,
  CasioAngleUnit,
  CasioComplexValue,
  CasioNormMode,
  CasioStats1VarResult,
  computeMatrixDet,
  computeMatrixInverse,
  computeVectorMetrics,
  evaluateCasioComplex,
  formatCasioExact,
  formatComplexLatex,
  matrixToLatex,
  multiplyMatrices,
  solveCubicEquation,
  solveLinearSystem2x2,
  solveLinearSystem3x3,
  solveQuadraticInequality,
} from '../../engine/casio580Engine';
import { solveQuadratic } from '../../engine/mathEngine';
import { compileMathExpression } from '../../engine/mathUtils';
import { MathTex } from './MathTex';

export type CasioMainMode =
  | 'calc'
  | 'complex'
  | 'matrix'
  | 'vector'
  | 'table'
  | 'equation'
  | 'ineq'
  | 'stats'
  | 'menu';

export type CasioEqSubMode = 'quad' | 'cubic' | 'sys2' | 'sys3';

export type CasioLcdOverlay =
  | null
  | 'setup'
  | 'const'
  | 'conv'
  | 'recall'
  | 'optn'
  | 'calcPrompt'
  | 'help';

export interface CasioLcdModesProps {
  mode: CasioMainMode;
  setMode: (m: CasioMainMode) => void;
  overlay: CasioLcdOverlay;
  setOverlay: (o: CasioLcdOverlay) => void;
  angleUnit: CasioAngleUnit;
  setAngleUnit: (u: CasioAngleUnit) => void;
  normMode: CasioNormMode;
  setNormMode: (m: CasioNormMode) => void;
  fixDigits: number;
  setFixDigits: (d: number) => void;
  chassisTheme: 'carbon' | 'navy' | 'silver';
  setChassisTheme: (t: 'carbon' | 'navy' | 'silver') => void;
  vars: Record<string, number>;
  ansVal: number;
  preAnsVal: number;
  onInsertToken: (tok: string) => void;
  onApplyConversion: (val: number, label: string) => void;
  onTriggerOptnAction: (action: 'fact' | 'divR' | 'pol' | 'rec' | 'gcd' | 'lcm' | 'dms' | 'eng') => void;

  // Complex
  complexExpr: string;
  setComplexExpr: (v: string) => void;
  complexPolar: boolean;
  setComplexPolar: (v: boolean) => void;

  // Matrix (string[][] for frictionless keypad/keyboard entry)
  matSize: 2 | 3;
  setMatSize: (n: 2 | 3) => void;
  matA: string[][];
  setMatA: (m: string[][]) => void;
  matB: string[][];
  setMatB: (m: string[][]) => void;
  matOp: 'det' | 'inv' | 'add' | 'mul';
  setMatOp: (op: 'det' | 'inv' | 'add' | 'mul') => void;

  // Vector (string[] for frictionless keypad/keyboard entry)
  vecDim: 2 | 3;
  setVecDim: (n: 2 | 3) => void;
  vecU: string[];
  setVecU: (v: string[]) => void;
  vecV: string[];
  setVecV: (v: string[]) => void;

  // Table
  tableExpr: string;
  setTableExpr: (v: string) => void;
  tableStart: string;
  setTableStart: (v: string) => void;
  tableEnd: string;
  setTableEnd: (v: string) => void;
  tableStep: string;
  setTableStep: (v: string) => void;

  // Equation
  eqSubMode: CasioEqSubMode;
  setEqSubMode: (s: CasioEqSubMode) => void;
  qa: string;
  setQa: (v: string) => void;
  qb: string;
  setQb: (v: string) => void;
  qc: string;
  setQc: (v: string) => void;
  qd: string;
  setQd: (v: string) => void;
  sys2: string[];
  setSys2: (v: string[]) => void;
  sys3: string[][];
  setSys3: (v: string[][]) => void;

  // Inequality
  ineqOp: '>' | '<' | '>=' | '<=';
  setIneqOp: (op: '>' | '<' | '>=' | '<=') => void;

  // Stats
  statsRaw: string;
  setStatsRaw: (v: string) => void;
  statsResult: CasioStats1VarResult | null;

  // CALC prompt
  calcVarsList: string[];
  calcVarInputs: Record<string, string>;
  onSetCalcVarInput: (k: string, raw: string) => void;
  onEvalCalcPrompt: () => void;
}

const toNum = (s: string): number => {
  const cleaned = s.trim().replace(/−/g, '-');
  if (!cleaned || cleaned === '-') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

export const CasioLcdModes: React.FC<CasioLcdModesProps> = (props) => {
  const { mode, setMode, overlay, setOverlay } = props;

  // Overlays inside the LCD (SETUP, CONST, CONV, RECALL, OPTN, CALC prompt, HELP)
  if (overlay === 'setup') {
    return (
      <div className="p-2 min-h-[120px] space-y-1.5 text-slate-900">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>Cài đặt máy tính (SETUP)</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            Đóng
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => props.setAngleUnit(props.angleUnit === 'D' ? 'R' : 'D')}
            className="px-2 py-1 rounded bg-[#e5eee0] border border-[#96a68f] font-semibold cursor-pointer text-left"
          >
            Đơn vị góc: <b>{props.angleUnit === 'D' ? 'DEG (Độ)' : 'RAD'}</b>
          </button>
          <button
            type="button"
            onClick={() => {
              const order: CasioNormMode[] = ['NORM', 'FIX', 'SCI'];
              const next = order[(order.indexOf(props.normMode) + 1) % order.length];
              props.setNormMode(next);
            }}
            className="px-2 py-1 rounded bg-[#e5eee0] border border-[#96a68f] font-semibold cursor-pointer text-left"
          >
            Làm tròn: <b>{props.normMode}</b>
          </button>
        </div>
        {props.normMode !== 'NORM' && (
          <div className="flex items-center justify-between bg-[#e5eee0] rounded px-2 py-1 border border-[#96a68f] text-[10px]">
            <span>Số chữ số ({props.normMode}):</span>
            <div className="flex items-center gap-1">
              {[2, 3, 4, 6, 8].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => props.setFixDigits(d)}
                  className={`px-1.5 rounded font-mono font-bold cursor-pointer ${
                    props.fixDigits === d ? 'bg-slate-800 text-[#e6f0e1]' : 'bg-white/70'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between bg-[#e5eee0] rounded px-2 py-1 border border-[#96a68f] text-[10px]">
          <span>Vỏ máy:</span>
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'carbon', label: 'Đen' },
                { id: 'navy', label: 'Xanh' },
                { id: 'silver', label: 'Bạc' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => props.setChassisTheme(t.id)}
                className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${
                  props.chassisTheme === t.id ? 'bg-slate-800 text-[#e6f0e1]' : 'bg-white/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (overlay === 'const') {
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-slate-900">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>Hằng số vật lý & hóa học (CONST)</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            Đóng
          </button>
        </div>
        <div className="max-h-[96px] overflow-y-auto casio-lcd-no-scrollbar grid grid-cols-2 gap-1">
          {CASIO_CONSTANTS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                props.onInsertToken(c.token);
                setOverlay(null);
              }}
              className="px-1.5 py-1 rounded bg-[#e5eee0] hover:bg-slate-800 hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[9.5px] cursor-pointer"
            >
              <div className="font-bold flex items-center justify-between">
                <span>{c.symbol}</span>
                <span className="font-mono text-[8.5px] opacity-80">{c.unit}</span>
              </div>
              <div className="truncate text-[8.5px] opacity-80">{c.name}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (overlay === 'conv') {
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-slate-900">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>Chuyển đổi đơn vị (CONV · Ans = {Number(props.ansVal.toFixed(4))})</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            Đóng
          </button>
        </div>
        <div className="max-h-[96px] overflow-y-auto casio-lcd-no-scrollbar grid grid-cols-2 gap-1">
          {CASIO_CONVERSIONS.map((conv) => {
            const converted = conv.convert(props.ansVal);
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => {
                  props.onApplyConversion(converted, `${props.ansVal} ${conv.fromUnit} → ${conv.toUnit}`);
                  setOverlay(null);
                }}
                className="px-1.5 py-1 rounded bg-[#e5eee0] hover:bg-slate-800 hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[9.5px] cursor-pointer"
              >
                <div className="font-bold">{conv.label}</div>
                <div className="font-mono text-[8.5px] opacity-80">
                  = {Number(converted.toFixed(5))} {conv.toUnit}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (overlay === 'recall') {
    const varKeys = ['A', 'B', 'C', 'D', 'T', 'F', 'M', 'x', 'y', 'z'];
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-slate-900">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>Biến nhớ (RECALL · Bấm để chèn)</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            Đóng
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {varKeys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                props.onInsertToken(k);
                setOverlay(null);
              }}
              className="px-1 py-1 rounded bg-[#e5eee0] hover:bg-slate-800 hover:text-[#e6f0e1] border border-[#96a68f] text-center text-[9.5px] font-mono cursor-pointer"
            >
              <div className="font-bold">{k}</div>
              <div className="truncate text-[8.5px]">{Number((props.vars[k] ?? 0).toFixed(3))}</div>
            </button>
          ))}
        </div>
        <div className="text-[9px] font-mono flex items-center justify-between pt-0.5 opacity-85">
          <span>Ans = {Number(props.ansVal.toFixed(5))}</span>
          <span>PreAns = {Number(props.preAnsVal.toFixed(5))}</span>
        </div>
      </div>
    );
  }

  if (overlay === 'optn') {
    const actions: { id: 'fact' | 'divR' | 'pol' | 'rec' | 'gcd' | 'lcm' | 'dms' | 'eng'; label: string }[] = [
      { id: 'fact', label: 'FACT (Thừa số NT)' },
      { id: 'divR', label: 'a ÷R b (Chia có dư)' },
      { id: 'pol', label: 'Pol(x; y)' },
      { id: 'rec', label: 'Rec(r; θ)' },
      { id: 'gcd', label: 'GCD(a; b)' },
      { id: 'lcm', label: 'LCM(a; b)' },
      { id: 'dms', label: `Đổi ° ' " (DMS)` },
      { id: 'eng', label: 'Đổi ENG (×10³ⁿ)' },
    ];
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-slate-900">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>Tùy chọn nhanh (OPTN)</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            Đóng
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {actions.map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => {
                props.onTriggerOptnAction(act.id);
                setOverlay(null);
              }}
              className="px-1.5 py-1 rounded bg-[#e5eee0] hover:bg-slate-800 hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[9.5px] font-semibold cursor-pointer"
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (overlay === 'calcPrompt') {
    return (
      <div className="p-2 min-h-[120px] space-y-1.5 text-slate-900">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>CALC · Nhập giá trị biến (Bấm phím số Casio hoặc gõ)</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            Hủy
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 max-h-[68px] overflow-y-auto casio-lcd-no-scrollbar">
          {props.calcVarsList.map((k, idx) => (
            <label
              key={k}
              className="flex items-center gap-1 bg-[#e5eee0] focus-within:ring-2 focus-within:ring-indigo-600 rounded px-1.5 h-6 border border-[#96a68f]"
            >
              <span className="text-[10px] font-mono font-bold">{k}=</span>
              <input
                type="text"
                inputMode="decimal"
                data-casio-field={`calc-${k}`}
                autoFocus={idx === 0}
                value={props.calcVarInputs[k] ?? String(props.vars[k] ?? 0)}
                onChange={(e) => props.onSetCalcVarInput(k, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') props.onEvalCalcPrompt();
                }}
                className="w-full min-w-0 bg-transparent text-[10.5px] font-mono outline-none"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={props.onEvalCalcPrompt}
          className="w-full h-6 rounded bg-slate-800 text-[#e6f0e1] text-[10.5px] font-bold cursor-pointer"
        >
          Tính giá trị biểu thức (=)
        </button>
      </div>
    );
  }

  if (overlay === 'help') {
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-slate-900 text-[9.5px] leading-snug">
        <div className="flex items-center justify-between font-bold text-[10px]">
          <span>Hướng dẫn Casio fx-580VN X</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            Đóng
          </button>
        </div>
        <p>• <b>Bấm phím trực tiếp</b>: Mọi ô nhập ở tất cả chế độ đều nhận phím cứng trên mặt máy tính Casio.</p>
        <p>• <b>Phím ◀ / ▶</b>: Di chuyển con trỏ giữa các ô hoặc nhảy qua dấu <b>;</b> trong <code>∫, d/dx, Σ, logb</code>.</p>
        <p>• <b>STO + A..F/x..z</b>: Lưu kết quả vào biến; <b>CALC</b>: Thế biến; <b>SHIFT+CALC (SOLVE)</b>: Dò nghiệm.</p>
      </div>
    );
  }

  // MENU Grid (8 real Casio modes)
  if (mode === 'menu') {
    const items: { id: CasioMainMode; num: string; title: string }[] = [
      { id: 'calc', num: '1', title: 'Tính toán' },
      { id: 'complex', num: '2', title: 'Số phức' },
      { id: 'matrix', num: '3', title: 'Ma trận' },
      { id: 'vector', num: '4', title: 'Vectơ' },
      { id: 'table', num: '5', title: 'Bảng f(x)' },
      { id: 'equation', num: '6', title: 'Phương trình' },
      { id: 'ineq', num: '7', title: 'Bất phương trình' },
      { id: 'stats', num: '8', title: 'Thống kê' },
    ];
    return (
      <div className="p-2 min-h-[120px] grid grid-cols-2 gap-1 text-slate-900">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            className="px-2 py-1 rounded bg-[#c6d4bf] hover:bg-slate-900 hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[10.5px] font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="w-4 h-4 rounded-sm bg-slate-800 text-[#e6f0e1] text-[9.5px] font-mono flex items-center justify-center shrink-0">
              {item.num}
            </span>
            <span className="truncate">{item.title}</span>
          </button>
        ))}
      </div>
    );
  }

  // Mode 2: Complex Numbers
  if (mode === 'complex') {
    const cmpVal: CasioComplexValue | null = evaluateCasioComplex(props.complexExpr, props.angleUnit);
    const modVal = cmpVal ? Math.hypot(cmpVal.re, cmpVal.im) : NaN;
    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-slate-900">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>2: Số phức (a + bi)</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => props.onInsertToken('i')}
              className="px-1.5 py-0.5 rounded bg-[#c6d4bf] border border-[#96a68f] text-[9px] font-mono font-bold cursor-pointer"
            >
              +i
            </button>
            <button
              type="button"
              onClick={() => props.onInsertToken('∠')}
              className="px-1.5 py-0.5 rounded bg-[#c6d4bf] border border-[#96a68f] text-[9px] font-mono font-bold cursor-pointer"
            >
              +∠
            </button>
            <button
              type="button"
              onClick={() => props.setComplexPolar(!props.complexPolar)}
              className="px-1.5 py-0.5 rounded bg-slate-800 text-[#e6f0e1] text-[9px] cursor-pointer"
            >
              {props.complexPolar ? 'r∠θ' : 'a+bi'}
            </button>
            <button type="button" onClick={() => setMode('calc')} className="underline cursor-pointer text-[9.5px]">
              Thoát
            </button>
          </div>
        </div>
        <input
          type="text"
          data-casio-field="complex-expr"
          aria-label="Biểu thức số phức"
          autoFocus
          value={props.complexExpr}
          onChange={(e) => props.setComplexExpr(e.target.value)}
          placeholder="Ví dụ: (2+3i)*(1-i) hoặc 2∠45"
          className="w-full h-6 px-1.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#96a68f] text-[11px] font-mono outline-none"
        />
        <div
          data-testid="calculator-display-result"
          className="px-2 py-1 rounded bg-[#e5eee0] border border-[#a5b89d] flex items-center justify-between text-[12px] font-bold"
        >
          {cmpVal ? (
            <>
              <span className="text-[9.5px] font-mono text-slate-600">
                |z| = {Number(modVal.toFixed(4))}
              </span>
              <MathTex latex={formatComplexLatex(cmpVal, props.complexPolar, props.angleUnit)} />
            </>
          ) : (
            <span className="text-rose-700 text-[10.5px]">Nhập biểu thức số phức...</span>
          )}
        </div>
      </div>
    );
  }

  // Mode 3: Matrix
  if (mode === 'matrix') {
    const { matSize, matA, matB, matOp } = props;
    const numA = matA.map((r) => r.map(toNum));
    const numB = matB.map((r) => r.map(toNum));
    const detA = computeMatrixDet(numA);
    const invA = matOp === 'inv' ? computeMatrixInverse(numA) : null;
    const sumMat =
      matOp === 'add' ? numA.map((r, ri) => r.map((v, ci) => v + numB[ri][ci])) : null;
    const mulMat = matOp === 'mul' ? multiplyMatrices(numA, numB) : null;

    const updateCell = (which: 'A' | 'B', r: number, c: number, rawVal: string) => {
      const target = which === 'A' ? matA : matB;
      const next = target.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? rawVal : cell)));
      if (which === 'A') props.setMatA(next);
      else props.setMatB(next);
    };

    const resizeMat = (n: 2 | 3) => {
      props.setMatSize(n);
      const make = (src: string[][]) =>
        Array.from({ length: n }, (_, r) =>
          Array.from({ length: n }, (__, c) => src[r]?.[c] ?? (r === c ? '1' : '0'))
        );
      props.setMatA(make(matA));
      props.setMatB(make(matB));
    };

    return (
      <div className="p-2 min-h-[120px] space-y-1 text-slate-900">
        <div className="flex items-center justify-between text-[9.5px] font-bold">
          <div className="flex items-center gap-1">
            <span>Ma trận</span>
            <button
              type="button"
              onClick={() => resizeMat(matSize === 2 ? 3 : 2)}
              className="px-1 rounded bg-slate-800 text-[#e6f0e1] cursor-pointer"
            >
              {matSize}×{matSize}
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            {(['det', 'inv', 'add', 'mul'] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => props.setMatOp(op)}
                className={`px-1 rounded text-[9px] cursor-pointer ${
                  matOp === op ? 'bg-slate-800 text-[#e6f0e1]' : 'bg-[#e5eee0] border border-[#96a68f]'
                }`}
              >
                {op === 'det' ? 'detA' : op === 'inv' ? 'A⁻¹' : op === 'add' ? 'A+B' : 'A×B'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <div className="flex-1">
            <div className="text-[8.5px] font-bold">MatA</div>
            <div className={`grid gap-0.5 ${matSize === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {matA.map((row, r) =>
                row.map((val, c) => (
                  <input
                    key={`a-${r}-${c}`}
                    type="text"
                    inputMode="decimal"
                    data-casio-field={`matA-${r}-${c}`}
                    aria-label={`MatA(${r + 1},${c + 1})`}
                    value={val}
                    onChange={(e) => updateCell('A', r, c, e.target.value)}
                    className="h-5 px-0.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#96a68f] text-[9.5px] font-mono text-center outline-none"
                  />
                ))
              )}
            </div>
          </div>
          {(matOp === 'add' || matOp === 'mul') && (
            <div className="flex-1">
              <div className="text-[8.5px] font-bold">MatB</div>
              <div className={`grid gap-0.5 ${matSize === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {matB.map((row, r) =>
                  row.map((val, c) => (
                    <input
                      key={`b-${r}-${c}`}
                      type="text"
                      inputMode="decimal"
                      data-casio-field={`matB-${r}-${c}`}
                      aria-label={`MatB(${r + 1},${c + 1})`}
                      value={val}
                      onChange={(e) => updateCell('B', r, c, e.target.value)}
                      className="h-5 px-0.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#96a68f] text-[9.5px] font-mono text-center outline-none"
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div
          data-testid="calculator-display-result"
          className="px-2 py-0.5 rounded bg-[#e5eee0] border border-[#a5b89d] text-[10.5px] flex justify-end overflow-x-auto casio-lcd-no-scrollbar"
        >
          {matOp === 'det' && <MathTex latex={`\\det(A) = ${formatCasioExact(detA).exactLatex}`} />}
          {matOp === 'inv' &&
            (invA ? <MathTex latex={`A^{-1} = ${matrixToLatex(invA)}`} /> : <span className="text-rose-700 font-bold">Ma trận suy biến (det=0)</span>)}
          {matOp === 'add' && sumMat && <MathTex latex={matrixToLatex(sumMat)} />}
          {matOp === 'mul' && mulMat && <MathTex latex={matrixToLatex(mulMat)} />}
        </div>
      </div>
    );
  }

  // Mode 4: Vector
  if (mode === 'vector') {
    const { vecDim, vecU, vecV } = props;
    const numU = vecU.slice(0, vecDim).map(toNum);
    const numV = vecV.slice(0, vecDim).map(toNum);
    const res = computeVectorMetrics(numU, numV, props.angleUnit);
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-slate-900">
        <div className="flex items-center justify-between text-[9.5px] font-bold">
          <span>4: Vectơ ({vecDim}D)</span>
          <button
            type="button"
            onClick={() => props.setVecDim(vecDim === 2 ? 3 : 2)}
            className="px-1.5 py-0.5 rounded bg-slate-800 text-[#e6f0e1] cursor-pointer"
          >
            Đổi {vecDim === 2 ? '3D' : '2D'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <div className="text-[8.5px] font-bold">VctA (u)</div>
            <div className={`grid gap-0.5 ${vecDim === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {vecU.slice(0, vecDim).map((val, i) => (
                <input
                  key={`u-${i}`}
                  type="text"
                  inputMode="decimal"
                  data-casio-field={`vecU-${i}`}
                  aria-label={`u${i + 1}`}
                  value={val}
                  onChange={(e) => {
                    const next = [...vecU];
                    next[i] = e.target.value;
                    props.setVecU(next);
                  }}
                  className="h-5 px-1 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#96a68f] text-[10px] font-mono text-center outline-none"
                />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[8.5px] font-bold">VctB (v)</div>
            <div className={`grid gap-0.5 ${vecDim === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {vecV.slice(0, vecDim).map((val, i) => (
                <input
                  key={`v-${i}`}
                  type="text"
                  inputMode="decimal"
                  data-casio-field={`vecV-${i}`}
                  aria-label={`v${i + 1}`}
                  value={val}
                  onChange={(e) => {
                    const next = [...vecV];
                    next[i] = e.target.value;
                    props.setVecV(next);
                  }}
                  className="h-5 px-1 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#96a68f] text-[10px] font-mono text-center outline-none"
                />
              ))}
            </div>
          </div>
        </div>
        <div
          data-testid="calculator-display-result"
          className="px-1.5 py-1 rounded bg-[#e5eee0] border border-[#a5b89d] text-[9.5px] font-mono space-y-0.5"
        >
          <div className="flex justify-between">
            <span>u·v = <b>{Number(res.dot.toFixed(3))}</b></span>
            <span>∠ = <b>{Number.isFinite(res.angle) ? `${Number(res.angle.toFixed(2))}${props.angleUnit === 'D' ? '°' : ' rad'}` : '—'}</b></span>
          </div>
          <div className="flex justify-between">
            <span>|u| = {Number(res.magU.toFixed(3))}</span>
            <span>{vecDim === 3 ? `[u,v]=(${res.cross.join('; ')})` : `u+v=(${res.sum.join('; ')})`}</span>
          </div>
        </div>
      </div>
    );
  }

  // Mode 5: Table f(x)
  if (mode === 'table') {
    const fn = compileMathExpression(props.tableExpr);
    const s = toNum(props.tableStart);
    const e = toNum(props.tableEnd);
    const st = toNum(props.tableStep);
    const rows: { x: number; y: string }[] = [];
    if (fn && Number.isFinite(s) && Number.isFinite(e) && Number.isFinite(st) && st > 0) {
      for (let x = s, guard = 0; x <= e + 1e-9 && guard < 25; x += st, guard += 1) {
        const y = fn(x);
        rows.push({
          x: Number(x.toFixed(3)),
          y: Number.isFinite(y) ? Number(y.toFixed(4)).toString() : 'KXĐ',
        });
      }
    }
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-slate-900">
        <div className="flex items-center gap-1 bg-[#e5eee0] rounded px-1.5 h-6 border border-[#9eb096]">
          <span className="text-[10px] font-mono font-bold">f(x)=</span>
          <input
            type="text"
            data-casio-field="table-expr"
            aria-label="Hàm f(x)"
            value={props.tableExpr}
            onChange={(e) => props.setTableExpr(e.target.value)}
            className="w-full min-w-0 bg-transparent text-[10.5px] font-mono outline-none"
          />
          <div className="flex items-center gap-0.5 text-[9.5px] font-mono">
            <input
              type="text"
              inputMode="decimal"
              data-casio-field="table-start"
              aria-label="Start"
              value={props.tableStart}
              onChange={(e) => props.setTableStart(e.target.value)}
              className="w-7 bg-white/60 focus:ring-1 focus:ring-indigo-600 rounded px-0.5 text-center outline-none"
            />
            <span>:</span>
            <input
              type="text"
              inputMode="decimal"
              data-casio-field="table-end"
              aria-label="End"
              value={props.tableEnd}
              onChange={(e) => props.setTableEnd(e.target.value)}
              className="w-7 bg-white/60 focus:ring-1 focus:ring-indigo-600 rounded px-0.5 text-center outline-none"
            />
            <span>/</span>
            <input
              type="text"
              inputMode="decimal"
              data-casio-field="table-step"
              aria-label="Step"
              value={props.tableStep}
              onChange={(e) => props.setTableStep(e.target.value)}
              className="w-7 bg-white/60 focus:ring-1 focus:ring-indigo-600 rounded px-0.5 text-center outline-none"
            />
          </div>
        </div>
        <div
          data-testid="calculator-display-result"
          className="max-h-[76px] overflow-y-auto casio-lcd-no-scrollbar rounded border border-[#9eb096] bg-[#e5eee0]"
        >
          <table className="w-full text-[10px] font-mono tabular-nums">
            <tbody>
              {rows.map((row) => (
                <tr key={row.x} className="border-b border-[#c2d1ba] last:border-b-0">
                  <td className="px-2 py-0.5 font-semibold">x = {row.x}</td>
                  <td className="px-2 py-0.5 text-right font-bold">{row.y}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Mode 6: Equation (PT Bậc 2, PT Bậc 3, Hệ 2 ẩn, Hệ 3 ẩn)
  if (mode === 'equation') {
    const { eqSubMode, setEqSubMode } = props;
    const quadRes = eqSubMode === 'quad' ? solveQuadratic(toNum(props.qa), toNum(props.qb), toNum(props.qc)) : null;
    const cubicRes =
      eqSubMode === 'cubic'
        ? solveCubicEquation(toNum(props.qa), toNum(props.qb), toNum(props.qc), toNum(props.qd))
        : null;
    const sys2Res =
      eqSubMode === 'sys2'
        ? solveLinearSystem2x2(...(props.sys2.map(toNum) as [number, number, number, number, number, number]))
        : null;
    const sys3Res = eqSubMode === 'sys3' ? solveLinearSystem3x3(props.sys3.map((r) => r.map(toNum))) : null;

    return (
      <div className="p-2 min-h-[120px] space-y-1 text-slate-900">
        <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
          <div className="flex items-center gap-0.5">
            {(
              [
                { id: 'quad', label: 'Bậc 2' },
                { id: 'cubic', label: 'Bậc 3' },
                { id: 'sys2', label: 'Hệ 2 ẩn' },
                { id: 'sys3', label: 'Hệ 3 ẩn' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setEqSubMode(s.id)}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  eqSubMode === s.id ? 'bg-slate-800 text-[#e6f0e1]' : 'bg-[#e5eee0] border border-[#96a68f]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setMode('calc')} className="underline cursor-pointer">
            Quay lại
          </button>
        </div>

        {(eqSubMode === 'quad' || eqSubMode === 'cubic') && (
          <div className={`grid gap-1 ${eqSubMode === 'quad' ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {[
              { lbl: 'a', val: props.qa, set: props.setQa },
              { lbl: 'b', val: props.qb, set: props.setQb },
              { lbl: 'c', val: props.qc, set: props.setQc },
              ...(eqSubMode === 'cubic' ? [{ lbl: 'd', val: props.qd, set: props.setQd }] : []),
            ].map((f) => (
              <label
                key={f.lbl}
                className="flex items-center gap-0.5 bg-[#e5eee0] focus-within:ring-2 focus-within:ring-indigo-600 rounded px-1 h-6 border border-[#9eb096]"
              >
                <span className="text-[9.5px] font-mono font-bold">{f.lbl}=</span>
                <input
                  type="text"
                  inputMode="decimal"
                  data-casio-field={`eq-${f.lbl}`}
                  aria-label={`Hệ số ${f.lbl}`}
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  className="w-full min-w-0 bg-transparent text-[10.5px] font-mono outline-none"
                />
              </label>
            ))}
          </div>
        )}

        {eqSubMode === 'sys2' && (
          <div className="grid grid-cols-3 gap-1">
            {['a₁', 'b₁', 'c₁', 'a₂', 'b₂', 'c₂'].map((lbl, idx) => (
              <input
                key={lbl}
                type="text"
                inputMode="decimal"
                data-casio-field={`sys2-${idx}`}
                aria-label={lbl}
                value={props.sys2[idx]}
                onChange={(e) => {
                  const next = [...props.sys2];
                  next[idx] = e.target.value;
                  props.setSys2(next);
                }}
                className="h-5 px-1 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#9eb096] text-[10px] font-mono outline-none"
              />
            ))}
          </div>
        )}

        {eqSubMode === 'sys3' && (
          <div className="grid grid-cols-4 gap-0.5">
            {props.sys3.map((row, ri) =>
              row.map((val, ci) => (
                <input
                  key={`s3-${ri}-${ci}`}
                  type="text"
                  inputMode="decimal"
                  data-casio-field={`sys3-${ri}-${ci}`}
                  aria-label={`Hệ 3 ẩn (${ri + 1},${ci + 1})`}
                  value={val}
                  onChange={(e) => {
                    const next = props.sys3.map((r, rIdx) =>
                      r.map((cVal, cIdx) => (rIdx === ri && cIdx === ci ? e.target.value : cVal))
                    );
                    props.setSys3(next);
                  }}
                  className="h-[18px] px-0.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#9eb096] text-[9.5px] font-mono text-center outline-none"
                />
              ))
            )}
          </div>
        )}

        <div
          data-testid="calculator-display-result"
          className="px-2 py-1 rounded bg-[#e5eee0] border border-[#a5b89d] text-[10.5px] text-slate-950 flex justify-end overflow-x-auto casio-lcd-no-scrollbar"
        >
          {eqSubMode === 'quad' && quadRes && <span className="font-mono font-bold">{quadRes.summary}</span>}
          {eqSubMode === 'cubic' && cubicRes && <MathTex latex={cubicRes.summaryLatex} />}
          {eqSubMode === 'sys2' && sys2Res && <MathTex latex={sys2Res.summaryLatex} />}
          {eqSubMode === 'sys3' && sys3Res && <MathTex latex={sys3Res.summaryLatex} />}
        </div>
      </div>
    );
  }

  // Mode 7: Inequality
  if (mode === 'ineq') {
    const res = solveQuadraticInequality(toNum(props.qa), toNum(props.qb), toNum(props.qc), props.ineqOp);
    return (
      <div className="p-2 min-h-[120px] space-y-1.5 text-slate-900">
        <div className="flex items-center justify-between text-[9.5px] font-bold">
          <span>7: Bất phương trình bậc 2</span>
          <div className="flex items-center gap-0.5">
            {(['>', '<', '>=', '<='] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => props.setIneqOp(op)}
                className={`px-1.5 rounded cursor-pointer ${
                  props.ineqOp === op ? 'bg-slate-800 text-[#e6f0e1]' : 'bg-[#e5eee0] border border-[#96a68f]'
                }`}
              >
                {op === '>=' ? '≥' : op === '<=' ? '≤' : op}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {[
            { lbl: 'a', val: props.qa, set: props.setQa },
            { lbl: 'b', val: props.qb, set: props.setQb },
            { lbl: 'c', val: props.qc, set: props.setQc },
          ].map((f) => (
            <label
              key={f.lbl}
              className="flex items-center gap-1 bg-[#e5eee0] focus-within:ring-2 focus-within:ring-indigo-600 rounded px-1.5 h-6 border border-[#9eb096]"
            >
              <span className="text-[10px] font-mono font-bold">{f.lbl}=</span>
              <input
                type="text"
                inputMode="decimal"
                data-casio-field={`ineq-${f.lbl}`}
                aria-label={`Bất PT ${f.lbl}`}
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                className="w-full min-w-0 bg-transparent text-[10.5px] font-mono outline-none"
              />
            </label>
          ))}
        </div>
        <div
          data-testid="calculator-display-result"
          className="px-2 py-1 rounded bg-[#e5eee0] border border-[#a5b89d] text-[11px] flex justify-end"
        >
          <MathTex latex={res.summaryLatex} />
        </div>
      </div>
    );
  }

  // Mode 8: Statistics 1-Var
  return (
    <div className="p-2 min-h-[120px] space-y-1 text-slate-900">
      <div className="flex items-center justify-between text-[9.5px] font-bold">
        <span>8: Thống kê 1 biến (nhập dãy số)</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => props.onInsertToken(', ')}
            className="px-1.5 py-0.5 rounded bg-slate-800 text-[#e6f0e1] text-[8.5px] cursor-pointer"
          >
            + Thêm số (,)
          </button>
          <button type="button" onClick={() => setMode('calc')} className="underline cursor-pointer">
            Thoát
          </button>
        </div>
      </div>
      <input
        type="text"
        data-casio-field="stats-raw"
        aria-label="Dãy số thống kê"
        value={props.statsRaw}
        onChange={(e) => props.setStatsRaw(e.target.value)}
        placeholder="VD: 5, 7, 8, 8, 9, 10"
        className="w-full h-6 px-1.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#9eb096] text-[10.5px] font-mono outline-none"
      />
      {props.statsResult ? (
        <div
          data-testid="calculator-display-result"
          className="grid grid-cols-3 gap-x-2 gap-y-0.5 px-2 py-1 rounded bg-[#e5eee0] border border-[#a5b89d] text-[9.5px] font-mono"
        >
          <span>n = <b>{props.statsResult.n}</b></span>
          <span>x̄ = <b>{Number(props.statsResult.mean.toFixed(3))}</b></span>
          <span>Med = <b>{Number(props.statsResult.median.toFixed(3))}</b></span>
          <span>σ = <b>{Number(props.statsResult.popStd.toFixed(3))}</b></span>
          <span>s = <b>{Number(props.statsResult.sampleStd.toFixed(3))}</b></span>
          <span>Q₁/Q₃ = {props.statsResult.q1}/{props.statsResult.q3}</span>
        </div>
      ) : (
        <div className="text-[10px] text-rose-700 font-semibold">Nhập các số cách nhau bằng dấu phẩy hoặc bấm nút + Thêm số</div>
      )}
    </div>
  );
};
