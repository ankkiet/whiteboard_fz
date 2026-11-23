/**
 * Pure utilities for standard mathematical typography conversion:
 * - friendlyMathToLatex: converts user-friendly math ("(2x+1)/(x-1)", "x^3 - 3*m*x + 1", "sqrt(x)") into clean KaTeX/LaTeX.
 * - latexToReadableMath: converts LaTeX into clean readable Unicode math (for canvas PNG export fallback & plain labels — zero raw backslashes).
 * - formatPrimeFactorizationLatex / formatTrigValueToLatex / parseMathSegments.
 */

export interface MathTextSegment {
  kind: 'text' | 'math';
  content: string;
  display?: boolean;
}

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '(': '⁽',
  ')': '⁾',
  'n': 'ⁿ',
  'x': 'ˣ',
  'k': 'ᵏ',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  'a': 'ₐ',
  'e': 'ₑ',
  'i': 'ᵢ',
  'k': 'ₖ',
  'n': 'ₙ',
  'x': 'ₓ',
};

function toMappedScript(raw: string, map: Record<string, string>): string | null {
  let out = '';
  for (const ch of raw) {
    if (ch === ' ') continue;
    const mapped = map[ch];
    if (!mapped) return null;
    out += mapped;
  }
  return out || null;
}

/**
 * Extracts a balanced `{...}` group starting at `openIdx` (which must point to `{`).
 */
function readBraceGroup(str: string, openIdx: number): { content: string; endIdx: number } | null {
  if (str[openIdx] !== '{') return null;
  let depth = 0;
  for (let i = openIdx; i < str.length; i += 1) {
    if (str[i] === '{') depth += 1;
    else if (str[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return { content: str.slice(openIdx + 1, i), endIdx: i + 1 };
      }
    }
  }
  return null;
}

/**
 * Replaces balanced `sqrt(...)` calls with `\sqrt{...}`.
 */
