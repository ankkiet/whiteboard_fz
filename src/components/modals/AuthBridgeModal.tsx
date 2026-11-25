import React, { useEffect, useState, useRef } from 'react';
import { GoogleDriveWorkspaceState } from '../../hooks/useGoogleDriveWorkspace';
import {
  createAuthBridgeToken,
  getWebPortalOrigin,
  parseAuthBridgeToken,
  BridgeUser,
} from '../../services/authBridge';
import { getGoogleAccessToken } from '../../services/googleAuth';
import { GoogleSignInButton } from '../home/GoogleSignInButton';
import { useI18n } from '../../i18n/useI18n';
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
  Globe,
  CheckCircle2,
  ArrowRight,
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
  const { t } = useI18n();
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const effectiveMode = initialMode || (isFileProtocol ? 'connect' : 'export');

  // Trạng thái kết nối phía Desktop
  const [connectStatus, setConnectStatus] = useState<'waiting' | 'connecting' | 'success' | 'error'>(
    'waiting'
  );
  const [connectedUser, setConnectedUser] = useState<BridgeUser | null>(null);
  const [inputToken, setInputToken] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  // Trạng thái chia sẻ phía Web
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [appRedirectRequested, setAppRedirectRequested] = useState(false);
  const [showManualCode, setShowManualCode] = useState(false);

  const appliedRef = useRef(false);

  // Khởi tạo trạng thái khi mở modal
  useEffect(() => {
    if (isOpen) {
      appliedRef.current = false;
      setErrorMessage(null);
      setAppRedirectRequested(false);
      if (effectiveMode === 'connect') {
        setConnectStatus('waiting');
      }
    }
  }, [isOpen, effectiveMode]);

  // Phía Web: Khi người dùng đã đăng nhập Google, tạo token cầu nối
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

          // Tự động sao chép sẵn vào clipboard để phía desktop có thể nhận diện ngay
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

  // Phía Desktop: Hàm áp dụng token với hiệu ứng chuyển trạng thái
  const handleApplyToken = (raw: string) => {
    if (appliedRef.current) return;
    const trimmed = (raw || '').trim();
    if (!trimmed) return;

    try {
      const session = parseAuthBridgeToken(trimmed);
      appliedRef.current = true;
      setConnectedUser(session.user);
      setConnectStatus('connecting');
      setErrorMessage(null);

      // Cho một khoảng chờ ngắn để người dùng thấy trạng thái loading
      setTimeout(() => {
        const ok = drive.applyBridgeToken(trimmed);
        if (ok) {
          setConnectStatus('success');
          // Giữ màn hình thông báo thành công 1.2s trước khi đóng
          setTimeout(() => {
            onClose();
          }, 1200);
        } else {
          appliedRef.current = false;
          setConnectStatus('error');
          setErrorMessage(
            t(
              'Không thể thiết lập phiên kết nối Google Drive với mã này.',
              'Could not initialize the Google Drive connection session with this code.'
            )
          );
        }
      }, 600);
    } catch (err) {
      setConnectStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : t('Mã kết nối không hợp lệ.', 'Invalid connection code.')
      );
    }
  };

  // Phía Desktop: Lắng nghe postMessage từ popup hoặc Electron
  useEffect(() => {
    if (!isOpen || effectiveMode !== 'connect') return;

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BTTM_AUTH_SUCCESS' && typeof event.data.token === 'string') {
        handleApplyToken(event.data.token);
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [isOpen, effectiveMode]);

  // Phía Desktop: Tự động đọc bộ nhớ tạm khi người dùng chuyển lại cửa sổ ứng dụng
  useEffect(() => {
    if (!isOpen || effectiveMode !== 'connect') return;

    const checkClipboardOnFocus = async () => {
      if (appliedRef.current || connectStatus === 'success' || connectStatus === 'connecting') return;
      try {
        if (!navigator.clipboard?.readText) return;
        const text = await navigator.clipboard.readText();
        const trimmed = text ? text.trim() : '';
        if (trimmed && trimmed.startsWith('BTTM-')) {
          setInputToken(trimmed);
          handleApplyToken(trimmed);
        }
      } catch {
        // Trình duyệt có thể chặn đọc clipboard khi chưa cấp quyền
      }
    };

    window.addEventListener('focus', checkClipboardOnFocus);
    return () => window.removeEventListener('focus', checkClipboardOnFocus);
  }, [isOpen, effectiveMode, connectStatus]);

  if (!isOpen) return null;

  // Phía Desktop: Mở lại cửa sổ trình duyệt
  const handleOpenBrowserForCode = () => {
    appliedRef.current = false;
    setConnectStatus('waiting');
    setErrorMessage(null);
    const portal = getWebPortalOrigin();
    const targetUrl = `${portal}?auth_bridge=1`;
    window.open(
      targetUrl,
      'bttm_auth_bridge',
      'width=540,height=700,menubar=no,toolbar=no,location=no,status=no'
    );
  };

  // Phía Desktop: Dán từ clipboard
  const handlePasteFromClipboard = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error(
          t(
            'Trình duyệt không cho phép đọc bộ nhớ tạm. Hãy dán thủ công bằng phím Ctrl + V.',
            'Browser clipboard read access is blocked. Please paste manually with Ctrl + V.'
          )
        );
      }
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error(
          t(
            'Bộ nhớ tạm đang trống. Hãy sao chép mã từ trình duyệt trước.',
            'Clipboard is empty. Please copy the code from your browser first.'
          )
        );
      }
      setInputToken(trimmed);
      handleApplyToken(trimmed);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : t('Không thể đọc bộ nhớ tạm.', 'Could not read clipboard.')
      );
    }
  };

  // Phía Web: Sao chép mã tạo ra
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

  // Phía Web: Người dùng bấm "Quay về ứng dụng máy tính"
  const handleReturnToDesktopApp = async () => {
    if (!generatedToken) return;
    setAppRedirectRequested(true);

    // 1. Sao chép mã vào bộ nhớ tạm
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedToken);
      }
    } catch {
      // ignore
    }

    // 2. Gửi tín hiệu trực tiếp cho opener window nếu có
    if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: 'BTTM_AUTH_SUCCESS', token: generatedToken }, '*');
      } catch {
        // Cross-origin fallback
      }
    }

    // 3. Kích hoạt mở custom protocol bttm:// để hệ điều hành chuyển về app
    try {
      const protocolUrl = `bttm://auth?token=${encodeURIComponent(generatedToken)}`;
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = protocolUrl;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 1500);
    } catch {
      // ignore
    }

    // Nếu là popup window do app mở ra, tự đóng sau 2 giây
    if (window.opener && !window.opener.closed) {
      setTimeout(() => {
        try {
          window.close();
        } catch {}
      }, 2000);
    }
  };

  // Phía Web: Người dùng chọn "Tiếp tục dùng trên web"
  const handleContinueOnWeb = () => {
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('auth_bridge');
        url.hash = url.hash.replace('auth_bridge', '');
        window.history.replaceState({}, document.title, url.pathname + (url.search || '') + (url.hash || ''));
      } catch {}
    }
    void drive.refreshFiles();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Cầu nối xác thực tài khoản Google', 'Google account authentication bridge')}
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
                  ? t('Đăng nhập Google cho ứng dụng máy tính', 'Sign in with Google for desktop app')
                  : t('Cầu nối đăng nhập cho ứng dụng máy tính', 'Desktop app sign-in bridge')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {effectiveMode === 'connect'
                  ? t('Đồng bộ Google Drive an toàn thông qua trình duyệt', 'Secure Google Drive sync via browser')
                  : t(
                      'Cấp quyền truy cập Google Drive an toàn cho bản cài đặt',
                      'Grant secure Google Drive access to your desktop install'
                    )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('Đóng', 'Close')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {effectiveMode === 'connect' ? (
            /* ========================================================
               DESKTOP CONNECT FLOW (Hiển thị loading & trạng thái chờ)
               ======================================================== */
            <div className="space-y-4">
              {connectStatus === 'waiting' && (
                <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {t('Đang chờ đăng nhập từ trình duyệt', 'Waiting for browser sign-in')}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                      {t(
                        'Cửa sổ trình duyệt đã được mở. Vui lòng chọn tài khoản Google của bạn trên trình duyệt.',
                        'A browser window has opened. Please choose your Google account in the browser.'
                      )}
                    </p>
                  </div>

                  <div className="w-full py-2 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>
                      {t(
                        'Tự động nhận diện khi bạn chọn tài khoản và quay lại cửa sổ này',
                        'Automatically detected when you select an account and return here'
                      )}
                    </span>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenBrowserForCode}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{t('Mở lại trình duyệt', 'Reopen browser')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualInput(!showManualInput)}
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {showManualInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{t('Dán mã thủ công (dự phòng)', 'Paste code manually (fallback)')}</span>
                    </button>
                  </div>
                </div>
              )}

              {connectStatus === 'connecting' && (
                <div className="p-6 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex flex-col items-center text-center space-y-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-md">
                    <Loader2 className="w-7 h-7 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {t('Đang kết nối tài khoản Google...', 'Connecting Google account...')}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {connectedUser?.displayName
                        ? t(
                            `Đang kích hoạt tài khoản "${connectedUser.displayName}"...`,
                            `Activating account "${connectedUser.displayName}"...`
                          )
                        : t(
                            'Đang xác thực thông tin và thiết lập không gian lưu trữ...',
                            'Verifying credentials and setting up storage space...'
                          )}
                    </p>
                  </div>
                </div>
              )}

              {connectStatus === 'success' && (
                <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center text-center space-y-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-emerald-950 dark:text-emerald-100">
                      {t('Đăng nhập thành công', 'Sign-in successful')}
                    </h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">
                      {connectedUser?.displayName || connectedUser?.email
                        ? t(
                            `Chào mừng ${connectedUser.displayName || connectedUser.email}. Đang tải danh sách bảng vẽ...`,
                            `Welcome ${connectedUser.displayName || connectedUser.email}. Loading your boards...`
                          )
                        : t(
                            'Đã hoàn tất kết nối Google Drive. Đang nạp dữ liệu...',
                            'Google Drive connection complete. Loading data...'
                          )}
                    </p>
                  </div>
                </div>
              )}

              {connectStatus === 'error' && (
                <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                      {t('Chưa hoàn tất kết nối', 'Connection incomplete')}
                    </h3>
                    <p className="text-xs text-red-700 dark:text-red-300 max-w-sm">
                      {errorMessage ||
                        t(
                          'Không thể xác thực mã đăng nhập từ trình duyệt.',
                          'Could not verify the sign-in code from your browser.'
                        )}
                    </p>
                  </div>
                  <div className="pt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={handleOpenBrowserForCode}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {t('Thử lại qua trình duyệt', 'Retry via browser')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualInput(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      {t('Dán mã thủ công', 'Paste code manually')}
                    </button>
                  </div>
                </div>
              )}

              {/* Ô dán thủ công dự phòng */}
              {showManualInput && connectStatus !== 'success' && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {t('Dán mã kết nối thủ công', 'Paste connection code manually')}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handlePasteFromClipboard()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <Clipboard className="w-3 h-3" />
                      <span>{t('Dán từ bộ nhớ tạm', 'Paste from clipboard')}</span>
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
                      placeholder={t('Dán mã bắt đầu bằng BTTM- vào đây', 'Paste the code starting with BTTM- here')}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-150 resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyToken(inputToken)}
                    disabled={!inputToken.trim()}
                    className="w-full h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{t('Xác nhận kết nối', 'Confirm connection')}</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 text-[11.5px] text-slate-500 dark:text-slate-400 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {t(
                    'Hoàn toàn tự động và an toàn theo chuẩn bảo mật Google OAuth.',
                    'Fully automatic and secured with standard Google OAuth.'
                  )}
                </span>
              </div>
            </div>
          ) : (
            /* ========================================================
               WEB EXPORT FLOW (Chọn Quay về app hoặc Tiếp tục dùng web)
               ======================================================== */
            <div className="space-y-4">
              {drive.needsAuth || !drive.user ? (
                /* Chưa đăng nhập Google trên web */
                <div className="py-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                    <Laptop className="w-7 h-7" />
                  </div>
                  <div className="max-w-sm space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {t('Đăng nhập Google để kết nối ứng dụng máy tính', 'Sign in with Google to connect the desktop app')}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t(
                        'Đăng nhập tài khoản Google của bạn để cấp quyền lưu trữ và đồng bộ bảng vẽ cho ứng dụng fzInK trên máy tính.',
                        'Sign in to your Google account to grant storage and board sync permissions for the fzInK desktop app.'
                      )}
                    </p>
                  </div>
                  <GoogleSignInButton
                    onClick={() => void drive.signIn()}
                    isLoading={drive.isLoggingIn}
                    label={t('Đăng nhập Google để kết nối app', 'Sign in with Google to connect app')}
                  />
                </div>
              ) : (
                /* ĐÃ ĐĂNG NHẬP THÀNH CÔNG -> HIỂN THỊ MÀN HÌNH QUYẾT ĐỊNH */
                <div className="space-y-4">
                  {/* Card thông báo thành công & tài khoản */}
                  <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
                        {t('Đăng nhập thành công!', 'Sign-in successful!')}
                      </h3>
                      <div className="flex items-center justify-center gap-2 pt-0.5">
                        {drive.user.photoURL ? (
                          <img
                            src={drive.user.photoURL}
                            alt={drive.user.displayName || t('Tài khoản', 'Account')}
                            referrerPolicy="no-referrer"
                            className="w-5 h-5 rounded-full border border-emerald-200 dark:border-emerald-700"
                          />
                        ) : null}
                        <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                          {drive.user.displayName || drive.user.email}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-medium">
                          {t('Đã liên kết Drive', 'Drive linked')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Câu hỏi trung tâm & 2 nút điều hướng lớn */}
                  <div className="space-y-3 pt-1">
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t(
                          'Bạn muốn quay về ứng dụng máy tính hay tiếp tục sử dụng trên trình duyệt web?',
                          'Would you like to return to the desktop app or continue in your web browser?'
                        )}
                      </p>
                      <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                        {t('Chọn cách làm việc phù hợp với bạn bên dưới:', 'Choose your preferred option below:')}
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      {/* Lựa chọn 1: Quay về ứng dụng máy tính */}
                      <button
                        type="button"
                        onClick={() => void handleReturnToDesktopApp()}
                        className="w-full h-11 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 cursor-pointer active:scale-[0.98]"
                      >
                        <Laptop className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                        <span>{t('Quay về ứng dụng máy tính', 'Return to desktop app')}</span>
                        <ArrowRight className="w-4 h-4 shrink-0 opacity-80" strokeWidth={1.75} />
                      </button>

                      {appRedirectRequested && (
                        <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 text-center leading-relaxed">
                          {t(
                            'Đã kích hoạt quay về ứng dụng. Hãy mở hoặc chuyển sang cửa sổ fzInK trên thanh tác vụ của máy tính.',
                            'Triggered switch back to desktop app. Open or focus the fzInK window on your taskbar.'
                          )}
                        </div>
                      )}

                      {/* Lựa chọn 2: Tiếp tục dùng trên web */}
                      <button
                        type="button"
                        onClick={handleContinueOnWeb}
                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>{t('Tiếp tục dùng trên web', 'Continue on web')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Accordion tùy chọn xem mã thủ công (dự phòng) */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setShowManualCode(!showManualCode)}
                      className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      {showManualCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span>{t('Xem mã kết nối thủ công (dự phòng)', 'Show manual connection code (fallback)')}</span>
                    </button>

                    {showManualCode && (
                      <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            {t('Mã phiên đăng nhập:', 'Session code:')}
                          </span>
                          {copiedCode && (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" strokeWidth={1.75} />
                              <span>{t('Đã sao chép', 'Copied')}</span>
                            </span>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            readOnly
                            value={generatedToken || t('Đang tạo mã kết nối...', 'Generating connection code...')}
                            className="w-full h-9 px-3 pr-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-800 dark:text-slate-200 select-all"
                          />
                          <button
                            type="button"
                            onClick={() => void handleCopyGeneratedToken()}
                            disabled={!generatedToken}
                            className="absolute right-1 top-1 h-7 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{t('Sao chép', 'Copy')}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
