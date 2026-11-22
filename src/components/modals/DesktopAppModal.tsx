import React, { useState } from 'react';
import {
  buildDesktopLauncherScript,
  useOnlineStatus,
  usePWAInstall,
} from '../../hooks/usePWAInstall';
import { useBoardStore } from '../../store/useBoardStore';
import {
  Monitor,
  Download,
  Globe,
  PackageCheck,
  Copy,
  Check,
  X,
  Laptop,
  WifiOff,
  Sparkles,
  Terminal,
  CheckCircle2,
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
      <span>Chế độ Ngoại tuyến (Offline) — Bảng vẫn tự động lưu trên máy</span>
    </div>
  );
};

export const PWAInstallTriggerButton: React.FC<{
  onOpenModal: () => void;
  compact?: boolean;
}> = ({ onOpenModal, compact = false }) => {
  const { isInstalled } = usePWAInstall();

  return (
    <button
      type="button"
      data-testid="open-desktop-app-modal-button"
      onClick={onOpenModal}
      title="Cài ứng dụng về máy tính Windows / macOS hoặc đóng gói bộ cài .exe / .dmg"
      aria-label="Cài ứng dụng Windows hoặc macOS"
      className={`inline-flex items-center gap-1.5 rounded-xl border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
        compact
          ? 'px-2 py-1.5 text-xs font-semibold bg-indigo-50/90 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80'
          : 'h-9 px-3 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
      }`}
    >
      <Monitor className="w-3.5 h-3.5 shrink-0" />
      <span className={compact ? 'hidden xl:inline' : ''}>
        {isInstalled ? 'App Win/Mac' : 'Cài App Win/Mac'}
      </span>
    </button>
  );
};

