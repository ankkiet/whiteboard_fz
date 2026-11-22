import React, { useEffect, useState } from 'react';
import { GoogleDriveWorkspaceState } from '../../hooks/useGoogleDriveWorkspace';
import {
  createAuthBridgeToken,
  getWebPortalOrigin,
} from '../../services/authBridge';
import { getGoogleAccessToken } from '../../services/googleAuth';
import { GoogleSignInButton } from '../home/GoogleSignInButton';
import {
  X,
  ExternalLink,
  Clipboard,
  Check,
  Laptop,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Copy,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AuthBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  drive: GoogleDriveWorkspaceState;
  initialMode?: 'connect' | 'export';
}

export const AuthBridgeModal: React.FC<AuthBridgeModalProps> = ({
  isOpen,
  onClose,
  drive,
  initialMode,
}) => {
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const effectiveMode = initialMode || (isFileProtocol ? 'connect' : 'export');

  const [inputToken, setInputToken] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isWaitingBrowser, setIsWaitingBrowser] = useState(false);
  const [autoSentToOpener, setAutoSentToOpener] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // Generate bridge token when in export mode on web with authenticated user
  useEffect(() => {
    if (!isOpen || effectiveMode !== 'export') return;

    if (!drive.needsAuth && drive.user) {
      const accessToken = getGoogleAccessToken();
      if (accessToken) {
        try {
          const code = createAuthBridgeToken(
            {
              uid: drive.user.uid,
              displayName: drive.user.displayName,
              email: drive.user.email,
              photoURL: drive.user.photoURL,
            },
            accessToken
          );
          setGeneratedToken(code);

          // 1. Automatically communicate back to the desktop opener window
          if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
            try {
              window.opener.postMessage({ type: 'BTTM_AUTH_SUCCESS', token: code }, '*');
              setAutoSentToOpener(true);
              setTimeout(() => {
                window.close();
              }, 1200);
            } catch {
              // cross-origin restriction fallback
            }
          }

          // 2. Silently copy to clipboard as seamless fallback
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(code).catch(() => {});
          }
        } catch {
          setGeneratedToken(null);
        }
      } else {
        setGeneratedToken(null);
      }
    } else {
      setGeneratedToken(null);
    }
  }, [isOpen, effectiveMode, drive.needsAuth, drive.user]);

  // When desktop modal is open, listen for postMessage from browser popup
  useEffect(() => {
    if (!isOpen || effectiveMode !== 'connect') return;

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BTTM_AUTH_SUCCESS' && typeof event.data.token === 'string') {
        const ok = drive.applyBridgeToken(event.data.token);
        if (ok) {
          setIsWaitingBrowser(false);
          onClose();
        }
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [isOpen, effectiveMode, drive, onClose]);

  // When desktop modal is open, auto-read clipboard on window focus for 1-click zero-paste handshake
  useEffect(() => {
    if (!isOpen || effectiveMode !== 'connect') return;

    const checkClipboardOnFocus = async () => {
      try {
        if (!navigator.clipboard?.readText) return;
        const text = await navigator.clipboard.readText();
        const trimmed = text ? text.trim() : '';
        if (trimmed && trimmed.startsWith('BTTM-')) {
          setInputToken(trimmed);
          const ok = drive.applyBridgeToken(trimmed);
          if (ok) {
            setIsWaitingBrowser(false);
            onClose();
          }
        }
      } catch {
        // clipboard access might be restricted; ignore
      }
    };

    window.addEventListener('focus', checkClipboardOnFocus);
    return () => window.removeEventListener('focus', checkClipboardOnFocus);
  }, [isOpen, effectiveMode, drive, onClose]);

  if (!isOpen) return null;

  const handleOpenBrowserForCode = () => {
    setIsWaitingBrowser(true);
    setErrorMessage(null);
    const portal = getWebPortalOrigin();
    const targetUrl = `${portal}?auth_bridge=1`;
    window.open(
      targetUrl,
      'bttm_auth_bridge',
      'width=540,height=700,menubar=no,toolbar=no,location=no,status=no'
    );
  };

  const handlePasteFromClipboard = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error('Trình duyệt không cho phép đọc bộ nhớ tạm. Hãy dán thủ công bằng phím Ctrl + V.');
      }
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error('Bộ nhớ tạm đang trống. Hãy sao chép mã từ trình duyệt trước.');
      }
      setInputToken(trimmed);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể đọc bộ nhớ tạm.');
    }
  };

  const handleConfirmConnect = () => {
    setErrorMessage(null);
    const trimmed = inputToken.trim();
    if (!trimmed) {
      setErrorMessage('Vui lòng dán mã kết nối từ trình duyệt vào ô bên trên.');
      return;
    }

    const success = drive.applyBridgeToken(trimmed);
    if (success) {
      setIsWaitingBrowser(false);
      onClose();
    }
  };

  const handleCopyGeneratedToken = async () => {
    if (!generatedToken) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedToken);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = generatedToken;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cầu nối xác thực Google Drive cho ứng dụng máy tính"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 select-text"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold truncate">
                {effectiveMode === 'connect'
                  ? 'Đăng nhập Google qua trình duyệt'
                  : 'Cầu nối đăng nhập cho ứng dụng máy tính'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {effectiveMode === 'connect'
                  ? 'Tự động xác thực tài khoản an toàn từ trình duyệt về ứng dụng'
                  : 'Cấp quyền truy cập Google Drive an toàn cho bản tải về máy'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {effectiveMode === 'connect' ? (
            /* Desktop Connect Flow */
            <>
              {isWaitingBrowser ? (
                /* Auto-Waiting State */
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Đang chờ bạn đăng nhập trên trình duyệt...
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed">
                      Cửa sổ Google đã được mở. Bạn chỉ cần chọn tài khoản Google của mình, hệ thống sẽ <strong>tự động nhận diện và hoàn tất đăng nhập</strong> vào ứng dụng.
                    </p>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenBrowserForCode}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Mở lại cửa sổ trình duyệt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualInput(!showManualInput)}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {showManualInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>Dán mã thủ công (dự phòng)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Initial Action Card */
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Đăng nhập tự động qua trình duyệt
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Bấm nút bên dưới để mở cửa sổ đăng nhập Google trên trình duyệt. Sau khi bạn chọn tài khoản, ứng dụng sẽ <strong>tự động kết nối và chuyển về đây</strong> ngay lập tức.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenBrowserForCode}
                    className="w-full h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>Mở trình duyệt để đăng nhập ngay</span>
                  </button>
                </div>
              )}

              {/* Collapsible Manual Fallback (Optional) */}
              {showManualInput && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Dán mã kết nối thủ công
                    </span>
                    <button
                      type="button"
                      onClick={() => void handlePasteFromClipboard()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <Clipboard className="w-3 h-3" />
                      <span>Dán từ bộ nhớ tạm</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <textarea
                      rows={2}
                      value={inputToken}
                      onChange={(e) => {
                        setInputToken(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="Dán mã bắt đầu bằng BTTM-... vào đây"
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                    {errorMessage && (
                      <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmConnect}
                    disabled={!inputToken.trim()}
                    className="w-full h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Xác nhận kết nối</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 text-[11.5px] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Hoàn toàn tự động và an toàn theo chuẩn bảo mật Google OAuth. Bạn chỉ cần thực hiện một lần.</span>
              </div>
            </>
          ) : (
            /* Web Export Flow */
            <>
              {autoSentToOpener ? (
                /* Auto-Closed State */
                <div className="py-8 flex flex-col items-center text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                    <Check className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Đăng nhập thành công!
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Đang tự động chuyển về ứng dụng máy tính...
                    </p>
                  </div>
                </div>
              ) : drive.needsAuth || !drive.user ? (
                <div className="py-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <div className="max-w-sm space-y-1.5">
                    <h3 className="text-sm font-bold">Đăng nhập tài khoản Google của bạn</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Bấm nút bên dưới để chọn tài khoản Google của bạn. Sau khi đăng nhập, hệ thống sẽ tự động hoàn tất kết nối cho ứng dụng máy tính.
                    </p>
                  </div>
                  <GoogleSignInButton
                    onClick={() => void drive.signIn()}
                    isLoading={drive.isLoggingIn}
                    label="Đăng nhập Google để kết nối app"
                  />
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Account Card */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    {drive.user.photoURL ? (
                      <img
                        src={drive.user.photoURL}
                        alt={drive.user.displayName || 'Tài khoản'}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {(drive.user.displayName || drive.user.email || 'G')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {drive.user.displayName || 'Tài khoản Google'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {drive.user.email}
                      </div>
                    </div>
                  </div>

                  {/* Token Box */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Mã kết nối cho app máy tính:
                      </span>
                      {copiedCode && (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Đã sao chép!</span>
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={generatedToken || 'Đang tạo mã kết nối...'}
                        className="w-full h-10 px-3 pr-20 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-800 dark:text-slate-200 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCopyGeneratedToken()}
                        disabled={!generatedToken}
                        className="absolute right-1.5 top-1.5 h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Sao chép</span>
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
                      Đã tự động gửi mã về ứng dụng máy tính. Bạn chỉ cần mở lại cửa sổ ứng dụng Bảng Trắng Thông Minh là đã hoàn tất!
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Bạn chỉ cần thực hiện bước này một lần.</span>
                    <button
                      type="button"
                      onClick={() => void drive.signIn()}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Đổi tài khoản khác
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
