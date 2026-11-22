import React from 'react';
import { BoardType } from '../../types/board';

interface BoardTemplatePreviewProps {
  type: BoardType;
  className?: string;
}

export const BoardTemplatePreview: React.FC<BoardTemplatePreviewProps> = ({
  type,
  className = 'w-full h-24',
}) => {
  if (type === 'math') {
    return (
      <div
        className={`${className} relative overflow-hidden bg-slate-50 dark:bg-slate-950/80 flex items-center justify-center`}
      >
        <svg viewBox="0 0 220 110" className="w-full h-full" fill="none" aria-hidden="true">
          {/* Clean math grid paper */}
          <g className="stroke-slate-200/80 dark:stroke-slate-800/80" strokeWidth="0.75">
            {[22, 44, 66, 88, 110, 132, 154, 176, 198].map((x) => (
              <line key={`vx-${x}`} x1={x} y1="0" x2={x} y2="110" />
            ))}
            {[22, 44, 66, 88].map((y) => (
              <line key={`hy-${y}`} x1="0" y1={y} x2="220" y2={y} />
            ))}
          </g>

          {/* Geometric right triangle */}
          <path
            d="M 28 30 L 28 84 L 92 84 Z"
            className="fill-indigo-500/8 stroke-indigo-600 dark:stroke-indigo-400"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M 28 75 L 37 75 L 37 84"
            className="stroke-indigo-500 dark:stroke-indigo-400"
            strokeWidth="1.2"
          />

          {/* Formula expression */}
          <text
            x="116"
            y="42"
            className="fill-slate-700 dark:fill-slate-200"
            fontSize="12"
            fontWeight="600"
            fontFamily="ui-monospace, SFMono-Regular, monospace"
          >
            a² + b² = c²
          </text>

          {/* Subtle parabola accent */}
          <path
            d="M 118 82 Q 156 46 194 82"
            className="stroke-emerald-600 dark:stroke-emerald-400"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="156"
            cy="64"
            r="2.5"
            className="fill-emerald-600 dark:fill-emerald-400"
          />
        </svg>
      </div>
    );
  }

  if (type === 'notebook') {
    return (
      <div
        className={`${className} relative overflow-hidden bg-slate-50 dark:bg-slate-950/80 flex items-center justify-center`}
      >
        <svg viewBox="0 0 220 110" className="w-full h-full" fill="none" aria-hidden="true">
          {[22, 40, 58, 76, 94].map((y) => (
            <line
              key={`line-${y}`}
              x1="0"
              y1={y}
              x2="220"
              y2={y}
              className="stroke-blue-200/85 dark:stroke-slate-800"
              strokeWidth="1"
            />
          ))}
          {/* Margin rule */}
          <line
            x1="34"
            y1="0"
            x2="34"
            y2="110"
            className="stroke-rose-300/60 dark:stroke-rose-900/60"
            strokeWidth="1"
          />
          {/* Clean handwriting / note lines */}
          <line
            x1="46"
            y1="32"
            x2="132"
            y2="32"
            className="stroke-slate-700 dark:stroke-slate-300"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <line
            x1="46"
            y1="50"
            x2="178"
            y2="50"
            className="stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="46"
            y1="68"
            x2="156"
            y2="68"
            className="stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="46"
            y="81"
            width="64"
            height="8"
            rx="2"
            className="fill-amber-300/60 dark:fill-amber-500/30"
          />
        </svg>
      </div>
    );
  }

  if (type === 'mindmap') {
    return (
      <div
        className={`${className} relative overflow-hidden bg-slate-50 dark:bg-slate-950/80 flex items-center justify-center`}
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(148, 163, 184, 0.35) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        <svg viewBox="0 0 220 110" className="w-full h-full" fill="none" aria-hidden="true">
          {/* Connectors */}
          <path
            d="M 134 50 C 148 44, 150 30, 160 30"
            className="stroke-blue-500 dark:stroke-blue-400"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M 134 60 C 148 66, 150 80, 160 80"
            className="stroke-emerald-500 dark:stroke-emerald-400"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M 86 55 L 60 55"
            className="stroke-amber-500 dark:stroke-amber-400"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Central node */}
          <rect
            x="84"
            y="40"
            width="52"
            height="30"
            rx="7"
            className="fill-indigo-50 dark:fill-indigo-950/70 stroke-indigo-500 dark:stroke-indigo-400"
            strokeWidth="1.6"
          />
          <line
            x1="95"
            y1="55"
            x2="125"
            y2="55"
            className="stroke-indigo-600 dark:stroke-indigo-300"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Branch nodes */}
          <rect
            x="160"
            y="18"
            width="44"
            height="24"
            rx="6"
            className="fill-blue-50 dark:fill-blue-950/60 stroke-blue-400 dark:stroke-blue-500"
            strokeWidth="1.4"
          />
          <rect
            x="160"
            y="68"
            width="44"
            height="24"
            rx="6"
            className="fill-emerald-50 dark:fill-emerald-950/60 stroke-emerald-400 dark:stroke-emerald-500"
            strokeWidth="1.4"
          />
          <rect
            x="16"
            y="43"
            width="44"
            height="24"
            rx="6"
            className="fill-amber-50 dark:fill-amber-950/60 stroke-amber-400 dark:stroke-amber-500"
            strokeWidth="1.4"
          />
        </svg>
      </div>
    );
  }

  // basic
  return (
    <div
      className={`${className} relative overflow-hidden bg-slate-50 dark:bg-slate-950/80 flex items-center justify-center`}
    >
      <svg viewBox="0 0 220 110" className="w-full h-full" fill="none" aria-hidden="true">
        <g className="stroke-slate-200/75 dark:stroke-slate-800/75" strokeWidth="0.75">
          {[22, 44, 66, 88, 110, 132, 154, 176, 198].map((x) => (
            <line key={`bgx-${x}`} x1={x} y1="0" x2={x} y2="110" />
          ))}
          {[22, 44, 66, 88].map((y) => (
            <line key={`bgy-${y}`} x1="0" y1={y} x2="220" y2={y} />
          ))}
        </g>
        <rect
          x="26"
          y="24"
          width="66"
          height="42"
          rx="7"
          className="fill-white dark:fill-slate-900 stroke-slate-400 dark:stroke-slate-600"
          strokeWidth="1.5"
        />
        <rect
          x="134"
          y="46"
          width="58"
          height="42"
          rx="7"
          className="fill-amber-100/90 dark:fill-amber-950/50 stroke-amber-300 dark:stroke-amber-700"
          strokeWidth="1.5"
        />
        <path
          d="M 94 45 C 114 45, 114 66, 132 66"
          className="stroke-indigo-500 dark:stroke-indigo-400"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M 38 82 C 56 70, 74 96, 98 80"
          className="stroke-slate-700 dark:stroke-slate-300"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
