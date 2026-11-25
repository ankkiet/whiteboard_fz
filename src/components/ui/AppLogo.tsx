import React from 'react';
import { useI18n } from '../../i18n/useI18n';

export type AppLogoConcept = 'infinite' | 'monogram' | 'easel';

export interface AppLogoProps {
  concept?: AppLogoConcept;
  variant?: 'icon' | 'full';
  size?: number | string;
  className?: string;
  showSubtitle?: boolean;
}

/**
 * Flat drafting-board & ink-stroke brand mark (single solid ink tile, no gradients or sparkles).
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
    <rect width="512" height="512" rx="112" fill="#4338CA" />
    {/* Subtle drafting dots */}
    <g fill="#FFFFFF" fillOpacity="0.24">
      <circle cx="136" cy="136" r="10" />
      <circle cx="256" cy="136" r="10" />
      <circle cx="376" cy="136" r="10" />
      <circle cx="136" cy="256" r="10" />
      <circle cx="376" cy="256" r="10" />
      <circle cx="136" cy="376" r="10" />
      <circle cx="256" cy="376" r="10" />
      <circle cx="376" cy="376" r="10" />
    </g>
    {/* Single confident ink curve */}
    <path
      d="M124 344 C 178 206, 232 344, 304 226 C 334 176, 362 168, 392 152"
      stroke="#FFFFFF"
      strokeWidth="42"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Ink point */}
    <circle cx="392" cy="152" r="20" fill="#FFFFFF" />
  </svg>
);

export const MonogramLogoSvg: React.FC<{ className?: string; size?: number | string }> = ({
  className = 'w-full h-full',
  size,
}) => <InfiniteBoardLogoSvg className={className} size={size} />;

export const EaselLogoSvg: React.FC<{ className?: string; size?: number | string }> = ({
  className = 'w-full h-full',
  size,
}) => <InfiniteBoardLogoSvg className={className} size={size} />;

export const AppLogo: React.FC<AppLogoProps> = ({
  concept = 'infinite',
  variant = 'icon',
  size = 32,
  className = '',
  showSubtitle = false,
}) => {
  const { t } = useI18n();
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
        className={`inline-flex items-center justify-center shrink-0 rounded-lg overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        {renderSvg()}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 shrink-0 ${className}`}>
      <div
        className="inline-flex items-center justify-center shrink-0 rounded-lg overflow-hidden"
        style={{ width: size, height: size }}
      >
        {renderSvg()}
      </div>
      <div className="flex flex-col min-w-0 leading-none">
        <span className="font-fzink-brand text-xl sm:text-[22px] leading-none text-slate-900 dark:text-slate-100 pr-1 truncate">
          fzInK
        </span>
        {showSubtitle && (
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-1 truncate">
            {t('Bảng trắng tương tác', 'Interactive whiteboard')}
          </span>
        )}
      </div>
    </div>
  );
};
