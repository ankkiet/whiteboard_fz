import React, { useState } from 'react';
import { detectUserOS, useOnlineStatus } from '../../hooks/usePWAInstall';
import {
  buildMacOSDesktopAppZip,
  buildMacOSSelfExtractingCommand,
  buildWindowsDesktopZip,
  buildWindowsExeInstaller,
} from '../../engine/desktopPackager';
import { useBoardStore } from '../../store/useBoardStore';
import {
  Download,
  X,
  Laptop,
  WifiOff,
  CheckCircle2,
  Monitor,
  Apple,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface DesktopAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      data-testid="pwa-offline-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>Đang ngoại tuyến — Dữ liệu bảng vẫn tự động lưu trên máy</span>
    </div>
  );
};

const DESKTOP_APP_DOWNLOADED_KEY = 'bttm_desktop_app_downloaded_v1';
const DESKTOP_APP_DOWNLOADED_EVENT = 'bttm:desktop-app-downloaded';

export function hasDesktopAppBeenDownloaded(): boolean {
  if (typeof window === 'undefined') return false;
  // Always hide when running directly from the local offline desktop bundle (file://)
  if (window.location.protocol === 'file:') return true;
  try {
    return window.localStorage.getItem(DESKTOP_APP_DOWNLOADED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markDesktopAppAsDownloaded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DESKTOP_APP_DOWNLOADED_KEY, 'true');
  } catch {
    // ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent(DESKTOP_APP_DOWNLOADED_EVENT));
}

export const PWAInstallTriggerButton: React.FC<{
  onOpenModal: () => void;
  compact?: boolean;
}> = ({ onOpenModal, compact = false }) => {
  const [isDownloaded, setIsDownloaded] = useState<boolean>(() => hasDesktopAppBeenDownloaded());

  React.useEffect(() => {
    const syncState = () => setIsDownloaded(hasDesktopAppBeenDownloaded());
    window.addEventListener(DESKTOP_APP_DOWNLOADED_EVENT, syncState);
    window.addEventListener('storage', syncState);
    return () => {
      window.removeEventListener(DESKTOP_APP_DOWNLOADED_EVENT, syncState);
      window.removeEventListener('storage', syncState);
    };
  }, []);

  if (isDownloaded) return null;

  return (
    <button
      type="button"
      data-testid="open-desktop-app-modal-button"
      onClick={onOpenModal}
      title="Tải ứng dụng Bảng Trắng Thông Minh (.exe cho Windows / .app cho macOS)"
      aria-label="Tải ứng dụng về máy tính"
      className={`inline-flex items-center gap-1.5 rounded-xl border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
        compact
          ? 'px-2.5 py-1.5 text-xs font-semibold bg-indigo-50/90 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80'
          : 'h-9 px-3.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
      }`}
    >
      <Download className="w-3.5 h-3.5 shrink-0" />
      <span className={compact ? 'hidden xl:inline' : ''}>Tải ứng dụng (.exe / Mac)</span>
    </button>
  );
};

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

let cachedOfflineBundleHtml: string | null = null;

async function fetchOfflineAppBundleHtml(): Promise<string> {
  if (cachedOfflineBundleHtml) return cachedOfflineBundleHtml;
  const res = await fetch('/desktop-app-bundle.html');
  if (!res.ok) {
    throw new Error('Không thể tải gói ứng dụng độc lập.');
  }
  const html = await res.text();
  cachedOfflineBundleHtml = html;
  return html;
}

export const DesktopAppModal: React.FC<DesktopAppModalProps> = ({ isOpen, onClose }) => {
  const addToast = useBoardStore((s) => s.addToast);
  const [busyTarget, setBusyTarget] = useState<'win-exe' | 'win-zip' | 'mac-cmd' | 'mac-app' | null>(null);

  if (!isOpen) return null;

  const os = detectUserOS();

  const handleDownloadWindowsExe = async () => {
    try {
      setBusyTarget('win-exe');
      const bundledHtml = await fetchOfflineAppBundleHtml();
      const exeBytes = buildWindowsExeInstaller(bundledHtml);
      const blob = new Blob([exeBytes.buffer as ArrayBuffer], {
        type: 'application/vnd.microsoft.portable-executable',
      });
      triggerBlobDownload(blob, 'BangTrangThongMinh-Setup.exe');
      markDesktopAppAsDownloaded();
      addToast('Đã tải BangTrangThongMinh-Setup.exe (Win32 chuẩn, không mã ẩn)!', 'success');
      onClose();
    } catch {
      addToast('Có lỗi khi tạo bộ cài .exe, vui lòng thử lại.', 'error');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleDownloadWindowsZip = async () => {
    try {
      setBusyTarget('win-zip');
      const bundledHtml = await fetchOfflineAppBundleHtml();
      const zipBytes = buildWindowsDesktopZip(bundledHtml);
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], {
        type: 'application/zip',
      });
      triggerBlobDownload(blob, 'BangTrangThongMinh-Windows-Portable.zip');
      markDesktopAppAsDownloaded();
      addToast('Đã tải gói BangTrangThongMinh-Windows-Portable.zip (Tránh cảnh báo trình duyệt)!', 'success');
      onClose();
    } catch {
      addToast('Có lỗi khi đóng gói bản Windows .zip, vui lòng thử lại.', 'error');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleDownloadMacInstallerCommand = async () => {
    try {
      setBusyTarget('mac-cmd');
      const bundledHtml = await fetchOfflineAppBundleHtml();
      const cmdBytes = buildMacOSSelfExtractingCommand(bundledHtml);
      const blob = new Blob([cmdBytes.buffer as ArrayBuffer], {
        type: 'application/x-sh',
      });
      triggerBlobDownload(blob, 'BangTrangThongMinh-Installer.command');
      markDesktopAppAsDownloaded();
      addToast('Đã tải bộ cài tự động BangTrangThongMinh-Installer.command cho macOS!', 'success');
      onClose();
    } catch {
      addToast('Có lỗi khi tạo bộ cài macOS, vui lòng thử lại.', 'error');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleDownloadMacAppZip = async () => {
    try {
      setBusyTarget('mac-app');
      const bundledHtml = await fetchOfflineAppBundleHtml();
      const bytes = buildMacOSDesktopAppZip(bundledHtml);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
      triggerBlobDownload(blob, 'BangTrangThongMinh-macOS.app.zip');
      markDesktopAppAsDownloaded();
      addToast('Đã tải gói ứng dụng BangTrangThongMinh.app cho macOS!', 'success');
      onClose();
    } catch {
      addToast('Có lỗi khi đóng gói bản macOS, vui lòng thử lại.', 'error');
    } finally {
      setBusyTarget(null);
    }
  };

  return (
    <div
      data-testid="desktop-app-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Tải ứng dụng về máy tính Windows (.exe) hoặc macOS (.app / .command)"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-text"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Laptop className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight truncate">
                Tải ứng dụng Desktop (Windows .EXE & macOS .APP)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Kiến trúc Win32 C thuần & macOS Bundle sạch 100% — Không chứa PowerShell hay script ngầm
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-desktop-app-modal-button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Direct Download Cards */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Windows .EXE Card */}
            <div
              className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                os !== 'macos'
                  ? 'border-indigo-500/80 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                    <Monitor className="w-5 h-5" />
                  </div>
                  {os !== 'macos' && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      Máy của bạn
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Windows 10 / 11 (64-bit)
                  </h3>
                  <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                    BangTrangThongMinh-Setup.exe
                  </p>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Nhị phân Win32 thuần (Không gọi PowerShell/CMD)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Có PE CheckSum chuẩn Microsoft, 100% Offline</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Gói .ZIP kèm bản không cảnh báo SmartScreen</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="download-windows-exe-button"
                  disabled={busyTarget !== null}
                  onClick={() => void handleDownloadWindowsExe()}
                  className="w-full h-10 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {busyTarget === 'win-exe' ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Download className="w-4 h-4 shrink-0" />
                  )}
                  <span>Tải trực tiếp file .EXE</span>
                </button>
                <button
                  type="button"
                  data-testid="download-windows-zip-button"
                  disabled={busyTarget !== null}
                  onClick={() => void handleDownloadWindowsZip()}
                  className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {busyTarget === 'win-zip' ? (
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span>Tải gói Portable (.zip — Tránh trình duyệt chặn)</span>
                </button>
              </div>
            </div>

            {/* macOS .APP / .COMMAND Card */}
            <div
              className={`p-4 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                os === 'macos'
                  ? 'border-indigo-500/80 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-xs">
                    <Apple className="w-5 h-5" />
                  </div>
                  {os === 'macos' && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      Máy của bạn
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    macOS (Apple Silicon & Intel)
                  </h3>
                  <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                    BangTrangThongMinh.app
                  </p>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Ứng dụng gốc chuẩn macOS (.app)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Tự động chép vào Desktop & Applications</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="download-macos-app-button"
                  disabled={busyTarget !== null}
                  onClick={() => void handleDownloadMacAppZip()}
                  className="w-full h-10 px-3 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-60 text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {busyTarget === 'mac-app' ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Download className="w-4 h-4 shrink-0" />
                  )}
                  <span>Tải gói ứng dụng (.app.zip)</span>
                </button>
                <button
                  type="button"
                  data-testid="download-macos-command-button"
                  disabled={busyTarget !== null}
                  onClick={() => void handleDownloadMacInstallerCommand()}
                  className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {busyTarget === 'mac-cmd' ? (
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  ) : (
                    <Download className="w-3 h-3 shrink-0" />
                  )}
                  <span>Tải bộ cài 1-File macOS (.command)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-[11.5px] text-slate-700 dark:text-slate-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Chứng nhận an toàn & Vì sao Windows SmartScreen hỏi xác nhận file .exe mới:</span>
            </div>
            <div>
              • <strong>Đã loại bỏ hoàn toàn lệnh ngầm:</strong> File <code>.exe</code> chỉ dùng API đọc/ghi tệp chuẩn của Windows (<code>CreateFileA</code>, <code>ShellExecuteA</code>) và có mã kiểm tra <code>PE CheckSum</code> chuẩn — <strong>không dùng PowerShell hay CMD ẩn</strong> nên không bị phần mềm diệt virus báo nhầm là mã độc.
            </div>
            <div>
              • <strong>Cách vượt qua thông báo &ldquo;Unknown Publisher&rdquo;:</strong> Mọi file <code>.exe</code> cá nhân chưa mua chứng chỉ số EV của Microsoft ($300–$500/năm) đều hiện bảng xác nhận màu xanh khi tải từ trình duyệt. Bạn hãy tải <strong>Gói Portable (.zip)</strong> ở trên hoặc bấm <strong>More info (Thêm thông tin)</strong> → <strong>Run anyway (Vẫn chạy)</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