function replaceSqrtCalls(input: string): string {
  let out = input;
  let guard = 0;
  while (guard < 24) {
    const match = /(?<![a-zA-Z])sqrt\s*\(/i.exec(out);
    if (!match) break;
    const start = match.index;
    const openParen = start + match[0].length - 1;
    let depth = 0;
    let closeParen = -1;
    for (let i = openParen; i < out.length; i += 1) {
      if (out[i] === '(') depth += 1;
      else if (out[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          closeParen = i;
          break;
        }
      }
    }
    if (closeParen === -1) break;
    const inner = out.slice(openParen + 1, closeParen).trim();
    out = `${out.slice(0, start)}\\sqrt{${inner}}${out.slice(closeParen + 1)}`;
    guard += 1;
  }
  return out;
}

/**
 * Replaces simple division fractions like `(2x+1)/(x-1)`, `a/b`, `(a+b)/2`, `1/x` with `\frac{num}{den}`.
 */
function replaceFriendlyFractions(input: string): string {
  let out = input;
  let guard = 0;
  // Pass 1: parenthesized numerator and/or denominator: (A)/(B), (A)/b, a/(B)
  while (guard < 20) {
    const slashIdx = out.indexOf('/');
    if (slashIdx === -1) break;

    // Scan left for numerator
    let leftEnd = slashIdx - 1;
    while (leftEnd >= 0 && out[leftEnd] === ' ') leftEnd -= 1;
    if (leftEnd < 0) break;

    let leftStart = leftEnd;
    let numRaw = '';
    if (out[leftEnd] === ')') {
      let depth = 0;
      let matched = -1;
      for (let i = leftEnd; i >= 0; i -= 1) {
        if (out[i] === ')') depth += 1;
        else if (out[i] === '(') {
          depth -= 1;
          if (depth === 0) {
            matched = i;
            break;
          }
        }
      }
      if (matched === -1) break;
      leftStart = matched;
      numRaw = out.slice(matched + 1, leftEnd).trim();
    } else {
      while (leftStart > 0 && /[a-zA-Z0-9_.^{}\\]/.test(out[leftStart - 1])) {
        leftStart -= 1;
      }
      numRaw = out.slice(leftStart, leftEnd + 1).trim();
    }

    // Scan right for denominator
    let rightStart = slashIdx + 1;
    while (rightStart < out.length && out[rightStart] === ' ') rightStart += 1;
    if (rightStart >= out.length) break;

    let rightEnd = rightStart;
    let denRaw = '';
    if (out[rightStart] === '(') {
      let depth = 0;
      let matched = -1;
      for (let i = rightStart; i < out.length; i += 1) {
        if (out[i] === '(') depth += 1;
        else if (out[i] === ')') {
          depth -= 1;
          if (depth === 0) {
            matched = i;
            break;
          }
        }
      }
      if (matched === -1) break;
      rightEnd = matched + 1;
      denRaw = out.slice(rightStart + 1, matched).trim();
    } else {
      while (rightEnd < out.length && /[a-zA-Z0-9_.^{}\\]/.test(out[rightEnd])) {
        rightEnd += 1;
      }
      denRaw = out.slice(rightStart, rightEnd).trim();
    }

    if (!numRaw || !denRaw) break;
    out = `${out.slice(0, leftStart)}\\frac{${numRaw}}{${denRaw}}${out.slice(rightEnd)}`;
    guard += 1;
  }
  return out;
}

/**
 * Converts user-friendly mathematical input into clean standard LaTeX for KaTeX rendering.
 * If the string already contains LaTeX commands (`\frac`, `\int`, `\sqrt`, etc.), returns it cleanly.
 */
export function friendlyMathToLatex(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Already contains explicit LaTeX commands -> normalize light Unicode symbols only
  if (/\\[a-zA-Z]+/.test(trimmed)) {
    return trimmed
      .replace(/−/g, '-')
      .replace(/×/g, '\\times ')
      .replace(/≤/g, '\\le ')
      .replace(/≥/g, '\\ge ')
      .replace(/≠/g, '\\ne ')
      .replace(/±/g, '\\pm ');
  }

  let s = trimmed;

  // Replace friendly Unicode superscripts & symbols first
  s = s
    .replace(/²/g, '^{2}')
    .replace(/³/g, '^{3}')
    .replace(/⁴/g, '^{4}')
    .replace(/−|–|—/g, '-')
    .replace(/×/g, ' \\times ')
    .replace(/÷/g, ' : ')
    .replace(/·/g, ' \\cdot ')
    .replace(/√\s*\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/√\s*([a-zA-Z0-9_.]+)/g, '\\sqrt{$1}')
    .replace(/π/g, '\\pi ')
    .replace(/∞/g, '\\infty ')
    .replace(/±/g, ' \\pm ')
    .replace(/≤|<=/g, ' \\le ')
    .replace(/≥|>=/g, ' \\ge ')
    .replace(/≠|!=/g, ' \\ne ')
    .replace(/≈/g, ' \\approx ')
    .replace(/<=>/g, ' \\Leftrightarrow ')
    .replace(/=>/g, ' \\Rightarrow ')
    .replace(/->/g, ' \\to ')
    .replace(/\+-/g, ' \\pm ')
    .replace(/\|([^|]+)\|/g, '\\left|$1\\right|');

  // Replace sqrt(...) calls
  s = replaceSqrtCalls(s);

  // Clean implicit multiplication `*`:
  // 3*m*x -> 3mx, 0.25*x -> 0.25x, 2*\sqrt{x} -> 2\sqrt{x}, 2*(x+1) -> 2(x+1), 2*3 -> 2 \cdot 3
  s = s
    .replace(/(\d|\)|[a-zA-Z])\s*\*\s*(?=[a-zA-Z\\(])/g, '$1')
    .replace(/\s*\*\s*/g, ' \\cdot ');

  // Normalize exponents: x^3 -> x^{3}, x^(-2) -> x^{-2}
  s = s
    .replace(/\^\(([^()]+)\)/g, '^{$1}')
    .replace(/\^([a-zA-Z0-9+-]+)/g, '^{$1}');

  // Normalize subscripts: x_1 -> x_{1}, u_n -> u_{n}
  s = s.replace(/_([a-zA-Z0-9]+)/g, '_{$1}');

  // Convert standard functions & constants before fractions so sin(x)/x works nicely
  s = s
    .replace(/(?:(?<=[0-9])|\b)(sin|cos|tan|cot|ln|log|lim|exp)\b/gi, (m) => `\\${m.toLowerCase()}`)
    .replace(/\bpi\b/gi, '\\pi')
    .replace(/\binfinity\b/gi, '\\infty')
    .replace(/\bDelta\b/g, '\\Delta');

  // Convert division `/` into clean vertical fractions `\frac{...}{...}`
  s = replaceFriendlyFractions(s);

  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Converts LaTeX into clean, readable Unicode mathematical notation with zero raw backslashes.
 * Used for PNG export fallback and plain-text summaries.
 */
export function latexToReadableMath(latex: string): string {
  if (!latex) return '';
  let s = latex.trim();

  // Handle \begin{cases} ... \end{cases}
  s = s.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, body: string) => {
    const rows = body
      .split('\\\\')
      .map((r) => r.trim())
      .filter(Boolean);
    return `{ ${rows.join(' ; ')} }`;
  });

  // Handle \left[\begin{array}{...} ... \end{array}\right.
  s = s.replace(/\\left\[\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}\\right\./g, (_, body: string) => {
    const rows = body
      .split('\\\\')
      .map((r) => r.trim())
      .filter(Boolean);
    return `[ ${rows.join(' ; ')} ]`;
  });

  // Unwrap \text{...}, \mathbb{R}, \overrightarrow{...}, \widehat{...}
  s = s
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{Q\}/g, 'ℚ')
    .replace(/\\overrightarrow\{([^{}]+)\}/g, '$1⃗')
    .replace(/\\widehat\{([^{}]+)\}/g, '∠$1')
    .replace(/\\overline\{([^{}]+)\}/g, '$1̄')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\pi/g, 'π')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\varphi|\\phi/g, 'φ')
    .replace(/\\infty/g, '∞');

  // Unwrap \sqrt[n]{x} and \sqrt{x}
  let guard = 0;
  while (guard < 16) {
    const idx = s.indexOf('\\sqrt');
    if (idx === -1) break;
    let cursor = idx + 5;
    let rootIndex = '';
    if (s[cursor] === '[') {
      const closeBracket = s.indexOf(']', cursor);
      if (closeBracket !== -1) {
        rootIndex = s.slice(cursor + 1, closeBracket).trim();
        cursor = closeBracket + 1;
      }
    }
    const grp = readBraceGroup(s, cursor);
    if (!grp) break;
    const prefix = rootIndex ? (toMappedScript(rootIndex, SUPERSCRIPT_MAP) || `${rootIndex}`) : '';
    const inner = grp.content.trim();
    const formattedInner = inner.length <= 2 ? inner : `(${inner})`;
    s = `${s.slice(0, idx)}${prefix}√${formattedInner}${s.slice(grp.endIdx)}`;
    guard += 1;
  }

  // Unwrap \frac{num}{den} iteratively (innermost/leftmost)
  guard = 0;
  while (guard < 16) {
    const idx = s.indexOf('\\frac');
    if (idx === -1) break;
    const numGrp = readBraceGroup(s, idx + 5);
    if (!numGrp) break;
    const denGrp = readBraceGroup(s, numGrp.endIdx);
    if (!denGrp) break;
    const numClean = numGrp.content.trim();
    const denClean = denGrp.content.trim();
    const numStr = /[+\-\s]/.test(numClean) ? `(${numClean})` : numClean;
    const denStr = /[+\-\s]/.test(denClean) ? `(${denClean})` : denClean;
    s = `${s.slice(0, idx)}${numStr}/${denStr}${s.slice(denGrp.endIdx)}`;
    guard += 1;
  }

  // Replace LaTeX operator & symbol commands
  s = s.replace(/\\right\s*([)|[\].])/g, (_, ch: string) => (ch === '.' ? '' : ch));
  const replacements: [RegExp, string][] = [
    [/\\left\s*([(|[\]])/g, '$1'],
    [/\\quad|\\qquad|\\;|\\,|\\:/g, ' '],
    [/\\times/g, '×'],
    [/\\cdot/g, '·'],
    [/\\div/g, ':'],
    [/\\pm/g, '±'],
    [/\\mp/g, '∓'],
    [/\\le(?:q)?/g, '≤'],
    [/\\ge(?:q)?/g, '≥'],
    [/\\ne(?:q)?/g, '≠'],
    [/\\approx/g, '≈'],
    [/\\equiv/g, '≡'],
    [/\\int/g, '∫'],
    [/\\sum/g, '∑'],
    [/\\lim/g, 'lim'],
    [/\\to|\\rightarrow/g, '→'],
    [/\\Rightarrow/g, '⇒'],
    [/\\Leftrightarrow/g, '⇔'],
    [/\\in\b/g, '∈'],
    [/\\notin\b/g, '∉'],
    [/\\forall\b/g, '∀'],
    [/\\exists\b/g, '∃'],
    [/\\cap\b/g, '∩'],
    [/\\cup\b/g, '∪'],
    [/\\perp\b/g, '⊥'],
    [/\\parallel\b/g, '∥'],
    [/\\triangle\b/g, '△'],
    [/\\sim\b/g, '∼'],
    [/\\circ\b/g, '°'],
    [/\\(sin|cos|tan|cot|ln|log)\b/g, '$1'],
    [/\{,\}/g, ','],
  ];

  for (const [pattern, rep] of replacements) {
    s = s.replace(pattern, rep);
  }

  // Convert superscripts ^{...} / ^x and subscripts _{...} / _x
  s = s.replace(/\^\{([^{}]+)\}/g, (_, inner: string) => {
    const trimmed = inner.trim();
    if (trimmed === '°') return '°';
    return toMappedScript(trimmed, SUPERSCRIPT_MAP) ?? `^(${trimmed})`;
  });
  s = s.replace(/\^([0-9nkx])/g, (_, ch: string) => SUPERSCRIPT_MAP[ch] ?? `^${ch}`);

  s = s.replace(/_\{([^{}]+)\}/g, (_, inner: string) => {
    const trimmed = inner.trim();
    return toMappedScript(trimmed, SUBSCRIPT_MAP) ?? `_${trimmed}`;
  });
  s = s.replace(/_([0-9aekinx])/g, (_, ch: string) => SUBSCRIPT_MAP[ch] ?? `_${ch}`);

  // Strip any stray LaTeX braces or leftover command slashes
  s = s
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return s;
}

