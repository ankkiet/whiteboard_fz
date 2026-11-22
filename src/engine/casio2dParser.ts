export type Casio2dTemplateKind =
  | 'int'
  | 'frac'
  | 'mixfrac'
  | 'sqrt'
  | 'cbrt'
  | 'nroot'
  | 'pow'
  | 'logb'
  | 'ddx'
  | 'sum'
  | 'prod'
  | 'lim'
  | 'GCD'
  | 'LCM'
  | 'Pol'
  | 'Rec'
  | 'RanInt';

export interface Casio2dSlotNode {
  type: 'slot';
  id: string;
  start: number;
  end: number;
  value: string;
  role: 'root' | 'gap' | 'arg';
  size: 'main' | 'sub';
  dashedWhenFilled?: boolean;
  upSlotId?: string;
  downSlotId?: string;
}

export interface Casio2dTemplateNode {
  type: 'template';
  id: string;
  kind: Casio2dTemplateKind;
  start: number;
  end: number;
  args: Casio2dNode[][];
  argRanges: { start: number; end: number }[];
}

export type Casio2dNode = Casio2dSlotNode | Casio2dTemplateNode;

const TEMPLATE_NAMES: Casio2dTemplateKind[] = [
  'mixfrac',
  'RanInt',
  'nroot',
  'frac',
  'sqrt',
  'cbrt',
  'logb',
  'prod',
  'int',
  'pow',
  'ddx',
  'sum',
  'lim',
  'GCD',
  'LCM',
  'Pol',
  'Rec',
];

const EXPECTED_ARG_COUNT: Record<Casio2dTemplateKind, number> = {
  int: 4,
  frac: 2,
  mixfrac: 3,
  sqrt: 1,
  cbrt: 1,
  nroot: 2,
  pow: 2,
  logb: 2,
  ddx: 2,
  sum: 3,
  prod: 3,
  lim: 2,
  GCD: 2,
  LCM: 2,
  Pol: 2,
  Rec: 2,
  RanInt: 2,
};

function getArgSize(kind: Casio2dTemplateKind, argIdx: number): 'main' | 'sub' {
  if (kind === 'int' && (argIdx === 1 || argIdx === 2)) return 'sub';
  if ((kind === 'sum' || kind === 'prod') && (argIdx === 1 || argIdx === 2)) return 'sub';
  if (kind === 'nroot' && argIdx === 0) return 'sub';
  if (kind === 'pow' && argIdx === 1) return 'sub';
  if (kind === 'logb' && argIdx === 0) return 'sub';
  if (kind === 'ddx' && argIdx === 1) return 'sub';
  if (kind === 'lim' && argIdx === 1) return 'sub';
  return 'main';
}

interface EarliestCallMatch {
  kind: Casio2dTemplateKind;
  callStart: number;
  callEnd: number;
  argRanges: { start: number; end: number }[];
}

/**
 * Finds the earliest balanced 2D template call within `expr[rangeStart..rangeEnd]`.
 */
function findEarliestTemplateInRange(
  expr: string,
  rangeStart: number,
  rangeEnd: number
): EarliestCallMatch | null {
  const slice = expr.slice(rangeStart, rangeEnd);
  const pattern = new RegExp(`\\b(${TEMPLATE_NAMES.join('|')})\\s*\\(`, 'g');
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(slice)) !== null) {
    const rawName = match[1];
    const kind = TEMPLATE_NAMES.find((t) => t.toLowerCase() === rawName.toLowerCase());
    if (!kind) continue;

    const callStart = rangeStart + match.index;
    const openParenIdx = rangeStart + match.index + match[0].length - 1;
    let depth = 0;
    const argRanges: { start: number; end: number }[] = [];
    let curArgStart = openParenIdx + 1;
    let closedAt = -1;

    for (let i = openParenIdx; i < rangeEnd; i += 1) {
      const ch = expr[i];
      if (ch === '(') {
        depth += 1;
      } else if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          argRanges.push({ start: curArgStart, end: i });
          closedAt = i + 1;
          break;
        }
      } else if ((ch === ';' || ch === ',') && depth === 1) {
        argRanges.push({ start: curArgStart, end: i });
        curArgStart = i + 1;
      }
    }

    if (closedAt !== -1) {
      return {
        kind,
        callStart,
        callEnd: closedAt,
        argRanges,
      };
    }
  }

  return null;
}

