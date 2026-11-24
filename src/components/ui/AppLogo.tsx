import React from 'react';

export type AppLogoConcept = 'infinite' | 'monogram' | 'easel';

export interface AppLogoProps {
  concept?: AppLogoConcept;
  variant?: 'icon' | 'full';
  size?: number | string;
  className?: string;
  showSubtitle?: boolean;
}

/**
 * Concept 1: "Infinite Board & Smart Stylus" (Khuyên dùng)
 * Bảng trắng vô tận, nét bút rực rỡ và ngôi sao trí tuệ.
 */
export const InfiniteBoardLogoSvg: React.FC<{ className?: string; size?: number | string }> = ({
  className = 'w-full h-full',
  size,
}) => (
  <svg
    viewBox="0 0 512 512"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="ib-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4F46E5" />
        <stop offset="60%" stopColor="#4338CA" />
        <stop offset="100%" stopColor="#312E81" />
      </linearGradient>
      <linearGradient id="ib-ribbon" x1="100" y1="360" x2="420" y2="120" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#06B6D4" />
        <stop offset="45%" stopColor="#38BDF8" />
        <stop offset="80%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
      <linearGradient id="ib-card" x1="72" y1="72" x2="440" y2="440" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.04" />
      </linearGradient>
      <filter id="ib-shadow" x="50" y="56" width="412" height="412" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="16" stdDeviation="20" floodColor="#1E1B4B" floodOpacity="0.45" />
      </filter>
    </defs>
    <rect width="512" height="512" rx="116" fill="url(#ib-bg)" />
    <rect
      x="76"
      y="76"
      width="360"
      height="360"
      rx="36"
      fill="url(#ib-card)"
      stroke="#FFFFFF"
      strokeOpacity="0.22"
      strokeWidth="4"
      filter="url(#ib-shadow)"
    />
    <g fill="#FFFFFF" fillOpacity="0.25">
      <circle cx="140" cy="140" r="4" />
      <circle cx="216" cy="140" r="4" />
      <circle cx="296" cy="140" r="4" />
      <circle cx="372" cy="140" r="4" />
      <circle cx="140" cy="216" r="4" />
      <circle cx="216" cy="216" r="4" />
      <circle cx="296" cy="216" r="4" />
      <circle cx="372" cy="216" r="4" />
      <circle cx="140" cy="296" r="4" />
      <circle cx="216" cy="296" r="4" />
      <circle cx="296" cy="296" r="4" />
      <circle cx="372" cy="296" r="4" />
      <circle cx="140" cy="372" r="4" />
      <circle cx="216" cy="372" r="4" />
      <circle cx="296" cy="372" r="4" />
      <circle cx="372" cy="372" r="4" />
    </g>
    <path
      d="M128 336 C 180 170, 240 370, 324 200 C 354 140, 396 152, 408 142"
      stroke="url(#ib-ribbon)"
      strokeWidth="26"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <g transform="translate(254, 242) rotate(-38)">
      <rect x="0" y="0" width="134" height="34" rx="9" fill="#FFFFFF" />
      <rect x="18" y="0" width="12" height="34" fill="#F59E0B" />
      <polygon points="-34,17 0,0 0,34" fill="#F59E0B" />
      <circle cx="-28" cy="17" r="4.5" fill="#1E1B4B" />
    </g>
    <path
      d="M394 112 C 394 132, 406 144, 426 144 C 406 144, 394 156, 394 176 C 394 156, 382 144, 362 144 C 382 144, 394 132, 394 112 Z"
      fill="#FDE047"
    />
  </svg>
);

/**
 * Concept 2: "Geometric Monogram B"
 * Khung chữ B tối giản, hiện đại mang hơi hướng công nghệ cao.
 */