/**
 * Formats a prime factorization as standard textbook exponential notation in LaTeX.
 * Example: (120, [2,2,2,3,5]) -> "120 = 2^{3} \\cdot 3 \\cdot 5"
 */
export function formatPrimeFactorizationLatex(n: number, factors: number[]): string {
  if (!Number.isFinite(n) || factors.length === 0) return String(Math.floor(n) || 0);
  const counts = new Map<number, number>();
  for (const f of factors) {
    counts.set(f, (counts.get(f) || 0) + 1);
  }
  const terms = Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([p, exp]) => (exp > 1 ? `${p}^{${exp}}` : String(p)));
  return `${Math.floor(n)} = ${terms.join(' \\cdot ')}`;
}

/**
 * Converts exact trigonometry value labels ("√2/2", "-√3/2", "π/4", "KXĐ") into crisp LaTeX.
 */
export function formatTrigValueToLatex(label: string): string {
  const s = label.trim();
  if (!s) return '';
  if (s === 'KXĐ') return '\\text{KXĐ}';
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const sign = neg ? '-' : '';

  if (body.includes('/')) {
    const [rawNum, rawDen] = body.split('/');
    const num = rawNum
      .replace(/√(\d+)/g, '\\sqrt{$1}')
      .replace(/π/g, '\\pi');
    const den = rawDen
      .replace(/√(\d+)/g, '\\sqrt{$1}')
      .replace(/π/g, '\\pi');
    return `${sign}\\frac{${num}}{${den}}`;
  }

  return `${sign}${body.replace(/√(\d+)/g, '\\sqrt{$1}').replace(/π/g, '\\pi')}`;
}

