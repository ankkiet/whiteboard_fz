import React, { useEffect, useRef, useState } from 'react';
import { GoogleDriveWorkspaceState } from '../../hooks/useGoogleDriveWorkspace';
import { StartDesktopUpdateParams } from '../../hooks/useDesktopUpdate';
import { HomeSectionId } from '../../hooks/useHomeScrollState';
import { HomeSettingsMenu, PWAInstallTriggerButton } from './HomeSettingsMenu';
import { AppLogo } from '../ui/AppLogo';
import { useI18n } from '../../i18n/useI18n';
import {
  ChevronDown,
  Laptop,
  LogOut,
  Moon,
  Plus,
  Sun,
  UserRoundCog,
} from 'lucide-react';

interface HomeHeaderProps {
  drive: GoogleDriveWorkspaceState;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isFileProtocol: boolean;
  onCreateNewClick: () => void;
  onOpenDesktopAppClick: () => void;
  onOpenAuthBridgeClick?: () => void;
  onStartDesktopUpdate?: (params: StartDesktopUpdateParams) => void;
  activeSection?: HomeSectionId;
  isScrolled?: boolean;
  progressBarRef?: React.RefObject<HTMLDivElement | null>;
  onNavigateSection?: (id: HomeSectionId) => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  drive,
  theme,
  onToggleTheme,
  isFileProtocol,
  onCreateNewClick,
  onOpenDesktopAppClick,
  onOpenAuthBridgeClick,
  onStartDesktopUpdate,
  activeSection = 'local-draft-section',
  isScrolled = false,
  progressBarRef,
  onNavigateSection,
}) => {
  const { t } = useI18n();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const chapterItems: { id: HomeSectionId; label: string }[] = [
    { id: 'local-draft-section', label: t('Đang mở', 'Active') },
    { id: 'board-templates-section', label: t('Mẫu bảng', 'Templates') },
    { id: 'local-boards-section', label: t('Thư viện', 'Library') },
    { id: 'drive-boards-section', label: 'Google Drive' },
  ];

  useEffect(() => {
    if (!showAccountMenu) return;
    const onOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showAccountMenu]);

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-200 border-b ${
        isScrolled
          ? 'bg-white dark:bg-[#151518] border-slate-200/80 dark:border-slate-800/80'
          : 'bg-[#fafafa] dark:bg-[#111113] border-transparent'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <AppLogo size={28} concept="infinite" />
          <span className="font-fzink-brand text-xl sm:text-[22px] leading-none text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 pr-1">
            fzInK
          </span>
        </div>

        {/* Inline Chapter Navigation */}
        {onNavigateSection && (
          <nav
            aria-label={t('Điều hướng khu vực trang chủ', 'Home section navigation')}
            className="hidden lg:flex items-center gap-1 h-full"
          >
            {chapterItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigateSection(item.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`relative h-full px-3 inline-flex items-center text-[13px] font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 bottom-0 h-[2px] bg-slate-900 dark:bg-slate-100"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark'
                ? t('Chuyển sang giao diện sáng', 'Switch to light mode')
                : t('Chuyển sang giao diện tối', 'Switch to dark mode')
            }
            title={
              theme === 'dark'
                ? t('Giao diện sáng', 'Light mode')
                : t('Giao diện tối', 'Dark mode')
            }
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-150 cursor-pointer shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Moon className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>

          {!drive.needsAuth && drive.user && (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setShowAccountMenu((v) => !v)}
                aria-expanded={showAccountMenu}
                aria-label={t('Tài khoản Google', 'Google account')}
                className="h-9 pl-1.5 pr-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors duration-150 cursor-pointer shrink-0"
              >
                {drive.user.photoURL ? (
                  <img
                    src={drive.user.photoURL}
                    alt={drive.user.displayName || t('Tài khoản Google', 'Google account')}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#1d5fbf] text-white text-xs font-medium flex items-center justify-center shrink-0">
                    {(drive.user.displayName || drive.user.email || 'G')[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden md:inline text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
                  {drive.user.displayName || drive.user.email}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.75} />
              </button>

              {showAccountMenu && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-md dark:shadow-none border border-slate-200 dark:border-slate-800 p-1.5 z-30" /* taste-skill-ignore */
                >
                  <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {drive.user.displayName || t('Tài khoản Google', 'Google account')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {drive.user.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={drive.isLoggingIn || Boolean(drive.busyAction)}
                    onClick={() => {
                      setShowAccountMenu(false);
                      void drive.signIn({ forceAccountPicker: true });
                    }}
                    className="w-full h-9 flex items-center gap-2 px-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                  >
                    <UserRoundCog className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.75} />
                    <span>{t('Đổi tài khoản Google', 'Switch Google account')}</span>
                  </button>
                  {!isFileProtocol && onOpenAuthBridgeClick && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAccountMenu(false);
                        onOpenAuthBridgeClick();
                      }}
                      className="w-full h-9 flex items-center gap-2 px-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer"
                    >
                      <Laptop className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.75} />
                      <span>{t('Mã kết nối app máy tính', 'Desktop app connection code')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={Boolean(drive.busyAction)}
                    onClick={() => {
                      setShowAccountMenu(false);
                      void drive.signOut();
                    }}
                    className="w-full h-9 flex items-center gap-2 px-2.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors duration-150 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>{t('Đăng xuất', 'Sign out')}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <HomeSettingsMenu
            onOpenDesktopModal={onOpenDesktopAppClick}
            onStartDesktopUpdate={onStartDesktopUpdate}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />

          <PWAInstallTriggerButton onOpenModal={onOpenDesktopAppClick} />

          <button
            type="button"
            data-testid="create-new-board-button"
            onClick={onCreateNewClick}
            className="h-9 inline-flex items-center gap-1.5 px-3 sm:px-4 rounded-lg bg-[#1d5fbf] hover:bg-[#174ea1] dark:bg-[#2a6fd1] dark:hover:bg-[#3b80e0] active:scale-[0.98] text-white text-xs sm:text-sm font-medium transition-[background-color,transform] duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>{t('Tạo bảng mới', 'New board')}</span>
          </button>
        </div>
      </div>

      {/* Scroll Progress Hairline */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[2px] pointer-events-none overflow-hidden"
      >
        <div
          ref={progressBarRef}
          className="h-full w-full bg-[#1d5fbf] dark:bg-[#669df6] origin-left"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>
    </header>
  );
};
