import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  CasioAngleUnit,
  CasioDisplayFormat,
  CasioExactRepresentation,
  CasioNormMode,
  casioExprToNaturalLatex,
  computeCasioStats1Var,
  computeMatrixDet,
  computeMatrixInverse,
  computeVectorMetrics,
  evaluateCasioComplex,
  evaluateCasioExpression,
  factorizeIntegerLatex,
  formatCasioExact,
  formatComplexLatex,
  matrixToLatex,
  multiplyMatrices,
  solveCasioEquation,
  solveCubicEquation,
  solveLinearSystem2x2,
  solveLinearSystem3x3,
  solveQuadraticInequality,
} from '../../engine/casio580Engine';
import { solveQuadratic } from '../../engine/mathEngine';
import { FormulaElement } from '../../types/board';
import { MathTex } from './MathTex';
import { CasioEqSubMode, CasioLcdModes, CasioLcdOverlay, CasioMainMode } from './CasioLcdModes';
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

export const FloatingCalculator: React.FC = () => {
  const isOpen = useBoardStore((s) => s.isCalculatorOpen);
  const setIsOpen = useBoardStore((s) => s.setIsCalculatorOpen);
  const isMinimized = useBoardStore((s) => s.isCalculatorMinimized);
  const setIsMinimized = useBoardStore((s) => s.setIsCalculatorMinimized);
  const addElement = useBoardStore((s) => s.addElement);
  const addToast = useBoardStore((s) => s.addToast);

  const [pos, setPos] = useState({ x: 14, y: 60 });
  const [mode, setMode] = useState<CasioMainMode>('calc');
  const [overlay, setOverlay] = useState<CasioLcdOverlay>(null);
  const [angleUnit, setAngleUnit] = useState<CasioAngleUnit>('D');
  const [normMode, setNormMode] = useState<CasioNormMode>('NORM');
  const [fixDigits, setFixDigits] = useState<number>(4);
  const [displayFormat, setDisplayFormat] = useState<CasioDisplayFormat>('exact');
  const [chassisTheme, setChassisTheme] = useState<'carbon' | 'navy' | 'silver'>('carbon');

  const [shiftActive, setShiftActive] = useState(false);
  const [alphaActive, setAlphaActive] = useState(false);
  const [stoActive, setStoActive] = useState(false);

  // Mode 1: Calculate state
  const [expr, setExpr] = useState('sin(30) + sqrt(16)');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [isEvaluated, setIsEvaluated] = useState(true);
  const [lastResult, setLastResult] = useState<CasioExactRepresentation>({
    numeric: 4.5,
    decimalText: '4.5',
    exactLatex: '\\frac{9}{2}',
    mixedLatex: '4\\frac{1}{2}',
    dmsText: `4°30'0"`,
    engLatex: '4.5 \\times 10^{0}',
    hasExactForm: true,
  });
  const [preAns, setPreAns] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [vars, setVars] = useState<Record<string, number>>({
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
  });
  const [calcVarInputs, setCalcVarInputs] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      expr: 'sin(30) + sqrt(16)',
      res: {
        numeric: 4.5,
        decimalText: '4.5',
        exactLatex: '\\frac{9}{2}',
        mixedLatex: '4\\frac{1}{2}',
        dmsText: `4°30'0"`,
        engLatex: '4.5 \\times 10^{0}',
        hasExactForm: true,
      },
    },
  ]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);

  const calcRootRef = useRef<HTMLDivElement>(null);
  const activeFieldIdRef = useRef<string>('slot-root');
  const [activeFieldId, setActiveFieldId] = useState<string>('slot-root');
  const caretPosRef = useRef<number | null>(null);

  const setActiveField = (id: string) => {
    activeFieldIdRef.current = id;
    setActiveFieldId(id);
  };

  // Mode 2: Complex
  const [complexExpr, setComplexExpr] = useState('(2+3i)*(1-i)');
  const [complexPolar, setComplexPolar] = useState(false);

  // Mode 3: Matrix (string[][] for keypad entry)
  const [matSize, setMatSize] = useState<2 | 3>(2);
  const [matA, setMatA] = useState<string[][]>([
    ['2', '1'],
    ['1', '3'],
  ]);
  const [matB, setMatB] = useState<string[][]>([
    ['1', '0'],
    ['2', '4'],
  ]);
  const [matOp, setMatOp] = useState<'det' | 'inv' | 'add' | 'mul'>('det');

  // Mode 4: Vector (string[] for keypad entry)
  const [vecDim, setVecDim] = useState<2 | 3>(3);
  const [vecU, setVecU] = useState<string[]>(['1', '2', '-1']);
  const [vecV, setVecV] = useState<string[]>(['2', '-1', '0']);

  // Mode 5: Table f(x)
  const [tableExpr, setTableExpr] = useState('x^2 - 2*x');
  const [tableStart, setTableStart] = useState('-2');
  const [tableEnd, setTableEnd] = useState('4');
  const [tableStep, setTableStep] = useState('1');

  // Mode 6 & 7: Equations & Inequality
  const [eqSubMode, setEqSubMode] = useState<CasioEqSubMode>('sys2');
  const [qa, setQa] = useState('1');
  const [qb, setQb] = useState('-5');
  const [qc, setQc] = useState('6');
  const [qd, setQd] = useState('0');
  const [sys2, setSys2] = useState<string[]>(['2', '1', '5', '1', '-1', '1']);
  const [sys3, setSys3] = useState<string[][]>([
    ['1', '1', '1', '6'],
    ['2', '-1', '1', '3'],
    ['1', '2', '-1', '2'],
  ]);
  const [ineqOp, setIneqOp] = useState<'>' | '<' | '>=' | '<='>('>');

  // Mode 8: Stats
  const [statsRaw, setStatsRaw] = useState('5, 7, 8, 8, 9, 10');
  const statsResult = useMemo(() => {
    const nums = statsRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== '-')
      .map(Number);
    return computeCasioStats1Var(nums);
  }, [statsRaw]);

  const calcVarsList = useMemo(() => {
    const found: string[] = [];
    for (const v of ['x', 'y', 'z', 'A', 'B', 'C', 'D', 'T', 'F', 'M']) {
      if (new RegExp(`\\b${v}\\b`).test(expr)) found.push(v);
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
    } else if (mode === 'matrix') {
      setActiveField('matA-0-0');
    } else if (mode === 'vector') {
      setActiveField('vecU-0');
    } else if (mode === 'table') {
      setActiveField('table-expr');
    } else if (mode === 'equation') {
      setActiveField(
        eqSubMode === 'sys2' ? 'sys2-0' : eqSubMode === 'sys3' ? 'sys3-0-0' : 'eq-a'
      );
    } else if (mode === 'ineq') {
      setActiveField('ineq-a');
    } else if (mode === 'stats') {
      setActiveField('stats-raw');
    }
    caretPosRef.current = null;
  }, [isOpen, mode, overlay, eqSubMode, calcVarsList]);

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
    caretPosRef.current = caret;
    requestAnimationFrame(() => {
      const el = getFieldInputEl(fieldId);
      if (el) {
        el.focus();
        try {
          const clamped = Math.max(0, Math.min(el.value.length, caret));
          el.setSelectionRange(clamped, clamped);
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

    if (mode === 'table') {
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
      if (id === 'eq-b') return { fieldId: id, getVal: () => qb, setVal: setQb, isExpressionField: false };
      if (id === 'eq-c') return { fieldId: id, getVal: () => qc, setVal: setQc, isExpressionField: false };
      if (id === 'eq-d') return { fieldId: id, getVal: () => qd, setVal: setQd, isExpressionField: false };
      return { fieldId: 'eq-a', getVal: () => qa, setVal: setQa, isExpressionField: false };
    }

    if (mode === 'ineq') {
      if (id === 'ineq-b') return { fieldId: id, getVal: () => qb, setVal: setQb, isExpressionField: false };
      if (id === 'ineq-c') return { fieldId: id, getVal: () => qc, setVal: setQc, isExpressionField: false };
      return { fieldId: 'ineq-a', getVal: () => qa, setVal: setQa, isExpressionField: false };
    }

    if (mode === 'stats') {
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

  /**
   * Universal Caret-Aware Token Insertion across ALL 8 Casio modes, 2D template boxes, & overlays.
   */
  const insertTokenToActiveField = (tok: string, cursorOffsetInToken?: number) => {
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
      const m = /([a-zA-Z0-9.π]+|\([^()]+\))$/.exec(before);
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
    if (mode === 'stats') {
      setStatsRaw('');
      focusFieldAtCaret('stats-raw', 0);
      return;
    }
    if (mode === 'matrix' || mode === 'vector' || mode === 'equation' || mode === 'ineq' || mode === 'table') {
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

    // In multi-field modes (Matrix, Vector, Equation, Inequality, Table), pressing `=` advances to the next cell!
    if (mode !== 'calc') {
      if (mode === 'stats') {
        insertTokenToActiveField(', ');
        return;
      }
      const fields = getAllVisibleFields();
      if (fields.length > 1) {
        const idx = fields.findIndex((f) => f.getAttribute('data-casio-field') === activeFieldIdRef.current);
        const nextEl = fields[(idx + 1) % fields.length];
        const nextId = nextEl?.getAttribute('data-casio-field');
        if (nextId && nextEl) {
          activeFieldIdRef.current = nextId;
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
      const solved = solveCasioEquation(
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
      if (!solved) {
        setErrorMsg("Can't Solve");
        setIsEvaluated(false);
        clearModifiers();
        return;
      }
      setErrorMsg(null);
      setIsEvaluated(true);
      setInfoBanner('SOLVE: L − R = 0');
      setPreAns(lastResult.numeric);
      setLastResult({
        ...solved,
        specialSummaryLatex: `x = ${solved.hasExactForm ? solved.exactLatex : solved.decimalText}`,
      });
      setVars((v) => ({ ...v, x: solved.numeric }));
      setDisplayFormat(forceDecimal ? 'decimal' : solved.hasExactForm ? 'exact' : 'decimal');
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
    const solved = solveCasioEquation(
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
    if (!solved) {
      setErrorMsg("Can't Solve");
      return;
    }
    setErrorMsg(null);
    setInfoBanner('SOLVE (x): L − R = 0');
    setPreAns(lastResult.numeric);
    setLastResult({
      ...solved,
      specialSummaryLatex: `x = ${solved.hasExactForm ? solved.exactLatex : solved.decimalText}`,
    });
    setVars((v) => ({ ...v, x: solved.numeric }));
    setDisplayFormat(solved.hasExactForm ? 'exact' : 'decimal');
  };

  const handleFactAction = () => {
    const targetVal = expr.trim()
      ? evaluateCasioExpression(expr, { angleUnit, ans: lastResult.numeric, preAns, vars })?.numeric ??
        lastResult.numeric
      : lastResult.numeric;
    const factLatex = factorizeIntegerLatex(targetVal);
    if (!factLatex) {
      setErrorMsg('FACT: Cần số nguyên');
      return;
    }
    setErrorMsg(null);
    setInfoBanner(`FACT(${Math.round(targetVal)})`);
    setLastResult({
      ...formatCasioExact(targetVal, normMode, fixDigits),
      specialSummaryLatex: factLatex,
    });
  };

  const handleToggleSD = () => {
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

    if (mode === 'equation' && eqSubMode === 'sys2') {
      const res = solveLinearSystem2x2(...(sys2.map(toNum) as [number, number, number, number, number, number]));
      fullLatex = `\\begin{cases} ${sys2[0]}x + (${sys2[1]})y = ${sys2[2]} \\\\ ${sys2[3]}x + (${sys2[4]})y = ${sys2[5]} \\end{cases} \\Rightarrow ${res.summaryLatex}`;
      boxHeight = 86;
    } else if (mode === 'equation' && eqSubMode === 'sys3') {
      const res = solveLinearSystem3x3(sys3.map((r) => r.map(toNum)));
      fullLatex = `\\text{Hệ 3 ẩn} \\Rightarrow ${res.summaryLatex}`;
      boxHeight = 68;
    } else if (mode === 'equation' && eqSubMode === 'quad') {
      const res = solveQuadratic(toNum(qa), toNum(qb), toNum(qc));
      fullLatex = `${qa}x^2 + (${qb})x + (${qc}) = 0 \\Rightarrow \\text{${res.summary}}`;
    } else if (mode === 'equation' && eqSubMode === 'cubic') {
      const res = solveCubicEquation(toNum(qa), toNum(qb), toNum(qc), toNum(qd));
      fullLatex = `${qa}x^3 + (${qb})x^2 + (${qc})x + (${qd}) = 0 \\Rightarrow ${res.summaryLatex}`;
    } else if (mode === 'complex') {
      const cmp = evaluateCasioComplex(complexExpr, angleUnit);
      fullLatex = cmp
        ? `${complexExpr} = ${formatComplexLatex(cmp, complexPolar, angleUnit)}`
        : complexExpr;
    } else if (mode === 'matrix') {
      const numA = matA.map((r) => r.map(toNum));
      const numB = matB.map((r) => r.map(toNum));
      if (matOp === 'det') {
        fullLatex = `\\det(${matrixToLatex(numA)}) = ${formatCasioExact(computeMatrixDet(numA)).exactLatex}`;
      } else if (matOp === 'inv') {
        const inv = computeMatrixInverse(numA);
        fullLatex = inv ? `${matrixToLatex(numA)}^{-1} = ${matrixToLatex(inv)}` : `\\det(A) = 0`;
      } else if (matOp === 'add') {
        const sumM = numA.map((r, ri) => r.map((v, ci) => v + numB[ri][ci]));
        fullLatex = `${matrixToLatex(numA)} + ${matrixToLatex(numB)} = ${matrixToLatex(sumM)}`;
      } else {
        fullLatex = `${matrixToLatex(numA)} \\times ${matrixToLatex(numB)} = ${matrixToLatex(multiplyMatrices(numA, numB))}`;
      }
      boxHeight = matSize === 3 ? 110 : 86;
    } else if (mode === 'vector') {
      const u = vecU.slice(0, vecDim).map(toNum);
      const v = vecV.slice(0, vecDim).map(toNum);
      const res = computeVectorMetrics(u, v, angleUnit);
      fullLatex = `\\vec{u}=(${u.join(';')}),\\; \\vec{v}=(${v.join(';')}) \\Rightarrow \\vec{u}\\cdot\\vec{v}=${Number(res.dot.toFixed(3))}`;
    } else if (mode === 'ineq') {
      const opTex = ineqOp === '>=' ? '\\ge' : ineqOp === '<=' ? '\\le' : ineqOp;
      const res = solveQuadraticInequality(toNum(qa), toNum(qb), toNum(qc), ineqOp);
      fullLatex = `${qa}x^2 + (${qb})x + (${qc}) ${opTex} 0 \\Leftrightarrow ${res.summaryLatex}`;
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
        currentResult.specialSummaryLatex ??
        (displayFormat === 'mixed' && currentResult.mixedLatex
          ? currentResult.mixedLatex
          : displayFormat === 'eng' && currentResult.engLatex
            ? currentResult.engLatex
            : displayFormat === 'exact' && currentResult.hasExactForm
              ? currentResult.exactLatex
              : currentResult.decimalText);
      fullLatex = `${exprTex} = ${ansTex}`;
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
      alphaLabel: 'mod',
      title: 'Bình phương (SHIFT: Lập phương, ALPHA: Chia lấy dư mod)',
      onPress: () => handleInsertSmartPower('2'),
      onShiftPress: () => handleInsertSmartPower('3'),
      onAlphaPress: () => insertTokenToActiveField(' mod '),
    },
    {
      id: 'pow',
      label: 'x^□',
      labelLatex: 'x^{\\square}',
      shiftLabel: 'ˣ√□',
      alphaLabel: 'cot',
      title: 'Lũy thừa (SHIFT: Căn bậc n, ALPHA: cot)',
      onPress: () => handleInsertSmartPower(''),
      onShiftPress: () => insertTokenToActiveField('nroot(;)', 6),
      onAlphaPress: () => insertTokenToActiveField('cot('),
    },
    {
      id: 'logb',
      label: 'log□',
      labelLatex: '\\log_{\\square}\\square',
      shiftLabel: '10^□',
      alphaLabel: 'cot⁻¹',
      title: 'Logarit cơ số bất kỳ (SHIFT: 10^x, ALPHA: arccot)',
      onPress: () => insertTokenToActiveField('logb(;)', 5),
      onShiftPress: () => insertTokenToActiveField('pow(10;)', 7),
      onAlphaPress: () => insertTokenToActiveField('acot('),
    },
    {
      id: 'ln',
      label: 'ln',
      shiftLabel: 'e^□',
      alphaLabel: '',
      title: 'Logarit tự nhiên ln (SHIFT: e^x)',
      onPress: () => insertTokenToActiveField('ln('),
      onShiftPress: () => insertTokenToActiveField('pow(e;)', 6),
    },
  ];

  const sciRow2: SciKeyDef[] = [
    {
      id: 'neg',
      label: '(−)',
      shiftLabel: 'log',
      alphaLabel: 'A',
      title: 'Dấu âm (SHIFT: log10, ALPHA: Biến A)',
      onPress: () => insertTokenToActiveField('-'),
      onShiftPress: () => insertTokenToActiveField('log('),
      onAlphaPress: () => insertTokenToActiveField('A'),
    },
    {
      id: 'dms',
      label: `° ' "`,
      shiftLabel: 'FACT',
      alphaLabel: 'B',
      title: `Độ Phút Giây (SHIFT: Phân tích thừa số NT FACT, ALPHA: Biến B)`,
      onPress: () => {
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
      title: 'Nghịch đảo (SHIFT: Giai thừa !, ALPHA: Biến C)',
      onPress: () => handleInsertSmartPower('-1'),
      onShiftPress: () => insertTokenToActiveField('!'),
      onAlphaPress: () => insertTokenToActiveField('C'),
    },
    {
      id: 'sin',
      label: 'sin',
      shiftLabel: 'sin⁻¹',
      alphaLabel: 'D',
      title: 'Sin (SHIFT: arcsin)',
      onPress: () => insertTokenToActiveField('sin('),
      onShiftPress: () => insertTokenToActiveField('asin('),
      onAlphaPress: () => insertTokenToActiveField('D'),
    },
    {
      id: 'cos',
      label: 'cos',
      shiftLabel: 'cos⁻¹',
      alphaLabel: 'T',
      title: 'Cos (SHIFT: arccos, ALPHA: Biến T)',
      onPress: () => insertTokenToActiveField('cos('),
      onShiftPress: () => insertTokenToActiveField('acos('),
      onAlphaPress: () => insertTokenToActiveField('T'),
    },
    {
      id: 'tan',
      label: 'tan',
      shiftLabel: 'tan⁻¹',
      alphaLabel: 'F',
      title: 'Tan (SHIFT: arctan, ALPHA: Biến F)',
      onPress: () => insertTokenToActiveField('tan('),
      onShiftPress: () => insertTokenToActiveField('atan('),
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
        title: 'Số 4 (SHIFT: Chế độ Ma trận)',
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
      { id: 'k5', label: '5', title: 'Số 5', onPress: () => insertTokenToActiveField('5') },
      { id: 'k6', label: '6', title: 'Số 6', onPress: () => insertTokenToActiveField('6') },
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
        title: 'Nhân 10 mũ x (SHIFT: Số π, ALPHA: Số e)',
        onPress: () => insertTokenToActiveField('×10^'),
        onShiftPress: () => insertTokenToActiveField('pi'),
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
    matrix: '3: Ma trận',
    vector: '4: Vectơ',
    table: '5: Bảng f(x)',
    equation: '6: Phương trình',
    ineq: '7: Bất phương trình',
    stats: '8: Thống kê',
    menu: 'Menu chính',
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
      style={{ left: pos.x, top: pos.y }}
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
          <div className="casio-lcd-screen rounded-[8px] bg-[#d6e2d0] text-slate-900 shadow-inner border border-[#9eb098] overflow-hidden">
            {/* LCD Status Indicator Bar */}
            <div className="px-2 py-0.5 bg-[#c5d3be] border-b border-[#adbd9f] flex items-center justify-between text-[9px] font-mono font-bold">
              <div className="flex items-center gap-1">
                {shiftActive && (
                  <span className="px-1 rounded-[2px] bg-slate-900 text-amber-300 leading-tight">S</span>
                )}
                {alphaActive && (
                  <span className="px-1 rounded-[2px] bg-slate-900 text-rose-300 leading-tight">A</span>
                )}
                {stoActive && (
                  <span className="px-1 rounded-[2px] bg-indigo-700 text-white leading-tight">STO</span>
                )}
                {(vars.M ?? 0) !== 0 && (
                  <span className="px-1 rounded-[2px] bg-slate-700 text-[#d6e2d0] leading-tight">M</span>
                )}
                <span className="text-slate-800 truncate max-w-[130px]">{modeBadgeLabel[mode]}</span>
              </div>
              <button
                type="button"
                onClick={handleStampToBoard}
                title="Dán kết quả này lên bảng trắng"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-indigo-700 text-[#eef5ea] text-[9px] font-sans font-semibold cursor-pointer"
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
                  onSelectSlot={(slotId, caret) => {
                    setActiveField(slotId);
                    caretPosRef.current = caret;
                  }}
                  onChangeSlotValue={(slot, nextVal, nextCaret) => {
                    setErrorMsg(null);
                    setIsEvaluated(false);
                    const nextExpr = expr.slice(0, slot.start) + nextVal + expr.slice(slot.end);
                    setExpr((prev) => {
                      if (nextExpr !== prev) setUndoStack((st) => [...st.slice(-19), prev]);
                      return nextExpr;
                    });
                    caretPosRef.current = nextCaret;
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
                      <span className="text-[15px] font-mono font-bold text-slate-950">
                        {lastResult.dmsText}
                      </span>
                    ) : (
                      <>
                        {displayFormat === 'exact' && lastResult.hasExactForm && !lastResult.specialSummaryLatex && (
                          <span className="text-[9.5px] font-mono text-slate-600 mr-auto select-none">
                            S⇔D ({lastResult.decimalText})
                          </span>
                        )}
                        <MathTex
                          latex={renderResultLatex()}
                          className="text-[16px] font-bold text-slate-950"
                        />
                      </>
                    )
                  ) : null}
                </div>
              </div>
            ) : (
              <CasioLcdModes
                mode={mode}
                setMode={setMode}
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
                tableExpr={tableExpr}
                setTableExpr={setTableExpr}
                tableStart={tableStart}
                setTableStart={setTableStart}
                tableEnd={tableEnd}
                setTableEnd={setTableEnd}
                tableStep={tableStep}
                setTableStep={setTableStep}
                eqSubMode={eqSubMode}
                setEqSubMode={setEqSubMode}
                qa={qa}
                setQa={setQa}
                qb={qb}
                setQb={setQb}
                qc={qc}
                setQc={setQc}
                qd={qd}
                setQd={setQd}
                sys2={sys2}
                setSys2={setSys2}
                sys3={sys3}
                setSys3={setSys3}
                ineqOp={ineqOp}
                setIneqOp={setIneqOp}
                statsRaw={statsRaw}
                setStatsRaw={setStatsRaw}
                statsResult={statsResult}
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
                    setPreAns(lastResult.numeric);
                    setLastResult(res);
                  } else {
                    setErrorMsg('Syntax ERROR');
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
            onClick={() => setAngleUnit((u) => (u === 'D' ? 'R' : 'D'))}
            title="Chuyển đổi Độ (DEG) ↔ Radian (RAD)"
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 cursor-pointer"
          >
            {angleUnit === 'D' ? 'DEG' : 'RAD'}
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
                <span className="h-2.5" />
                <button
                  type="button"
                  title="Tùy chọn nhanh OPTN"
                  onClick={() => setOverlay((o) => (o === 'optn' ? null : 'optn'))}
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