function getFirstSlotId(nodes: Casio2dNode[]): string | undefined {
  for (const n of nodes) {
    if (n.type === 'slot') return n.id;
    for (const arg of n.args) {
      const found = getFirstSlotId(arg);
      if (found) return found;
    }
  }
  return undefined;
}

function assignVerticalLink(
  nodes: Casio2dNode[],
  dir: 'upSlotId' | 'downSlotId',
  targetId: string | undefined
) {
  if (!targetId) return;
  for (const n of nodes) {
    if (n.type === 'slot') {
      n[dir] = targetId;
    }
  }
}

/**
 * Normalizes legacy 3-argument `int(f; a; b)` or space-padded `; ` inside 2D templates if needed,
 * or parses any Casio expression directly into a recursive 2D node tree with exact `[start, end]` indices.
 */
export function parseCasio2dNodes(
  expr: string,
  rangeStart = 0,
  rangeEnd = expr.length,
  pathPrefix = 'slot-root',
  isArgLevel = false,
  slotSize: 'main' | 'sub' = 'main',
  dashedWhenFilled = false
): Casio2dNode[] {
  const firstMatch = findEarliestTemplateInRange(expr, rangeStart, rangeEnd);

  // Base case: no 2D template calls inside this range -> single editable leaf slot
  if (!firstMatch) {
    return [
      {
        type: 'slot',
        id: pathPrefix,
        start: rangeStart,
        end: rangeEnd,
        value: expr.slice(rangeStart, rangeEnd),
        role: isArgLevel ? 'arg' : 'root',
        size: slotSize,
        dashedWhenFilled,
      },
    ];
  }

  const nodes: Casio2dNode[] = [];
  let cursor = rangeStart;
  let segIdx = 0;

  while (cursor <= rangeEnd) {
    const nextCall = findEarliestTemplateInRange(expr, cursor, rangeEnd);
    if (!nextCall) {
      // Trailing gap after the last template in this range
      nodes.push({
        type: 'slot',
        id: `${pathPrefix}-g${segIdx}`,
        start: cursor,
        end: rangeEnd,
        value: expr.slice(cursor, rangeEnd),
        role: 'gap',
        size: slotSize,
      });
      break;
    }

    // Gap before `nextCall`
    nodes.push({
      type: 'slot',
      id: `${pathPrefix}-g${segIdx}`,
      start: cursor,
      end: nextCall.callStart,
      value: expr.slice(cursor, nextCall.callStart),
      role: 'gap',
      size: slotSize,
    });

    const tId = `${pathPrefix}-t${segIdx}`;
    const expectedCount = EXPECTED_ARG_COUNT[nextCall.kind];
    const argRanges = [...nextCall.argRanges];

    // If a template has fewer args than expected (e.g. 3-arg `int(f;a;b)`), create a virtual empty range at closing paren
    while (argRanges.length < expectedCount) {
      const closeParenPos = nextCall.callEnd - 1;
      argRanges.push({ start: closeParenPos, end: closeParenPos });
    }

    const parsedArgs: Casio2dNode[][] = argRanges.map((r, aIdx) => {
      const aSize = getArgSize(nextCall.kind, aIdx);
      const isDifferentialVar = nextCall.kind === 'int' && aIdx === 3;
      return parseCasio2dNodes(
        expr,
        r.start,
        r.end,
        `${tId}-a${aIdx}`,
        true,
        aSize,
        isDifferentialVar || true
      );
    });

    // Wire vertical D-pad links (Up / Down between limits, numerator/denominator, base/exponent)
    if (nextCall.kind === 'int' || nextCall.kind === 'sum' || nextCall.kind === 'prod') {
      const mainId = getFirstSlotId(parsedArgs[0]);
      const lowerId = getFirstSlotId(parsedArgs[1]);
      const upperId = getFirstSlotId(parsedArgs[2]);
      assignVerticalLink(parsedArgs[0], 'upSlotId', upperId);
      assignVerticalLink(parsedArgs[0], 'downSlotId', lowerId);
      assignVerticalLink(parsedArgs[1], 'upSlotId', upperId);
      assignVerticalLink(parsedArgs[2], 'downSlotId', lowerId ?? mainId);
    } else if (nextCall.kind === 'frac') {
      const numId = getFirstSlotId(parsedArgs[0]);
      const denId = getFirstSlotId(parsedArgs[1]);
      assignVerticalLink(parsedArgs[0], 'downSlotId', denId);
      assignVerticalLink(parsedArgs[1], 'upSlotId', numId);
    } else if (nextCall.kind === 'mixfrac') {
      const wholeId = getFirstSlotId(parsedArgs[0]);
      const numId = getFirstSlotId(parsedArgs[1]);
      const denId = getFirstSlotId(parsedArgs[2]);
      assignVerticalLink(parsedArgs[0], 'upSlotId', numId);
      assignVerticalLink(parsedArgs[0], 'downSlotId', denId);
      assignVerticalLink(parsedArgs[1], 'downSlotId', denId ?? wholeId);
      assignVerticalLink(parsedArgs[2], 'upSlotId', numId ?? wholeId);
    } else if (nextCall.kind === 'pow') {
      const baseId = getFirstSlotId(parsedArgs[0]);
      const expId = getFirstSlotId(parsedArgs[1]);
      assignVerticalLink(parsedArgs[0], 'upSlotId', expId);
      assignVerticalLink(parsedArgs[1], 'downSlotId', baseId);
    } else if (nextCall.kind === 'nroot') {
      const idxId = getFirstSlotId(parsedArgs[0]);
      const radId = getFirstSlotId(parsedArgs[1]);
      assignVerticalLink(parsedArgs[0], 'downSlotId', radId);
      assignVerticalLink(parsedArgs[1], 'upSlotId', idxId);
    } else if (nextCall.kind === 'logb') {
      const baseId = getFirstSlotId(parsedArgs[0]);
      const valId = getFirstSlotId(parsedArgs[1]);
      assignVerticalLink(parsedArgs[0], 'upSlotId', valId);
      assignVerticalLink(parsedArgs[1], 'downSlotId', baseId);
    } else if (nextCall.kind === 'ddx' || nextCall.kind === 'lim') {
      const fnId = getFirstSlotId(parsedArgs[0]);
      const subId = getFirstSlotId(parsedArgs[1]);
      assignVerticalLink(parsedArgs[0], 'downSlotId', subId);
      assignVerticalLink(parsedArgs[1], 'upSlotId', fnId);
    }

    nodes.push({
      type: 'template',
      id: tId,
      kind: nextCall.kind,
      start: nextCall.callStart,
      end: nextCall.callEnd,
      args: parsedArgs,
      argRanges,
    });

    cursor = nextCall.callEnd;
    segIdx += 1;
  }

  return nodes;
}

