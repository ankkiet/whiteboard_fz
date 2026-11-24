import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  CasioAngleUnit,
  CasioBaseMode,
  CasioDisplayFormat,
  CasioDistKind,
  CasioEqFullResult,
  CasioExactRepresentation,
  CasioNormMode,
  CasioVerifyOp,
  casioExprToNaturalLatex,
  computeCasioDistribution,
  computeCasioLinReg,
  computeCasioStats1Var,
  computeMatrixDet,
  computeMatrixInverse,
  computeVectorMetrics,
  evaluateCasioBaseN,
  evaluateCasioComplex,
  evaluateCasioExpression,
  evaluateCasioVerify,
  factorizeIntegerLatex,
  formatCasioExact,
  formatComplexLatex,
  matrixToLatex,
  multiplyMatrices,
  parseCasioCoeff,
  solveCasioCubicFull,
  solveCasioEquationAllRoots,
  solveCasioLinearSystemFull,
  solveCasioQuadraticFull,
  solveCasioQuarticFull,
  solveCasioRatio,
  solveCubicInequality,
  solveQuadraticInequality,
  subtractMatrices,
  transposeMatrix,
} from '../../engine/casio580Engine';
import { FormulaElement } from '../../types/board';
import { MathTex } from './MathTex';
import {
  CasioDistScreen,
  CasioEqScreen,
  CasioEqSubMode,
  CasioIneqScreen,
  CasioLcdModes,
  CasioLcdOverlay,
  CasioMainMode,
  CasioMatOp,
  CasioRatioScreen,
  CasioStatsScreen,
  CasioStatsSubMode,
  CasioTableScreen,
  CasioVecOp,
} from './CasioLcdModes';
import { CasioNaturalEditor } from './CasioNaturalEditor';
import {
  Casio2dSlotNode,
  findEnclosingCasio2dTemplate,
  flattenCasio2dSlots,
  getNavigableCasio2dSlots,
  parseCasio2dNodes,
} from '../../engine/casio2dParser';
import { computeSafeWorldCenter, getSafeMathViewport } from '../../engine/mathViewport';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripHorizontal,
  HelpCircle,
  Maximize2,
  Minimize2,
  Palette,
  Share2,
  SlidersHorizontal,
  X,
} from 'lucide-react';

interface HistoryEntry {
  expr: string;
  res: CasioExactRepresentation;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const toNum = (s: string): number => {
  const cleaned = s.trim().replace(/−/g, '-');
  if (!cleaned || cleaned === '-') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

interface SciKeyDef {
  id: string;
  label: string;
  labelLatex?: string;
  shiftLabel?: string;
  alphaLabel?: string;
  title: string;
  onPress: () => void;
  onShiftPress?: () => void;
  onAlphaPress?: () => void;
}

interface NumKeyDef {
  id: string;
  label: string;
  shiftLabel?: string;
  alphaLabel?: string;
  title: string;
  variant?: 'white' | 'blue';
  testId?: string;
  onPress: () => void;
  onShiftPress?: () => void;
  onAlphaPress?: () => void;
}

const CASIO_STORAGE_KEY = 'bttm_casio_fx580_state_v1';

interface PersistedCasioState {
  angleUnit?: CasioAngleUnit;
  normMode?: CasioNormMode;
  fixDigits?: number;
  chassisTheme?: 'carbon' | 'navy' | 'silver';
  vars?: Record<string, number>;
}

function loadPersistedCasioState(): PersistedCasioState {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem(CASIO_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export const FloatingCalculator: React.FC = () => {
  const isOpen = useBoardStore((s) => s.isCalculatorOpen);
  const setIsOpen = useBoardStore((s) => s.setIsCalculatorOpen);
  const isMinimized = useBoardStore((s) => s.isCalculatorMinimized);
  const setIsMinimized = useBoardStore((s) => s.setIsCalculatorMinimized);
  const addElement = useBoardStore((s) => s.addElement);
  const addToast = useBoardStore((s) => s.addToast);

  const persisted = useMemo(() => loadPersistedCasioState(), []);

  const [pos, setPos] = useState({ x: 14, y: 60 });
  const [mode, setMode] = useState<CasioMainMode>('calc');
  const [overlay, setOverlay] = useState<CasioLcdOverlay>(null);
  const [angleUnit, setAngleUnit] = useState<CasioAngleUnit>(
    persisted.angleUnit === 'R' || persisted.angleUnit === 'G' ? persisted.angleUnit : 'D'
  );
  const [normMode, setNormMode] = useState<CasioNormMode>(
    persisted.normMode === 'FIX' || persisted.normMode === 'SCI' ? persisted.normMode : 'NORM'
  );
  const [fixDigits, setFixDigits] = useState<number>(
    typeof persisted.fixDigits === 'number' ? persisted.fixDigits : 4
  );
  const [displayFormat, setDisplayFormat] = useState<CasioDisplayFormat>('exact');
  const [chassisTheme, setChassisTheme] = useState<'carbon' | 'navy' | 'silver'>(
    persisted.chassisTheme === 'navy' || persisted.chassisTheme === 'silver' ? persisted.chassisTheme : 'carbon'
  );

  const [shiftActive, setShiftActive] = useState(false);
  const [alphaActive, setAlphaActive] = useState(false);
  const [stoActive, setStoActive] = useState(false);

  // Mode 1: Calculate state (clean empty LCD on startup, just like a real Casio)
  const [expr, setExpr] = useState('');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [lastResult, setLastResult] = useState<CasioExactRepresentation>({
    numeric: 0,
    decimalText: '0',
    exactLatex: '0',
    mixedLatex: '0',
    dmsText: `0°0'0"`,
    engLatex: '0 \\times 10^{0}',
    hasExactForm: false,
  });
  const [preAns, setPreAns] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [vars, setVars] = useState<Record<string, number>>(() => ({
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    T: 0,
    F: 0,
    M: 0,
    x: 0,
    y: 0,
    z: 0,
    ...(persisted.vars ?? {}),
  }));
  const [calcVarInputs, setCalcVarInputs] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const calcRootRef = useRef<HTMLDivElement>(null);
  const activeFieldIdRef = useRef<string>('slot-root');
  const [activeFieldId, setActiveFieldId] = useState<string>('slot-root');
  const caretPosRef = useRef<number | null>(0);
  const [activeCaret, setActiveCaret] = useState<number | null>(0);

  const setActiveField = (id: string) => {
    activeFieldIdRef.current = id;
    setActiveFieldId(id);
  };

  const setCaretPos = (posVal: number | null) => {
    caretPosRef.current = posVal;
    setActiveCaret(posVal);
  };

  // Persist user settings and memory variables safely
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CASIO_STORAGE_KEY,
        JSON.stringify({ angleUnit, normMode, fixDigits, chassisTheme, vars })
      );
    } catch {
      // ignore quota/private mode errors
    }
  }, [angleUnit, normMode, fixDigits, chassisTheme, vars]);

  // Mode 2: Complex
  const [complexExpr, setComplexExpr] = useState('');
  const [complexPolar, setComplexPolar] = useState(false);

  // Mode 3: Base-N
  const [baseMode, setBaseMode] = useState<CasioBaseMode>('DEC');
  const [baseExpr, setBaseExpr] = useState('');

  // Mode 4: Matrix (2x2, 3x3, 4x4) — initialized to 0 like real Casio
  const [matSize, setMatSize] = useState<2 | 3 | 4>(2);
  const [matA, setMatA] = useState<string[][]>([
    ['0', '0'],
    ['0', '0'],
  ]);
  const [matB, setMatB] = useState<string[][]>([
    ['0', '0'],
    ['0', '0'],
  ]);
  const [matOp, setMatOp] = useState<CasioMatOp>('det');

  // Mode 5: Vector
  const [vecDim, setVecDim] = useState<2 | 3>(3);
  const [vecU, setVecU] = useState<string[]>(['0', '0', '0']);
  const [vecV, setVecV] = useState<string[]>(['0', '0', '0']);
  const [vecOp, setVecOp] = useState<CasioVecOp>('dot');

