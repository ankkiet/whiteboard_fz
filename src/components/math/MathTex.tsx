import React, { useMemo } from 'react';
import katex from 'katex';
import { parseMathSegments } from '../../engine/mathDisplay';

interface MathTexProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export function renderKatexSafe(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex || '\\text{ }', {
      throwOnError: false,
      displayMode,
      strict: 'ignore',
    });
  } catch {
    return latex;
  }
}

/**
 * Renders standard mathematical notation via KaTeX without exposing raw LaTeX source.
 */
export const MathTex: React.FC<MathTexProps> = ({ latex, displayMode = false, className = '' }) => {
  const html = useMemo(() => renderKatexSafe(latex, displayMode), [latex, displayMode]);
  return (
    <span
      className={`inline-flex items-center leading-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface RichMathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders Vietnamese prose mixed with inline equations (`$...$`, `$$...$$`, or `y = x³ - 3mx + 1`)
 * using standard KaTeX typography for every mathematical segment.
 */
export const RichMathText: React.FC<RichMathTextProps> = ({ text, className = '' }) => {
  const segments = useMemo(() => parseMathSegments(text), [text]);
  return (
    <span className={className}>
      {segments.map((seg, idx) =>
        seg.kind === 'math' ? (
          <MathTex
            key={idx}
            latex={seg.content}
            displayMode={Boolean(seg.display)}
            className="mx-0.5 align-middle"
          />
        ) : (
          <React.Fragment key={idx}>{seg.content}</React.Fragment>
        )
      )}
    </span>
  );
};