/**
 * Splits mixed Vietnamese text + math expressions (either `$...$`, `$$...$$`, or inline equations like `y = x³ - 3mx + 1`)
 * into structured segments so prose stays normal font while math renders in crisp KaTeX.
 */
export function parseMathSegments(text: string): MathTextSegment[] {
  if (!text) return [];

  // 1. Explicit $$...$$ or $...$ delimiters
  if (text.includes('$')) {
    const segments: MathTextSegment[] = [];
    const regex = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        segments.push({ kind: 'text', content: text.slice(lastIdx, match.index) });
      }
      const isDisplay = match[1] !== undefined;
      const body = (match[1] ?? match[2] ?? '').trim();
      if (body) {
        segments.push({ kind: 'math', content: friendlyMathToLatex(body), display: isDisplay });
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) {
      segments.push({ kind: 'text', content: text.slice(lastIdx) });
    }
    return segments;
  }

  // 2. Auto-detect inline algebraic equations like "y = x³ - 3mx + 1" or "f(x) = (2x+1)/(x-1)"
  const eqRegex = /\b(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\))\s*=\s*[a-zA-Z0-9²³⁴√π^*/+\-−().\s]+(?=[.,;!?]|$)/g;
  const segments: MathTextSegment[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = eqRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ kind: 'text', content: text.slice(lastIdx, match.index) });
    }
    const rawEq = match[0].trim();
    segments.push({ kind: 'math', content: friendlyMathToLatex(rawEq), display: false });
    lastIdx = match.index + rawEq.length;
    if (lastIdx < match.index + match[0].length) {
      segments.push({ kind: 'text', content: match[0].slice(rawEq.length) });
      lastIdx = match.index + match[0].length;
    }
  }
  if (segments.length === 0) {
    return [{ kind: 'text', content: text }];
  }
  if (lastIdx < text.length) {
    segments.push({ kind: 'text', content: text.slice(lastIdx) });
  }
  return segments;
}
