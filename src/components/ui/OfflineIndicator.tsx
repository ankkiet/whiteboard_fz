import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../hooks/usePWAInstall';
import { isDesktopApp } from '../../services/appUpdater';
import { WifiOff, X } from 'lucide-react';

const OFFLINE_BANNER_DURATION_MS = 4000;

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [visible, setVisible] = useState(!isOnline);

  useEffect(() => {
    if (isOnline) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, OFFLINE_BANNER_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOnline]);

  if (isOnline || !visible) return null;

  const isDesktop = isDesktopApp();

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pwa-offline-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 pl-3 pr-2 py-2 text-xs font-medium text-white shadow-sm"
    >
      <WifiOff className="w-4 h-4 shrink-0" strokeWidth={1.75} />
      <span>
        {isDesktop
          ? 'Đang ngoại tuyến — Dữ liệu bảng vẫn tự động lưu trên máy'
          : 'Đang ngoại tuyến — Dữ liệu bảng vẫn đang lưu trên trình duyệt'}
      </span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Đóng thông báo ngoại tuyến"
        className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-black/15 transition-colors duration-150 cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
};