export const MonogramLogoSvg: React.FC<{ className?: string; size?: number | string }> = ({
  className = 'w-full h-full',
  size,
}) => (
  <svg
    viewBox="0 0 512 512"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="mono-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0F172A" />
        <stop offset="50%" stopColor="#1E1B4B" />
        <stop offset="100%" stopColor="#020617" />
      </linearGradient>
      <linearGradient id="mono-stroke" x1="120" y1="100" x2="420" y2="420" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="50%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
      <filter id="mono-glow" x="60" y="60" width="392" height="392" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#4F46E5" floodOpacity="0.35" />
      </filter>
    </defs>
    <rect width="512" height="512" rx="116" fill="url(#mono-bg)" />
    <rect x="8" y="8" width="496" height="496" rx="108" stroke="#6366F1" strokeOpacity="0.2" strokeWidth="4" />
    <g filter="url(#mono-glow)">
      <rect x="116" y="108" width="60" height="296" rx="20" fill="#FFFFFF" />
      <path
        d="M160 118 H 270 C 326 118, 360 148, 360 196 C 360 240, 326 268, 270 268 H 160"
        stroke="url(#mono-stroke)"
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M160 252 H 284 C 348 252, 392 288, 392 346 C 392 400, 344 438, 278 438 H 160"
        stroke="url(#mono-stroke)"
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="268" cy="192" r="15" fill="#FBBF24" />
      <path
        d="M328 334 C 328 346, 336 354, 348 354 C 336 354, 328 362, 328 374 C 328 362, 320 354, 308 354 C 320 354, 328 346, 328 334 Z"
        fill="#38BDF8"
      />
    </g>
  </svg>
);

/**
 * Concept 3: "Smart Whiteboard & Math Arc"
 * Màn hình bảng trắng nổi bật cùng đồ thị toán học và cung hình học.
 */
export const EaselLogoSvg: React.FC<{ className?: string; size?: number | string }> = ({
  className = 'w-full h-full',
  size,
}) => (
  <svg
    viewBox="0 0 512 512"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="es-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4338CA" />
        <stop offset="60%" stopColor="#3730A3" />
        <stop offset="100%" stopColor="#1E1B4B" />
      </linearGradient>
      <filter id="es-shadow" x="60" y="70" width="392" height="340" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#0F172A" floodOpacity="0.38" />
      </filter>
    </defs>
    <rect width="512" height="512" rx="116" fill="url(#es-bg)" />
    <g filter="url(#es-shadow)">
      <rect x="92" y="104" width="328" height="236" rx="28" fill="#FFFFFF" />
      <line x1="132" y1="264" x2="380" y2="264" stroke="#E2E8F0" strokeWidth="3" strokeDasharray="6 6" />
      <line x1="132" y1="204" x2="380" y2="204" stroke="#E2E8F0" strokeWidth="3" strokeDasharray="6 6" />
      <path
        d="M132 254 C 180 180, 230 292, 290 208 C 330 152, 360 172, 380 162"
        stroke="#4F46E5"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M226 270 A 58 58 0 0 1 306 196"
        stroke="#06B6D4"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
    </g>
    <rect x="136" y="364" width="240" height="16" rx="8" fill="#94A3B8" />
    <polygon points="186,380 164,446 190,446 206,380" fill="#64748B" />
    <polygon points="326,380 306,380 322,446 348,446" fill="#64748B" />
    <path
      d="M404 76 C 404 96, 416 108, 436 108 C 416 108, 404 120, 404 140 C 404 120, 392 108, 372 108 C 392 108, 404 96, 404 76 Z"
      fill="#F59E0B"
    />
  </svg>
);

export const AppLogo: React.FC<AppLogoProps> = ({
  concept = 'infinite',
  variant = 'icon',
  size = 32,
  className = '',
  showSubtitle = false,
}) => {
  const renderSvg = () => {
    switch (concept) {
      case 'monogram':
        return <MonogramLogoSvg />;
      case 'easel':
        return <EaselLogoSvg />;
      case 'infinite':
      default:
        return <InfiniteBoardLogoSvg />;
    }
  };

  if (variant === 'icon') {
    return (
      <div
        className={`inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        {renderSvg()}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <div
        className="inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-sm"
        style={{ width: size, height: size }}
      >
        {renderSvg()}
      </div>
      <div className="flex flex-col min-w-0 leading-none">
        <span className="font-fzink-brand text-xl sm:text-[22px] leading-none text-slate-900 dark:text-white pr-1 truncate">
          fzInK
        </span>
        {showSubtitle && (
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
            Bảng trắng tương tác
          </span>
        )}
      </div>
    </div>
  );
};