  // Mode 6: Stats (1-Var & Linear Regression)
  const [statsScreen, setStatsScreen] = useState<CasioStatsScreen>('selectType');
  const [statsSubMode, setStatsSubMode] = useState<CasioStatsSubMode>('1var');
  const [statsRaw, setStatsRaw] = useState('');
  const [statsPairs, setStatsPairs] = useState<{ x: string; y: string }[]>([
    { x: '', y: '' },
    { x: '', y: '' },
    { x: '', y: '' },
    { x: '', y: '' },
  ]);
  const statsResult = useMemo(() => {
    const nums = statsRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== '-')
      .map(Number);
    return computeCasioStats1Var(nums);
  }, [statsRaw]);
  const linRegResult = useMemo(() => {
    const pairs = statsPairs
      .filter((p) => p.x.trim() !== '' && p.y.trim() !== '')
      .map((p) => ({ x: parseCasioCoeff(p.x), y: parseCasioCoeff(p.y) }));
    return computeCasioLinReg(pairs);
  }, [statsPairs]);

  // Mode 7: Distribution
  const [distScreen, setDistScreen] = useState<CasioDistScreen>('selectKind');
  const [distKind, setDistKind] = useState<CasioDistKind>('normalCD');
  const [distX, setDistX] = useState('0');
  const [distLower, setDistLower] = useState('0');
  const [distUpper, setDistUpper] = useState('0');
  const [distMu, setDistMu] = useState('0');
  const [distSigma, setDistSigma] = useState('1');
  const [distArea, setDistArea] = useState('0.5');
  const [distN, setDistN] = useState('0');
  const [distP, setDistP] = useState('0');
  const [distLambda, setDistLambda] = useState('1');

  // Mode 8: Table f(x) & optional g(x) (default Start=1, End=5, Step=1 like Casio fx-580VN X)
  const [tableScreen, setTableScreen] = useState<CasioTableScreen>('input');
  const [tableExpr, setTableExpr] = useState('');
  const [tableGExpr, setTableGExpr] = useState('');
  const [tableStart, setTableStart] = useState('1');
  const [tableEnd, setTableEnd] = useState('5');
  const [tableStep, setTableStep] = useState('1');

  // Mode 9 & A: Equations & Inequality (all 0 by default like real Casio)
  const [eqScreen, setEqScreen] = useState<CasioEqScreen>('selectType');
  const [eqSubMode, setEqSubMode] = useState<CasioEqSubMode>('quad');
  const [eqResult, setEqResult] = useState<CasioEqFullResult | null>(null);
  const [eqResultIdx, setEqResultIdx] = useState<number>(0);
  const [eqShowDecimal, setEqShowDecimal] = useState<boolean>(false);
  const [qa, setQa] = useState('0');
  const [qb, setQb] = useState('0');
  const [qc, setQc] = useState('0');
  const [qd, setQd] = useState('0');
  const [qe, setQe] = useState('0');
  const [sys2, setSys2] = useState<string[]>(['0', '0', '0', '0', '0', '0']);
  const [sys3, setSys3] = useState<string[][]>([
    ['0', '0', '0', '0'],
    ['0', '0', '0', '0'],
    ['0', '0', '0', '0'],
  ]);
  const [sys4, setSys4] = useState<string[][]>([
    ['0', '0', '0', '0', '0'],
    ['0', '0', '0', '0', '0'],
    ['0', '0', '0', '0', '0'],
    ['0', '0', '0', '0', '0'],
  ]);
  const [ineqScreen, setIneqScreen] = useState<CasioIneqScreen>('selectDeg');
  const [ineqDegree, setIneqDegree] = useState<2 | 3>(2);
  const [ineqOp, setIneqOp] = useState<'>' | '<' | '>=' | '<='>('>');

  // Mode B: Verify
  const [verifyLhs, setVerifyLhs] = useState('');
  const [verifyOp, setVerifyOp] = useState<CasioVerifyOp>('=');
  const [verifyRhs, setVerifyRhs] = useState('');
  const [verifyEvaluated, setVerifyEvaluated] = useState<boolean>(false);

  // Mode C: Ratio
  const [ratioScreen, setRatioScreen] = useState<CasioRatioScreen>('selectForm');
  const [ratioUnknown, setRatioUnknown] = useState<'c' | 'd'>('c');
  const [ratioA, setRatioA] = useState('0');
  const [ratioB, setRatioB] = useState('0');
  const [ratioC, setRatioC] = useState('0');
  const [ratioD, setRatioD] = useState('0');
  const [ratioShowDecimal, setRatioShowDecimal] = useState<boolean>(false);

  const calcVarsList = useMemo(() => {
    const found: string[] = [];
    for (const v of ['x', 'y', 'z', 'A', 'B', 'C', 'D', 'T', 'F', 'M']) {
      if (new RegExp(`(?<![a-zA-Z])${v}(?![a-zA-Z])`).test(expr)) found.push(v);
    }
    return found.length > 0 ? found : ['x'];
  }, [expr]);

  // Automatically set default activeFieldId whenever mode or overlay changes
  useEffect(() => {
    if (!isOpen) return;
    if (overlay === 'calcPrompt') {
      const firstVar = calcVarsList[0] ?? 'x';
      setActiveField(`calc-${firstVar}`);
    } else if (mode === 'calc') {
      const navSlots = getNavigableCasio2dSlots(parseCasio2dNodes(expr));
      setActiveField(navSlots[0]?.id ?? 'slot-root');
    } else if (mode === 'complex') {
      setActiveField('complex-expr');
    } else if (mode === 'basen') {
      setActiveField('basen-expr');
    } else if (mode === 'matrix') {
      setActiveField('matA-0-0');
    } else if (mode === 'vector') {
      setActiveField('vecU-0');
    } else if (mode === 'stats') {
      if (statsScreen === 'input') {
        setActiveField(statsSubMode === '1var' ? 'stats-raw' : 'linreg-x-0');
      }
    } else if (mode === 'dist') {
      if (distScreen === 'input') {
        setActiveField(
          distKind === 'normalCD' ? 'dist-lower' : distKind === 'invNormal' ? 'dist-area' : 'dist-x'
        );
      }
    } else if (mode === 'table') {
      if (tableScreen === 'input') {
        setActiveField('table-expr');
      }
    } else if (mode === 'equation') {
      if (eqScreen === 'input') {
        const defaultEqField =
          eqSubMode === 'sys2'
            ? 'sys2-0'
            : eqSubMode === 'sys3'
              ? 'sys3-0-0'
              : eqSubMode === 'sys4'
                ? 'sys4-0-0'
                : 'eq-a';
        setActiveField(defaultEqField);
        requestAnimationFrame(() => {
          const el = getFieldInputEl(defaultEqField);
          if (el) {
            el.focus();
            el.select();
          }
        });
      }
    } else if (mode === 'ineq') {
      if (ineqScreen === 'input') {
        setActiveField('ineq-a');
      }
    } else if (mode === 'verify') {
      setActiveField('verify-lhs');
    } else if (mode === 'ratio') {
      if (ratioScreen === 'input') {
        setActiveField('ratio-a');
      }
    }
    caretPosRef.current = null;
  }, [
    isOpen,
    mode,
    overlay,
    eqSubMode,
    eqScreen,
    statsScreen,
    statsSubMode,
    distScreen,
    distKind,
    tableScreen,
    ineqScreen,
    ratioScreen,
    calcVarsList,
  ]);

  if (!isOpen) return null;

  const getFieldInputEl = (fieldId: string): HTMLInputElement | null => {
    if (!calcRootRef.current) return null;
    return calcRootRef.current.querySelector<HTMLInputElement>(`input[data-casio-field="${fieldId}"]`);
  };

  const getAllVisibleFields = (): HTMLInputElement[] => {
    if (!calcRootRef.current) return [];
    return Array.from(calcRootRef.current.querySelectorAll<HTMLInputElement>('input[data-casio-field]'));
  };

  const focusFieldAtCaret = (fieldId: string, caret: number) => {
    setActiveField(fieldId);
    setCaretPos(caret);
    requestAnimationFrame(() => {
      const el = getFieldInputEl(fieldId);
      if (el) {
        el.focus();
        try {
          const clamped = Math.max(0, Math.min(el.value.length, caret));
          el.setSelectionRange(clamped, clamped);
          setCaretPos(clamped);
        } catch {
          // ignore if browser blocks selection range
        }
      }
    });
  };

  const getActiveCalcSlot = (): Casio2dSlotNode => {
    const nodes = parseCasio2dNodes(expr);
    const allSlots = flattenCasio2dSlots(nodes);
    const navSlots = getNavigableCasio2dSlots(nodes, activeFieldIdRef.current);
    return (
      allSlots.find((s) => s.id === activeFieldIdRef.current) ??
      navSlots[0] ??
      allSlots[0] ?? {
        type: 'slot',
        id: 'slot-root',
        start: 0,
        end: expr.length,
        value: expr,
        role: 'root',
        size: 'main',
      }
    );
  };

  const applyCalcExprEdit = (nextExpr: string, targetAbsCaret: number) => {
    setErrorMsg(null);
    setInfoBanner(null);
    setIsEvaluated(false);
    setExpr((prev) => {
      if (nextExpr !== prev) setUndoStack((st) => [...st.slice(-19), prev]);
      return nextExpr;
    });
    const nextNodes = parseCasio2dNodes(nextExpr);
    const allSlots = flattenCasio2dSlots(nextNodes);
    const targetSlot =
      allSlots.find((s) => s.role === 'arg' && s.start <= targetAbsCaret && targetAbsCaret <= s.end) ??
      allSlots.find((s) => s.start <= targetAbsCaret && targetAbsCaret <= s.end) ??
      allSlots[allSlots.length - 1];
    if (targetSlot) {
      focusFieldAtCaret(targetSlot.id, targetAbsCaret - targetSlot.start);
    }
    clearModifiers();
    setStoActive(false);
  };

  const getTargetFieldBinding = (): {
    fieldId: string;
    getVal: () => string;
    setVal: (next: string) => void;
    isExpressionField: boolean;
  } => {
    const id = activeFieldIdRef.current;

    if (overlay === 'calcPrompt' && id.startsWith('calc-')) {
      const vKey = id.slice(5);
      return {
        fieldId: id,
        getVal: () => calcVarInputs[vKey] ?? String(vars[vKey] ?? 0),
        setVal: (next) => {
          setCalcVarInputs((prev) => ({ ...prev, [vKey]: next }));
          setVars((prev) => ({ ...prev, [vKey]: toNum(next) }));
        },
        isExpressionField: false,
      };
    }

    if (mode === 'complex') {
      return {
        fieldId: 'complex-expr',
        getVal: () => complexExpr,
        setVal: setComplexExpr,
        isExpressionField: true,
      };
    }

    if (mode === 'basen') {
      return {
        fieldId: 'basen-expr',
        getVal: () => baseExpr,
        setVal: setBaseExpr,
        isExpressionField: true,
      };
    }

    if (mode === 'matrix') {
      const mMatch = /^(matA|matB)-(\d)-(\d)$/.exec(id);
      const which = mMatch ? mMatch[1] : 'matA';
      const r = mMatch ? Number(mMatch[2]) : 0;
      const c = mMatch ? Number(mMatch[3]) : 0;
      const targetMat = which === 'matB' ? matB : matA;
      const setTargetMat = which === 'matB' ? setMatB : setMatA;
      return {
        fieldId: `${which}-${r}-${c}`,
        getVal: () => targetMat[r]?.[c] ?? '0',
        setVal: (next) => {
          setTargetMat(
            targetMat.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? next : cell)))
          );
        },
        isExpressionField: false,
      };
    }

    if (mode === 'vector') {
      const vMatch = /^(vecU|vecV)-(\d)$/.exec(id);
      const which = vMatch ? vMatch[1] : 'vecU';
      const idx = vMatch ? Number(vMatch[2]) : 0;
      const targetVec = which === 'vecV' ? vecV : vecU;
      const setTargetVec = which === 'vecV' ? setVecV : setVecU;
      return {
        fieldId: `${which}-${idx}`,
        getVal: () => targetVec[idx] ?? '0',
        setVal: (next) => {
          const copy = [...targetVec];
          copy[idx] = next;
          setTargetVec(copy);
        },
        isExpressionField: false,
      };
    }

    if (mode === 'dist') {
      const distMap: Record<string, { get: () => string; set: (v: string) => void }> = {
        'dist-x': { get: () => distX, set: setDistX },
        'dist-lower': { get: () => distLower, set: setDistLower },
        'dist-upper': { get: () => distUpper, set: setDistUpper },
        'dist-mu': { get: () => distMu, set: setDistMu },
        'dist-sigma': { get: () => distSigma, set: setDistSigma },
        'dist-area': { get: () => distArea, set: setDistArea },
        'dist-n': { get: () => distN, set: setDistN },
        'dist-p': { get: () => distP, set: setDistP },
        'dist-lambda': { get: () => distLambda, set: setDistLambda },
      };
      const hit = distMap[id] ?? distMap['dist-x'];
      const targetId = distMap[id] ? id : 'dist-x';
      return { fieldId: targetId, getVal: hit.get, setVal: hit.set, isExpressionField: false };
    }

    if (mode === 'table') {
      if (id === 'table-gexpr') {
        return { fieldId: id, getVal: () => tableGExpr, setVal: setTableGExpr, isExpressionField: true };
      }
      if (id === 'table-start') {
        return { fieldId: id, getVal: () => tableStart, setVal: setTableStart, isExpressionField: false };
      }
      if (id === 'table-end') {
        return { fieldId: id, getVal: () => tableEnd, setVal: setTableEnd, isExpressionField: false };
      }
      if (id === 'table-step') {
        return { fieldId: id, getVal: () => tableStep, setVal: setTableStep, isExpressionField: false };
      }
      return { fieldId: 'table-expr', getVal: () => tableExpr, setVal: setTableExpr, isExpressionField: true };
    }

    if (mode === 'equation') {
      if (eqSubMode === 'sys2') {
        const sMatch = /^sys2-(\d)$/.exec(id);
        const idx = sMatch ? Number(sMatch[1]) : 0;
        return {
          fieldId: `sys2-${idx}`,
          getVal: () => sys2[idx] ?? '0',
          setVal: (next) => {
            const copy = [...sys2];
            copy[idx] = next;
            setSys2(copy);
          },
          isExpressionField: false,
        };
      }
      if (eqSubMode === 'sys3') {
        const s3Match = /^sys3-(\d)-(\d)$/.exec(id);
        const r = s3Match ? Number(s3Match[1]) : 0;
        const c = s3Match ? Number(s3Match[2]) : 0;
        return {
          fieldId: `sys3-${r}-${c}`,
          getVal: () => sys3[r]?.[c] ?? '0',
          setVal: (next) => {
            setSys3(
              sys3.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? next : cell)))
            );
          },
          isExpressionField: false,
        };
      }
      if (eqSubMode === 'sys4') {
        const s4Match = /^sys4-(\d)-(\d)$/.exec(id);
        const r = s4Match ? Number(s4Match[1]) : 0;
        const c = s4Match ? Number(s4Match[2]) : 0;
        return {
          fieldId: `sys4-${r}-${c}`,
          getVal: () => sys4[r]?.[c] ?? '0',
          setVal: (next) => {
            setSys4(
              sys4.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? next : cell)))
            );
          },
          isExpressionField: false,
        };
      }
      if (id === 'eq-b') return { fieldId: id, getVal: () => qb, setVal: setQb, isExpressionField: false };
      if (id === 'eq-c') return { fieldId: id, getVal: () => qc, setVal: setQc, isExpressionField: false };
      if (id === 'eq-d') return { fieldId: id, getVal: () => qd, setVal: setQd, isExpressionField: false };
      if (id === 'eq-e') return { fieldId: id, getVal: () => qe, setVal: setQe, isExpressionField: false };
      return { fieldId: 'eq-a', getVal: () => qa, setVal: setQa, isExpressionField: false };
    }

    if (mode === 'ineq') {
      if (id === 'ineq-b') return { fieldId: id, getVal: () => qb, setVal: setQb, isExpressionField: false };
      if (id === 'ineq-c') return { fieldId: id, getVal: () => qc, setVal: setQc, isExpressionField: false };
      if (id === 'ineq-d') return { fieldId: id, getVal: () => qd, setVal: setQd, isExpressionField: false };
      return { fieldId: 'ineq-a', getVal: () => qa, setVal: setQa, isExpressionField: false };
    }

    if (mode === 'verify') {
      if (id === 'verify-rhs') {
        return { fieldId: id, getVal: () => verifyRhs, setVal: setVerifyRhs, isExpressionField: true };
      }
      return { fieldId: 'verify-lhs', getVal: () => verifyLhs, setVal: setVerifyLhs, isExpressionField: true };
    }

    if (mode === 'ratio') {
      if (id === 'ratio-b') return { fieldId: id, getVal: () => ratioB, setVal: setRatioB, isExpressionField: false };
      if (id === 'ratio-c') return { fieldId: id, getVal: () => ratioC, setVal: setRatioC, isExpressionField: false };
      if (id === 'ratio-d') return { fieldId: id, getVal: () => ratioD, setVal: setRatioD, isExpressionField: false };
      return { fieldId: 'ratio-a', getVal: () => ratioA, setVal: setRatioA, isExpressionField: false };
    }

    if (mode === 'stats') {
      const lrMatch = /^linreg-(x|y)-(\d+)$/.exec(id);
      if (statsSubMode === 'linreg') {
        const col = (lrMatch ? lrMatch[1] : 'x') as 'x' | 'y';
        const idx = lrMatch ? Number(lrMatch[2]) : 0;
        return {
          fieldId: `linreg-${col}-${idx}`,
          getVal: () => statsPairs[idx]?.[col] ?? '',
          setVal: (next) => {
            setStatsPairs(
              statsPairs.map((p, i) => (i === idx ? { ...p, [col]: next } : p))
            );
          },
          isExpressionField: false,
        };
      }
      return {
        fieldId: 'stats-raw',
        getVal: () => statsRaw,
        setVal: setStatsRaw,
        isExpressionField: true,
      };
    }

    return {
      fieldId: 'calc-expr',
      getVal: () => expr,
      setVal: (next) => {
        setExpr((prev) => {
          if (next !== prev) setUndoStack((st) => [...st.slice(-19), prev]);
          return next;
        });
      },
      isExpressionField: true,
    };
  };

  const startDrag = (e: React.PointerEvent) => {
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    const onMove = (ev: PointerEvent) => {
      const maxX = Math.max(24, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 360);
      const maxY = Math.max(68, (typeof window !== 'undefined' ? window.innerHeight : 800) - 560);
      setPos({
        x: Math.max(12, Math.min(maxX, ev.clientX - startX)),
        y: Math.max(60, Math.min(maxY, ev.clientY - startY)),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const clearModifiers = () => {
    setShiftActive(false);
    setAlphaActive(false);
  };

  const handleStoreToVar = (varName: string): boolean => {
    if (!stoActive) return false;
    let val = lastResult.numeric;
    if (expr.trim()) {
      const evalCurrent = evaluateCasioExpression(expr, {
        angleUnit,
        ans: lastResult.numeric,
        preAns,
        mem: vars.M ?? 0,
        vars,
        normMode,
        fixDigits,
      });
      if (evalCurrent) {
        val = evalCurrent.numeric;
        setLastResult(evalCurrent);
      }
    }
    setVars((prev) => ({ ...prev, [varName]: val }));
    setInfoBanner(`Ans → ${varName} (${Number(val.toFixed(6))})`);
    setStoActive(false);
    clearModifiers();
    return true;
  };

  const enterCasioMode = (nextMode: CasioMainMode) => {
    setMode(nextMode);
    if (nextMode === 'equation') {
      setEqScreen('selectType');
      setEqResult(null);
      setEqResultIdx(0);
      setEqShowDecimal(false);
    } else if (nextMode === 'stats') {
      setStatsScreen('selectType');
    } else if (nextMode === 'dist') {
      setDistScreen('selectKind');
    } else if (nextMode === 'table') {
      setTableScreen('input');
    } else if (nextMode === 'ineq') {
      setIneqScreen('selectDeg');
    } else if (nextMode === 'verify') {
      setVerifyEvaluated(false);
    } else if (nextMode === 'ratio') {
      setRatioScreen('selectForm');
      setRatioShowDecimal(false);
    }
  };

  const computeCurrentEqResult = (): CasioEqFullResult => {
    if (eqSubMode === 'quad') {
      return solveCasioQuadraticFull(parseCasioCoeff(qa), parseCasioCoeff(qb), parseCasioCoeff(qc));
    }
    if (eqSubMode === 'cubic') {
      return solveCasioCubicFull(
        parseCasioCoeff(qa),
        parseCasioCoeff(qb),
        parseCasioCoeff(qc),
        parseCasioCoeff(qd)
      );
    }
    if (eqSubMode === 'quartic') {
      return solveCasioQuarticFull(
        parseCasioCoeff(qa),
        parseCasioCoeff(qb),
        parseCasioCoeff(qc),
        parseCasioCoeff(qd),
        parseCasioCoeff(qe)
      );
    }
    if (eqSubMode === 'sys2') {
      const n = sys2.map(parseCasioCoeff);
      return solveCasioLinearSystemFull([
        [n[0], n[1], n[2]],
        [n[3], n[4], n[5]],
      ]);
    }
    if (eqSubMode === 'sys3') {
      return solveCasioLinearSystemFull(sys3.map((r) => r.map(parseCasioCoeff)));
    }
    return solveCasioLinearSystemFull(sys4.map((r) => r.map(parseCasioCoeff)));
  };

  const handleSolveEquationMode = () => {
    const res = computeCurrentEqResult();
    setEqResult(res);
    setEqResultIdx(0);
    setEqShowDecimal(false);
    setEqScreen('result');
    const firstNum = res.steps[0]?.numeric;
    if (firstNum !== undefined && Number.isFinite(firstNum)) {
      setPreAns(lastResult.numeric);
      setLastResult(formatCasioExact(firstNum, normMode, fixDigits));
    }
    clearModifiers();
  };

  /**
   * Authentic Casio fx-580VN X sub-menu key dispatch across Modes 6, 7, 9, A, and C:
   * Lets users tap `MENU 9 2 2`, `MENU 6 1`, `MENU 7 2`, `MENU A 2 1`, `MENU C 1` straight on the keypad.
   */
  const tryHandleSubMenuKey = (rawKey: string): boolean => {
    if (overlay !== null) return false;
    const k = rawKey.trim();

    if (mode === 'equation') {
      if (eqScreen === 'selectType') {
        if (k === '1') {
          setEqScreen('selectSimulDeg');
          clearModifiers();
          return true;
        }
        if (k === '2') {
          setEqScreen('selectPolyDeg');
          clearModifiers();
          return true;
        }
        return true;
      }
      if (eqScreen === 'selectSimulDeg') {
        if (k === '2' || k === '3' || k === '4') {
          setEqSubMode(k === '2' ? 'sys2' : k === '3' ? 'sys3' : 'sys4');
          setEqScreen('input');
          clearModifiers();
          return true;
        }
        return true;
      }
      if (eqScreen === 'selectPolyDeg') {
        if (k === '2' || k === '3' || k === '4') {
          setEqSubMode(k === '2' ? 'quad' : k === '3' ? 'cubic' : 'quartic');
          setEqScreen('input');
          clearModifiers();
          return true;
        }
        return true;
      }
    }

    if (mode === 'stats' && statsScreen === 'selectType') {
      if (k === '1') {
        setStatsSubMode('1var');
        setStatsScreen('input');
        clearModifiers();
        return true;
      }
      if (k === '2') {
        setStatsSubMode('linreg');
        setStatsScreen('input');
        clearModifiers();
        return true;
      }
      return true;
    }

    if (mode === 'dist' && distScreen === 'selectKind') {
      const distMap: Record<string, CasioDistKind> = {
        '1': 'normalPD',
        '2': 'normalCD',
        '3': 'invNormal',
        '4': 'binomialPD',
        '5': 'binomialCD',
        '6': 'poissonPD',
        '7': 'poissonCD',
      };
      if (distMap[k]) {
        setDistKind(distMap[k]);
        setDistScreen('input');
        clearModifiers();
        return true;
      }
      return true;
    }

    if (mode === 'ineq') {
      if (ineqScreen === 'selectDeg') {
        if (k === '2' || k === '3') {
          setIneqDegree(k === '2' ? 2 : 3);
          setIneqScreen('selectOp');
          clearModifiers();
          return true;
        }
        return true;
      }
      if (ineqScreen === 'selectOp') {
        const opMap: Record<string, '>' | '<' | '>=' | '<='> = {
          '1': '>',
          '2': '<',
          '3': '>=',
          '4': '<=',
        };
        if (opMap[k]) {
          setIneqOp(opMap[k]);
          setIneqScreen('input');
          clearModifiers();
          return true;
        }
        return true;
      }
    }

    if (mode === 'ratio' && ratioScreen === 'selectForm') {
      if (k === '1') {
        setRatioUnknown('c');
        setRatioScreen('input');
        clearModifiers();
        return true;
      }
      if (k === '2') {
        setRatioUnknown('d');
        setRatioScreen('input');
        clearModifiers();
        return true;
      }
      return true;
    }

    return false;
  };

  /**
   * Authentic Casio fx-580VN X MENU shortcut dispatch:
   * Pressing 1..9 or A/B/C (or physical keys -, °, inv) while on MENU jumps directly into that mode.
   */
  const trySelectMenuByKey = (rawKey: string): boolean => {
    if (mode !== 'menu' || overlay !== null) return false;
    const k = rawKey.trim().toUpperCase();
    const map: Record<string, CasioMainMode> = {
      '1': 'calc',
      '2': 'complex',
      '3': 'basen',
      '4': 'matrix',
      '5': 'vector',
      '6': 'stats',
      '7': 'dist',
      '8': 'table',
      '9': 'equation',
      A: 'ineq',
      '-': 'ineq',
      B: 'verify',
      '°': 'verify',
      C: 'ratio',
      INV: 'ratio',
    };
    const targetMode = map[k];
    if (!targetMode) return false;
    enterCasioMode(targetMode);
    clearModifiers();
    return true;
  };

  /**
   * Universal Caret-Aware Token Insertion across ALL 12 Casio modes, 2D template boxes, & overlays.
   */
  const insertTokenToActiveField = (tok: string, cursorOffsetInToken?: number) => {
    if (trySelectMenuByKey(tok)) {
      return;
    }
    if (tryHandleSubMenuKey(tok)) {
      return;
    }
    if (mode === 'equation' && eqScreen === 'result') setEqScreen('input');
    if (mode === 'stats' && statsScreen === 'result') setStatsScreen('input');
    if (mode === 'dist' && distScreen === 'result') setDistScreen('input');
    if (mode === 'table' && tableScreen === 'result') setTableScreen('input');
    if (mode === 'ineq' && ineqScreen === 'result') setIneqScreen('input');
    if (mode === 'ratio' && ratioScreen === 'result') setRatioScreen('input');
    if (mode === 'verify') setVerifyEvaluated(false);

    if (stoActive && /^[ABCDFMTxyz]$/.test(tok)) {
      handleStoreToVar(tok);
      return;
    }

    setErrorMsg(null);
    setInfoBanner(null);

    // Close informational overlays (`const`, `conv`, `recall`, `optn`, `help`) on key press, but keep `calcPrompt` open
    const nextOverlay = overlay && overlay !== 'calcPrompt' ? null : overlay;
    if (overlay && overlay !== 'calcPrompt') {
      setOverlay(null);
    }
    const nextMode = mode === 'menu' ? 'calc' : mode;
    if (mode === 'menu') {
      setMode('calc');
    }

    const offset = cursorOffsetInToken ?? tok.length;

    // In Mode 1 (Calculate) with no active prompt overlay: splice directly into the active 2D Natural-V.P.A.M. slot box!
    if (nextMode === 'calc' && nextOverlay === null) {
      const curSlot = getActiveCalcSlot();
      const el = getFieldInputEl(curSlot.id);
      const selStart = el?.selectionStart ?? caretPosRef.current ?? curSlot.value.length;
      const selEnd = el?.selectionEnd ?? selStart;

      if (curSlot.role === 'root' && curSlot.value === '0' && /^[0-9(a-zA-Zπ\-]/.test(tok) && selStart === 1) {
        applyCalcExprEdit(tok, offset);
        return;
      }

      const absStart = curSlot.start + selStart;
      const absEnd = curSlot.start + selEnd;
      const nextExpr = expr.slice(0, absStart) + tok + expr.slice(absEnd);
      applyCalcExprEdit(nextExpr, absStart + offset);
      return;
    }

    const binding = getTargetFieldBinding();
    const el = getFieldInputEl(binding.fieldId);
    const currentVal = binding.getVal();
    const selStart = el?.selectionStart ?? caretPosRef.current ?? currentVal.length;
    const selEnd = el?.selectionEnd ?? selStart;

    let nextVal = '';
    let nextCaret = 0;

    if (!binding.isExpressionField && selStart === 0 && selEnd === currentVal.length && currentVal.length > 0) {
      nextVal = tok;
      nextCaret = offset;
    } else if (currentVal === '0' && /^[0-9(a-zA-Zπ\-]/.test(tok) && selStart === currentVal.length) {
      nextVal = tok;
      nextCaret = offset;
    } else {
      nextVal = currentVal.slice(0, selStart) + tok + currentVal.slice(selEnd);
      nextCaret = selStart + offset;
    }

    binding.setVal(nextVal);
    focusFieldAtCaret(binding.fieldId, nextCaret);
    clearModifiers();
    setStoActive(false);
  };

  /**
   * Smart 2D Fraction insertion (`□/□` button or `/` key in Mode 1):
   * - Wraps trailing token before caret as numerator `frac(tok;)` and focuses denominator box, OR
   * - Inserts empty `frac(;)` and focuses numerator box.
   */
  const handleInsertSmartFraction = () => {
    if (mode !== 'calc' || overlay !== null) {
      insertTokenToActiveField('/');
      return;
    }
    const curSlot = getActiveCalcSlot();
    const el = getFieldInputEl(curSlot.id);
    const selStart = el?.selectionStart ?? caretPosRef.current ?? curSlot.value.length;
    const selEnd = el?.selectionEnd ?? selStart;

    if (selStart === selEnd) {
      const before = curSlot.value.slice(0, selStart);
      const m = /([a-zA-Z0-9.π]+|\([^()]+\))$/.exec(before);
      if (m) {
        const numTok = m[1];
        const tokStartInExpr = curSlot.start + selStart - numTok.length;
        const replacement = `frac(${numTok};)`;
        const nextExpr = expr.slice(0, tokStartInExpr) + replacement + expr.slice(curSlot.start + selEnd);
        // Place caret inside denominator box
        applyCalcExprEdit(nextExpr, tokStartInExpr + 5 + numTok.length + 1);
        return;
      }
    }

    insertTokenToActiveField('frac(;)', 5);
  };

  /**
   * Smart 2D Power insertion (`x^□`, `x²`, `x³`, `x⁻¹`, or `^` key in Mode 1):
   * - Wraps trailing base token before caret into `pow(base;exp)`
   * - Otherwise inserts `pow(;exp)` and focuses the base box.
   */
  const handleInsertSmartPower = (defaultExp = '') => {
    if (mode !== 'calc' || overlay !== null) {
      insertTokenToActiveField(defaultExp ? `^(${defaultExp})` : '^');
      return;
    }
    const curSlot = getActiveCalcSlot();
    const el = getFieldInputEl(curSlot.id);
    const selStart = el?.selectionStart ?? caretPosRef.current ?? curSlot.value.length;
    const selEnd = el?.selectionEnd ?? selStart;

    if (selStart === selEnd) {
      const before = curSlot.value.slice(0, selStart);
      // Match parenthesized group, trailing number, OR single trailing variable/pi so `3x` + `x²` -> `3pow(x;2)` (NOT `(3x)²`)!
      const m = /(\([^()]+\)|[0-9.]+|[a-zA-Zπ])$/.exec(before);
      if (m) {
        const baseTok = m[1];
        const tokStartInExpr = curSlot.start + selStart - baseTok.length;
        const replacement = `pow(${baseTok};${defaultExp})`;
        const nextExpr = expr.slice(0, tokStartInExpr) + replacement + expr.slice(curSlot.start + selEnd);
        const targetCaret = defaultExp
          ? tokStartInExpr + replacement.length
          : tokStartInExpr + 4 + baseTok.length + 1;
        applyCalcExprEdit(nextExpr, targetCaret);
        return;
      }
    }

    const replacement = `pow(;${defaultExp})`;
    const absStart = curSlot.start + selStart;
    const nextExpr = expr.slice(0, absStart) + replacement + expr.slice(curSlot.start + selEnd);
    applyCalcExprEdit(nextExpr, absStart + 4);
  };

  const handleDeleteFromEmptySlot = (slot: Casio2dSlotNode) => {
    const nodes = parseCasio2dNodes(expr);
    const enclosing = findEnclosingCasio2dTemplate(nodes, slot.id);
    if (enclosing) {
      const { template, argIndex } = enclosing;
      // For `pow(base;)` or `frac(num;)` when pressing Backspace in empty 2nd box -> unwrap back to 1st arg!
      if ((template.kind === 'pow' || template.kind === 'frac') && argIndex === 1) {
        const firstArgRange = template.argRanges[0];
        const baseText = firstArgRange ? expr.slice(firstArgRange.start, firstArgRange.end) : '';
        const nextExpr = expr.slice(0, template.start) + baseText + expr.slice(template.end);
        applyCalcExprEdit(nextExpr, template.start + baseText.length);
        return;
      }

      // Check if all user arguments of `template` are empty (for `int`, arg 3 `'x'` is default)
      const allArgsEmpty = template.argRanges.every((r, idx) => {
        const txt = expr.slice(r.start, r.end).trim();
        if (template.kind === 'int' && idx === 3) return txt === '' || txt === 'x';
        return txt === '';
      });

      if (allArgsEmpty) {
        const nextExpr = expr.slice(0, template.start) + expr.slice(template.end);
        applyCalcExprEdit(nextExpr, template.start);
        return;
      }
    }

    // Otherwise move focus to the previous box
    handleDpadHorizontal(-1);
  };

  const handleDeleteChar = () => {
    setErrorMsg(null);
    setInfoBanner(null);

    if (mode === 'calc' && overlay === null) {
      const curSlot = getActiveCalcSlot();
      const el = getFieldInputEl(curSlot.id);
      const prev = curSlot.value;
      const selStart = el?.selectionStart ?? caretPosRef.current ?? prev.length;
      const selEnd = el?.selectionEnd ?? selStart;

      if (selStart !== selEnd) {
        const nextSlotVal = prev.slice(0, selStart) + prev.slice(selEnd);
        const nextExpr = expr.slice(0, curSlot.start) + nextSlotVal + expr.slice(curSlot.end);
        applyCalcExprEdit(nextExpr, curSlot.start + selStart);
        return;
      }

      if (selStart === 0) {
        handleDeleteFromEmptySlot(curSlot);
        return;
      }

      const before = prev.slice(0, selStart);
      const after = prev.slice(selStart);
      const multiSuffixes = [
        'PreAns',
        'sin⁻¹(',
        'cos⁻¹(',
        'tan⁻¹(',
        'cot⁻¹(',
        'asin(',
        'acos(',
        'atan(',
        'acot(',
        'Ceil(',
        'Intg(',
        'sin(',
        'cos(',
        'tan(',
        'cot(',
        'log(',
        'ln(',
        'abs(',
        'Ran()',
        ' ÷R ',
        ' mod ',
        'Ans',
        '×10^',
        '*10^',
      ];
      for (const suf of multiSuffixes) {
        if (before.endsWith(suf)) {
          const cut = before.slice(0, before.length - suf.length);
          const nextExpr = expr.slice(0, curSlot.start) + cut + after + expr.slice(curSlot.end);
          applyCalcExprEdit(nextExpr, curSlot.start + cut.length);
          return;
        }
      }

      const cut = before.slice(0, -1);
      const nextExpr = expr.slice(0, curSlot.start) + cut + after + expr.slice(curSlot.end);
      applyCalcExprEdit(nextExpr, curSlot.start + cut.length);
      return;
    }

    const binding = getTargetFieldBinding();
    const el = getFieldInputEl(binding.fieldId);
    const prev = binding.getVal();
    if (!prev) {
      clearModifiers();
      return;
    }

    const selStart = el?.selectionStart ?? caretPosRef.current ?? prev.length;
    const selEnd = el?.selectionEnd ?? selStart;

    if (selStart !== selEnd) {
      const next = prev.slice(0, selStart) + prev.slice(selEnd);
      binding.setVal(next);
      focusFieldAtCaret(binding.fieldId, selStart);
      clearModifiers();
      return;
    }

    const before = prev.slice(0, selStart);
    const after = prev.slice(selStart);
    if (!before) {
      clearModifiers();
      return;
    }

    const cut = before.slice(0, -1);
    binding.setVal(cut + after);
    focusFieldAtCaret(binding.fieldId, cut.length);
    clearModifiers();
  };

  const handleDpadHorizontal = (dir: -1 | 1) => {
    if (mode === 'calc' && overlay === null) {
      const nodes = parseCasio2dNodes(expr);
      const navSlots = getNavigableCasio2dSlots(nodes, activeFieldIdRef.current);
      const curSlot = getActiveCalcSlot();
      const el = getFieldInputEl(curSlot.id);
      const curPos = el?.selectionStart ?? caretPosRef.current ?? curSlot.value.length;

      if (navSlots.length > 1) {
        const idx = navSlots.findIndex((s) => s.id === curSlot.id);
        if (dir === 1) {
          if (curPos < curSlot.value.length) {
            focusFieldAtCaret(curSlot.id, curPos + 1);
            return;
          }
          const nextSlot = navSlots[(idx + 1) % navSlots.length];
          if (nextSlot) {
            focusFieldAtCaret(nextSlot.id, nextSlot.value.length);
          }
          return;
        } else {
          if (curPos > 0) {
            focusFieldAtCaret(curSlot.id, curPos - 1);
            return;
          }
          const prevSlot = navSlots[(idx - 1 + navSlots.length) % navSlots.length];
          if (prevSlot) {
            focusFieldAtCaret(prevSlot.id, prevSlot.value.length);
          }
          return;
        }
      }

      const nextPos = Math.max(0, Math.min(curSlot.value.length, curPos + dir));
      focusFieldAtCaret(curSlot.id, nextPos);
      return;
    }

    const binding = getTargetFieldBinding();
    const fields = getAllVisibleFields();

    if (fields.length > 1 && !binding.isExpressionField) {
      const idx = fields.findIndex((f) => f.getAttribute('data-casio-field') === binding.fieldId);
      const nextIdx = (idx + dir + fields.length) % fields.length;
      const nextEl = fields[nextIdx];
      const nextId = nextEl?.getAttribute('data-casio-field');
      if (nextId && nextEl) {
        setActiveField(nextId);
        nextEl.focus();
        nextEl.select();
      }
      return;
    }

    const current = binding.getVal();
    const el = getFieldInputEl(binding.fieldId);
    const curPos = el?.selectionStart ?? caretPosRef.current ?? current.length;
    const nextPos = Math.max(0, Math.min(current.length, curPos + dir));
    focusFieldAtCaret(binding.fieldId, nextPos);
  };

  const handleDpadVertical = (dir: 'up' | 'down') => {
    if (mode === 'equation' && eqScreen === 'result' && eqResult && eqResult.steps.length > 0) {
      setEqResultIdx((prev) =>
        dir === 'down'
          ? (prev + 1) % eqResult.steps.length
          : (prev - 1 + eqResult.steps.length) % eqResult.steps.length
      );
      return;
    }
    if (mode !== 'calc' || overlay !== null) {
      handleDpadHorizontal(dir === 'up' ? -1 : 1);
      return;
    }
    const curSlot = getActiveCalcSlot();
    const targetVerticalId = dir === 'up' ? curSlot.upSlotId : curSlot.downSlotId;
    if (targetVerticalId) {
      const allSlots = flattenCasio2dSlots(parseCasio2dNodes(expr));
      const targetSlot = allSlots.find((s) => s.id === targetVerticalId);
      if (targetSlot) {
        focusFieldAtCaret(targetSlot.id, targetSlot.value.length);
        return;
      }
    }
    if (history.length === 0) return;
    const nextIdx =
      dir === 'up'
        ? Math.max(0, historyIdx - 1)
        : Math.min(history.length - 1, historyIdx + 1);
    setHistoryIdx(nextIdx);
    setExpr(history[nextIdx].expr);
    setLastResult(history[nextIdx].res);
  };

  const handleUndo = () => {
    setUndoStack((st) => {
      if (st.length === 0) return st;
      const prev = st[st.length - 1];
      setExpr(prev);
      return st.slice(0, -1);
    });
    clearModifiers();
  };

  const handleAllClear = () => {
    setErrorMsg(null);
    setInfoBanner(null);
    setStoActive(false);
    clearModifiers();

    if (overlay) {
      setOverlay(null);
      return;
    }

    if (mode === 'complex') {
      setComplexExpr('');
      focusFieldAtCaret('complex-expr', 0);
      return;
    }
    if (mode === 'basen') {
      setBaseExpr('');
      focusFieldAtCaret('basen-expr', 0);
      return;
    }
    if (mode === 'stats') {
      if (statsScreen === 'result') {
        setStatsScreen('input');
        return;
      }
      if (statsScreen === 'selectType') return;
      if (statsSubMode === '1var') {
        setStatsRaw('');
        focusFieldAtCaret('stats-raw', 0);
        return;
      }
    }
    if (mode === 'dist') {
      if (distScreen === 'result') {
        setDistScreen('input');
        return;
      }
      if (distScreen === 'selectKind') return;
    }
    if (mode === 'table') {
      if (tableScreen === 'result') {
        setTableScreen('input');
        return;
      }
    }
    if (mode === 'ineq') {
      if (ineqScreen === 'result') {
        setIneqScreen('input');
        return;
      }
      if (ineqScreen === 'selectOp') {
        setIneqScreen('selectDeg');
        return;
      }
      if (ineqScreen === 'selectDeg') return;
    }
    if (mode === 'ratio') {
      if (ratioScreen === 'result') {
        setRatioScreen('input');
        return;
      }
      if (ratioScreen === 'selectForm') return;
    }
    if (mode === 'verify') {
      setVerifyEvaluated(false);
    }
    if (mode === 'equation') {
      if (eqScreen === 'result') {
        setEqScreen('input');
        return;
      }
      if (eqScreen === 'selectSimulDeg' || eqScreen === 'selectPolyDeg') {
        setEqScreen('selectType');
        return;
      }
      if (eqScreen === 'selectType') {
        return;
      }
    }
    if (
      mode === 'matrix' ||
      mode === 'vector' ||
      mode === 'dist' ||
      mode === 'equation' ||
      mode === 'ineq' ||
      mode === 'table' ||
      mode === 'verify' ||
      mode === 'ratio'
    ) {
      const binding = getTargetFieldBinding();
      binding.setVal('');
      focusFieldAtCaret(binding.fieldId, 0);
      return;
    }

    setUndoStack((st) => (expr ? [...st.slice(-19), expr] : st));
    setExpr('');
    setIsEvaluated(false);
    setLastResult({
      numeric: 0,
      decimalText: '0',
      exactLatex: '0',
      mixedLatex: '0',
      dmsText: `0°0'0"`,
      engLatex: '0',
      hasExactForm: true,
    });
    focusFieldAtCaret('slot-root', 0);
  };

  const evaluateNow = (forceDecimal = false) => {
    if (overlay === 'calcPrompt') {
      setOverlay(null);
    } else if (overlay) {
      setOverlay(null);
      return;
    }

    // Mode 9 (Equation): authentic Casio `=` stepping (next coeff -> solve -> next root/extremum -> back to edit)
    if (mode === 'equation') {
      if (eqScreen === 'selectType' || eqScreen === 'selectSimulDeg' || eqScreen === 'selectPolyDeg') {
        clearModifiers();
        return;
      }
      if (eqScreen === 'result') {
        if (eqResult && eqResult.kind === 'ok' && eqResultIdx < eqResult.steps.length - 1) {
          setEqResultIdx((prev) => prev + 1);
        } else {
          setEqScreen('input');
        }
        clearModifiers();
        return;
      }
      const fields = getAllVisibleFields();
      const idx = fields.findIndex((f) => f.getAttribute('data-casio-field') === activeFieldIdRef.current);
      if (fields.length > 0 && idx >= 0 && idx < fields.length - 1) {
        const nextEl = fields[idx + 1];
        const nextId = nextEl?.getAttribute('data-casio-field');
        if (nextId && nextEl) {
          setActiveField(nextId);
          nextEl.focus();
          nextEl.select();
        }
        clearModifiers();
        return;
      }
      handleSolveEquationMode();
      return;
    }

    // Modes with input -> result screens (Stats, Distribution, Table, Inequality, Verify, Ratio)
    if (mode === 'stats') {
      if (statsScreen === 'selectType') {
        clearModifiers();
        return;
      }
      if (statsScreen === 'result') {
        setStatsScreen('input');
        clearModifiers();
        return;
      }
      if (statsSubMode === '1var') {
        setStatsScreen('result');
        clearModifiers();
        return;
      }
      const fields = getAllVisibleFields();
      const idx = fields.findIndex((f) => f.getAttribute('data-casio-field') === activeFieldIdRef.current);
      if (fields.length > 0 && idx >= 0 && idx < fields.length - 1) {
        const nextEl = fields[idx + 1];
        const nextId = nextEl?.getAttribute('data-casio-field');
        if (nextId && nextEl) {
          setActiveField(nextId);
          nextEl.focus();
          nextEl.select();
        }
        clearModifiers();
        return;
      }
      setStatsScreen('result');
      clearModifiers();
      return;
    }

    if (mode === 'dist' || mode === 'table' || mode === 'ineq' || mode === 'ratio') {
      const isSelect =
        (mode === 'dist' && distScreen === 'selectKind') ||
        (mode === 'ineq' && (ineqScreen === 'selectDeg' || ineqScreen === 'selectOp')) ||
        (mode === 'ratio' && ratioScreen === 'selectForm');
      if (isSelect) {
        clearModifiers();
        return;
      }
      const isResult =
        (mode === 'dist' && distScreen === 'result') ||
        (mode === 'table' && tableScreen === 'result') ||
        (mode === 'ineq' && ineqScreen === 'result') ||
        (mode === 'ratio' && ratioScreen === 'result');
      if (isResult) {
        if (mode === 'dist') setDistScreen('input');
        else if (mode === 'table') setTableScreen('input');
        else if (mode === 'ineq') setIneqScreen('input');
        else setRatioScreen('input');
        clearModifiers();
        return;
      }
      const fields = getAllVisibleFields();
      const idx = fields.findIndex((f) => f.getAttribute('data-casio-field') === activeFieldIdRef.current);
      if (fields.length > 0 && idx >= 0 && idx < fields.length - 1) {
        const nextEl = fields[idx + 1];
        const nextId = nextEl?.getAttribute('data-casio-field');
        if (nextId && nextEl) {
          setActiveField(nextId);
          nextEl.focus();
          nextEl.select();
        }
        clearModifiers();
        return;
      }
      if (mode === 'dist') setDistScreen('result');
      else if (mode === 'table') setTableScreen('result');
      else if (mode === 'ineq') setIneqScreen('result');
      else setRatioScreen('result');
      clearModifiers();
      return;
    }

    if (mode === 'verify') {
      setVerifyEvaluated(true);
      clearModifiers();
      return;
    }

    // In remaining multi-field modes (Complex, Base-N, Matrix, Vector), pressing `=` advances to the next cell!
    if (mode !== 'calc') {
      const fields = getAllVisibleFields();
      if (fields.length > 1) {
        const idx = fields.findIndex((f) => f.getAttribute('data-casio-field') === activeFieldIdRef.current);
        const nextEl = fields[(idx + 1) % fields.length];
        const nextId = nextEl?.getAttribute('data-casio-field');
        if (nextId && nextEl) {
          setActiveField(nextId);
          nextEl.focus();
          nextEl.select();
        }
      }
      clearModifiers();
      return;
    }

    const target = expr.trim();
    if (!target) return;

    if (target.includes('=')) {
      const solvedAll = solveCasioEquationAllRoots(
        target,
        {
          angleUnit,
          ans: lastResult.numeric,
          preAns,
          mem: vars.M ?? 0,
          vars,
          normMode,
          fixDigits,
        },
        vars.x ?? 1
      );
      if (!solvedAll || solvedAll.roots.length === 0) {
        setErrorMsg("Can't Solve");
        setIsEvaluated(false);
        clearModifiers();
        return;
      }
      const primary = solvedAll.roots[0];
      const hasAnyExact = solvedAll.roots.some((r) => r.hasExactForm);
      setErrorMsg(null);
      setIsEvaluated(true);
      setInfoBanner(
        solvedAll.roots.length === 1
          ? 'SOLVE: 1 nghiệm thực (L − R = 0)'
          : solvedAll.hasMoreRoots
            ? `SOLVE: ${solvedAll.roots.length} nghiệm thực gần nhất`
            : `SOLVE: ${solvedAll.roots.length} nghiệm thực`
      );
      setPreAns(lastResult.numeric);
      setLastResult({
        ...primary,
        hasExactForm: hasAnyExact,
        specialSummaryLatex: solvedAll.exactSummaryLatex,
        specialDecimalLatex: solvedAll.decimalSummaryLatex,
      });
      setVars((v) => ({ ...v, x: primary.numeric }));
      setDisplayFormat(forceDecimal ? 'decimal' : hasAnyExact ? 'exact' : 'decimal');
      clearModifiers();
      return;
    }

    const res = evaluateCasioExpression(target, {
      angleUnit,
      ans: lastResult.numeric,
      preAns,
      mem: vars.M ?? 0,
      vars,
      normMode,
      fixDigits,
    });
    if (!res) {
      setErrorMsg('Syntax ERROR');
      setIsEvaluated(false);
      clearModifiers();
      return;
    }
    setErrorMsg(null);
    setIsEvaluated(true);
    setInfoBanner(null);
    setPreAns(lastResult.numeric);
    setLastResult(res);
    setDisplayFormat(forceDecimal ? 'decimal' : res.hasExactForm ? 'exact' : 'decimal');
    if (res.secondaryVars) {
      setVars((prev) => ({
        ...prev,
        ...(res.secondaryVars?.x !== undefined ? { x: res.secondaryVars.x } : {}),
        ...(res.secondaryVars?.y !== undefined ? { y: res.secondaryVars.y } : {}),
      }));
    }
    setHistory((prev) => {
      const next = [...prev.slice(-19), { expr: target, res }];
      setHistoryIdx(next.length - 1);
      return next;
    });
    clearModifiers();
  };

  const handleSolveAction = () => {
    setMode('calc');
    setOverlay(null);
    const target = expr.trim() || 'x^2 - 2';
    const solvedAll = solveCasioEquationAllRoots(
      target,
      {
        angleUnit,
        ans: lastResult.numeric,
        preAns,
        mem: vars.M ?? 0,
        vars,
        normMode,
        fixDigits,
      },
      vars.x || 1
    );
    if (!solvedAll || solvedAll.roots.length === 0) {
      setErrorMsg("Can't Solve");
      setIsEvaluated(false);
      return;
    }
    const primary = solvedAll.roots[0];
    const hasAnyExact = solvedAll.roots.some((r) => r.hasExactForm);
    setErrorMsg(null);
    setIsEvaluated(true);
    setInfoBanner(
      solvedAll.roots.length === 1
        ? 'SOLVE (x): 1 nghiệm thực (L − R = 0)'
        : solvedAll.hasMoreRoots
          ? `SOLVE (x): ${solvedAll.roots.length} nghiệm thực gần nhất`
          : `SOLVE (x): ${solvedAll.roots.length} nghiệm thực`
    );
    setPreAns(lastResult.numeric);
    setLastResult({
      ...primary,
      hasExactForm: hasAnyExact,
      specialSummaryLatex: solvedAll.exactSummaryLatex,
      specialDecimalLatex: solvedAll.decimalSummaryLatex,
    });
    setVars((v) => ({ ...v, x: primary.numeric }));
    setDisplayFormat(hasAnyExact ? 'exact' : 'decimal');
  };

  const handleFactAction = () => {
    const targetVal = expr.trim()
      ? evaluateCasioExpression(expr, { angleUnit, ans: lastResult.numeric, preAns, vars })?.numeric ??
        lastResult.numeric
      : lastResult.numeric;
    const factLatex = factorizeIntegerLatex(targetVal);
    if (!factLatex) {
      setErrorMsg('FACT: Cần số nguyên');
      setIsEvaluated(false);
      return;
    }
    setErrorMsg(null);
    setIsEvaluated(true);
    setInfoBanner(`FACT(${Math.round(targetVal)})`);
    setLastResult({
      ...formatCasioExact(targetVal, normMode, fixDigits),
      specialSummaryLatex: factLatex,
    });
  };

  const handleToggleSD = () => {
    if (mode === 'equation' && eqScreen === 'result') {
      setEqShowDecimal((v) => !v);
      return;
    }
    if (mode === 'ratio' && ratioScreen === 'result') {
      setRatioShowDecimal((v) => !v);
      return;
    }
    if (displayFormat === 'exact') setDisplayFormat('decimal');
    else setDisplayFormat('exact');
  };

  const handleToggleMixed = () => {
    if (displayFormat === 'mixed') setDisplayFormat('exact');
    else if (lastResult.mixedLatex) setDisplayFormat('mixed');
    else handleToggleSD();
  };

  const handleStampToBoard = () => {
    const state = useBoardStore.getState();
    const { camera } = state;
    const viewW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const safeRect = getSafeMathViewport({
      viewW,
      viewH,
      isMathPanelOpen: state.boardType === 'math',
      isMathPanelCollapsed: state.isMathPanelCollapsed,
      isCalculatorOpen: true,
      isCalculatorMinimized: isMinimized,
      calculatorX: pos.x,
      hasPinnedProblem: Boolean(state.pinnedProblem),
      isPinnedProblemCollapsed: Boolean(state.pinnedProblem?.collapsed),
    });
    const safeWorld = computeSafeWorldCenter(camera, safeRect, state.elements.length);
    const cx = safeWorld.x;
    const cy = safeWorld.y;
    const maxZ = state.elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0);

    let fullLatex = '';
    let boxHeight = 62;

    if (mode === 'equation') {
      const res = eqResult ?? computeCurrentEqResult();
      if (eqSubMode === 'sys2') {
        fullLatex = `\\begin{cases} ${sys2[0]}x + (${sys2[1]})y = ${sys2[2]} \\\\ ${sys2[3]}x + (${sys2[4]})y = ${sys2[5]} \\end{cases} \\Rightarrow ${res.summaryLatex}`;
        boxHeight = 86;
      } else if (eqSubMode === 'sys3') {
        fullLatex = `\\text{Hệ 3 ẩn} \\Rightarrow ${res.summaryLatex}`;
        boxHeight = 68;
      } else if (eqSubMode === 'sys4') {
        fullLatex = `\\text{Hệ 4 ẩn} \\Rightarrow ${res.summaryLatex}`;
        boxHeight = 68;
      } else if (eqSubMode === 'quad') {
        fullLatex = `${qa}x^2 + (${qb})x + (${qc}) = 0 \\Rightarrow ${res.summaryLatex}`;
      } else if (eqSubMode === 'cubic') {
        fullLatex = `${qa}x^3 + (${qb})x^2 + (${qc})x + (${qd}) = 0 \\Rightarrow ${res.summaryLatex}`;
      } else {
        fullLatex = `${qa}x^4 + (${qb})x^3 + (${qc})x^2 + (${qd})x + (${qe}) = 0 \\Rightarrow ${res.summaryLatex}`;
      }
    } else if (mode === 'complex') {
      const cmp = evaluateCasioComplex(complexExpr, angleUnit);
      fullLatex = cmp
        ? `${complexExpr} = ${formatComplexLatex(cmp, complexPolar, angleUnit)}`
        : complexExpr;
    } else if (mode === 'basen') {
      const bn = evaluateCasioBaseN(baseExpr, baseMode);
      fullLatex = bn
        ? `(${baseExpr})_{${baseMode}} = ${bn.dec}_{10} = \\text{${bn.hex}}_{16} = ${bn.bin}_2`
        : baseExpr;
    } else if (mode === 'matrix') {
      const numA = matA.map((r) => r.map(parseCasioCoeff));
      const numB = matB.map((r) => r.map(parseCasioCoeff));
      if (matOp === 'det') {
        fullLatex = `\\det(${matrixToLatex(numA)}) = ${formatCasioExact(computeMatrixDet(numA)).exactLatex}`;
      } else if (matOp === 'inv') {
        const inv = computeMatrixInverse(numA);
        fullLatex = inv ? `${matrixToLatex(numA)}^{-1} = ${matrixToLatex(inv)}` : `\\det(A) = 0`;
      } else if (matOp === 'sq') {
        fullLatex = `${matrixToLatex(numA)}^2 = ${matrixToLatex(multiplyMatrices(numA, numA))}`;
      } else if (matOp === 'add') {
        const sumM = numA.map((r, ri) => r.map((v, ci) => v + numB[ri][ci]));
        fullLatex = `${matrixToLatex(numA)} + ${matrixToLatex(numB)} = ${matrixToLatex(sumM)}`;
      } else if (matOp === 'sub') {
        fullLatex = `${matrixToLatex(numA)} - ${matrixToLatex(numB)} = ${matrixToLatex(subtractMatrices(numA, numB))}`;
      } else if (matOp === 'trn') {
        fullLatex = `${matrixToLatex(numA)}^T = ${matrixToLatex(transposeMatrix(numA))}`;
      } else {
        fullLatex = `${matrixToLatex(numA)} \\times ${matrixToLatex(numB)} = ${matrixToLatex(multiplyMatrices(numA, numB))}`;
      }
      boxHeight = matSize === 4 ? 132 : matSize === 3 ? 110 : 86;
    } else if (mode === 'vector') {
      const u = vecU.slice(0, vecDim).map(parseCasioCoeff);
      const v = vecV.slice(0, vecDim).map(parseCasioCoeff);
      const res = computeVectorMetrics(u, v, angleUnit);
      fullLatex = `\\vec{u}=(${u.join(';')}),\\; \\vec{v}=(${v.join(';')}) \\Rightarrow \\vec{u}\\cdot\\vec{v}=${Number(res.dot.toFixed(3))}`;
    } else if (mode === 'dist') {
      const res = computeCasioDistribution({
        kind: distKind,
        x: parseCasioCoeff(distX),
        lower: parseCasioCoeff(distLower),
        upper: parseCasioCoeff(distUpper),
        mu: parseCasioCoeff(distMu),
        sigma: parseCasioCoeff(distSigma),
        area: parseCasioCoeff(distArea),
        n: parseCasioCoeff(distN),
        p: parseCasioCoeff(distP),
        lambda: parseCasioCoeff(distLambda),
      });
      fullLatex = res ? res.summaryLatex : '\\text{Phân phối xác suất}';
    } else if (mode === 'ineq') {
      const opTex = ineqOp === '>=' ? '\\ge' : ineqOp === '<=' ? '\\le' : ineqOp;
      if (ineqDegree === 3) {
        const res = solveCubicInequality(
          parseCasioCoeff(qa),
          parseCasioCoeff(qb),
          parseCasioCoeff(qc),
          parseCasioCoeff(qd),
          ineqOp
        );
        fullLatex = `${qa}x^3 + (${qb})x^2 + (${qc})x + (${qd}) ${opTex} 0 \\Leftrightarrow ${res.summaryLatex}`;
      } else {
        const res = solveQuadraticInequality(
          parseCasioCoeff(qa),
          parseCasioCoeff(qb),
          parseCasioCoeff(qc),
          ineqOp
        );
        fullLatex = `${qa}x^2 + (${qb})x + (${qc}) ${opTex} 0 \\Leftrightarrow ${res.summaryLatex}`;
      }
    } else if (mode === 'verify') {
      const res = evaluateCasioVerify(verifyLhs, verifyOp, verifyRhs, {
        angleUnit,
        ans: lastResult.numeric,
        preAns,
        vars,
        normMode,
        fixDigits,
      });
      fullLatex = res ? res.summaryLatex : `${verifyLhs} ${verifyOp} ${verifyRhs}`;
    } else if (mode === 'ratio') {
      const res = solveCasioRatio(
        parseCasioCoeff(ratioA),
        parseCasioCoeff(ratioB),
        parseCasioCoeff(ratioC),
        parseCasioCoeff(ratioD),
        ratioUnknown
      );
      const eqStr =
        ratioUnknown === 'c'
          ? `${ratioA} : ${ratioB} = X : ${ratioD}`
          : `${ratioA} : ${ratioB} = ${ratioC} : X`;
      fullLatex = `${eqStr} \\Rightarrow ${res.summaryLatex}`;
    } else if (mode === 'stats' && statsSubMode === 'linreg' && linRegResult) {
      fullLatex = linRegResult.summaryLatex;
    } else if (mode === 'stats' && statsResult) {
      fullLatex = `n=${statsResult.n},\\; \\bar{x}=${Number(statsResult.mean.toFixed(3))},\\; M_e=${Number(statsResult.median.toFixed(3))},\\; \\sigma=${Number(statsResult.popStd.toFixed(3))}`;
    } else {
      let currentResult = lastResult;
      if (!isEvaluated && expr.trim()) {
        const evaluated = evaluateCasioExpression(expr.trim(), {
          angleUnit,
          ans: lastResult.numeric,
          preAns,
          mem: vars.M ?? 0,
          vars,
          normMode,
          fixDigits,
        });
        if (evaluated) {
          currentResult = evaluated;
          setLastResult(evaluated);
          setIsEvaluated(true);
        }
      }
      const exprTex = casioExprToNaturalLatex(expr);
      const ansTex =
        displayFormat === 'decimal' && currentResult.specialDecimalLatex
          ? currentResult.specialDecimalLatex
          : currentResult.specialSummaryLatex ??
            (displayFormat === 'mixed' && currentResult.mixedLatex
              ? currentResult.mixedLatex
              : displayFormat === 'eng' && currentResult.engLatex
                ? currentResult.engLatex
                : displayFormat === 'exact' && currentResult.hasExactForm
                  ? currentResult.exactLatex
                  : currentResult.decimalText);
      fullLatex = currentResult.specialDecimalLatex
        ? `${exprTex}${expr.includes('=') ? '' : ' = 0'} \\Rightarrow ${ansTex}`
        : `${exprTex} = ${ansTex}`;
    }

    const el: FormulaElement = {
      id: uid('el'),
      type: 'formula',
      x: Math.round(cx - 160),
      y: Math.round(cy - boxHeight / 2),
      width: Math.max(200, Math.min(560, fullLatex.length * 8 + 90)),
      height: boxHeight,
      latex: fullLatex,
      color: state.color,
      fontSize: 21,
      zIndex: maxZ + 1,
    };
    addElement(el, true);
    addToast('Đã dán kết quả từ Casio fx-580VN X lên bảng', 'success');
  };

  const runKey = (onNormal: () => void, onShift?: () => void, onAlpha?: () => void) => {
    if (shiftActive && onShift) {
      onShift();
      clearModifiers();
      return;
    }
    if (alphaActive && onAlpha) {
      onAlpha();
      clearModifiers();
      return;
    }
    onNormal();
    clearModifiers();
  };

  // Scientific Keys Matrix (3 rows × 6 cols matching uploaded Casio fx-580VN X layout)
  const sciRow1: SciKeyDef[] = [
    {
      id: 'frac',
      label: '□/□',
      labelLatex: '\\frac{\\square}{\\square}',
      shiftLabel: '■a/b',
      alphaLabel: '÷R',
      title: 'Phân số (SHIFT: Hỗn số, ALPHA: Chia có dư ÷R)',
      onPress: handleInsertSmartFraction,
      onShiftPress: () => insertTokenToActiveField('mixfrac(;;)', 8),
      onAlphaPress: () => insertTokenToActiveField(' ÷R '),
    },
    {
      id: 'sqrt',
      label: '√□',
      labelLatex: '\\sqrt{\\square}',
      shiftLabel: '³√□',
      alphaLabel: '(■)',
      title: 'Căn bậc hai (SHIFT: Căn bậc ba, ALPHA: Số thập phân tuần hoàn)',
      onPress: () => insertTokenToActiveField('sqrt()', 5),
      onShiftPress: () => insertTokenToActiveField('cbrt()', 5),
      onAlphaPress: () => insertTokenToActiveField('()', 1),
    },
    {
      id: 'sq',
      label: 'x²',
      labelLatex: 'x^{2}',
      shiftLabel: 'x³',
      alphaLabel: 'DEC',
      title: 'Bình phương (SHIFT: lập phương, Mode 3 Base-N: DEC)',
      onPress: () => {
        if (mode === 'basen') {
          const cur = evaluateCasioBaseN(baseExpr, baseMode);
          setBaseMode('DEC');
          if (cur) setBaseExpr(cur.dec);
          return;
        }
        handleInsertSmartPower('2');
      },
      onShiftPress: () => handleInsertSmartPower('3'),
      onAlphaPress: () => insertTokenToActiveField(' mod '),
    },
    {
      id: 'pow',
      label: 'x^□',
      labelLatex: 'x^{\\square}',
      shiftLabel: 'ˣ√□',
      alphaLabel: 'HEX',
      title: 'Lũy thừa (SHIFT: căn bậc n, Mode 3 Base-N: HEX, ALPHA: cot)',
      onPress: () => {
        if (mode === 'basen') {
          const cur = evaluateCasioBaseN(baseExpr, baseMode);
          setBaseMode('HEX');
          if (cur) setBaseExpr(cur.hex);
          return;
        }
        handleInsertSmartPower('');
      },
      onShiftPress: () => insertTokenToActiveField('nroot(;)', 6),
      onAlphaPress: () => insertTokenToActiveField('cot('),
    },
    {
      id: 'logb',
      label: 'log□',
      labelLatex: '\\log_{\\square}\\square',
      shiftLabel: '10^□',
      alphaLabel: 'BIN',
      title: 'Logarit cơ số bất kỳ (SHIFT: 10^x, Mode 3 Base-N: BIN, ALPHA: cot⁻¹)',
      onPress: () => {
        if (mode === 'basen') {
          const cur = evaluateCasioBaseN(baseExpr, baseMode);
          setBaseMode('BIN');
          if (cur) setBaseExpr(cur.bin);
          return;
        }
        insertTokenToActiveField('logb(;)', 5);
      },
      onShiftPress: () => insertTokenToActiveField('pow(10;)', 7),
      onAlphaPress: () => insertTokenToActiveField('cot⁻¹('),
    },
    {
      id: 'ln',
      label: 'ln',
      shiftLabel: 'e^□',
      alphaLabel: 'OCT',
      title: 'Logarit tự nhiên ln (SHIFT: e^x, Mode 3 Base-N: OCT)',
      onPress: () => {
        if (mode === 'basen') {
          const cur = evaluateCasioBaseN(baseExpr, baseMode);
          setBaseMode('OCT');
          if (cur) setBaseExpr(cur.oct);
          return;
        }
        insertTokenToActiveField('ln(');
      },
      onShiftPress: () => insertTokenToActiveField('pow(e;)', 6),
    },
  ];

  const sciRow2: SciKeyDef[] = [
    {
      id: 'neg',
      label: '(−)',
      shiftLabel: 'log',
      alphaLabel: 'A',
      title: 'Dấu âm (SHIFT: log10, ALPHA: biến A · MENU A: bất PT · HEX: A)',
      onPress: () => {
        if (trySelectMenuByKey('A')) return;
        if (mode === 'basen' && baseMode === 'HEX') {
          insertTokenToActiveField('A');
          return;
        }
        insertTokenToActiveField('-');
      },
      onShiftPress: () => insertTokenToActiveField('log('),
      onAlphaPress: () => insertTokenToActiveField('A'),
    },
    {
      id: 'dms',
      label: `° ' "`,
      shiftLabel: 'FACT',
      alphaLabel: 'B',
      title: `Độ phút giây (SHIFT: phân tích thừa số NT FACT, ALPHA: biến B · MENU B: đúng/sai · HEX: B)`,
      onPress: () => {
        if (trySelectMenuByKey('B')) return;
        if (mode === 'basen' && baseMode === 'HEX') {
          insertTokenToActiveField('B');
          return;
        }
        if (expr.trim()) insertTokenToActiveField('°');
        else setDisplayFormat((f) => (f === 'dms' ? 'exact' : 'dms'));
      },
      onShiftPress: handleFactAction,
      onAlphaPress: () => insertTokenToActiveField('B'),
    },
    {
      id: 'inv',
      label: 'x⁻¹',
      labelLatex: 'x^{-1}',
      shiftLabel: 'x!',
      alphaLabel: 'C',
      title: 'Nghịch đảo (SHIFT: giai thừa !, ALPHA: biến C · MENU C: tỉ lệ thức · HEX: C)',
      onPress: () => {
        if (trySelectMenuByKey('C')) return;
        if (mode === 'basen' && baseMode === 'HEX') {
          insertTokenToActiveField('C');
          return;
        }
        handleInsertSmartPower('-1');
      },
      onShiftPress: () => insertTokenToActiveField('!'),
      onAlphaPress: () => insertTokenToActiveField('C'),
    },
    {
      id: 'sin',
      label: 'sin',
      shiftLabel: 'sin⁻¹',
      alphaLabel: 'D',
      title: 'Sin (SHIFT: sin⁻¹, ALPHA: biến D · HEX: D)',
      onPress: () => {
        if (mode === 'basen' && baseMode === 'HEX') {
          insertTokenToActiveField('D');
          return;
        }
        insertTokenToActiveField('sin(');
      },
      onShiftPress: () => insertTokenToActiveField('sin⁻¹('),
      onAlphaPress: () => insertTokenToActiveField('D'),
    },
    {
      id: 'cos',
      label: 'cos',
      shiftLabel: 'cos⁻¹',
      alphaLabel: 'E',
      title: 'Cos (SHIFT: cos⁻¹, ALPHA: biến T / HEX: E)',
      onPress: () => {
        if (mode === 'basen' && baseMode === 'HEX') {
          insertTokenToActiveField('E');
          return;
        }
        insertTokenToActiveField('cos(');
      },
      onShiftPress: () => insertTokenToActiveField('cos⁻¹('),
      onAlphaPress: () => insertTokenToActiveField(mode === 'basen' ? 'E' : 'T'),
    },
    {
      id: 'tan',
      label: 'tan',
      shiftLabel: 'tan⁻¹',
      alphaLabel: 'F',
      title: 'Tan (SHIFT: tan⁻¹, ALPHA: biến F · HEX: F)',
      onPress: () => {
        if (mode === 'basen' && baseMode === 'HEX') {
          insertTokenToActiveField('F');
          return;
        }
        insertTokenToActiveField('tan(');
      },
      onShiftPress: () => insertTokenToActiveField('tan⁻¹('),
      onAlphaPress: () => insertTokenToActiveField('F'),
    },
  ];

  const sciRow3: SciKeyDef[] = [
    {
      id: 'sto',
      label: 'STO',
      shiftLabel: 'RECALL',
      title: 'Lưu giá trị vào biến (SHIFT: Xem tất cả biến nhớ)',
      onPress: () => {
        setStoActive((v) => !v);
        setAlphaActive(true);
        setShiftActive(false);
        setInfoBanner('STO: Bấm phím biến (A..F, x, y, z, M)');
      },
      onShiftPress: () => setOverlay((o) => (o === 'recall' ? null : 'recall')),
    },
    {
      id: 'eng',
      label: 'ENG',
      shiftLabel: '∠',
      alphaLabel: 'i',
      title: 'Ký hiệu kỹ thuật ENG (SHIFT: Góc phức ∠, ALPHA: Đơn vị ảo i)',
      onPress: () => setDisplayFormat((f) => (f === 'eng' ? 'exact' : 'eng')),
      onShiftPress: () => {
        if (mode !== 'complex') setMode('complex');
        insertTokenToActiveField('∠');
      },
      onAlphaPress: () => {
        if (mode !== 'complex') setMode('complex');
        insertTokenToActiveField('i');
      },
    },
    {
      id: 'lparen',
      label: '(',
      shiftLabel: 'Abs',
      alphaLabel: 'x',
      title: 'Mở ngoặc (SHIFT: Giá trị tuyệt đối Abs, ALPHA: Biến x)',
      onPress: () => insertTokenToActiveField('('),
      onShiftPress: () => insertTokenToActiveField('abs('),
      onAlphaPress: () => insertTokenToActiveField('x'),
    },
    {
      id: 'rparen',
      label: ')',
      shiftLabel: ';',
      alphaLabel: 'y',
      title: 'Đóng ngoặc',
      onPress: () => insertTokenToActiveField(')'),
      onShiftPress: () => {
        if (mode === 'calc' && overlay === null) handleDpadHorizontal(1);
        else insertTokenToActiveField(';');
      },
      onAlphaPress: () => insertTokenToActiveField('y'),
    },
    {
      id: 'sd',
      label: 'S⇔D',
      shiftLabel: 'a b/c⇔d/c',
      alphaLabel: 'z',
      title: 'Chuyển đổi Phân số/Căn ↔ Thập phân',
      onPress: handleToggleSD,
      onShiftPress: handleToggleMixed,
      onAlphaPress: () => insertTokenToActiveField('z'),
    },
    {
      id: 'mplus',
      label: 'M+',
      shiftLabel: 'M−',
      alphaLabel: 'M',
      title: 'Cộng bộ nhớ M (SHIFT: Trừ M, ALPHA: Biến M)',
      onPress: () => {
        if (Number.isFinite(lastResult.numeric)) {
          setVars((v) => ({ ...v, M: (v.M ?? 0) + lastResult.numeric }));
          setInfoBanner(`M = ${Number(((vars.M ?? 0) + lastResult.numeric).toFixed(5))}`);
        }
      },
      onShiftPress: () => {
        if (Number.isFinite(lastResult.numeric)) {
          setVars((v) => ({ ...v, M: (v.M ?? 0) - lastResult.numeric }));
          setInfoBanner(`M = ${Number(((vars.M ?? 0) - lastResult.numeric).toFixed(5))}`);
        }
      },
      onAlphaPress: () => insertTokenToActiveField('M'),
    },
  ];

  // Numpad & Arithmetic Matrix (4 rows × 5 cols matching uploaded Casio fx-580VN X)
  const numRows: NumKeyDef[][] = [
    [
      {
        id: 'k7',
        label: '7',
        shiftLabel: 'CONST',
        title: 'Số 7 (SHIFT: Hằng số khoa học CONST)',
        onPress: () => insertTokenToActiveField('7'),
        onShiftPress: () => setOverlay((o) => (o === 'const' ? null : 'const')),
      },
      {
        id: 'k8',
        label: '8',
        shiftLabel: 'CONV',
        title: 'Số 8 (SHIFT: Đổi đơn vị CONV)',
        onPress: () => insertTokenToActiveField('8'),
        onShiftPress: () => setOverlay((o) => (o === 'conv' ? null : 'conv')),
      },
      {
        id: 'k9',
        label: '9',
        shiftLabel: 'Limit',
        alphaLabel: '∞',
        title: 'Số 9 (SHIFT: Giới hạn Limit, ALPHA: Vô cực ∞)',
        onPress: () => insertTokenToActiveField('9'),
        onShiftPress: () => insertTokenToActiveField('lim(;)', 4),
        onAlphaPress: () => insertTokenToActiveField('∞'),
      },
      {
        id: 'del',
        label: 'DEL',
        shiftLabel: 'INS',
        alphaLabel: 'UNDO',
        title: 'Xóa ký tự (ALPHA: Hoàn tác UNDO)',
        variant: 'blue',
        testId: 'casio-del-key',
        onPress: handleDeleteChar,
        onShiftPress: () => getFieldInputEl(activeFieldIdRef.current)?.focus(),
        onAlphaPress: handleUndo,
      },
      {
        id: 'ac',
        label: 'AC',
        shiftLabel: 'OFF',
        title: 'Xóa toàn bộ (SHIFT: Đóng máy tính)',
        variant: 'blue',
        testId: 'casio-ac-key',
        onPress: handleAllClear,
        onShiftPress: () => setIsOpen(false),
      },
    ],
    [
      {
        id: 'k4',
        label: '4',
        shiftLabel: 'MATRIX',
        alphaLabel: '▦',
        title: 'Số 4 (SHIFT: chế độ ma trận)',
        onPress: () => insertTokenToActiveField('4'),
        onShiftPress: () => {
          setOverlay(null);
          setMode('matrix');
        },
        onAlphaPress: () => {
          setOverlay(null);
          setMode('matrix');
        },
      },
      {
        id: 'k5',
        label: '5',
        shiftLabel: 'VECTOR',
        title: 'Số 5 (SHIFT: chế độ vectơ)',
        onPress: () => insertTokenToActiveField('5'),
        onShiftPress: () => {
          setOverlay(null);
          setMode('vector');
        },
      },
      {
        id: 'k6',
        label: '6',
        shiftLabel: 'STAT',
        title: 'Số 6 (SHIFT: chế độ thống kê)',
        onPress: () => insertTokenToActiveField('6'),
        onShiftPress: () => {
          setOverlay(null);
          enterCasioMode('stats');
        },
      },
      {
        id: 'mul',
        label: '×',
        shiftLabel: 'nPr',
        alphaLabel: 'GCD',
        title: 'Nhân (SHIFT: Chỉnh hợp P, ALPHA: ƯCLN GCD)',
        onPress: () => insertTokenToActiveField('×'),
        onShiftPress: () => insertTokenToActiveField('P'),
        onAlphaPress: () => insertTokenToActiveField('GCD(;)', 4),
      },
      {
        id: 'div',
        label: '÷',
        shiftLabel: 'nCr',
        alphaLabel: 'LCM',
        title: 'Chia (SHIFT: Tổ hợp C, ALPHA: BCNN LCM)',
        onPress: () => insertTokenToActiveField('÷'),
        onShiftPress: () => insertTokenToActiveField('C'),
        onAlphaPress: () => insertTokenToActiveField('LCM(;)', 4),
      },
    ],
    [
      { id: 'k1', label: '1', title: 'Số 1', onPress: () => insertTokenToActiveField('1') },
      {
        id: 'k2',
        label: '2',
        shiftLabel: 'CMPLX',
        title: 'Số 2 (SHIFT: Chế độ Số phức)',
        onPress: () => insertTokenToActiveField('2'),
        onShiftPress: () => {
          setOverlay(null);
          setMode('complex');
        },
      },
      { id: 'k3', label: '3', title: 'Số 3', onPress: () => insertTokenToActiveField('3') },
      {
        id: 'plus',
        label: '+',
        shiftLabel: 'Pol',
        alphaLabel: 'Ceil',
        title: 'Cộng (SHIFT: Tọa độ cực Pol, ALPHA: Làm tròn lên Ceil)',
        onPress: () => insertTokenToActiveField('+'),
        onShiftPress: () => insertTokenToActiveField('Pol(;)', 4),
        onAlphaPress: () => insertTokenToActiveField('Ceil('),
      },
      {
        id: 'minus',
        label: '−',
        shiftLabel: 'Rec',
        alphaLabel: 'Intg',
        title: 'Trừ (SHIFT: Tọa độ Descartes Rec, ALPHA: Phần nguyên Intg)',
        onPress: () => insertTokenToActiveField('−'),
        onShiftPress: () => insertTokenToActiveField('Rec(;)', 4),
        onAlphaPress: () => insertTokenToActiveField('Intg('),
      },
    ],
    [
      { id: 'k0', label: '0', title: 'Số 0', onPress: () => insertTokenToActiveField('0') },
      {
        id: 'dot',
        label: '.',
        shiftLabel: 'Ran#',
        alphaLabel: 'RanInt',
        title: 'Dấu thập phân (SHIFT: Số ngẫu nhiên Ran#, ALPHA: RanInt#)',
        onPress: () => insertTokenToActiveField('.'),
        onShiftPress: () => insertTokenToActiveField('Ran()'),
        onAlphaPress: () => insertTokenToActiveField('RanInt(;)', 7),
      },
      {
        id: 'exp10',
        label: '×10ˣ',
        shiftLabel: 'π',
        alphaLabel: 'e',
        title: 'Nhân 10 mũ x (SHIFT: số π, ALPHA: số e)',
        onPress: () => insertTokenToActiveField('×10^'),
        onShiftPress: () => insertTokenToActiveField('π'),
        onAlphaPress: () => insertTokenToActiveField('e'),
      },
      {
        id: 'ans',
        label: 'Ans',
        shiftLabel: '%',
        alphaLabel: 'PreAns',
        title: 'Kết quả trước Ans (SHIFT: %, ALPHA: PreAns)',
        onPress: () => insertTokenToActiveField('Ans'),
        onShiftPress: () => insertTokenToActiveField('/100'),
        onAlphaPress: () => insertTokenToActiveField('PreAns'),
      },
      {
        id: 'eq',
        label: '=',
        shiftLabel: '≈',
        title: 'Tính toán (SHIFT: Kết quả thập phân xấp xỉ ≈)',
        testId: 'casio-equals-key',
        onPress: () => evaluateNow(false),
        onShiftPress: () => evaluateNow(true),
      },
    ],
  ];

  const modeBadgeLabel: Record<CasioMainMode, string> = {
    calc: '1: Tính toán',
    complex: '2: Số phức',
    basen: '3: Cơ số n',
    matrix: '4: Ma trận',
    vector: '5: Vectơ',
    stats: '6: Thống kê',
    dist: '7: Phân phối',
    table: '8: Bảng f(x)',
    equation: '9: Phương trình',
    ineq: 'A: Bất PT',
    verify: 'B: Đúng / Sai',
    ratio: 'C: Tỉ lệ thức',
    menu: 'Menu chính (1–9, A–C)',
  };

  const chassisClass =
    chassisTheme === 'navy'
      ? 'from-[#1e2c44] via-[#152033] to-[#0f1726] border-sky-700/60'
      : chassisTheme === 'silver'
        ? 'from-[#3c434f] via-[#2c313b] to-[#20242c] border-slate-400/70'
        : 'from-[#262b35] via-[#1b1f27] to-[#13161c] border-slate-600/70';

  const displayFormatLabel: Record<CasioDisplayFormat, string> = {
    exact: 'FRAC',
    decimal: 'DEC',
    mixed: 'a b/c',
    dms: `° ' "`,
    eng: 'ENG',
  };

  const renderResultLatex = (): string => {
    if (displayFormat === 'decimal' && lastResult.specialDecimalLatex) {
      return lastResult.specialDecimalLatex;
    }
    if (lastResult.specialSummaryLatex) return lastResult.specialSummaryLatex;
    if (displayFormat === 'mixed' && lastResult.mixedLatex) return lastResult.mixedLatex;
    if (displayFormat === 'eng' && lastResult.engLatex) return lastResult.engLatex;
    if (displayFormat === 'exact' && lastResult.hasExactForm) return lastResult.exactLatex;
    return lastResult.decimalText;
  };

  return (
    <div
      ref={calcRootRef}
      data-testid="floating-calculator"
      tabIndex={-1}
      style={{ left: pos.x, top: pos.y }}
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape') {
          if (overlay) {
            e.preventDefault();
            setOverlay(null);
            return;
          }
          if (mode === 'menu') {
            e.preventDefault();
            setMode('calc');
            return;
          }
          if (mode === 'equation') {
            e.preventDefault();
            if (eqScreen === 'result') setEqScreen('input');
            else if (eqScreen === 'selectSimulDeg' || eqScreen === 'selectPolyDeg') setEqScreen('selectType');
            return;
          }
        }
        if (mode === 'menu' && overlay === null && /^[1-9a-cA-C]$/.test(e.key)) {
          e.preventDefault();
          trySelectMenuByKey(e.key);
          return;
        }
        if (overlay === null && /^[1-7]$/.test(e.key)) {
          const isInSubMenu =
            (mode === 'equation' &&
              (eqScreen === 'selectType' || eqScreen === 'selectSimulDeg' || eqScreen === 'selectPolyDeg')) ||
            (mode === 'stats' && statsScreen === 'selectType') ||
            (mode === 'dist' && distScreen === 'selectKind') ||
            (mode === 'ineq' && (ineqScreen === 'selectDeg' || ineqScreen === 'selectOp')) ||
            (mode === 'ratio' && ratioScreen === 'selectForm');
          if (isInSubMenu) {
            e.preventDefault();
            tryHandleSubMenuKey(e.key);
            return;
          }
        }
        if (mode === 'equation' && overlay === null && eqScreen === 'result') {
          if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            evaluateNow(false);
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleDpadVertical('up');
          }
        }
      }}
      onFocusCapture={(e) => {
        const target = e.target as HTMLElement;
        const fieldId = target.getAttribute?.('data-casio-field');
        if (fieldId) {
          setActiveField(fieldId);
        }
      }}
      onClickCapture={(e) => {
        const target = e.target as HTMLInputElement;
        if (target?.tagName === 'INPUT' && target.getAttribute('data-casio-field')) {
          caretPosRef.current = target.selectionStart;
        }
      }}
      onKeyUpCapture={(e) => {
        const target = e.target as HTMLInputElement;
        if (target?.tagName === 'INPUT' && target.getAttribute('data-casio-field')) {
          caretPosRef.current = target.selectionStart;
        }
      }}
      className={`pointer-events-auto fixed z-30 w-[316px] max-h-[calc(100vh-70px)] overflow-y-auto rounded-[18px] bg-gradient-to-b ${chassisClass} border shadow-2xl shadow-black/50 text-slate-100 select-none`}
    >
      {/* Top Drag Handle & Casio fx-580VN X Header + Solar Panel + Minimize/Close */}
      <div
        onPointerDown={startDrag}
        className="px-3 pt-1.5 pb-1 bg-black/20 border-b border-white/10 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <GripHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[10.5px] font-extrabold tracking-[0.14em] text-white">CASIO</span>
            <span className="text-[10.5px] font-semibold italic text-slate-300">fx-580VN X</span>
          </div>
          <div className="pl-5 text-[7.5px] font-bold tracking-[0.15em] text-cyan-400/90 uppercase">
            CLASSWIZ · NATURAL-V.P.A.M.
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            aria-hidden="true"
            className="w-9 h-4 rounded-[3px] bg-[#2a1f1d] border border-slate-600/80 shadow-inner grid grid-cols-4 divide-x divide-[#45322e]"
          >
            <div />
            <div />
            <div />
            <div />
          </div>
          <button
            type="button"
            data-testid="minimize-calculator-button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setIsMinimized(!isMinimized)}
            title={
              isMinimized
                ? 'Mở rộng bàn phím Casio'
                : 'Thu gọn chỉ hiện màn hình LCD (vẫn gõ trực tiếp vào ô từ bàn phím)'
            }
            aria-label={isMinimized ? 'Mở rộng bàn phím Casio' : 'Thu gọn máy tính Casio'}
            className="w-5.5 h-5.5 rounded-full bg-white/10 hover:bg-indigo-500/80 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setIsOpen(false)}
            aria-label="Đóng máy tính Casio"
            className="w-5.5 h-5.5 rounded-full bg-white/10 hover:bg-rose-500/80 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Authentic Natural-V.P.A.M. LCD Screen */}
      <div className="px-2.5 pt-1.5 pb-1">
        <div className="rounded-xl p-[2.5px] bg-gradient-to-b from-slate-700 to-slate-800 shadow-inner border border-slate-600/70">
          <div className="casio-lcd-screen rounded-[8px] bg-[#d6e2d0] text-[#1e345a] shadow-inner border border-[#9eb098] overflow-hidden">
            {/* Authentic fx-580VN X LCD Indicator Bar (modeled after CasioEmuX rsd_* flags) */}
            <div className="px-2 py-0.5 bg-[#c5d3be] border-b border-[#adbd9f] flex items-center justify-between gap-1 text-[8.5px] font-mono font-bold">
              <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
                {shiftActive && (
                  <span className="px-1 rounded-[2px] bg-[#1e345a] text-amber-300 leading-tight shrink-0">S</span>
                )}
                {alphaActive && (
                  <span className="px-1 rounded-[2px] bg-[#1e345a] text-rose-300 leading-tight shrink-0">A</span>
                )}
                {stoActive && (
                  <span className="px-1 rounded-[2px] bg-indigo-700 text-white leading-tight shrink-0">STO</span>
                )}
                {(vars.M ?? 0) !== 0 && (
                  <span className="px-1 rounded-[2px] bg-[#1e345a] text-[#d6e2d0] leading-tight shrink-0">M</span>
                )}
                <span className="px-1 rounded-[2px] border border-[#1e345a]/40 text-[#1e345a] leading-tight shrink-0">
                  {angleUnit}
                </span>
                {normMode !== 'NORM' && (
                  <span className="px-1 rounded-[2px] bg-[#1e345a]/90 text-[#e6f0e1] leading-tight shrink-0">
                    {normMode}
                  </span>
                )}
                {mode === 'complex' && (
                  <span className="px-1 rounded-[2px] bg-[#1e345a] text-[#e6f0e1] italic leading-tight shrink-0">
                    i
                  </span>
                )}
                {mode === 'calc' && (
                  <span className="text-[7.5px] font-serif italic text-[#1e345a]/85 leading-tight shrink-0">
                    Math
                  </span>
                )}
                {mode === 'calc' && history.length > 1 && (
                  <span className="text-[7.5px] text-[#1e345a]/70 leading-tight shrink-0" title="Có lịch sử (bấm ▲/▼)">
                    ▲▼
                  </span>
                )}
                <span className="text-[#1e345a] truncate ml-0.5">{modeBadgeLabel[mode]}</span>
              </div>
              <button
                type="button"
                onClick={handleStampToBoard}
                title="Dán kết quả này lên bảng trắng (SHIFT + OPTN)"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#1e345a] hover:bg-indigo-700 text-[#eef5ea] text-[8.5px] font-sans font-semibold cursor-pointer shrink-0"
              >
                <Share2 className="w-2.5 h-2.5" />
                <span>Lên bảng</span>
              </button>
            </div>

            {mode === 'calc' && overlay === null ? (
              <div className="px-2 py-1 min-h-[96px] flex flex-col justify-between gap-1 overflow-hidden">
                <CasioNaturalEditor
                  expr={expr}
                  activeFieldId={activeFieldId}
                  activeCaret={activeCaret}
                  onSelectSlot={(slotId, caret) => {
                    setActiveField(slotId);
                    setCaretPos(caret);
                  }}
                  onChangeSlotValue={(slot, nextVal, nextCaret) => {
                    setErrorMsg(null);
                    setIsEvaluated(false);
                    const nextExpr = expr.slice(0, slot.start) + nextVal + expr.slice(slot.end);
                    setExpr((prev) => {
                      if (nextExpr !== prev) setUndoStack((st) => [...st.slice(-19), prev]);
                      return nextExpr;
                    });
                    setCaretPos(nextCaret);
                  }}
                  onNavigateHorizontal={handleDpadHorizontal}
                  onNavigateVertical={(dir) => handleDpadVertical(dir)}
                  onDeleteFromEmptySlot={handleDeleteFromEmptySlot}
                  onInsertSmartFraction={handleInsertSmartFraction}
                  onInsertSmartPower={handleInsertSmartPower}
                  onEvaluate={() => evaluateNow(false)}
                />
                {infoBanner && (
                  <div className="text-[9px] font-mono font-semibold text-indigo-800 truncate">
                    {infoBanner}
                  </div>
                )}
                <div
                  data-testid="calculator-display-result"
                  className="min-h-[26px] border-t border-[#b8c8b0]/70 pt-0.5 flex items-center justify-end gap-1.5 overflow-x-auto overflow-y-hidden casio-lcd-no-scrollbar"
                >
                  {errorMsg ? (
                    <span className="text-xs font-mono font-bold text-rose-700">{errorMsg}</span>
                  ) : isEvaluated ? (
                    displayFormat === 'dms' && lastResult.dmsText ? (
                      <span className="text-[15px] font-mono font-bold text-[#1e345a]">
                        {lastResult.dmsText}
                      </span>
                    ) : (
                      <>
                        {displayFormat === 'exact' && lastResult.hasExactForm && !lastResult.specialSummaryLatex && (
                          <span className="text-[9.5px] font-mono text-[#1e345a]/70 mr-auto select-none">
                            S⇔D ({lastResult.decimalText})
                          </span>
                        )}
                        <MathTex
                          latex={renderResultLatex()}
                          className="text-[16px] font-bold text-[#1e345a]"
                        />
                      </>
                    )
                  ) : null}
                </div>
              </div>
            ) : (
              <CasioLcdModes
                mode={mode}
                setMode={enterCasioMode}
                overlay={overlay}
                setOverlay={setOverlay}
                angleUnit={angleUnit}
                setAngleUnit={setAngleUnit}
                normMode={normMode}
                setNormMode={setNormMode}
                fixDigits={fixDigits}
                setFixDigits={setFixDigits}
                chassisTheme={chassisTheme}
                setChassisTheme={setChassisTheme}
                vars={vars}
                ansVal={lastResult.numeric}
                preAnsVal={preAns}
                onInsertToken={(tok) => insertTokenToActiveField(tok)}
                onApplyConversion={(converted, lbl) => {
                  const rep = formatCasioExact(converted, normMode, fixDigits);
                  setPreAns(lastResult.numeric);
                  setLastResult(rep);
                  setIsEvaluated(true);
                  setInfoBanner(lbl);
                  setDisplayFormat('decimal');
                }}
                onTriggerOptnAction={(action) => {
                  if (action === 'fact') handleFactAction();
                  else if (action === 'divR') insertTokenToActiveField(' ÷R ');
                  else if (action === 'pol') insertTokenToActiveField('Pol(;)', 4);
                  else if (action === 'rec') insertTokenToActiveField('Rec(;)', 4);
                  else if (action === 'gcd') insertTokenToActiveField('GCD(;)', 4);
                  else if (action === 'lcm') insertTokenToActiveField('LCM(;)', 4);
                  else if (action === 'dms') setDisplayFormat((f) => (f === 'dms' ? 'exact' : 'dms'));
                  else if (action === 'eng') setDisplayFormat((f) => (f === 'eng' ? 'exact' : 'eng'));
                }}
                complexExpr={complexExpr}
                setComplexExpr={setComplexExpr}
                complexPolar={complexPolar}
                setComplexPolar={setComplexPolar}
                baseMode={baseMode}
                setBaseMode={setBaseMode}
                baseExpr={baseExpr}
                setBaseExpr={setBaseExpr}
                matSize={matSize}
                setMatSize={setMatSize}
                matA={matA}
                setMatA={setMatA}
                matB={matB}
                setMatB={setMatB}
                matOp={matOp}
                setMatOp={setMatOp}
                vecDim={vecDim}
                setVecDim={setVecDim}
                vecU={vecU}
                setVecU={setVecU}
                vecV={vecV}
                setVecV={setVecV}
                vecOp={vecOp}
                setVecOp={setVecOp}
                statsScreen={statsScreen}
                setStatsScreen={setStatsScreen}
                statsSubMode={statsSubMode}
                setStatsSubMode={setStatsSubMode}
                statsRaw={statsRaw}
                setStatsRaw={setStatsRaw}
                statsPairs={statsPairs}
                setStatsPairs={setStatsPairs}
                statsResult={statsResult}
                linRegResult={linRegResult}
                distScreen={distScreen}
                setDistScreen={setDistScreen}
                distKind={distKind}
                setDistKind={setDistKind}
                distX={distX}
                setDistX={setDistX}
                distLower={distLower}
                setDistLower={setDistLower}
                distUpper={distUpper}
                setDistUpper={setDistUpper}
                distMu={distMu}
                setDistMu={setDistMu}
                distSigma={distSigma}
                setDistSigma={setDistSigma}
                distArea={distArea}
                setDistArea={setDistArea}
                distN={distN}
                setDistN={setDistN}
                distP={distP}
                setDistP={setDistP}
                distLambda={distLambda}
                setDistLambda={setDistLambda}
                tableScreen={tableScreen}
                setTableScreen={setTableScreen}
                tableExpr={tableExpr}
                setTableExpr={setTableExpr}
                tableGExpr={tableGExpr}
                setTableGExpr={setTableGExpr}
                tableStart={tableStart}
                setTableStart={setTableStart}
                tableEnd={tableEnd}
                setTableEnd={setTableEnd}
                tableStep={tableStep}
                setTableStep={setTableStep}
                eqScreen={eqScreen}
                setEqScreen={setEqScreen}
                eqSubMode={eqSubMode}
                setEqSubMode={setEqSubMode}
                eqResult={eqResult}
                eqResultIdx={eqResultIdx}
                setEqResultIdx={setEqResultIdx}
                eqShowDecimal={eqShowDecimal}
                onSolveEquationMode={handleSolveEquationMode}
                qa={qa}
                setQa={setQa}
                qb={qb}
                setQb={setQb}
                qc={qc}
                setQc={setQc}
                qd={qd}
                setQd={setQd}
                qe={qe}
                setQe={setQe}
                sys2={sys2}
                setSys2={setSys2}
                sys3={sys3}
                setSys3={setSys3}
                sys4={sys4}
                setSys4={setSys4}
                ineqScreen={ineqScreen}
                setIneqScreen={setIneqScreen}
                ineqDegree={ineqDegree}
                setIneqDegree={setIneqDegree}
                ineqOp={ineqOp}
                setIneqOp={setIneqOp}
                verifyLhs={verifyLhs}
                setVerifyLhs={setVerifyLhs}
                verifyOp={verifyOp}
                setVerifyOp={setVerifyOp}
                verifyRhs={verifyRhs}
                setVerifyRhs={setVerifyRhs}
                verifyEvaluated={verifyEvaluated}
                setVerifyEvaluated={setVerifyEvaluated}
                ratioScreen={ratioScreen}
                setRatioScreen={setRatioScreen}
                ratioUnknown={ratioUnknown}
                setRatioUnknown={setRatioUnknown}
                ratioA={ratioA}
                setRatioA={setRatioA}
                ratioB={ratioB}
                setRatioB={setRatioB}
                ratioC={ratioC}
                setRatioC={setRatioC}
                ratioD={ratioD}
                setRatioD={setRatioD}
                ratioShowDecimal={ratioShowDecimal}
                calcVarsList={calcVarsList}
                calcVarInputs={calcVarInputs}
                onSetCalcVarInput={(k, raw) => {
                  setCalcVarInputs((prev) => ({ ...prev, [k]: raw }));
                  setVars((prev) => ({ ...prev, [k]: toNum(raw) }));
                }}
                onEvalCalcPrompt={() => {
                  setOverlay(null);
                  setMode('calc');
                  const res = evaluateCasioExpression(expr, {
                    angleUnit,
                    ans: lastResult.numeric,
                    preAns,
                    mem: vars.M ?? 0,
                    vars,
                    normMode,
                    fixDigits,
                  });
                  if (res) {
                    setErrorMsg(null);
                    setIsEvaluated(true);
                    setPreAns(lastResult.numeric);
                    setLastResult(res);
                    setDisplayFormat(res.hasExactForm ? 'exact' : 'decimal');
                  } else {
                    setErrorMsg('Syntax ERROR');
                    setIsEvaluated(false);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Quick Mode Chips Bar (RAD · FRAC · NORM · Thu/Mở phím · ? · Palette) */}
      <div className="px-2.5 pb-1.5 flex items-center justify-between text-[9px] font-bold">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAngleUnit((u) => (u === 'D' ? 'R' : u === 'R' ? 'G' : 'D'))}
            title="Chuyển đổi Độ (DEG) ↔ Radian (RAD) ↔ Gradian (GRAD)"
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 cursor-pointer"
          >
            {angleUnit === 'D' ? 'DEG' : angleUnit === 'R' ? 'RAD' : 'GRAD'}
          </button>
          <button
            type="button"
            onClick={() => {
              const order: CasioDisplayFormat[] = ['exact', 'decimal', 'mixed', 'dms', 'eng'];
              setDisplayFormat(order[(order.indexOf(displayFormat) + 1) % order.length]);
            }}
            title="Định dạng hiển thị kết quả"
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 cursor-pointer"
          >
            {displayFormatLabel[displayFormat]}
          </button>
          <button
            type="button"
            onClick={() => {
              const order: CasioNormMode[] = ['NORM', 'FIX', 'SCI'];
              setNormMode(order[(order.indexOf(normMode) + 1) % order.length]);
            }}
            title="Chế độ làm tròn NORM / FIX / SCI"
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 cursor-pointer"
          >
            {normMode}
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Hiện bàn phím Casio' : 'Ẩn bàn phím Casio để rộng bảng vẽ'}
            className="px-1.5 py-0.5 rounded bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 cursor-pointer"
          >
            {isMinimized ? 'Mở phím' : 'Thu phím'}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOverlay((o) => (o === 'help' ? null : 'help'))}
            aria-label="Hướng dẫn phím Casio"
            title="Hướng dẫn phím Casio"
            className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() =>
              setChassisTheme((t) => (t === 'carbon' ? 'navy' : t === 'navy' ? 'silver' : 'carbon'))
            }
            aria-label="Đổi màu vỏ máy tính"
            title="Đổi màu vỏ máy tính"
            className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            <Palette className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Top Control Cluster: Left (SHIFT, ALPHA, OPTN, CALC), Center Oval D-Pad, Right (MENU, Setup, ∫, x) */}
          <div className="px-2.5 pb-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            {/* Left 2x2 */}
            <div className="grid grid-cols-2 gap-1">
              <div className="flex flex-col items-center">
                <span className="h-2.5 text-[7px] font-extrabold text-amber-400 leading-none">SHIFT</span>
                <button
                  type="button"
                  data-testid="casio-shift-key"
                  aria-pressed={shiftActive}
                  onClick={() => {
                    setShiftActive((v) => !v);
                    setAlphaActive(false);
                  }}
                  className={`w-full h-5.5 rounded-md border text-[8.5px] font-extrabold transition-all cursor-pointer ${
                    shiftActive
                      ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-sm shadow-amber-500/40'
                      : 'bg-[#2e3440] border-slate-600 text-amber-300 hover:bg-[#3a4252]'
                  }`}
                >
                  SHIFT
                </button>
              </div>

              <div className="flex flex-col items-center">
                <span className="h-2.5 text-[7px] font-extrabold text-rose-400 leading-none">ALPHA</span>
                <button
                  type="button"
                  data-testid="casio-alpha-key"
                  aria-pressed={alphaActive}
                  onClick={() => {
                    setAlphaActive((v) => !v);
                    setShiftActive(false);
                  }}
                  className={`w-full h-5.5 rounded-md border text-[8.5px] font-extrabold transition-all cursor-pointer ${
                    alphaActive
                      ? 'bg-rose-500 border-rose-300 text-white shadow-sm shadow-rose-500/40'
                      : 'bg-[#2e3440] border-slate-600 text-rose-300 hover:bg-[#3a4252]'
                  }`}
                >
                  ALPHA
                </button>
              </div>

              <div className="flex flex-col items-center">
                <span className="h-2.5 text-[7px] font-bold text-amber-400 leading-none">QR</span>
                <button
                  type="button"
                  title="Tùy chọn nhanh OPTN (SHIFT: QR — dán kết quả lên bảng trắng)"
                  onClick={() =>
                    runKey(
                      () => setOverlay((o) => (o === 'optn' ? null : 'optn')),
                      handleStampToBoard
                    )
                  }
                  className="w-full h-5.5 rounded-md bg-[#2e3440] hover:bg-[#3a4252] border border-slate-600 text-[8.5px] font-bold text-slate-100 cursor-pointer"
                >
                  OPTN
                </button>
              </div>

              <div className="flex flex-col items-center">
                <div className="h-2.5 flex items-center gap-1 text-[7px] font-bold leading-none">
                  <span className="text-amber-400">SOLVE</span>
                  <span className="text-rose-400">=</span>
                </div>
                <button
                  type="button"
                  title="Thế giá trị biến CALC (SHIFT: Giải PT SOLVE, ALPHA: Dấu =)"
                  onClick={() =>
                    runKey(
                      () => setOverlay((o) => (o === 'calcPrompt' ? null : 'calcPrompt')),
                      handleSolveAction,
                      () => insertTokenToActiveField(' = ')
                    )
                  }
                  className="w-full h-5.5 rounded-md bg-[#2e3440] hover:bg-[#3a4252] border border-slate-600 text-[8.5px] font-bold text-slate-100 cursor-pointer"
                >
                  CALC
                </button>
              </div>
            </div>

            {/* Center Oval Metallic 4-Way D-Pad + OK */}
            <div className="relative w-[72px] h-[52px] rounded-full bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600 p-[2px] shadow-md shrink-0">
              <div className="w-full h-full rounded-full bg-gradient-to-b from-[#353b48] to-[#1e222b] relative flex items-center justify-center">
                <button
                  type="button"
                  aria-label="Lịch sử trước"
                  onClick={() => handleDpadVertical('up')}
                  className="absolute top-0.5 left-1/2 -translate-x-1/2 text-slate-300 hover:text-white cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Lịch sử sau"
                  onClick={() => handleDpadVertical('down')}
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-slate-300 hover:text-white cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Sang trái"
                  title="Di chuyển con trỏ sang trái / Ô trước"
                  onClick={() => handleDpadHorizontal(-1)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Sang phải"
                  title="Di chuyển con trỏ sang phải / Nhảy qua dấu ; / Ô tiếp theo"
                  onClick={() => handleDpadHorizontal(1)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="OK"
                  onClick={() => evaluateNow(false)}
                  className="w-4.5 h-3 rounded-full bg-[#22262f] border border-slate-500/80 hover:bg-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Right 2x2 */}
            <div className="grid grid-cols-2 gap-1">
              <div className="flex flex-col items-center">
                <span className="h-2.5 text-[7px] font-bold text-amber-400 leading-none">SETUP</span>
                <button
                  type="button"
                  data-testid="casio-menu-key"
                  title="MENU các chế độ (SHIFT: Cài đặt SETUP)"
                  onClick={() =>
                    runKey(
                      () => {
                        setOverlay(null);
                        setMode((m) => (m === 'menu' ? 'calc' : 'menu'));
                      },
                      () => setOverlay((o) => (o === 'setup' ? null : 'setup'))
                    )
                  }
                  className="w-full h-5.5 rounded-md bg-[#2e3440] hover:bg-[#3a4252] border border-slate-600 text-[8.5px] font-bold text-slate-100 cursor-pointer"
                >
                  MENU
                </button>
              </div>

              <div className="flex flex-col items-center">
                <span className="h-2.5" />
                <button
                  type="button"
                  title="Cài đặt nhanh góc, làm tròn, màu máy"
                  aria-label="Cài đặt Casio"
                  onClick={() => setOverlay((o) => (o === 'setup' ? null : 'setup'))}
                  className="w-full h-5.5 rounded-md bg-[#2e3440] hover:bg-[#3a4252] border border-slate-600 text-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                </button>
              </div>

              <div className="flex flex-col items-center">
                <div className="h-2.5 flex items-center gap-1 text-[7px] font-bold leading-none">
                  <span className="text-amber-400">d/dx</span>
                  <span className="text-rose-400">;</span>
                </div>
                <button
                  type="button"
                  title="Tích phân xác định ∫(f(x); a; b) (SHIFT: Đạo hàm d/dx(f(x); a), ALPHA: Dấu ;)"
                  onClick={() =>
                    runKey(
                      () => insertTokenToActiveField('int(;;;x)', 4),
                      () => insertTokenToActiveField('ddx(;)', 4),
                      () => {
                        if (mode === 'calc' && overlay === null) handleDpadHorizontal(1);
                        else insertTokenToActiveField(';');
                      }
                    )
                  }
                  className="w-full h-5.5 rounded-md bg-[#2e3440] hover:bg-[#3a4252] border border-slate-600 text-[9px] font-bold text-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <MathTex latex="\int_{\square}^{\square}" className="text-[9px]" />
                </button>
              </div>

              <div className="flex flex-col items-center">
                <div className="h-2.5 flex items-center gap-1 text-[7px] font-bold leading-none">
                  <span className="text-amber-400">Σ□</span>
                  <span className="text-rose-400">Π□</span>
                </div>
                <button
                  type="button"
                  title="Biến x (SHIFT: Tổng Σ(f(x); a; b), ALPHA: Tích Π(f(x); a; b))"
                  onClick={() =>
                    runKey(
                      () => insertTokenToActiveField('x'),
                      () => insertTokenToActiveField('sum(;;)', 4),
                      () => insertTokenToActiveField('prod(;;)', 5)
                    )
                  }
                  className="w-full h-5.5 rounded-md bg-[#2e3440] hover:bg-[#3a4252] border border-slate-600 text-[10px] font-bold text-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <MathTex latex="x" className="text-[10.5px]" />
                </button>
              </div>
            </div>
          </div>

          {/* Scientific Keys Matrix (3 rows × 6 cols with exact SHIFT & ALPHA legends) */}
          <div className="px-2.5 pb-1 space-y-0.5">
            {[sciRow1, sciRow2, sciRow3].map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-6 gap-1">
                {row.map((k) => (
                  <div key={k.id} className="flex flex-col items-center">
                    <div className="h-2.5 w-full flex items-center justify-between px-0.5 text-[6.5px] font-bold tracking-tighter leading-none whitespace-nowrap">
                      <span className="text-amber-400">{k.shiftLabel ?? ''}</span>
                      <span className="text-rose-400">{k.alphaLabel ?? ''}</span>
                    </div>
                    <button
                      type="button"
                      title={k.title}
                      aria-label={k.title}
                      onClick={() => runKey(k.onPress, k.onShiftPress, k.onAlphaPress)}
                      className="w-full h-[21px] rounded-[5px] bg-gradient-to-b from-[#333945] to-[#232831] hover:from-[#404756] hover:to-[#2b313c] border border-slate-600/80 shadow-xs text-[9px] font-semibold text-slate-100 flex items-center justify-center cursor-pointer active:translate-y-[0.5px]"
                    >
                      {k.labelLatex ? (
                        <MathTex latex={k.labelLatex} className="text-[9.5px]" />
                      ) : (
                        k.label
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* ClassWiz Numpad Cluster (4 rows × 5 cols with SHIFT & ALPHA legends) */}
          <div className="px-2.5 pb-2 pt-0.5 border-t border-white/10 bg-black/25 space-y-0.5">
            {numRows.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-5 gap-1">
                {row.map((k) => (
                  <div key={k.id} className="flex flex-col items-center">
                    <div className="h-2.5 w-full flex items-center justify-between px-0.5 text-[6.5px] font-bold leading-none whitespace-nowrap">
                      <span className="text-amber-400 truncate">{k.shiftLabel ?? ''}</span>
                      <span className="text-rose-400 truncate">{k.alphaLabel ?? ''}</span>
                    </div>
                    <button
                      type="button"
                      data-testid={k.testId}
                      title={k.title}
                      aria-label={k.label}
                      onClick={() => runKey(k.onPress, k.onShiftPress, k.onAlphaPress)}
                      className={
                        k.variant === 'blue'
                          ? 'w-full h-[26px] rounded-md bg-gradient-to-b from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-[11px] font-extrabold shadow-xs border border-sky-400/50 cursor-pointer active:translate-y-[0.5px]'
                          : 'w-full h-[26px] rounded-md bg-gradient-to-b from-white to-slate-200 hover:from-white hover:to-slate-100 text-slate-950 font-mono text-[12.5px] font-extrabold shadow-xs border border-slate-300 cursor-pointer active:translate-y-[0.5px]'
                      }
                    >
                      {k.label}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
