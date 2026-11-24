import React, { useEffect, useRef, useState } from 'react';
import { GoogleDriveWorkspaceState } from '../../hooks/useGoogleDriveWorkspace';
import { HomeSettingsMenu, PWAInstallTriggerButton } from './HomeSettingsMenu';
import { AppLogo } from '../ui/AppLogo';
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
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  drive,
  theme,
  onToggleTheme,
  isFileProtocol,
  onCreateNewClick,
  onOpenDesktopAppClick,
  onOpenAuthBridgeClick,
}) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <AppLogo size={28} concept="infinite" />
          <span className="font-fzink-brand text-xl sm:text-[22px] leading-none text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 pr-1">
            fzInK
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
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
                aria-label="Tài khoản Google"
                className="h-9 pl-1.5 pr-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors duration-150 cursor-pointer shrink-0"
              >
                {drive.user.photoURL ? (
                  <img
                    src={drive.user.photoURL}
                    alt={drive.user.displayName || 'Tài khoản Google'}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-medium flex items-center justify-center shrink-0">
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
                  className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-lg dark:shadow-none border border-slate-200 dark:border-slate-800 p-1.5 z-30"
                >
                  <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {drive.user.displayName || 'Tài khoản Google'}
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
                    <span>Đổi tài khoản Google</span>
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
                      <span>Mã kết nối app máy tính</span>
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
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <HomeSettingsMenu
            onOpenDesktopModal={onOpenDesktopAppClick}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />

          <PWAInstallTriggerButton onOpenModal={onOpenDesktopAppClick} />

          <button
            type="button"
            data-testid="create-new-board-button"
            onClick={onCreateNewClick}
            className="h-9 inline-flex items-center gap-1.5 px-3 sm:px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs sm:text-sm font-medium transition-[background-color,transform] duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>Tạo bảng mới</span>
          </button>
        </div>
      </div>
    </header>
  );
};