/**
 * Flattens all leaf slots from a parsed 2D node tree in ascending `start` order.
 */
export function flattenCasio2dSlots(nodes: Casio2dNode[]): Casio2dSlotNode[] {
  const list: Casio2dSlotNode[] = [];
  const walk = (arr: Casio2dNode[]) => {
    for (const n of arr) {
      if (n.type === 'slot') {
        list.push(n);
      } else {
        for (const arg of n.args) {
          walk(arg);
        }
      }
    }
  };
  walk(nodes);
  return list.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/**
 * Returns the ordered list of slots that D-Pad Left / Right (`◀` / `▶`) visits.
 * Skips empty gap slots unless one is currently active.
 */
export function getNavigableCasio2dSlots(
  nodes: Casio2dNode[],
  activeSlotId?: string
): Casio2dSlotNode[] {
  const all = flattenCasio2dSlots(nodes);
  const filtered = all.filter(
    (s) =>
      s.role === 'root' ||
      s.role === 'arg' ||
      s.value.length > 0 ||
      (activeSlotId !== undefined && s.id === activeSlotId)
  );
  return filtered.length > 0 ? filtered : all;
}

/**
 * Finds the innermost enclosing 2D template node that directly owns `slotId` in one of its arguments.
 */
export function findEnclosingCasio2dTemplate(
  nodes: Casio2dNode[],
  slotId: string
): { template: Casio2dTemplateNode; argIndex: number } | null {
  for (const n of nodes) {
    if (n.type === 'template') {
      for (let aIdx = 0; aIdx < n.args.length; aIdx += 1) {
        const argNodes = n.args[aIdx];
        // Check deeper nested templates first
        const deeper = findEnclosingCasio2dTemplate(argNodes, slotId);
        if (deeper) return deeper;
        if (argNodes.some((child) => child.type === 'slot' && child.id === slotId)) {
          return { template: n, argIndex: aIdx };
        }
      }
    }
  }
  return null;
}

