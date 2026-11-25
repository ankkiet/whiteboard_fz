import React from 'react';
import {
  CASIO_CONSTANTS,
  CASIO_CONVERSIONS,
  CasioAngleUnit,
  CasioBaseMode,
  CasioComplexValue,
  CasioDistKind,
  CasioEqFullResult,
  CasioLinRegResult,
  CasioNormMode,
  CasioStats1VarResult,
  CasioVerifyOp,
  computeCasioDistribution,
  computeMatrixDet,
  computeMatrixInverse,
  computeVectorMetrics,
  evaluateCasioBaseN,
  evaluateCasioComplex,
  evaluateCasioVerify,
  formatCasioExact,
  formatComplexLatex,
  matrixToLatex,
  multiplyMatrices,
  parseCasioCoeff,
  solveCasioRatio,
  solveCubicInequality,
  solveQuadraticInequality,
  subtractMatrices,
  transposeMatrix,
} from '../../engine/casio580Engine';
import { compileMathExpression } from '../../engine/mathUtils';
import { getCasioConstants, getCasioConversions } from '../../engine/casio580Engine';
import { useI18n } from '../../i18n/useI18n';
import { MathTex } from './MathTex';

export type CasioMainMode =
  | 'calc'
  | 'complex'
  | 'basen'
  | 'matrix'
  | 'vector'
  | 'stats'
  | 'dist'
  | 'table'
  | 'equation'
  | 'ineq'
  | 'verify'
  | 'ratio'
  | 'menu';

export type CasioEqSubMode = 'quad' | 'cubic' | 'quartic' | 'sys2' | 'sys3' | 'sys4';
export type CasioEqScreen = 'selectType' | 'selectSimulDeg' | 'selectPolyDeg' | 'input' | 'result';
export type CasioStatsSubMode = '1var' | 'linreg';
export type CasioStatsScreen = 'selectType' | 'input' | 'result';
export type CasioDistScreen = 'selectKind' | 'input' | 'result';
export type CasioTableScreen = 'input' | 'result';
export type CasioIneqScreen = 'selectDeg' | 'selectOp' | 'input' | 'result';
export type CasioRatioScreen = 'selectForm' | 'input' | 'result';
export type CasioVecOp = 'dot' | 'cross' | 'angle' | 'mag' | 'sumdiff' | 'unit';
export type CasioMatOp = 'det' | 'inv' | 'add' | 'sub' | 'mul' | 'trn' | 'sq';

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

  // Mode 2: Complex
  complexExpr: string;
  setComplexExpr: (v: string) => void;
  complexPolar: boolean;
  setComplexPolar: (v: boolean) => void;

  // Mode 3: Base-N
  baseMode: CasioBaseMode;
  setBaseMode: (b: CasioBaseMode) => void;
  baseExpr: string;
  setBaseExpr: (v: string) => void;

  // Mode 4: Matrix (2x2, 3x3, 4x4)
  matSize: 2 | 3 | 4;
  setMatSize: (n: 2 | 3 | 4) => void;
  matA: string[][];
  setMatA: (m: string[][]) => void;
  matB: string[][];
  setMatB: (m: string[][]) => void;
  matOp: CasioMatOp;
  setMatOp: (op: CasioMatOp) => void;

  // Mode 5: Vector
  vecDim: 2 | 3;
  setVecDim: (n: 2 | 3) => void;
  vecU: string[];
  setVecU: (v: string[]) => void;
  vecV: string[];
  setVecV: (v: string[]) => void;
  vecOp: CasioVecOp;
  setVecOp: (op: CasioVecOp) => void;

  // Mode 6: Stats (1-Var & Linear Regression y = a + bx)
  statsScreen: CasioStatsScreen;
  setStatsScreen: (sc: CasioStatsScreen) => void;
  statsSubMode: CasioStatsSubMode;
  setStatsSubMode: (s: CasioStatsSubMode) => void;
  statsRaw: string;
  setStatsRaw: (v: string) => void;
  statsPairs: { x: string; y: string }[];
  setStatsPairs: (p: { x: string; y: string }[]) => void;
  statsResult: CasioStats1VarResult | null;
  linRegResult: CasioLinRegResult | null;

  // Mode 7: Distribution
  distScreen: CasioDistScreen;
  setDistScreen: (sc: CasioDistScreen) => void;
  distKind: CasioDistKind;
  setDistKind: (k: CasioDistKind) => void;
  distX: string;
  setDistX: (v: string) => void;
  distLower: string;
  setDistLower: (v: string) => void;
  distUpper: string;
  setDistUpper: (v: string) => void;
  distMu: string;
  setDistMu: (v: string) => void;
  distSigma: string;
  setDistSigma: (v: string) => void;
  distArea: string;
  setDistArea: (v: string) => void;
  distN: string;
  setDistN: (v: string) => void;
  distP: string;
  setDistP: (v: string) => void;
  distLambda: string;
  setDistLambda: (v: string) => void;

  // Mode 8: Table f(x), g(x)
  tableScreen: CasioTableScreen;
  setTableScreen: (sc: CasioTableScreen) => void;
  tableExpr: string;
  setTableExpr: (v: string) => void;
  tableGExpr: string;
  setTableGExpr: (v: string) => void;
  tableStart: string;
  setTableStart: (v: string) => void;
  tableEnd: string;
  setTableEnd: (v: string) => void;
  tableStep: string;
  setTableStep: (v: string) => void;

  // Mode 9: Equation
  eqScreen: CasioEqScreen;
  setEqScreen: (sc: CasioEqScreen) => void;
  eqSubMode: CasioEqSubMode;
  setEqSubMode: (s: CasioEqSubMode) => void;
  eqResult: CasioEqFullResult | null;
  eqResultIdx: number;
  setEqResultIdx: (i: number) => void;
  eqShowDecimal: boolean;
  onSolveEquationMode: () => void;
  qa: string;
  setQa: (v: string) => void;
  qb: string;
  setQb: (v: string) => void;
  qc: string;
  setQc: (v: string) => void;
  qd: string;
  setQd: (v: string) => void;
  qe: string;
  setQe: (v: string) => void;
  sys2: string[];
  setSys2: (v: string[]) => void;
  sys3: string[][];
  setSys3: (v: string[][]) => void;
  sys4: string[][];
  setSys4: (v: string[][]) => void;

  // Mode A: Inequality
  ineqScreen: CasioIneqScreen;
  setIneqScreen: (sc: CasioIneqScreen) => void;
  ineqDegree: 2 | 3;
  setIneqDegree: (d: 2 | 3) => void;
  ineqOp: '>' | '<' | '>=' | '<=';
  setIneqOp: (op: '>' | '<' | '>=' | '<=') => void;

  // Mode B: Verify
  verifyLhs: string;
  setVerifyLhs: (v: string) => void;
  verifyOp: CasioVerifyOp;
  setVerifyOp: (op: CasioVerifyOp) => void;
  verifyRhs: string;
  setVerifyRhs: (v: string) => void;
  verifyEvaluated: boolean;
  setVerifyEvaluated: (v: boolean) => void;

  // Mode C: Ratio
  ratioScreen: CasioRatioScreen;
  setRatioScreen: (sc: CasioRatioScreen) => void;
  ratioUnknown: 'c' | 'd';
  setRatioUnknown: (u: 'c' | 'd') => void;
  ratioA: string;
  setRatioA: (v: string) => void;
  ratioB: string;
  setRatioB: (v: string) => void;
  ratioC: string;
  setRatioC: (v: string) => void;
  ratioD: string;
  setRatioD: (v: string) => void;
  ratioShowDecimal: boolean;

  // CALC prompt
  calcVarsList: string[];
  calcVarInputs: Record<string, string>;
  onSetCalcVarInput: (k: string, raw: string) => void;
  onEvalCalcPrompt: () => void;
}

