import React from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const toasts = useBoardStore((s) => s.toasts);
  const dismissToast = useBoardStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  const visibleToasts = toasts.slice(-2);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg text-xs font-medium text-slate-800 dark:text-slate-100 max-w-xs"
        >
          {toast.variant === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : toast.variant === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          )}
          <span className="leading-snug">{toast.text}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Đóng thông báo"
            className="ml-1 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