export const DesktopAppModal: React.FC<DesktopAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, os, install } = usePWAInstall();
  const addToast = useBoardStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<'instant' | 'native' | 'web'>('instant');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-qtj5cexjmyqzlcadgs6erw-750670418863.asia-northeast1.run.app';

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(id);
      addToast('Đã sao chép lệnh vào bộ nhớ tạm', 'success');
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch {
      addToast('Không thể sao chép tự động', 'info');
    }
  };

  const handleDownloadLauncher = (targetOs: 'windows' | 'macos') => {
    const file = buildDesktopLauncherScript(targetOs, appUrl);
    const blob = new Blob([file.content], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast(
      `Đã tải trình khởi chạy Desktop cho ${targetOs === 'windows' ? 'Windows (.bat)' : 'macOS (.command)'}`,
      'success'
    );
  };

  const handleDirectPWAInstall = async () => {
    const ok = await install();
    if (ok) {
      addToast('Đã cài đặt Bảng Trắng Thông Minh thành ứng dụng máy tính!', 'success');
    }
  };

  return (
    <div
      data-testid="desktop-app-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt & Đóng gói ứng dụng Website, Windows và macOS"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-text"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Laptop className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight truncate">
                Chạy Website & Đóng gói Ứng dụng Windows / macOS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                1 mã nguồn duy nhất: vừa làm Website trực tuyến, vừa cài thành App máy tính độc lập
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

        {/* Mode Tabs */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950">
            <button
              type="button"
              data-testid="desktop-tab-instant"
              onClick={() => setActiveTab('instant')}
              className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'instant'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>1. Cài trực tiếp (PWA)</span>
            </button>
            <button
              type="button"
              data-testid="desktop-tab-native"
              onClick={() => setActiveTab('native')}
              className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'native'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>2. Đóng gói .EXE / .DMG</span>
            </button>
            <button
              type="button"
              data-testid="desktop-tab-web"
              onClick={() => setActiveTab('web')}
              className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'web'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3. Triển khai Website</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {activeTab === 'instant' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/70 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold">
                        ĐÃ TÍCH HỢP SẴN
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Cài làm ứng dụng máy tính độc lập (PWA Standalone)
                      </h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      Dự án đã được tích hợp đầy đủ chuẩn <strong>Progressive Web App (Web Manifest + Service Worker Offline)</strong>. Khi cài lên Windows hoặc macOS, ứng dụng sẽ có icon riêng ở Desktop / Start Menu / Dock, mở trong cửa sổ riêng không có thanh địa chỉ trình duyệt và <strong>hoạt động ngay cả khi mất mạng Internet</strong>.
                    </p>
                  </div>
                </div>

                {isInstalled ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Ứng dụng đang chạy ở chế độ Desktop App độc lập!</span>
                  </div>
                ) : isInstallable ? (
                  <button
                    type="button"
                    data-testid="pwa-native-install-button"
                    onClick={handleDirectPWAInstall}
                    className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      Cài đặt Bảng Trắng Thông Minh lên {os === 'macos' ? 'macOS' : 'Windows'} ngay (1-Click)
                    </span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200/70 dark:border-indigo-800/70 space-y-1.5">
                    <div className="font-bold text-indigo-700 dark:text-indigo-300">
                      Cách cài nhanh từ trình duyệt hiện tại ({isIOS ? 'Safari iOS' : os === 'macos' ? 'macOS' : 'Windows'}):
                    </div>
                    {isIOS ? (
                      <p className="text-slate-600 dark:text-slate-300">
                        Nhấn nút <strong>Chia sẻ (Share)</strong> trên thanh Safari → chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
                      </p>
                    ) : (
                      <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                        <li>
                          <strong>Chrome / Edge (Windows & Mac):</strong> Nhấp biểu tượng <strong>Cài đặt ứng dụng (hình màn hình có mũi tên xuống)</strong> ở góc phải thanh địa chỉ URL, hoặc vào menu <strong>⋮ → Lưu và chia sẻ → Cài đặt Bảng Trắng Thông Minh</strong>.
                        </li>
                        <li>
                          <strong>Safari (macOS Sonoma+):</strong> Vào menu <strong>Tệp (File) → Thêm vào Dock (Add to Dock...)</strong>.
                        </li>
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Desktop Launcher Download (.bat for Windows / .command for macOS) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Tải file khởi chạy cửa sổ App độc lập cho Windows & macOS
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Tải file khởi chạy đặt ngoài màn hình Desktop để bấm đúp mở ngay Bảng Trắng ở chế độ cửa sổ phần mềm riêng biệt (không thanh tab trình duyệt):
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    data-testid="download-win-launcher-button"
                    onClick={() => handleDownloadLauncher('windows')}
                    className="h-10 px-3.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải bản chạy nhanh Windows (.bat)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="download-mac-launcher-button"
                    onClick={() => handleDownloadLauncher('macos')}
                    className="h-10 px-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải bản chạy nhanh macOS (.command)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'native' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-200">
                    Dự án đã được cấu hình sẵn khung Electron Desktop (`electron/main.cjs` & `electron/builder.json`)
                  </div>
                  <p className="text-emerald-800/90 dark:text-emerald-300/90 text-[11.5px]">
                    Bạn không cần viết lại code! Toàn bộ tính năng Bảng Trắng, Toán Học Lớp 1–12, Máy tính Casio fx-580VN X và lưu trữ ngoại tuyến IndexedDB sẽ được đóng gói nguyên vẹn thành file cài đặt <strong>.exe (Windows)</strong> hoặc <strong>.dmg / .app (macOS)</strong>.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    id: 'install-electron',
                    title: 'Bước 1: Cài công cụ đóng gói Electron (chạy 1 lần trên máy của bạn)',
                    cmd: 'npm install -D electron electron-builder',
                  },
                  {
                    id: 'build-win',
                    title: 'Bước 2A: Xuất bộ cài đặt Windows (.exe Setup + bản Portable chạy ngay)',
                    cmd: 'npm run desktop:win',
                  },
                  {
                    id: 'build-mac',
                    title: 'Bước 2B: Xuất bộ cài đặt macOS (.dmg & .app cho chip Apple Silicon / Intel)',
                    cmd: 'npm run desktop:mac',
                  },
                ].map((step) => (
                  <div
                    key={step.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1.5"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {step.title}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11.5px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Terminal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <code className="truncate">{step.cmd}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopy(step.cmd, step.id)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-sans font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedCmd === step.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 text-[11px] text-slate-600 dark:text-slate-300">
                Sau khi chạy lệnh, các bộ cài đặt <strong>Bang Trang Thong Minh Setup.exe</strong> (Windows) và <strong>Bang Trang Thong Minh.dmg</strong> (macOS) sẽ nằm trong thư mục <code>release/</code>.
              </div>
            </div>
          )}

          {activeTab === 'web' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 space-y-1">
                <div className="font-bold text-sky-900 dark:text-sky-200">
                  Vừa chạy làm Website trực tuyến, vừa hỗ trợ người dùng tải App
                </div>
                <p className="text-sky-800/90 dark:text-sky-300/90 text-[11.5px]">
                  Khi bạn đưa dự án lên tên miền Website (Vercel, Netlify, Cloudflare Pages, Firebase Hosting hoặc VPS), bất kỳ giáo viên/học sinh nào truy cập web đều có thể dùng trực tiếp trên trình duyệt hoặc bấm <strong>Cài App Win/Mac</strong> ngay trên thanh công cụ.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    id: 'web-build',
                    title: 'Đóng gói bản Website tĩnh + PWA Service Worker (xuất ra thư mục dist/)',
                    cmd: 'npm run build',
                  },
                  {
                    id: 'web-preview',
                    title: 'Chạy thử bản Website Production trên máy',
                    cmd: 'npm run preview',
                  },
                ].map((step) => (
                  <div
                    key={step.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1.5"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {step.title}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11.5px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <code className="truncate">{step.cmd}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopy(step.cmd, step.id)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-sans font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedCmd === step.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