export const CasioLcdModes: React.FC<CasioLcdModesProps> = (props) => {
  const { language, t } = useI18n();
  const { mode, setMode, overlay, setOverlay } = props;
  const casioConstants = getCasioConstants(language);
  const casioConversions = getCasioConversions(language);

  // Overlays inside the LCD (SETUP, CONST, CONV, RECALL, OPTN, CALC prompt, HELP)
  if (overlay === 'setup') {
    const angleOrder: CasioAngleUnit[] = ['D', 'R', 'G'];
    const angleLabel: Record<CasioAngleUnit, string> = {
      D: t('DEG (Độ)', 'DEG (Deg)'),
      R: 'RAD',
      G: 'GRAD',
    };
    return (
      <div className="p-2 min-h-[120px] space-y-1.5 text-[#1e345a]">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>{t('Cài đặt máy tính (SETUP)', 'Calculator settings (SETUP)')}</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            {t('Đóng', 'Close')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => {
              const next = angleOrder[(angleOrder.indexOf(props.angleUnit) + 1) % angleOrder.length];
              props.setAngleUnit(next);
            }}
            className="px-2 py-1 rounded bg-[#e5eee0] border border-[#96a68f] font-semibold cursor-pointer text-left"
          >
            {t('Đơn vị góc:', 'Angle unit:')} <b>{angleLabel[props.angleUnit]}</b>
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
            {t('Làm tròn:', 'Rounding:')} <b>{props.normMode}</b>
          </button>
        </div>
        {props.normMode !== 'NORM' && (
          <div className="flex items-center justify-between bg-[#e5eee0] rounded px-2 py-1 border border-[#96a68f] text-[10px]">
            <span>{t(`Số chữ số (${props.normMode}):`, `Digits (${props.normMode}):`)}</span>
            <div className="flex items-center gap-1">
              {[2, 3, 4, 6, 8].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => props.setFixDigits(d)}
                  className={`px-1.5 rounded font-mono font-bold cursor-pointer ${
                    props.fixDigits === d ? 'bg-[#1e345a] text-[#e6f0e1]' : 'bg-white/70'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between bg-[#e5eee0] rounded px-2 py-1 border border-[#96a68f] text-[10px]">
          <span>{t('Vỏ máy:', 'Body theme:')}</span>
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'carbon', label: t('Đen', 'Black') },
                { id: 'navy', label: t('Xanh', 'Navy') },
                { id: 'silver', label: t('Bạc', 'Silver') },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => props.setChassisTheme(item.id)}
                className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${
                  props.chassisTheme === item.id ? 'bg-[#1e345a] text-[#e6f0e1]' : 'bg-white/70'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (overlay === 'const') {
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>{t('Hằng số vật lý & hóa học (CONST)', 'Scientific constants (CONST)')}</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            {t('Đóng', 'Close')}
          </button>
        </div>
        <div className="max-h-[96px] overflow-y-auto casio-lcd-no-scrollbar grid grid-cols-2 gap-1">
          {casioConstants.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                props.onInsertToken(c.token);
                setOverlay(null);
              }}
              className="px-1.5 py-1 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[9.5px] cursor-pointer"
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
      <div className="p-2 min-h-[120px] space-y-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>{t(`Chuyển đổi đơn vị (CONV · Ans = ${Number(props.ansVal.toFixed(4))})`, `Unit conversion (CONV · Ans = ${Number(props.ansVal.toFixed(4))})`)}</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            {t('Đóng', 'Close')}
          </button>
        </div>
        <div className="max-h-[96px] overflow-y-auto casio-lcd-no-scrollbar grid grid-cols-2 gap-1">
          {casioConversions.map((conv) => {
            const converted = conv.convert(props.ansVal);
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => {
                  props.onApplyConversion(converted, `${props.ansVal} ${conv.fromUnit} → ${conv.toUnit}`);
                  setOverlay(null);
                }}
                className="px-1.5 py-1 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[9.5px] cursor-pointer"
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
      <div className="p-2 min-h-[120px] space-y-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>{t('Biến nhớ (RECALL · bấm để chèn)', 'Memory variables (RECALL · click to insert)')}</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            {t('Đóng', 'Close')}
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
              className="px-1 py-1 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-center text-[9.5px] font-mono cursor-pointer"
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
      { id: 'fact', label: t('FACT (Thừa số NT)', 'FACT (Prime factors)') },
      { id: 'divR', label: t('a ÷R b (Chia có dư)', 'a ÷R b (Remainder)') },
      { id: 'pol', label: 'Pol(x; y)' },
      { id: 'rec', label: 'Rec(r; θ)' },
      { id: 'gcd', label: 'GCD(a; b)' },
      { id: 'lcm', label: 'LCM(a; b)' },
      { id: 'dms', label: t(`Đổi ° ' " (DMS)`, `Convert ° ' " (DMS)`) },
      { id: 'eng', label: t('Đổi ENG (×10³ⁿ)', 'Format ENG (×10³ⁿ)') },
    ];
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>{t('Tùy chọn nhanh (OPTN)', 'Quick options (OPTN)')}</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            {t('Đóng', 'Close')}
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
              className="px-1.5 py-1 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[9.5px] font-semibold cursor-pointer"
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
      <div className="p-2 min-h-[120px] space-y-1.5 text-[#1e345a]">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span>{t('CALC · nhập giá trị biến (bấm phím Casio hoặc gõ)', 'CALC · enter variable values')}</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            {t('Hủy', 'Cancel')}
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
          className="w-full h-6 rounded bg-[#1e345a] text-[#e6f0e1] text-[10.5px] font-bold cursor-pointer"
        >
          {t('Tính giá trị biểu thức (=)', 'Evaluate expression (=)')}
        </button>
      </div>
    );
  }

  if (overlay === 'help') {
    return (
      <div className="p-2 min-h-[120px] space-y-1 text-[#1e345a] text-[9.5px] leading-snug">
        <div className="flex items-center justify-between font-bold text-[10px]">
          <span>{t('Hướng dẫn Casio fx-580VN X', 'Casio fx-580VN X Guide')}</span>
          <button type="button" onClick={() => setOverlay(null)} className="underline cursor-pointer">
            {t('Đóng', 'Close')}
          </button>
        </div>
        <p>
          • <b>MENU + 1..9, (−), ° ' ", x⁻¹</b>:{' '}
          {t('Mở nhanh đúng 12 chế độ chuẩn fx-580VN X.', 'Quickly open all 12 fx-580VN X modes.')}
        </p>
        <p>
          • <b>Mode 9, 6, 7, A, C</b>:{' '}
          {t(
            'Bấm trực tiếp phím số theo menu từng bước giống máy thật; bấm = để sang ô / giải; AC quay lại sửa.',
            'Press number keys step-by-step like the real calculator; press = to advance/solve; AC to edit.'
          )}
        </p>
        <p>
          • <b>{t('Mode 3 (Cơ số n)', 'Mode 3 (Base-N)')}</b>:{' '}
          {t(
            'Phím x²(DEC), x^□(HEX), log□(BIN), ln(OCT); SHIFT+OPTN dán LaTeX lên bảng.',
            'Keys x²(DEC), x^□(HEX), log□(BIN), ln(OCT); SHIFT+OPTN stamps LaTeX to board.'
          )}
        </p>
      </div>
    );
  }

  // MENU Grid — Authentic 12 Casio fx-580VN X modes (1..9, A, B, C)
  if (mode === 'menu') {
    const items: { id: CasioMainMode; num: string; title: string }[] = [
      { id: 'calc', num: '1', title: t('Tính toán', 'Calculate') },
      { id: 'complex', num: '2', title: t('Số phức', 'Complex') },
      { id: 'basen', num: '3', title: t('Cơ số n', 'Base-N') },
      { id: 'matrix', num: '4', title: t('Ma trận', 'Matrix') },
      { id: 'vector', num: '5', title: t('Vectơ', 'Vector') },
      { id: 'stats', num: '6', title: t('Thống kê', 'Statistics') },
      { id: 'dist', num: '7', title: t('Phân phối', 'Distribution') },
      { id: 'table', num: '8', title: t('Bảng f(x)', 'Table') },
      { id: 'equation', num: '9', title: t('Phương trình', 'Equation/Func') },
      { id: 'ineq', num: 'A', title: t('Bất PT', 'Inequality') },
      { id: 'verify', num: 'B', title: t('Đúng / Sai', 'Verify') },
      { id: 'ratio', num: 'C', title: t('Tỉ lệ thức', 'Ratio') },
    ];
    return (
      <div className="p-1.5 min-h-[120px] grid grid-cols-3 gap-1 text-[#1e345a]">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            className="px-1.5 py-1 rounded bg-[#c6d4bf] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[9.5px] font-bold transition-colors cursor-pointer flex items-center gap-1"
          >
            <span className="w-3.5 h-3.5 rounded-sm bg-[#1e345a] text-[#e6f0e1] text-[8.5px] font-mono flex items-center justify-center shrink-0">
              {item.num}
            </span>
            <span className="truncate">{item.title}</span>
          </button>
        ))}
      </div>
    );
  }

  // Mode 2: Complex Numbers (authentic OPTN bar + LCD split display)
  if (mode === 'complex') {
    const cmpVal: CasioComplexValue | null = evaluateCasioComplex(props.complexExpr, props.angleUnit);
    const modVal = cmpVal ? Math.hypot(cmpVal.re, cmpVal.im) : NaN;
    const quickTokens = [
      { lbl: 'i', tok: 'i' },
      { lbl: '∠', tok: '∠' },
      { lbl: 'Arg', tok: 'Arg(' },
      { lbl: 'Conjg', tok: 'Conjg(' },
      { lbl: 'Abs', tok: 'Abs(' },
    ];
    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5 flex-wrap">
            {quickTokens.map((q) => (
              <button
                key={q.lbl}
                type="button"
                onClick={() => props.onInsertToken(q.tok)}
                className="px-1.5 py-0.5 rounded bg-[#c6d4bf] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-[8.5px] font-mono font-bold cursor-pointer"
              >
                {q.lbl}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => props.setComplexPolar(!props.complexPolar)}
            title={t('Đổi dạng đại số a+bi ↔ lượng giác r∠θ', 'Toggle rectangular a+bi ↔ polar r∠θ')}
            className="px-1.5 py-0.5 rounded bg-[#1e345a] text-[#e6f0e1] text-[8.5px] font-mono font-bold cursor-pointer shrink-0"
          >
            {props.complexPolar ? 'r∠θ' : 'a+bi'}
          </button>
        </div>

        <input
          type="text"
          data-casio-field="complex-expr"
          aria-label={t('Biểu thức số phức', 'Complex expression')}
          autoFocus
          value={props.complexExpr}
          onChange={(e) => props.setComplexExpr(e.target.value)}
          className="casio-math-font w-full h-7 px-1.5 bg-transparent text-[16px] text-[#1e345a] outline-none"
        />

        <div
          data-testid="calculator-display-result"
          className="min-h-[28px] border-t border-[#b8c8b0]/80 pt-1 flex items-center justify-between gap-2 overflow-x-auto casio-lcd-no-scrollbar"
        >
          {cmpVal ? (
            <>
              <span className="text-[9px] font-mono opacity-75 shrink-0">
                |z| = {Number(modVal.toFixed(4))}
              </span>
              <MathTex
                latex={formatComplexLatex(cmpVal, props.complexPolar, props.angleUnit)}
                className="text-[15.5px] font-bold text-[#1e345a]"
              />
            </>
          ) : props.complexExpr.trim() ? (
            <span className="text-rose-700 text-[10.5px] font-mono font-bold ml-auto">Syntax ERROR</span>
          ) : (
            <span className="text-[11px] font-mono opacity-40 ml-auto">0</span>
          )}
        </div>
      </div>
    );
  }

  // Mode 3: Base-N (DEC / HEX / BIN / OCT with authentic Casio big active-base readout & x²/x^□/log/ln shortcuts)
  if (mode === 'basen') {
    const res = evaluateCasioBaseN(props.baseExpr, props.baseMode);
    const bases: CasioBaseMode[] = ['DEC', 'HEX', 'BIN', 'OCT'];
    const activeVal = res
      ? props.baseMode === 'DEC'
        ? res.dec
        : props.baseMode === 'HEX'
          ? res.hex
          : props.baseMode === 'BIN'
            ? res.bin
            : res.oct
      : '0';
    const baseTag: Record<CasioBaseMode, string> = {
      DEC: 'Dec',
      HEX: 'Hex',
      BIN: 'Bin',
      OCT: 'Oct',
    };

    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5">
            {bases.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  props.setBaseMode(b);
                  if (res) {
                    const nextVal = b === 'DEC' ? res.dec : b === 'HEX' ? res.hex : b === 'BIN' ? res.bin : res.oct;
                    props.setBaseExpr(nextVal);
                  }
                }}
                className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold cursor-pointer ${
                  props.baseMode === b ? 'bg-[#1e345a] text-[#e6f0e1]' : 'bg-[#e5eee0] border border-[#96a68f]'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            {(['AND', 'OR', 'XOR', 'NOT'] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => props.onInsertToken(op === 'NOT' ? 'NOT ' : ` ${op} `)}
                className="px-1 py-0.5 rounded bg-[#c6d4bf] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-[7.5px] font-mono font-bold cursor-pointer"
              >
                {op}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          data-casio-field="basen-expr"
          aria-label={t('Biểu thức cơ số n', 'Base-N expression')}
          value={props.baseExpr}
          onChange={(e) => props.setBaseExpr(e.target.value)}
          className="w-full h-6 px-1.5 rounded bg-[#e5eee0] focus:ring-1 focus:ring-indigo-600 border border-[#96a68f] text-[12px] font-mono font-bold outline-none"
        />

        <div
          data-testid="calculator-display-result"
          className="border-t border-[#b8c8b0]/80 pt-1 space-y-0.5"
        >
          {res || !props.baseExpr.trim() ? (
            <>
              <div className="flex items-baseline justify-between gap-2 overflow-x-auto casio-lcd-no-scrollbar">
                <span className="text-[8.5px] font-mono px-1 rounded bg-[#1e345a] text-[#e6f0e1] shrink-0">
                  {baseTag[props.baseMode]}
                </span>
                <span className="text-[15px] font-mono font-extrabold tracking-tight text-[#1e345a]">
                  {activeVal}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[8px] font-mono opacity-80">
                {bases
                  .filter((b) => b !== props.baseMode)
                  .map((b) => {
                    const v = res
                      ? b === 'DEC'
                        ? res.dec
                        : b === 'HEX'
                          ? res.hex
                          : b === 'BIN'
                            ? res.bin
                            : res.oct
                      : '0';
                    return (
                      <span key={b} className="truncate" title={`${b}: ${v}`}>
                        {b}: <b>{v}</b>
                      </span>
                    );
                  })}
              </div>
            </>
          ) : (
            <div className="text-right text-rose-700 text-[10px] font-mono font-bold">
              Syntax ERROR ({props.baseMode})
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mode 4: Matrix (2×2, 3×3, 4×4 with Casio row/col indices + MatA² + Trn + parseCasioCoeff)
  if (mode === 'matrix') {
    const { matSize, matA, matB, matOp } = props;
    const numA = matA.map((r) => r.map(parseCasioCoeff));
    const numB = matB.map((r) => r.map(parseCasioCoeff));
    const detA = computeMatrixDet(numA);
    const invA = matOp === 'inv' ? computeMatrixInverse(numA) : null;
    const sumMat = matOp === 'add' ? numA.map((r, ri) => r.map((v, ci) => v + numB[ri][ci])) : null;
    const subMat = matOp === 'sub' ? subtractMatrices(numA, numB) : null;
    const mulMat = matOp === 'mul' ? multiplyMatrices(numA, numB) : null;
    const trnMat = matOp === 'trn' ? transposeMatrix(numA) : null;
    const sqMat = matOp === 'sq' ? multiplyMatrices(numA, numA) : null;

    const updateCell = (which: 'A' | 'B', r: number, c: number, rawVal: string) => {
      const target = which === 'A' ? matA : matB;
      const next = target.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? rawVal : cell)));
      if (which === 'A') props.setMatA(next);
      else props.setMatB(next);
    };

    const resizeMat = (n: 2 | 3 | 4) => {
      props.setMatSize(n);
      const make = (src: string[][]) =>
        Array.from({ length: n }, (_, r) =>
          Array.from({ length: n }, (__, c) => src[r]?.[c] ?? '0')
        );
      props.setMatA(make(matA));
      props.setMatB(make(matB));
    };

    const nextSize: 2 | 3 | 4 = matSize === 2 ? 3 : matSize === 3 ? 4 : 2;
    const gridColsClass = matSize === 2 ? 'grid-cols-2' : matSize === 3 ? 'grid-cols-3' : 'grid-cols-4';
    const cellHeightClass = matSize === 4 ? 'h-4 text-[8px]' : 'h-5 text-[9.5px]';
    const showMatB = matOp === 'add' || matOp === 'sub' || matOp === 'mul';

    return (
      <div className="p-2 min-h-[120px] space-y-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[8.5px] font-bold gap-1">
          <div className="flex items-center gap-1 shrink-0">
            <span>4: Mat</span>
            <button
              type="button"
              onClick={() => resizeMat(nextSize)}
              title={t('Đổi kích thước 2×2 / 3×3 / 4×4', 'Resize 2×2 / 3×3 / 4×4')}
              className="px-1 rounded bg-[#1e345a] text-[#e6f0e1] cursor-pointer"
            >
              {matSize}×{matSize}
            </button>
          </div>
          <div className="flex items-center gap-0.5 flex-wrap justify-end">
            {(
              [
                { id: 'det', lbl: 'det' },
                { id: 'inv', lbl: 'A⁻¹' },
                { id: 'sq', lbl: 'A²' },
                { id: 'trn', lbl: 'Trn' },
                { id: 'add', lbl: 'A+B' },
                { id: 'sub', lbl: 'A−B' },
                { id: 'mul', lbl: 'A×B' },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => props.setMatOp(op.id)}
                className={`px-1 rounded text-[8px] cursor-pointer ${
                  matOp === op.id ? 'bg-[#1e345a] text-[#e6f0e1]' : 'bg-[#e5eee0] border border-[#96a68f]'
                }`}
              >
                {op.lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[8px] font-mono font-bold opacity-80">
              <span>MatA</span>
              <span>{Array.from({ length: matSize }, (_, i) => i + 1).join(' · ')}</span>
            </div>
            <div className={`grid gap-0.5 ${gridColsClass}`}>
              {matA.map((row, r) =>
                row.map((val, c) => (
                  <input
                    key={`a-${r}-${c}`}
                    type="text"
                    data-casio-field={`matA-${r}-${c}`}
                    aria-label={`MatA(${r + 1},${c + 1})`}
                    value={val}
                    onChange={(e) => updateCell('A', r, c, e.target.value)}
                    className={`${cellHeightClass} px-0.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#96a68f] font-mono text-center outline-none`}
                  />
                ))
              )}
            </div>
          </div>
          {showMatB && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[8px] font-mono font-bold opacity-80">
                <span>MatB</span>
                <span>{Array.from({ length: matSize }, (_, i) => i + 1).join(' · ')}</span>
              </div>
              <div className={`grid gap-0.5 ${gridColsClass}`}>
                {matB.map((row, r) =>
                  row.map((val, c) => (
                    <input
                      key={`b-${r}-${c}`}
                      type="text"
                      data-casio-field={`matB-${r}-${c}`}
                      aria-label={`MatB(${r + 1},${c + 1})`}
                      value={val}
                      onChange={(e) => updateCell('B', r, c, e.target.value)}
                      className={`${cellHeightClass} px-0.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#96a68f] font-mono text-center outline-none`}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div
          data-testid="calculator-display-result"
          className="px-2 py-0.5 rounded bg-[#e5eee0] border border-[#a5b89d] text-[10px] flex justify-end overflow-x-auto casio-lcd-no-scrollbar"
        >
          {matOp === 'det' && <MathTex latex={`\\det(A) = ${formatCasioExact(detA).exactLatex}`} />}
          {matOp === 'inv' &&
            (invA ? (
              <MathTex latex={`A^{-1} = ${matrixToLatex(invA)}`} />
            ) : (
              <span className="text-rose-700 font-mono font-bold">Math ERROR (det = 0)</span>
            ))}
          {matOp === 'sq' && sqMat && <MathTex latex={`A^{2} = ${matrixToLatex(sqMat)}`} />}
          {matOp === 'add' && sumMat && <MathTex latex={matrixToLatex(sumMat)} />}
          {matOp === 'sub' && subMat && <MathTex latex={matrixToLatex(subMat)} />}
          {matOp === 'mul' && mulMat && <MathTex latex={matrixToLatex(mulMat)} />}
          {matOp === 'trn' && trnMat && <MathTex latex={`A^{T} = ${matrixToLatex(trnMat)}`} />}
        </div>
      </div>
    );
  }

  // Mode 5: Vector (2D / 3D with authentic OPTN vector selector: u·v, u×v, ∠, |u|, u±v, û)
  if (mode === 'vector') {
    const { vecDim, vecU, vecV, vecOp, setVecOp } = props;
    const numU = vecU.slice(0, vecDim).map(parseCasioCoeff);
    const numV = vecV.slice(0, vecDim).map(parseCasioCoeff);
    const res = computeVectorMetrics(numU, numV, props.angleUnit);
    const unitTxt = props.angleUnit === 'D' ? '^\\circ' : props.angleUnit === 'G' ? '^g' : '\\text{ rad}';
    const axisLabels = vecDim === 2 ? ['x', 'y'] : ['x', 'y', 'z'];

    const fmtCoord = (arr: number[]) =>
      `\\left(${arr.map((n) => {
        const rep = formatCasioExact(n);
        return rep.hasExactForm ? rep.exactLatex : Number(n.toFixed(3)).toString();
      }).join(';\\;')}\\right)`;

    let vecResultLatex = '';
    if (vecOp === 'dot') {
      const r = formatCasioExact(res.dot);
      vecResultLatex = `\\vec{u}\\cdot\\vec{v} = ${r.hasExactForm ? r.exactLatex : r.decimalText}`;
    } else if (vecOp === 'cross') {
      vecResultLatex =
        vecDim === 3
          ? `[\\vec{u},\\vec{v}] = ${fmtCoord(res.cross)}`
          : `\\det(\\vec{u},\\vec{v}) = ${formatCasioExact(res.cross[0]).exactLatex}`;
    } else if (vecOp === 'angle') {
      vecResultLatex = Number.isFinite(res.angle)
        ? `\\angle(\\vec{u},\\vec{v}) = ${Number(res.angle.toFixed(3))}${unitTxt}`
        : `\\text{${t('Chưa xác định', 'Undefined')}}`;
    } else if (vecOp === 'mag') {
      const ru = formatCasioExact(res.magU);
      const rv = formatCasioExact(res.magV);
      vecResultLatex = `|\\vec{u}|=${ru.hasExactForm ? ru.exactLatex : Number(res.magU.toFixed(3))},\\; |\\vec{v}|=${rv.hasExactForm ? rv.exactLatex : Number(res.magV.toFixed(3))}`;
    } else if (vecOp === 'sumdiff') {
      vecResultLatex = `\\vec{u}+\\vec{v}=${fmtCoord(res.sum)}`;
    } else {
      vecResultLatex = res.unitU
        ? `\\hat{u} = ${fmtCoord(res.unitU)}`
        : '\\text{Math ERROR (}|\\vec{u}|=0\\text{)}';
    }

    return (
      <div className="p-2 min-h-[120px] space-y-1 text-[#1e345a]">
        <div className="flex items-center justify-between gap-1 text-[8.5px] font-bold">
          <div className="flex items-center gap-1 shrink-0">
            <span>5: Vct</span>
            <button
              type="button"
              onClick={() => props.setVecDim(vecDim === 2 ? 3 : 2)}
              className="px-1 rounded bg-[#1e345a] text-[#e6f0e1] cursor-pointer"
            >
              {vecDim}D
            </button>
          </div>
          <div className="flex items-center gap-0.5 flex-wrap justify-end">
            {(
              [
                { id: 'dot', lbl: 'u·v' },
                { id: 'cross', lbl: 'u×v' },
                { id: 'angle', lbl: '∠' },
                { id: 'mag', lbl: '|u|' },
                { id: 'sumdiff', lbl: 'u+v' },
                { id: 'unit', lbl: 'û' },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setVecOp(op.id)}
                className={`px-1 rounded text-[8px] cursor-pointer ${
                  vecOp === op.id ? 'bg-[#1e345a] text-[#e6f0e1]' : 'bg-[#e5eee0] border border-[#96a68f]'
                }`}
              >
                {op.lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <div className="text-[8px] font-mono font-bold opacity-80">VctA (u)</div>
            <div className={`grid gap-0.5 ${vecDim === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {vecU.slice(0, vecDim).map((val, i) => (
                <label
                  key={`u-${i}`}
                  className="flex flex-col bg-[#e5eee0] focus-within:ring-1 focus-within:ring-indigo-600 rounded border border-[#96a68f] px-0.5"
                >
                  <span className="text-[7px] casio-math-var text-center leading-none pt-0.5 opacity-75">
                    {axisLabels[i]}
                  </span>
                  <input
                    type="text"
                    data-casio-field={`vecU-${i}`}
                    aria-label={`u_${axisLabels[i]}`}
                    value={val}
                    onChange={(e) => {
                      const next = [...vecU];
                      next[i] = e.target.value;
                      props.setVecU(next);
                    }}
                    className="h-4.5 w-full bg-transparent text-[9.5px] font-mono text-center outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[8px] font-mono font-bold opacity-80">VctB (v)</div>
            <div className={`grid gap-0.5 ${vecDim === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {vecV.slice(0, vecDim).map((val, i) => (
                <label
                  key={`v-${i}`}
                  className="flex flex-col bg-[#e5eee0] focus-within:ring-1 focus-within:ring-indigo-600 rounded border border-[#96a68f] px-0.5"
                >
                  <span className="text-[7px] casio-math-var text-center leading-none pt-0.5 opacity-75">
                    {axisLabels[i]}
                  </span>
                  <input
                    type="text"
                    data-casio-field={`vecV-${i}`}
                    aria-label={`v_${axisLabels[i]}`}
                    value={val}
                    onChange={(e) => {
                      const next = [...vecV];
                      next[i] = e.target.value;
                      props.setVecV(next);
                    }}
                    className="h-4.5 w-full bg-transparent text-[9.5px] font-mono text-center outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div
          data-testid="calculator-display-result"
          className="px-2 py-1 rounded bg-[#e5eee0] border border-[#a5b89d] text-[10.5px] flex justify-end overflow-x-auto casio-lcd-no-scrollbar"
        >
          <MathTex latex={vecResultLatex} />
        </div>
      </div>
    );
  }

  // Mode 6: Statistics (MENU 6 -> 1: 1-Variable | 2: y = a + bx Linear Regression -> Input -> Result)
  if (mode === 'stats') {
    const { statsScreen, setStatsScreen, statsSubMode, setStatsSubMode } = props;

    if (statsScreen === 'selectType') {
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between text-[#1e345a]">
          <div className="flex items-center justify-between text-[9.5px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>{t('6: Thống kê (Statistics)', '6: Statistics')}</span>
            <button type="button" onClick={() => setMode('calc')} className="underline cursor-pointer">
              {t('Thoát', 'Exit')}
            </button>
          </div>
          <div className="space-y-1.5 my-1">
            <button
              type="button"
              onClick={() => {
                setStatsSubMode('1var');
                setStatsScreen('input');
              }}
              className="w-full px-2 py-1.5 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[10.5px] font-bold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span className="w-4 h-4 rounded-sm bg-[#1e345a] text-[#e6f0e1] text-[9.5px] font-mono flex items-center justify-center shrink-0">
                1
              </span>
              <span>{t('1-Variable (Thống kê 1 biến)', '1-Variable statistics')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatsSubMode('linreg');
                setStatsScreen('input');
              }}
              className="w-full px-2 py-1.5 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[10.5px] font-bold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span className="w-4 h-4 rounded-sm bg-[#1e345a] text-[#e6f0e1] text-[9.5px] font-mono flex items-center justify-center shrink-0">
                2
              </span>
              <span>{t('y = a + bx (Hồi quy tuyến tính)', 'y = a + bx (Linear regression)')}</span>
            </button>
          </div>
          <div className="text-[8.5px] font-mono opacity-75">{t('Bấm phím 1 hoặc 2', 'Press key 1 or 2')}</div>
        </div>
      );
    }

    if (statsScreen === 'result') {
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
          <div className="flex items-center justify-between text-[9px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>
              {statsSubMode === '1var'
                ? t('Kết quả 1-Variable', '1-Variable results')
                : t('Kết quả hồi quy y = a + bx', 'Regression y = a + bx')}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStatsScreen('input')}
                className="px-1.5 py-0.5 rounded bg-[#e5eee0] border border-[#96a68f] text-[8.5px] cursor-pointer"
              >
                {t('Sửa (AC)', 'Edit (AC)')}
              </button>
              <button type="button" onClick={() => setStatsScreen('selectType')} className="underline cursor-pointer">
                {t('Đổi loại', 'Change type')}
              </button>
            </div>
          </div>

          {statsSubMode === '1var' ? (
            props.statsResult ? (
              <div
                data-testid="calculator-display-result"
                className="grid grid-cols-3 gap-x-2 gap-y-1 px-2 py-1.5 rounded bg-[#e5eee0] border border-[#a5b89d] text-[9.5px] font-mono"
              >
                <span>x̄ = <b>{Number(props.statsResult.mean.toFixed(4))}</b></span>
                <span>Σx = <b>{Number(props.statsResult.sumX.toFixed(3))}</b></span>
                <span>n = <b>{props.statsResult.n}</b></span>
                <span>σx = <b>{Number(props.statsResult.popStd.toFixed(4))}</b></span>
                <span>sx = <b>{Number(props.statsResult.sampleStd.toFixed(4))}</b></span>
                <span>Med = <b>{Number(props.statsResult.median.toFixed(3))}</b></span>
                <span>Min = {props.statsResult.min}</span>
                <span>Q₁/Q₃ = {props.statsResult.q1}/{props.statsResult.q3}</span>
                <span>Max = {props.statsResult.max}</span>
              </div>
            ) : (
              <div className="text-center text-rose-700 text-[10.5px] font-bold py-4">
                {t('Chưa có dữ liệu hợp lệ', 'No valid data')}
              </div>
            )
          ) : props.linRegResult ? (
            <div
              data-testid="calculator-display-result"
              className="grid grid-cols-2 gap-x-2 gap-y-1 px-2 py-1.5 rounded bg-[#e5eee0] border border-[#a5b89d] text-[10px] font-mono"
            >
              <span>a = <b>{Number(props.linRegResult.a.toFixed(5))}</b></span>
              <span>b = <b>{Number(props.linRegResult.b.toFixed(5))}</b></span>
              <span>r = <b>{Number(props.linRegResult.r.toFixed(5))}</b></span>
              <span>r² = <b>{Number(props.linRegResult.r2.toFixed(5))}</b></span>
              <span>x̄ = {Number(props.linRegResult.meanX.toFixed(3))}</span>
              <span>ȳ = {Number(props.linRegResult.meanY.toFixed(3))}</span>
            </div>
          ) : (
            <div className="text-center text-rose-700 text-[10.5px] font-bold py-4">
              {t('Cần tối thiểu 2 cặp (x, y) có x khác nhau', 'Need at least 2 (x, y) pairs with distinct x')}
            </div>
          )}
        </div>
      );
    }

    // Input screen for Mode 6
    if (statsSubMode === '1var') {
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
          <div className="flex items-center justify-between text-[9px] font-bold">
            <div className="flex items-center gap-1">
              <span>6: 1-Variable</span>
              <button
                type="button"
                onClick={() => setStatsScreen('selectType')}
                className="px-1 py-0.5 rounded bg-[#c6d4bf] border border-[#96a68f] text-[8px] cursor-pointer"
              >
                {t('Đổi loại', 'Change type')}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => props.onInsertToken(', ')}
                className="px-1.5 py-0.5 rounded bg-[#e5eee0] border border-[#96a68f] text-[8.5px] cursor-pointer"
              >
                {t('+ Số (,)', '+ Num (,)')}
              </button>
              <button
                type="button"
                onClick={() => setStatsScreen('result')}
                className="px-2 py-0.5 rounded bg-[#1e345a] text-[#e6f0e1] text-[8.5px] cursor-pointer"
              >
                {t('Tính (=)', 'Calc (=)')}
              </button>
            </div>
          </div>
          <input
            type="text"
            data-casio-field="stats-raw"
            aria-label={t('Dãy số thống kê', 'Statistics data list')}
            value={props.statsRaw}
            onChange={(e) => props.setStatsRaw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setStatsScreen('result');
              }
            }}
            placeholder={t('Nhập các số cách nhau bằng dấu phẩy...', 'Enter comma-separated numbers...')}
            className="w-full h-7 px-1.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#9eb096] text-[11px] font-mono outline-none"
          />
          <div className="text-[8.5px] font-mono opacity-75 flex justify-between">
            <span>{t('Đã nhập:', 'Entered:')} <b>{props.statsResult?.n ?? 0}</b> {t('giá trị', 'values')}</span>
            <span>{t('Bấm Tính (=) để xem x̄, σ, Q₁..Q₃', 'Press Calc (=) for x̄, σ, Q₁..Q₃')}</span>
          </div>
        </div>
      );
    }

    // Input screen for Linear Regression (2-column Casio table x | y)
    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[9px] font-bold">
          <div className="flex items-center gap-1">
            <span>6: y = a + bx</span>
            <button
              type="button"
              onClick={() => setStatsScreen('selectType')}
              className="px-1 py-0.5 rounded bg-[#c6d4bf] border border-[#96a68f] text-[8px] cursor-pointer"
            >
              {t('Đổi loại', 'Change type')}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => props.setStatsPairs([...props.statsPairs, { x: '', y: '' }])}
              className="px-1.5 py-0.5 rounded bg-[#e5eee0] border border-[#96a68f] text-[8.5px] cursor-pointer"
            >
              {t('+ Dòng', '+ Row')}
            </button>
            <button
              type="button"
              onClick={() => setStatsScreen('result')}
              className="px-2 py-0.5 rounded bg-[#1e345a] text-[#e6f0e1] text-[8.5px] cursor-pointer"
            >
              {t('Tính (=)', 'Calc (=)')}
            </button>
          </div>
        </div>

        <div className="max-h-[76px] overflow-y-auto casio-lcd-no-scrollbar rounded border border-[#9eb096] bg-[#e5eee0]">
          <div className="grid grid-cols-[20px_1fr_1fr] text-[8px] font-mono font-bold bg-[#c6d4bf] text-center py-0.5 border-b border-[#9eb096]">
            <span>#</span>
            <span>x</span>
            <span>y</span>
          </div>
          {props.statsPairs.map((pair, idx) => (
            <div key={idx} className="grid grid-cols-[20px_1fr_1fr] border-b border-[#c2d1ba] last:border-b-0">
              <span className="text-[8.5px] font-mono text-center bg-[#d6e2d0] py-0.5">{idx + 1}</span>
              <input
                type="text"
                data-casio-field={`linreg-x-${idx}`}
                aria-label={`x${idx + 1}`}
                value={pair.x}
                onChange={(e) => {
                  const next = props.statsPairs.map((p, i) => (i === idx ? { ...p, x: e.target.value } : p));
                  props.setStatsPairs(next);
                }}
                className="h-5 px-1 bg-transparent text-[9.5px] font-mono text-center border-r border-[#c2d1ba] outline-none focus:bg-white/60"
              />
              <input
                type="text"
                data-casio-field={`linreg-y-${idx}`}
                aria-label={`y${idx + 1}`}
                value={pair.y}
                onChange={(e) => {
                  const next = props.statsPairs.map((p, i) => (i === idx ? { ...p, y: e.target.value } : p));
                  props.setStatsPairs(next);
                }}
                className="h-5 px-1 bg-transparent text-[9.5px] font-mono text-center outline-none focus:bg-white/60"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Mode 7: Probability Distributions (MENU 7 -> 1..7 numbered menu -> Vertical Casio inputs -> Result)
  if (mode === 'dist') {
    const { distScreen, setDistScreen } = props;
    const distMenu: { num: string; id: CasioDistKind; label: string }[] = [
      { num: '1', id: 'normalPD', label: 'Normal PD' },
      { num: '2', id: 'normalCD', label: 'Normal CD' },
      { num: '3', id: 'invNormal', label: 'Inverse Normal' },
      { num: '4', id: 'binomialPD', label: 'Binomial PD' },
      { num: '5', id: 'binomialCD', label: 'Binomial CD' },
      { num: '6', id: 'poissonPD', label: 'Poisson PD' },
      { num: '7', id: 'poissonCD', label: 'Poisson CD' },
    ];

    if (distScreen === 'selectKind') {
      return (
        <div className="p-1.5 min-h-[120px] flex flex-col justify-between text-[#1e345a]">
          <div className="flex items-center justify-between text-[9px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>{t('7: Phân phối xác suất', '7: Probability distributions')}</span>
            <span className="font-mono text-[8px] opacity-75">{t('Bấm 1–7', 'Press 1–7')}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 my-1">
            {distMenu.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  props.setDistKind(item.id);
                  setDistScreen('input');
                }}
                className="px-1.5 py-0.5 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[9px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <span className="w-3.5 h-3.5 rounded-sm bg-[#1e345a] text-[#e6f0e1] text-[8px] font-mono flex items-center justify-center shrink-0">
                  {item.num}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    const distRes = computeCasioDistribution({
      kind: props.distKind,
      x: parseCasioCoeff(props.distX),
      lower: parseCasioCoeff(props.distLower),
      upper: parseCasioCoeff(props.distUpper),
      mu: parseCasioCoeff(props.distMu),
      sigma: parseCasioCoeff(props.distSigma),
      area: parseCasioCoeff(props.distArea),
      n: parseCasioCoeff(props.distN),
      p: parseCasioCoeff(props.distP),
      lambda: parseCasioCoeff(props.distLambda),
    });
    const curDistLabel = distMenu.find((d) => d.id === props.distKind)?.label ?? t('Phân phối', 'Distribution');

    if (distScreen === 'result') {
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
          <div className="flex items-center justify-between text-[9px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>{curDistLabel}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDistScreen('input')}
                className="px-1.5 py-0.5 rounded bg-[#e5eee0] border border-[#96a68f] text-[8.5px] cursor-pointer"
              >
                {t('Sửa (AC)', 'Edit (AC)')}
              </button>
              <button type="button" onClick={() => setDistScreen('selectKind')} className="underline cursor-pointer">
                {t('Đổi loại', 'Change type')}
              </button>
            </div>
          </div>
          <div
            data-testid="calculator-display-result"
            className="flex-1 px-2 py-2 rounded bg-[#e5eee0] border border-[#a5b89d] flex items-center justify-end overflow-x-auto casio-lcd-no-scrollbar"
          >
            {distRes ? (
              <MathTex latex={distRes.summaryLatex} className="text-[14.5px] font-bold" />
            ) : (
              <span className="text-rose-700 font-mono font-bold text-[11px]">
                {t('Math ERROR (Tham số sai)', 'Math ERROR (Invalid parameters)')}
              </span>
            )}
          </div>
          <div className="text-[8px] font-mono opacity-75 text-right">
            {t('Bấm AC hoặc = để sửa tham số', 'Press AC or = to edit parameters')}
          </div>
        </div>
      );
    }

    const fields: { id: string; lbl: string; val: string; set: (v: string) => void }[] =
      props.distKind === 'normalCD'
        ? [
            { id: 'dist-lower', lbl: 'Lower', val: props.distLower, set: props.setDistLower },
            { id: 'dist-upper', lbl: 'Upper', val: props.distUpper, set: props.setDistUpper },
            { id: 'dist-sigma', lbl: 'σ', val: props.distSigma, set: props.setDistSigma },
            { id: 'dist-mu', lbl: 'μ', val: props.distMu, set: props.setDistMu },
          ]
        : props.distKind === 'normalPD'
          ? [
              { id: 'dist-x', lbl: 'x', val: props.distX, set: props.setDistX },
              { id: 'dist-sigma', lbl: 'σ', val: props.distSigma, set: props.setDistSigma },
              { id: 'dist-mu', lbl: 'μ', val: props.distMu, set: props.setDistMu },
            ]
          : props.distKind === 'invNormal'
            ? [
                { id: 'dist-area', lbl: 'Area', val: props.distArea, set: props.setDistArea },
                { id: 'dist-sigma', lbl: 'σ', val: props.distSigma, set: props.setDistSigma },
                { id: 'dist-mu', lbl: 'μ', val: props.distMu, set: props.setDistMu },
              ]
            : props.distKind === 'binomialPD' || props.distKind === 'binomialCD'
              ? [
                  { id: 'dist-x', lbl: 'x', val: props.distX, set: props.setDistX },
                  { id: 'dist-n', lbl: 'N', val: props.distN, set: props.setDistN },
                  { id: 'dist-p', lbl: 'p', val: props.distP, set: props.setDistP },
                ]
              : [
                  { id: 'dist-x', lbl: 'x', val: props.distX, set: props.setDistX },
                  { id: 'dist-lambda', lbl: 'λ', val: props.distLambda, set: props.setDistLambda },
                ];

    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[9px] font-bold">
          <div className="flex items-center gap-1">
            <span>{curDistLabel}</span>
            <button
              type="button"
              onClick={() => setDistScreen('selectKind')}
              className="px-1 py-0.5 rounded bg-[#c6d4bf] border border-[#96a68f] text-[8px] cursor-pointer"
            >
              {t('Đổi loại', 'Change type')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDistScreen('result')}
            className="px-2 py-0.5 rounded bg-[#1e345a] text-[#e6f0e1] text-[8.5px] cursor-pointer"
          >
            {t('Tính (=)', 'Calc (=)')}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1">
          {fields.map((f) => (
            <label
              key={f.id}
              className="flex items-center justify-between gap-1 bg-[#e5eee0] focus-within:ring-2 focus-within:ring-indigo-600 rounded px-1.5 h-6 border border-[#9eb096]"
            >
              <span className="text-[9.5px] font-mono font-bold shrink-0">{f.lbl} :</span>
              <input
                type="text"
                data-casio-field={f.id}
                aria-label={f.lbl}
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setDistScreen('result');
                  }
                }}
                className="w-full min-w-0 bg-transparent text-[10.5px] font-mono text-right outline-none"
              />
            </label>
          ))}
        </div>
        <div className="text-[8px] font-mono opacity-75 text-right">
          {t('Bấm = để chuyển ô / tính kết quả', 'Press = to advance / calculate')}
        </div>
      </div>
    );
  }

  // Mode 8: Table f(x) & optional g(x) (2 authentic screens: input f(x)/g(x)/Start/End/Step -> full-height table)
  if (mode === 'table') {
    const { tableScreen, setTableScreen } = props;
    const fnF = compileMathExpression(props.tableExpr);
    const hasG = props.tableGExpr.trim().length > 0;
    const fnG = hasG ? compileMathExpression(props.tableGExpr) : null;
    const s = parseCasioCoeff(props.tableStart);
    const e = parseCasioCoeff(props.tableEnd);
    const st = parseCasioCoeff(props.tableStep);
    const rows: { x: number; y: string; g?: string }[] = [];
    if (fnF && Number.isFinite(s) && Number.isFinite(e) && Number.isFinite(st) && st > 0) {
      for (let x = s, guard = 0; x <= e + 1e-9 && guard < 45; x += st, guard += 1) {
        const y = fnF(x);
        const gv = fnG ? fnG(x) : undefined;
        rows.push({
          x: Number(x.toFixed(4)),
          y: Number.isFinite(y) ? Number(y.toFixed(4)).toString() : 'ERROR',
          g: fnG ? (gv !== undefined && Number.isFinite(gv) ? Number(gv.toFixed(4)).toString() : 'ERROR') : undefined,
        });
      }
    }

    if (tableScreen === 'result') {
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
          <div className="flex items-center justify-between text-[9px] font-bold">
            <span className="truncate">
              f(x) = {props.tableExpr || '—'}
              {hasG ? ` · g(x) = ${props.tableGExpr}` : ''}
            </span>
            <button
              type="button"
              onClick={() => setTableScreen('input')}
              className="px-1.5 py-0.5 rounded bg-[#1e345a] text-[#e6f0e1] text-[8.5px] cursor-pointer shrink-0"
            >
              {t('Sửa (AC)', 'Edit (AC)')}
            </button>
          </div>
          <div
            data-testid="calculator-display-result"
            className="max-h-[92px] overflow-y-auto casio-lcd-no-scrollbar rounded border border-[#9eb096] bg-[#e5eee0]"
          >
            {rows.length > 0 ? (
              <table className="w-full text-[10px] font-mono tabular-nums">
                <thead className="sticky top-0 bg-[#c6d4bf] border-b border-[#9eb096] text-[9px]">
                  <tr>
                    <th className="px-1.5 py-0.5 text-left">x</th>
                    <th className="px-1.5 py-0.5 text-right">f(x)</th>
                    {hasG && <th className="px-1.5 py-0.5 text-right border-l border-[#9eb096]">g(x)</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.x} className="border-b border-[#c2d1ba] last:border-b-0">
                      <td className="px-1.5 py-0.5 font-semibold">{row.x}</td>
                      <td className="px-1.5 py-0.5 text-right font-bold">{row.y}</td>
                      {row.g !== undefined && (
                        <td className="px-1.5 py-0.5 text-right font-bold border-l border-[#c2d1ba]">
                          {row.g}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-3 text-center text-[10px] font-bold text-rose-700">
                {t('Nhập hàm f(x) và Step > 0 hợp lệ', 'Enter valid f(x) and Step > 0')}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[9px] font-bold">
          <span>{t('8: Bảng giá trị (Table)', '8: Function table')}</span>
          <button
            type="button"
            onClick={() => setTableScreen('result')}
            className="px-2 py-0.5 rounded bg-[#1e345a] text-[#e6f0e1] text-[8.5px] cursor-pointer"
          >
            {t('Lập bảng (=)', 'Table (=)')}
          </button>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1 bg-[#e5eee0] rounded px-1.5 h-6 border border-[#9eb096]">
            <span className="text-[10px] casio-math-font font-bold shrink-0">f(x) =</span>
            <input
              type="text"
              data-casio-field="table-expr"
              aria-label={t('Hàm f(x)', 'Function f(x)')}
              value={props.tableExpr}
              onChange={(e) => props.setTableExpr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setTableScreen('result');
                }
              }}
              className="w-full min-w-0 bg-transparent text-[11px] font-mono outline-none"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#e5eee0] rounded px-1.5 h-5.5 border border-[#9eb096]">
            <span className="text-[10px] casio-math-font font-bold shrink-0">g(x) =</span>
            <input
              type="text"
              data-casio-field="table-gexpr"
              aria-label={t('Hàm g(x) tùy chọn', 'Optional function g(x)')}
              value={props.tableGExpr}
              onChange={(e) => props.setTableGExpr(e.target.value)}
              placeholder={t('(Bỏ trống nếu không dùng)', '(Leave blank if unused)')}
              className="w-full min-w-0 bg-transparent text-[10px] font-mono outline-none placeholder:font-sans placeholder:text-[8.5px]"
            />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'table-start', lbl: 'Start', val: props.tableStart, set: props.setTableStart },
              { id: 'table-end', lbl: 'End', val: props.tableEnd, set: props.setTableEnd },
              { id: 'table-step', lbl: 'Step', val: props.tableStep, set: props.setTableStep },
            ].map((f) => (
              <label
                key={f.id}
                className="flex items-center gap-0.5 bg-[#e5eee0] focus-within:ring-1 focus-within:ring-indigo-600 rounded px-1 h-5.5 border border-[#9eb096]"
              >
                <span className="text-[8.5px] font-mono font-bold shrink-0">{f.lbl}:</span>
                <input
                  type="text"
                  data-casio-field={f.id}
                  aria-label={f.lbl}
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setTableScreen('result');
                    }
                  }}
                  className="w-full min-w-0 bg-transparent text-[10px] font-mono text-right outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Mode 9: Authentic Casio fx-580VN X Equation / Simultaneous Flow
  if (mode === 'equation') {
    const { eqScreen, setEqScreen, eqSubMode, setEqSubMode, eqResult, eqResultIdx, setEqResultIdx } = props;

    if (eqScreen === 'selectType') {
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between text-[#1e345a]">
          <div className="flex items-center justify-between text-[9.5px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>{t('9: Phương trình / Hệ PT', '9: Equation / System')}</span>
            <button type="button" onClick={() => setMode('calc')} className="underline cursor-pointer">
              {t('Thoát', 'Exit')}
            </button>
          </div>
          <div className="space-y-1.5 my-1">
            <button
              type="button"
              onClick={() => setEqScreen('selectSimulDeg')}
              className="w-full px-2 py-1.5 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[11px] font-bold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span className="w-4 h-4 rounded-sm bg-[#1e345a] text-[#e6f0e1] text-[9.5px] font-mono flex items-center justify-center shrink-0">
                1
              </span>
              <span>{t('Hệ phương trình', 'Simultaneous equation')}</span>
            </button>
            <button
              type="button"
              onClick={() => setEqScreen('selectPolyDeg')}
              className="w-full px-2 py-1.5 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[11px] font-bold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span className="w-4 h-4 rounded-sm bg-[#1e345a] text-[#e6f0e1] text-[9.5px] font-mono flex items-center justify-center shrink-0">
                2
              </span>
              <span>{t('Phương trình', 'Polynomial')}</span>
            </button>
          </div>
          <div className="text-[8.5px] font-mono opacity-75">
            {t('Bấm phím 1 hoặc 2 trên máy tính Casio', 'Press key 1 or 2 on the calculator')}
          </div>
        </div>
      );
    }

    if (eqScreen === 'selectSimulDeg') {
      const options: { deg: '2' | '3' | '4'; sub: CasioEqSubMode; label: string }[] = [
        { deg: '2', sub: 'sys2', label: t('2 ẩn (x, y)', '2 unknowns') },
        { deg: '3', sub: 'sys3', label: t('3 ẩn (x, y, z)', '3 unknowns') },
        { deg: '4', sub: 'sys4', label: t('4 ẩn (x, y, z, t)', '4 unknowns') },
      ];
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between text-[#1e345a]">
          <div className="flex items-center justify-between text-[9.5px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>{t('Hệ phương trình · Số ẩn?', 'Simultaneous · Unknowns?')}</span>
            <button type="button" onClick={() => setEqScreen('selectType')} className="underline cursor-pointer">
              {t('Quay lại', 'Back')}
            </button>
          </div>
          <div className="text-[10.5px] font-semibold">
            {t('Chọn số ẩn từ 2 đến 4:', 'Select unknowns (2 to 4):')}
          </div>
          <div className="grid grid-cols-3 gap-1.5 my-1">
            {options.map((opt) => (
              <button
                key={opt.deg}
                type="button"
                onClick={() => {
                  setEqSubMode(opt.sub);
                  setEqScreen('input');
                }}
                className="px-1.5 py-2 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-center cursor-pointer transition-colors"
              >
                <div className="text-[14px] font-mono font-extrabold leading-none">{opt.deg}</div>
                <div className="text-[8.5px] mt-1 font-semibold">{opt.label}</div>
              </button>
            ))}
          </div>
          <div className="text-[8.5px] font-mono opacity-75">
            {t('Bấm phím 2, 3 hoặc 4', 'Press key 2, 3, or 4')}
          </div>
        </div>
      );
    }

    if (eqScreen === 'selectPolyDeg') {
      const options: { deg: '2' | '3' | '4'; sub: CasioEqSubMode; formula: string }[] = [
        { deg: '2', sub: 'quad', formula: 'ax² + bx + c = 0' },
        { deg: '3', sub: 'cubic', formula: 'ax³ + ... + d = 0' },
        { deg: '4', sub: 'quartic', formula: 'ax⁴ + ... + e = 0' },
      ];
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between text-[#1e345a]">
          <div className="flex items-center justify-between text-[9.5px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>{t('Phương trình · Bậc?', 'Polynomial · Degree?')}</span>
            <button type="button" onClick={() => setEqScreen('selectType')} className="underline cursor-pointer">
              {t('Quay lại', 'Back')}
            </button>
          </div>
          <div className="text-[10.5px] font-semibold">
            {t('Chọn bậc phương trình từ 2 đến 4:', 'Select polynomial degree (2 to 4):')}
          </div>
          <div className="grid grid-cols-3 gap-1.5 my-1">
            {options.map((opt) => (
              <button
                key={opt.deg}
                type="button"
                onClick={() => {
                  setEqSubMode(opt.sub);
                  setEqScreen('input');
                }}
                className="px-1.5 py-2 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-center cursor-pointer transition-colors"
              >
                <div className="text-[14px] font-mono font-extrabold leading-none">{opt.deg}</div>
                <div className="text-[8px] mt-1 font-semibold truncate">{opt.formula}</div>
              </button>
            ))}
          </div>
          <div className="text-[8.5px] font-mono opacity-75">
            {t('Bấm phím 2, 3 hoặc 4', 'Press key 2, 3, or 4')}
          </div>
        </div>
      );
    }

    if (eqScreen === 'result' && eqResult) {
      const steps = eqResult.steps;
      const safeIdx = Math.max(0, Math.min(steps.length - 1, eqResultIdx));
      const curStep = steps[safeIdx];

      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
          <div className="flex items-center justify-between text-[9px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>
              {eqResult.kind === 'ok' && curStep
                ? `${curStep.label} (${safeIdx + 1}/${steps.length})`
                : t('Kết quả Mode 9', 'Mode 9 results')}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEqScreen('input')}
                className="px-1.5 py-0.5 rounded bg-[#e5eee0] border border-[#96a68f] text-[8.5px] cursor-pointer"
              >
                {t('Sửa (AC)', 'Edit (AC)')}
              </button>
              <button
                type="button"
                onClick={() => setEqScreen('selectType')}
                className="underline cursor-pointer"
              >
                {t('Đổi loại', 'Change type')}
              </button>
            </div>
          </div>

          <div
            data-testid="calculator-display-result"
            className="flex-1 px-2 py-1.5 rounded bg-[#e5eee0] border border-[#a5b89d] flex items-center justify-between gap-2 overflow-x-auto casio-lcd-no-scrollbar"
          >
            {eqResult.kind === 'ok' && curStep ? (
              <>
                <span className="text-[10.5px] font-semibold shrink-0">{curStep.label}</span>
                <MathTex
                  latex={props.eqShowDecimal ? curStep.decimalLatex : curStep.exactLatex}
                  className="text-[16px] font-bold text-[#1e345a]"
                />
              </>
            ) : (
              <div className="w-full text-center font-bold text-[13px] text-rose-700">
                {eqResult.message ?? t('Vô nghiệm', 'No solution')}
              </div>
            )}
          </div>

          {eqResult.kind === 'ok' && steps.length > 0 ? (
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-0.5 overflow-x-auto casio-lcd-no-scrollbar">
                {steps.map((st, idx) => (
                  <button
                    key={`${st.label}-${idx}`}
                    type="button"
                    onClick={() => setEqResultIdx(idx)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold whitespace-nowrap cursor-pointer ${
                      idx === safeIdx
                        ? 'bg-[#1e345a] text-[#e6f0e1]'
                        : 'bg-[#c6d4bf] text-[#1e345a] hover:bg-[#b5c7ad]'
                    }`}
                  >
                    {st.label.replace(' =', '').replace(' của y', '').replace(' of y', '')}
                  </button>
                ))}
              </div>
              <span className="text-[8px] font-mono opacity-75 shrink-0">▲▼/= · S⇔D</span>
            </div>
          ) : (
            <div className="text-[8.5px] font-mono opacity-75 text-right">
              {t('Bấm AC hoặc = để quay lại sửa hệ số', 'Press AC or = to edit coefficients')}
            </div>
          )}
        </div>
      );
    }

    const polyFormulaMap: Record<'quad' | 'cubic' | 'quartic', string> = {
      quad: 'a\\,x^{2} + b\\,x + c = 0',
      cubic: 'a\\,x^{3} + b\\,x^{2} + c\\,x + d = 0',
      quartic: 'a\\,x^{4} + b\\,x^{3} + c\\,x^{2} + d\\,x + e = 0',
    };

    const polyFields =
      eqSubMode === 'quad'
        ? [
            { lbl: 'a', val: props.qa, set: props.setQa },
            { lbl: 'b', val: props.qb, set: props.setQb },
            { lbl: 'c', val: props.qc, set: props.setQc },
          ]
        : eqSubMode === 'cubic'
          ? [
              { lbl: 'a', val: props.qa, set: props.setQa },
              { lbl: 'b', val: props.qb, set: props.setQb },
              { lbl: 'c', val: props.qc, set: props.setQc },
              { lbl: 'd', val: props.qd, set: props.setQd },
            ]
          : [
              { lbl: 'a', val: props.qa, set: props.setQa },
              { lbl: 'b', val: props.qb, set: props.setQb },
              { lbl: 'c', val: props.qc, set: props.setQc },
              { lbl: 'd', val: props.qd, set: props.setQd },
              { lbl: 'e', val: props.qe, set: props.setQe },
            ];

    const modeTitleMap: Record<CasioEqSubMode, string> = {
      quad: t('PT bậc 2', 'Quadratic eq'),
      cubic: t('PT bậc 3', 'Cubic eq'),
      quartic: t('PT bậc 4', 'Quartic eq'),
      sys2: t('Hệ 2 ẩn', '2-var system'),
      sys3: t('Hệ 3 ẩn', '3-var system'),
      sys4: t('Hệ 4 ẩn', '4-var system'),
    };

    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
        <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
          <div className="flex items-center gap-1">
            <span>9: {modeTitleMap[eqSubMode]}</span>
            <button
              type="button"
              onClick={() => setEqScreen('selectType')}
              className="px-1 py-0.5 rounded bg-[#c6d4bf] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-[8px] cursor-pointer"
            >
              {t('Đổi loại', 'Change type')}
            </button>
          </div>
          <button
            type="button"
            onClick={props.onSolveEquationMode}
            className="px-2 py-0.5 rounded bg-[#1e345a] hover:bg-indigo-700 text-[#e6f0e1] text-[8.5px] font-bold cursor-pointer"
          >
            {t('Giải (=)', 'Solve (=)')}
          </button>
        </div>

        {(eqSubMode === 'quad' || eqSubMode === 'cubic' || eqSubMode === 'quartic') && (
          <div className="space-y-1">
            <div className="text-center text-[11px] bg-[#c6d4bf]/60 rounded py-0.5">
              <MathTex latex={polyFormulaMap[eqSubMode]} />
            </div>
            <div
              className={`grid gap-1 ${
                eqSubMode === 'quad' ? 'grid-cols-3' : eqSubMode === 'cubic' ? 'grid-cols-4' : 'grid-cols-5'
              }`}
            >
              {polyFields.map((f) => (
                <label
                  key={f.lbl}
                  className="flex flex-col bg-[#e5eee0] focus-within:ring-2 focus-within:ring-indigo-600 rounded px-1 py-0.5 border border-[#9eb096]"
                >
                  <span className="text-[8.5px] casio-math-var font-bold leading-none text-center">
                    {f.lbl}
                  </span>
                  <input
                    type="text"
                    data-casio-field={`eq-${f.lbl}`}
                    aria-label={t(`Hệ số ${f.lbl}`, `Coefficient ${f.lbl}`)}
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        props.onSolveEquationMode();
                      }
                    }}
                    className="w-full min-w-0 bg-transparent text-[11.5px] font-mono text-center outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {eqSubMode === 'sys2' && (
          <div className="space-y-0.5">
            <div className="grid grid-cols-3 gap-1 text-center text-[8.5px] font-mono font-bold opacity-80">
              <span>x</span>
              <span>y</span>
              <span>= c</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {['a₁', 'b₁', 'c₁', 'a₂', 'b₂', 'c₂'].map((lbl, idx) => (
                <input
                  key={lbl}
                  type="text"
                  data-casio-field={`sys2-${idx}`}
                  aria-label={lbl}
                  value={props.sys2[idx]}
                  onChange={(e) => {
                    const next = [...props.sys2];
                    next[idx] = e.target.value;
                    props.setSys2(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      props.onSolveEquationMode();
                    }
                  }}
                  className="h-6 px-1 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#9eb096] text-[10.5px] font-mono text-center outline-none"
                />
              ))}
            </div>
          </div>
        )}

        {eqSubMode === 'sys3' && (
          <div className="space-y-0.5">
            <div className="grid grid-cols-4 gap-0.5 text-center text-[8px] font-mono font-bold opacity-80">
              <span>x</span>
              <span>y</span>
              <span>z</span>
              <span>= d</span>
            </div>
            <div className="grid grid-cols-4 gap-0.5">
              {props.sys3.map((row, ri) =>
                row.map((val, ci) => (
                  <input
                    key={`s3-${ri}-${ci}`}
                    type="text"
                    data-casio-field={`sys3-${ri}-${ci}`}
                    aria-label={t(`Hệ 3 ẩn (${ri + 1},${ci + 1})`, `3-var system (${ri + 1},${ci + 1})`)}
                    value={val}
                    onChange={(e) => {
                      const next = props.sys3.map((r, rIdx) =>
                        r.map((cVal, cIdx) => (rIdx === ri && cIdx === ci ? e.target.value : cVal))
                      );
                      props.setSys3(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        props.onSolveEquationMode();
                      }
                    }}
                    className="h-[19px] px-0.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#9eb096] text-[9.5px] font-mono text-center outline-none"
                  />
                ))
              )}
            </div>
          </div>
        )}

        {eqSubMode === 'sys4' && (
          <div className="space-y-0.5">
            <div className="grid grid-cols-5 gap-0.5 text-center text-[7.5px] font-mono font-bold opacity-80">
              <span>x</span>
              <span>y</span>
              <span>z</span>
              <span>t</span>
              <span>=</span>
            </div>
            <div className="grid grid-cols-5 gap-0.5">
              {props.sys4.map((row, ri) =>
                row.map((val, ci) => (
                  <input
                    key={`s4-${ri}-${ci}`}
                    type="text"
                    data-casio-field={`sys4-${ri}-${ci}`}
                    aria-label={t(`Hệ 4 ẩn (${ri + 1},${ci + 1})`, `4-var system (${ri + 1},${ci + 1})`)}
                    value={val}
                    onChange={(e) => {
                      const next = props.sys4.map((r, rIdx) =>
                        r.map((cVal, cIdx) => (rIdx === ri && cIdx === ci ? e.target.value : cVal))
                      );
                      props.setSys4(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        props.onSolveEquationMode();
                      }
                    }}
                    className="h-[16px] px-0.5 rounded bg-[#e5eee0] focus:ring-1 focus:ring-indigo-600 border border-[#9eb096] text-[8.5px] font-mono text-center outline-none"
                  />
                ))
              )}
            </div>
          </div>
        )}

        <div className="text-[8px] font-mono opacity-75 flex items-center justify-between">
          <span>{t('Nhập hệ số (hỗ trợ 1/2, √2)', 'Enter coefficients (supports 1/2, √2)')}</span>
          <span>{t('Bấm = để tiếp / giải', 'Press = to advance / solve')}</span>
        </div>
      </div>
    );
  }

  // Mode A: Inequality (MENU A -> Bậc 2/3 -> Chọn 1..4 chiều >, <, ≥, ≤ -> Nhập hệ số -> Kết quả)
  if (mode === 'ineq') {
    const { ineqScreen, setIneqScreen, ineqDegree, setIneqDegree, ineqOp, setIneqOp } = props;

    if (ineqScreen === 'selectDeg') {
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between text-[#1e345a]">
          <div className="flex items-center justify-between text-[9.5px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>{t('A: Bất phương trình · Bậc?', 'A: Inequality · Degree?')}</span>
            <button type="button" onClick={() => setMode('calc')} className="underline cursor-pointer">
              {t('Thoát', 'Exit')}
            </button>
          </div>
          <div className="text-[10.5px] font-semibold">
            {t('Chọn bậc bất phương trình (2 hoặc 3):', 'Select polynomial degree (2 or 3):')}
          </div>
          <div className="grid grid-cols-2 gap-1.5 my-1">
            {([2, 3] as const).map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => {
                  setIneqDegree(deg);
                  setIneqScreen('selectOp');
                }}
                className="px-2 py-2 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-center cursor-pointer transition-colors"
              >
                <div className="text-[14px] font-mono font-extrabold leading-none">{deg}</div>
                <div className="text-[8.5px] mt-1 font-semibold">
                  {deg === 2 ? 'ax² + bx + c' : 'ax³ + bx² + cx + d'}
                </div>
              </button>
            ))}
          </div>
          <div className="text-[8.5px] font-mono opacity-75">
            {t('Bấm phím 2 hoặc 3', 'Press key 2 or 3')}
          </div>
        </div>
      );
    }

    if (ineqScreen === 'selectOp') {
      const polyTxt = ineqDegree === 2 ? 'ax² + bx + c' : 'ax³ + bx² + cx + d';
      const opChoices: { num: string; op: '>' | '<' | '>=' | '<='; sym: string }[] = [
        { num: '1', op: '>', sym: '>' },
        { num: '2', op: '<', sym: '<' },
        { num: '3', op: '>=', sym: '≥' },
        { num: '4', op: '<=', sym: '≤' },
      ];
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between text-[#1e345a]">
          <div className="flex items-center justify-between text-[9.5px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>{t('Chọn dạng bất phương trình', 'Select inequality form')}</span>
            <button type="button" onClick={() => setIneqScreen('selectDeg')} className="underline cursor-pointer">
              {t('Quay lại', 'Back')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 my-1">
            {opChoices.map((c) => (
              <button
                key={c.num}
                type="button"
                onClick={() => {
                  setIneqOp(c.op);
                  setIneqScreen('input');
                }}
                className="px-1.5 py-1.5 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[9.5px] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-3.5 h-3.5 rounded-sm bg-[#1e345a] text-[#e6f0e1] text-[8.5px] font-mono flex items-center justify-center shrink-0">
                  {c.num}
                </span>
                <span className="truncate font-mono">{polyTxt} {c.sym} 0</span>
              </button>
            ))}
          </div>
          <div className="text-[8.5px] font-mono opacity-75">
            {t('Bấm phím 1, 2, 3 hoặc 4', 'Press key 1, 2, 3, or 4')}
          </div>
        </div>
      );
    }

    const opTex = ineqOp === '>=' ? '\\ge' : ineqOp === '<=' ? '\\le' : ineqOp;
    const res =
      ineqDegree === 3
        ? solveCubicInequality(
            parseCasioCoeff(props.qa),
            parseCasioCoeff(props.qb),
            parseCasioCoeff(props.qc),
            parseCasioCoeff(props.qd),
            ineqOp
          )
        : solveQuadraticInequality(
            parseCasioCoeff(props.qa),
            parseCasioCoeff(props.qb),
            parseCasioCoeff(props.qc),
            ineqOp
          );

    if (ineqScreen === 'result') {
      return (
        <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
          <div className="flex items-center justify-between text-[9px] font-bold border-b border-[#adbd9f] pb-0.5">
            <span>{t(`Tập nghiệm BPT bậc ${ineqDegree}`, `Degree-${ineqDegree} inequality solution`)}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIneqScreen('input')}
                className="px-1.5 py-0.5 rounded bg-[#e5eee0] border border-[#96a68f] text-[8.5px] cursor-pointer"
              >
                {t('Sửa (AC)', 'Edit (AC)')}
              </button>
              <button type="button" onClick={() => setIneqScreen('selectDeg')} className="underline cursor-pointer">
                {t('Đổi loại', 'Change type')}
              </button>
            </div>
          </div>
          <div
            data-testid="calculator-display-result"
            className="flex-1 px-2 py-2 rounded bg-[#e5eee0] border border-[#a5b89d] flex items-center justify-end overflow-x-auto casio-lcd-no-scrollbar"
          >
            <MathTex latex={res.summaryLatex} className="text-[14px] font-bold" />
          </div>
          <div className="text-[8px] font-mono opacity-75 text-right">
            {t('Bấm AC hoặc = để sửa hệ số', 'Press AC or = to edit coefficients')}
          </div>
        </div>
      );
    }

    const ineqFields = [
      { lbl: 'a', val: props.qa, set: props.setQa },
      { lbl: 'b', val: props.qb, set: props.setQb },
      { lbl: 'c', val: props.qc, set: props.setQc },
      ...(ineqDegree === 3 ? [{ lbl: 'd', val: props.qd, set: props.setQd }] : []),
    ];
    const formulaLatex =
      ineqDegree === 2
        ? `a\\,x^{2} + b\\,x + c ${opTex} 0`
        : `a\\,x^{3} + b\\,x^{2} + c\\,x + d ${opTex} 0`;

    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[9px] font-bold">
          <div className="flex items-center gap-1">
            <span>{t(`A: Bất PT bậc ${ineqDegree}`, `A: Degree-${ineqDegree} ineq`)}</span>
            <button
              type="button"
              onClick={() => setIneqScreen('selectDeg')}
              className="px-1 py-0.5 rounded bg-[#c6d4bf] border border-[#96a68f] text-[8px] cursor-pointer"
            >
              {t('Đổi loại', 'Change type')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIneqScreen('result')}
            className="px-2 py-0.5 rounded bg-[#1e345a] text-[#e6f0e1] text-[8.5px] cursor-pointer"
          >
            {t('Giải (=)', 'Solve (=)')}
          </button>
        </div>

        <div className="text-center text-[11px] bg-[#c6d4bf]/60 rounded py-0.5">
          <MathTex latex={formulaLatex} />
        </div>

        <div className={`grid gap-1 ${ineqDegree === 3 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {ineqFields.map((f) => (
            <label
              key={f.lbl}
              className="flex flex-col bg-[#e5eee0] focus-within:ring-2 focus-within:ring-indigo-600 rounded px-1 py-0.5 border border-[#9eb096]"
            >
              <span className="text-[8.5px] casio-math-var font-bold leading-none text-center">{f.lbl}</span>
              <input
                type="text"
                data-casio-field={`ineq-${f.lbl}`}
                aria-label={t(`Bất PT ${f.lbl}`, `Inequality ${f.lbl}`)}
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setIneqScreen('result');
                  }
                }}
                className="w-full min-w-0 bg-transparent text-[11px] font-mono text-center outline-none"
              />
            </label>
          ))}
        </div>
        <div className="text-[8px] font-mono opacity-75 text-right">
          {t('Bấm = để chuyển ô / giải', 'Press = to advance / solve')}
        </div>
      </div>
    );
  }

  // Mode B: Verify (Đúng / Sai — authentic TRUE / FALSE screen on `=`)
  if (mode === 'verify') {
    const res = props.verifyEvaluated
      ? evaluateCasioVerify(props.verifyLhs, props.verifyOp, props.verifyRhs, {
          angleUnit: props.angleUnit,
          ans: props.ansVal,
          preAns: props.preAnsVal,
          vars: props.vars,
          normMode: props.normMode,
          fixDigits: props.fixDigits,
        })
      : null;
    const ops: { id: CasioVerifyOp; label: string }[] = [
      { id: '=', label: '=' },
      { id: '!=', label: '≠' },
      { id: '>', label: '>' },
      { id: '<', label: '<' },
      { id: '>=', label: '≥' },
      { id: '<=', label: '≤' },
    ];
    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[9px] font-bold">
          <span>{t('B: Kiểm tra đúng / sai', 'B: Verify equality/inequality')}</span>
          <div className="flex items-center gap-0.5">
            {ops.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  props.setVerifyOp(o.id);
                  props.setVerifyEvaluated(false);
                }}
                className={`px-1 rounded cursor-pointer ${
                  props.verifyOp === o.id ? 'bg-[#1e345a] text-[#e6f0e1]' : 'bg-[#e5eee0] border border-[#96a68f]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <input
            type="text"
            data-casio-field="verify-lhs"
            aria-label={t('Vế trái', 'Left-hand side')}
            value={props.verifyLhs}
            onChange={(e) => {
              props.setVerifyLhs(e.target.value);
              props.setVerifyEvaluated(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                props.setVerifyEvaluated(true);
              }
            }}
            className="casio-math-font flex-1 min-w-0 h-6.5 px-1.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#9eb096] text-[13px] outline-none"
          />
          <span className="font-mono font-extrabold text-[13px] shrink-0">
            {ops.find((o) => o.id === props.verifyOp)?.label}
          </span>
          <input
            type="text"
            data-casio-field="verify-rhs"
            aria-label={t('Vế phải', 'Right-hand side')}
            value={props.verifyRhs}
            onChange={(e) => {
              props.setVerifyRhs(e.target.value);
              props.setVerifyEvaluated(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                props.setVerifyEvaluated(true);
              }
            }}
            className="casio-math-font flex-1 min-w-0 h-6.5 px-1.5 rounded bg-[#e5eee0] focus:ring-2 focus:ring-indigo-600 border border-[#9eb096] text-[13px] outline-none"
          />
        </div>

        <div
          data-testid="calculator-display-result"
          className="min-h-[28px] border-t border-[#b8c8b0]/80 pt-1 flex items-center justify-between gap-2"
        >
          {props.verifyEvaluated ? (
            res ? (
              <>
                <span className="font-mono text-[9px] opacity-75 truncate">
                  {Number(res.lhsVal.toFixed(4))} vs {Number(res.rhsVal.toFixed(4))}
                </span>
                <span
                  className={`font-extrabold font-mono text-[14px] ${
                    res.isTrue ? 'text-emerald-800' : 'text-rose-700'
                  }`}
                >
                  {res.isTrue ? 'TRUE' : 'FALSE'}
                </span>
              </>
            ) : (
              <span className="text-rose-700 font-mono font-bold text-[10.5px] ml-auto">Syntax ERROR</span>
            )
          ) : (
            <button
              type="button"
              onClick={() => props.setVerifyEvaluated(true)}
              className="ml-auto px-2 py-0.5 rounded bg-[#1e345a] text-[#e6f0e1] text-[8.5px] font-bold cursor-pointer"
            >
              {t('Kiểm tra (=)', 'Verify (=)')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Mode C: Ratio (MENU C -> 1: A:B=X:D | 2: A:B=C:X -> Nhập -> Kết quả X = ...)
  const { ratioScreen, setRatioScreen } = props;

  if (ratioScreen === 'selectForm') {
    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between text-[#1e345a]">
        <div className="flex items-center justify-between text-[9.5px] font-bold border-b border-[#adbd9f] pb-0.5">
          <span>{t('C: Tỉ lệ thức (Ratio)', 'C: Ratio')}</span>
          <button type="button" onClick={() => setMode('calc')} className="underline cursor-pointer">
            {t('Thoát', 'Exit')}
          </button>
        </div>
        <div className="space-y-1.5 my-1">
          <button
            type="button"
            onClick={() => {
              props.setRatioUnknown('c');
              setRatioScreen('input');
            }}
            className="w-full px-2 py-1.5 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[11px] font-bold flex items-center gap-2 cursor-pointer"
          >
            <span className="w-4 h-4 rounded-sm bg-[#1e345a] text-[#e6f0e1] text-[9.5px] font-mono flex items-center justify-center shrink-0">
              1
            </span>
            <span className="font-mono">A : B = X : D</span>
          </button>
          <button
            type="button"
            onClick={() => {
              props.setRatioUnknown('d');
              setRatioScreen('input');
            }}
            className="w-full px-2 py-1.5 rounded bg-[#e5eee0] hover:bg-[#1e345a] hover:text-[#e6f0e1] border border-[#96a68f] text-left text-[11px] font-bold flex items-center gap-2 cursor-pointer"
          >
            <span className="w-4 h-4 rounded-sm bg-[#1e345a] text-[#e6f0e1] text-[9.5px] font-mono flex items-center justify-center shrink-0">
              2
            </span>
            <span className="font-mono">A : B = C : X</span>
          </button>
        </div>
        <div className="text-[8.5px] font-mono opacity-75">
          {t('Bấm phím 1 hoặc 2', 'Press key 1 or 2')}
        </div>
      </div>
    );
  }

  const ratioRes = solveCasioRatio(
    parseCasioCoeff(props.ratioA),
    parseCasioCoeff(props.ratioB),
    parseCasioCoeff(props.ratioC),
    parseCasioCoeff(props.ratioD),
    props.ratioUnknown
  );

  if (ratioScreen === 'result') {
    const valLatex =
      ratioRes.kind === 'ok'
        ? `X = ${props.ratioShowDecimal ? ratioRes.decimalText : ratioRes.exactLatex}`
        : ratioRes.summaryLatex;
    return (
      <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
        <div className="flex items-center justify-between text-[9px] font-bold border-b border-[#adbd9f] pb-0.5">
          <span>
            {props.ratioUnknown === 'c'
              ? `${props.ratioA} : ${props.ratioB} = X : ${props.ratioD}`
              : `${props.ratioA} : ${props.ratioB} = ${props.ratioC} : X`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRatioScreen('input')}
              className="px-1.5 py-0.5 rounded bg-[#e5eee0] border border-[#96a68f] text-[8.5px] cursor-pointer"
            >
              {t('Sửa (AC)', 'Edit (AC)')}
            </button>
            <button type="button" onClick={() => setRatioScreen('selectForm')} className="underline cursor-pointer">
              {t('Đổi dạng', 'Change form')}
            </button>
          </div>
        </div>
        <div
          data-testid="calculator-display-result"
          className="flex-1 px-2 py-2 rounded bg-[#e5eee0] border border-[#a5b89d] flex items-center justify-end overflow-x-auto casio-lcd-no-scrollbar"
        >
          <MathTex latex={valLatex} className="text-[16px] font-bold" />
        </div>
        <div className="text-[8px] font-mono opacity-75 text-right">
          {t('Bấm S⇔D đổi thập phân · AC sửa hệ số', 'Press S⇔D for decimal · AC to edit')}
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 min-h-[120px] flex flex-col justify-between gap-1 text-[#1e345a]">
      <div className="flex items-center justify-between text-[9px] font-bold">
        <div className="flex items-center gap-1">
          <span>C: {props.ratioUnknown === 'c' ? 'A:B = X:D' : 'A:B = C:X'}</span>
          <button
            type="button"
            onClick={() => setRatioScreen('selectForm')}
            className="px-1 py-0.5 rounded bg-[#c6d4bf] border border-[#96a68f] text-[8px] cursor-pointer"
          >
            {t('Đổi dạng', 'Change form')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setRatioScreen('result')}
          className="px-2 py-0.5 rounded bg-[#1e345a] text-[#e6f0e1] text-[8.5px] cursor-pointer"
        >
          {t('Giải (=)', 'Solve (=)')}
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-1 font-mono text-[10px]">
        <label className="flex flex-col bg-[#e5eee0] focus-within:ring-1 focus-within:ring-indigo-600 rounded border border-[#9eb096]">
          <span className="text-[7.5px] text-center opacity-75">A</span>
          <input
            type="text"
            data-casio-field="ratio-a"
            aria-label="A"
            value={props.ratioA}
            onChange={(e) => props.setRatioA(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setRatioScreen('result');
              }
            }}
            className="h-5.5 px-1 bg-transparent text-center outline-none"
          />
        </label>
        <span className="font-bold">:</span>
        <label className="flex flex-col bg-[#e5eee0] focus-within:ring-1 focus-within:ring-indigo-600 rounded border border-[#9eb096]">
          <span className="text-[7.5px] text-center opacity-75">B</span>
          <input
            type="text"
            data-casio-field="ratio-b"
            aria-label="B"
            value={props.ratioB}
            onChange={(e) => props.setRatioB(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setRatioScreen('result');
              }
            }}
            className="h-5.5 px-1 bg-transparent text-center outline-none"
          />
        </label>
        <span className="font-bold">=</span>
        {props.ratioUnknown === 'c' ? (
          <div className="h-8 rounded bg-[#1e345a] text-[#e6f0e1] font-bold flex items-center justify-center">
            X
          </div>
        ) : (
          <label className="flex flex-col bg-[#e5eee0] focus-within:ring-1 focus-within:ring-indigo-600 rounded border border-[#9eb096]">
            <span className="text-[7.5px] text-center opacity-75">C</span>
            <input
              type="text"
              data-casio-field="ratio-c"
              aria-label="C"
              value={props.ratioC}
              onChange={(e) => props.setRatioC(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setRatioScreen('result');
                }
              }}
              className="h-5.5 px-1 bg-transparent text-center outline-none"
            />
          </label>
        )}
        <span className="font-bold">:</span>
        {props.ratioUnknown === 'd' ? (
          <div className="h-8 rounded bg-[#1e345a] text-[#e6f0e1] font-bold flex items-center justify-center">
            X
          </div>
        ) : (
          <label className="flex flex-col bg-[#e5eee0] focus-within:ring-1 focus-within:ring-indigo-600 rounded border border-[#9eb096]">
            <span className="text-[7.5px] text-center opacity-75">D</span>
            <input
              type="text"
              data-casio-field="ratio-d"
              aria-label="D"
              value={props.ratioD}
              onChange={(e) => props.setRatioD(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setRatioScreen('result');
                }
              }}
              className="h-5.5 px-1 bg-transparent text-center outline-none"
            />
          </label>
        )}
      </div>
      <div className="text-[8px] font-mono opacity-75 text-right">
        {t('Bấm = để chuyển ô / giải X', 'Press = to advance / solve for X')}
      </div>
    </div>
  );
};
