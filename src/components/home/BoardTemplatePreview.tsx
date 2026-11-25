import React from 'react';
import { BoardType } from '../../types/board';
import { useI18n } from '../../i18n/useI18n';

interface BoardTemplatePreviewProps {
  type: BoardType;
  className?: string;
}

export const BoardTemplatePreview: React.FC<BoardTemplatePreviewProps> = ({
  type,
  className = 'w-full h-24',
}) => {
  const { t } = useI18n();
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
        className={`${className} relative overflow-hidden bg-slate-200/70 dark:bg-slate-950 flex items-center justify-center`}
      >
        <svg viewBox="0 0 220 110" className="w-full h-full" fill="none" aria-hidden="true">
          {/* Paper sheet shadow & background */}
          <rect
            x="28"
            y="7"
            width="164"
            height="98"
            rx="3"
            className="fill-black/5 dark:fill-black/30"
          />
          <rect
            x="26"
            y="5"
            width="164"
            height="98"
            rx="3"
            className="fill-white dark:fill-slate-900 stroke-slate-300/80 dark:stroke-slate-800"
            strokeWidth="0.8"
          />

          {/* Notebook ruled lines */}
          {[26, 42, 58, 74].map((y) => (
            <line
              key={`line-${y}`}
              x1="26"
              y1={y}
              x2="178"
              y2={y}
              className="stroke-blue-200/80 dark:stroke-slate-800"
              strokeWidth="0.8"
            />
          ))}

          {/* Left red margin line */}
          <line
            x1="38"
            y1="5"
            x2="38"
            y2="103"
            className="stroke-rose-400/85 dark:stroke-rose-800/80"
            strokeWidth="1"
          />

          {/* Right margin line (dashed) */}
          <line
            x1="178"
            y1="5"
            x2="178"
            y2="103"
            className="stroke-slate-300 dark:stroke-slate-700"
            strokeWidth="0.8"
            strokeDasharray="3 3"
          />

          {/* Header text watermark */}
          <text
            x="42"
            y="17"
            className="fill-slate-400 dark:fill-slate-600 font-sans"
            fontSize="5.5"
            fontWeight="500"
          >
            {t('Vở ghi chú • A4', 'Notebook • A4')}
          </text>
          <text
            x="174"
            y="17"
            textAnchor="end"
            className="fill-slate-400 dark:fill-slate-600 font-sans"
            fontSize="5.5"
            fontWeight="500"
          >
            {t('Trang 1', 'Page 1')}
          </text>

          {/* Handwriting sample */}
          <line
            x1="58"
            y1="37"
            x2="136"
            y2="37"
            className="stroke-slate-800 dark:stroke-slate-200"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <line
            x1="58"
            y1="53"
            x2="162"
            y2="53"
            className="stroke-slate-500 dark:stroke-slate-400"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1="58"
            y1="69"
            x2="128"
            y2="69"
            className="stroke-slate-500 dark:stroke-slate-400"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Horizontal dividing line (ngăn cách trang) */}
          <line
            x1="26"
            y1="90"
            x2="190"
            y2="90"
            className="stroke-slate-400/70 dark:stroke-slate-600"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <rect
            x="84"
            y="85"
            width="48"
            height="10"
            rx="5"
            className="fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-700"
            strokeWidth="0.6"
          />
          <text
            x="108"
            y="92"
            textAnchor="middle"
            className="fill-slate-500 dark:fill-slate-400 font-sans"
            fontSize="4.8"
            fontWeight="600"
          >
            {t('Hết trang 1', 'End of page 1')}
          </text>
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
