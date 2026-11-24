import React, { useEffect, useRef, useState } from 'react';
import { detectUserOS, usePWAInstall } from '../../hooks/usePWAInstall';
import { detectMacArchitecture, MacArch } from '../../engine/macArch';
import { useBoardStore } from '../../store/useBoardStore';
import { AppLogo } from '../ui/AppLogo';
import {
  DESKTOP_RELEASES_PAGE,
  DOWNLOAD_LINKS,
  markDesktopAppAsDownloaded,
  triggerDirectDownload,
} from '../../services/appUpdater';
import { Download, ExternalLink, Laptop, ShieldCheck, X } from 'lucide-react';

interface DesktopAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WindowsLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 1024 1024"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fill="#0078D4"
      d="M0 0h486v485H0zM538 0h486v485H538zM0 538h486v486H0zM538 538h486v486H538z"
    />
  </svg>
);

const AppleLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 814 1000"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
  </svg>
);

export const DesktopAppModal: React.FC<DesktopAppModalProps> = ({ isOpen, onClose }) => {
  const addToast = useBoardStore((s) => s.addToast);
  const { isInstallable, install } = usePWAInstall();
  const os = detectUserOS();
  const [macArch, setMacArch] = useState<MacArch>('arm64');
  const [detectedMacArch, setDetectedMacArch] = useState<MacArch | null>(null);
  const userPickedMacArchRef = useRef(false);

  useEffect(() => {
    if (!isOpen || os !== 'macos') return;
    let cancelled = false;
    void detectMacArchitecture().then((result) => {
      if (cancelled || !result.detected) return;
      setDetectedMacArch(result.arch);
      if (!userPickedMacArchRef.current) {
        setMacArch(result.arch);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, os]);

  if (!isOpen) return null;

  const macDmgFileName = `fzInK-macOS-${macArch}.dmg`;
  const macZipFileName = `fzInK-macOS-${macArch}.zip`;
  const macDmgUrl = macArch === 'arm64' ? DOWNLOAD_LINKS.macosArm64Dmg : DOWNLOAD_LINKS.macosX64Dmg;
  const macZipUrl = macArch === 'arm64' ? DOWNLOAD_LINKS.macosArm64Zip : DOWNLOAD_LINKS.macosX64Zip;

  const handleSelectMacArch = (arch: MacArch) => {
    userPickedMacArchRef.current = true;
    setMacArch(arch);
  };

  const handleDownloadWindowsSetup = () => {
    addToast('Đang tải bộ cài đặt fzInK-Setup.exe', 'info');
    triggerDirectDownload(DOWNLOAD_LINKS.windowsSetup, 'fzInK-Setup.exe');
    markDesktopAppAsDownloaded();
  };

  const handleDownloadWindowsPortable = () => {
    addToast('Đang tải bản Portable (fzInK-Portable.exe)', 'info');
    triggerDirectDownload(DOWNLOAD_LINKS.windowsPortable, 'fzInK-Portable.exe');
    markDesktopAppAsDownloaded();
  };

  const handleDownloadMacDmg = () => {
    addToast(`Đang tải ứng dụng macOS (${macDmgFileName})`, 'info');
    triggerDirectDownload(macDmgUrl, macDmgFileName);
    markDesktopAppAsDownloaded();
  };

  const handleDownloadMacZip = () => {
    addToast(`Đang tải bản nén macOS (${macZipFileName})`, 'info');
    triggerDirectDownload(macZipUrl, macZipFileName);
    markDesktopAppAsDownloaded();
  };

  const handleInstallPWA = async () => {
    const success = await install();
    if (success) {
      addToast('Đã bắt đầu cài đặt ứng dụng vào máy tính', 'success');
      markDesktopAppAsDownloaded();
      onClose();
    }
  };

  return (
    <div
      data-testid="desktop-app-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Tải ứng dụng máy tính"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-text"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-none overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size={40} className="rounded-xl" />
            <div>
              <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">
                Tải ứng dụng máy tính
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ứng dụng độc lập cho Windows và macOS, hoạt động hoàn toàn ngoại tuyến
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-desktop-app-modal-button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Windows Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between transition-colors duration-150 ${
                os !== 'macos'
                  ? 'border-indigo-500/70 bg-white dark:bg-slate-900'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    <WindowsLogoIcon className="w-5 h-5" />
                  </div>
                  {os !== 'macos' && (
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Hệ điều hành của bạn
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">
                    Windows
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Windows 10 / 11 (64-bit)
                  </p>
                </div>

                <div className="mt-3 p-2.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-400 leading-snug">
                  Gồm bản cài đặt tự tạo biểu tượng màn hình và bản Portable chạy ngay
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  data-testid="download-windows-exe-button"
                  onClick={handleDownloadWindowsSetup}
                  className="w-full h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-medium text-xs inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>Tải bộ cài đặt (.exe Setup)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadWindowsPortable}
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <span>Bản chạy ngay (.exe Portable)</span>
                </button>
                <div className="text-xs font-mono text-center text-slate-400 dark:text-slate-500">
                  fzInK-Setup.exe
                </div>
              </div>
            </div>

            {/* macOS Card */}
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between transition-colors duration-150 ${
                os === 'macos'
                  ? 'border-indigo-500/70 bg-white dark:bg-slate-900'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    <AppleLogoIcon className="w-5 h-5 text-slate-900 dark:text-slate-100" />
                  </div>
                  {os === 'macos' && (
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Hệ điều hành của bạn
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">
                    macOS
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {os === 'macos' && detectedMacArch
                      ? `Tự nhận diện: ${detectedMacArch === 'arm64' ? 'Apple Silicon (M1–M4)' : 'chip Intel (x64)'}`
                      : 'macOS 11 trở lên · Apple Silicon & Intel'}
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Chọn kiến trúc chip macOS"
                  className="mt-3 grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70"
                >
                  {[
                    { id: 'arm64' as const, label: 'Apple Silicon', sub: 'M1–M4' },
                    { id: 'x64' as const, label: 'Intel', sub: 'x64' },
                  ].map((option) => {
                    const isSelected = macArch === option.id;
                    const isAutoMatched = os === 'macos' && detectedMacArch === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-testid={`mac-arch-${option.id}-button`}
                        onClick={() => handleSelectMacArch(option.id)}
                        className={`px-2 py-1.5 rounded-md text-left transition-colors duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium leading-tight truncate">
                            {option.label}
                          </span>
                          {isAutoMatched && (
                            <span
                              title="Phù hợp với máy Mac của bạn"
                              className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                            />
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                          {isAutoMatched ? `${option.sub} · Máy này` : option.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  data-testid="download-macos-app-button"
                  onClick={handleDownloadMacDmg}
                  className="w-full h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 active:scale-[0.98] text-white font-medium text-xs inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>Tải gói cài đặt (.dmg)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMacZip}
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer"
                >
                  <span>Gói ứng dụng (.zip)</span>
                </button>
                <div className="text-xs font-mono text-center text-slate-400 dark:text-slate-500 truncate">
                  {macDmgFileName}
                </div>
              </div>
            </div>
          </div>

          {isInstallable && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
                <span className="text-slate-700 dark:text-slate-300">
                  Dùng ngay không cần tải bộ cài đặt lớn?
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleInstallPWA()}
                className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs inline-flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>Cài đặt nhanh (PWA)</span>
              </button>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
              <span className="truncate">Ứng dụng độc lập · Lưu cục bộ · Hoạt động ngoại tuyến</span>
            </div>
            <a
              href={DESKTOP_RELEASES_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors duration-150"
            >
              <span>GitHub Releases</span>
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
