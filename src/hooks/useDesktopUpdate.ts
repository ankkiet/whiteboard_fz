import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { useI18n } from '../i18n/useI18n';
import { GoogleDriveWorkspaceState } from './useGoogleDriveWorkspace';
import { DesktopUpdaterProgress } from '../services/appUpdater';

export interface StartDesktopUpdateParams {
  currentVersion: string;
  targetVersion: string;
  targetBuildId?: string;
  notes?: string;
  updateKind?: 'ota' | 'native';
  otaBundleUrl?: string;
  otaBundleSha256?: string;
}

export interface DesktopUpdateSession {
  currentVersion: string;
  targetVersion: string;
  notes?: string;
  updateKind: 'ota' | 'native';
  status: 'saving' | 'preparing' | 'downloading' | 'launching' | 'completed' | 'error';
  progress: DesktopUpdaterProgress | null;
  errorMessage?: string;
  fileName?: string;
  destPath?: string;
  launched?: boolean;
  platform?: string;
  mode?: 'ota' | 'native';
}

interface UseDesktopUpdateOptions {
  drive: GoogleDriveWorkspaceState;
  onFallbackOpenDesktopModal: () => void;
}

export function useDesktopUpdate({
  drive,
  onFallbackOpenDesktopModal,
}: UseDesktopUpdateOptions) {
  const { t } = useI18n();
  const addToast = useBoardStore((s) => s.addToast);
  const saveToStorageNow = useBoardStore((s) => s.saveToStorageNow);

  const [session, setSession] = useState<DesktopUpdateSession | null>(null);
  const activeRunIdRef = useRef(0);
  const lastParamsRef = useRef<StartDesktopUpdateParams | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const cleanupProgressListener = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupProgressListener();
    };
  }, [cleanupProgressListener]);

  const startUpdate = useCallback(
    async (params: StartDesktopUpdateParams) => {
      if (typeof window === 'undefined' || !window.fzinkDesktopUpdater) {
        onFallbackOpenDesktopModal();
        return;
      }

      cleanupProgressListener();
      const runId = ++activeRunIdRef.current;
      lastParamsRef.current = params;

      const canRunOta =
        params.updateKind === 'ota' &&
        Boolean(params.otaBundleUrl) &&
        typeof window.fzinkDesktopUpdater.applyOtaUpdate === 'function';
      const resolvedUpdateKind: 'ota' | 'native' = canRunOta ? 'ota' : 'native';

      setSession({
        currentVersion: params.currentVersion,
        targetVersion: params.targetVersion,
        notes: params.notes,
        updateKind: resolvedUpdateKind,
        status: 'saving',
        progress: null,
      });

      try {
        await saveToStorageNow();
        if (!drive.needsAuth) {
          await drive.flushAutoSaveNow();
        }
      } catch {
        // Proceed with update even if background Drive flush fails
      }

      if (activeRunIdRef.current !== runId) {
        return;
      }

      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: 'preparing',
            }
          : prev
      );

      unsubscribeRef.current = window.fzinkDesktopUpdater.onProgress((payload) => {
        if (activeRunIdRef.current !== runId) return;
        setSession((prev) => {
          if (!prev) return prev;
          const nextStatus =
            payload.phase === 'preparing'
              ? 'preparing'
              : payload.phase === 'downloading'
              ? 'downloading'
              : payload.phase === 'launching'
              ? 'launching'
              : payload.phase === 'error'
              ? 'error'
              : prev.status;
          return {
            ...prev,
            status: nextStatus,
            progress: payload,
            fileName: payload.fileName || prev.fileName,
          };
        });
      });

      try {
        const res =
          canRunOta && params.otaBundleUrl && window.fzinkDesktopUpdater.applyOtaUpdate
            ? await window.fzinkDesktopUpdater.applyOtaUpdate({
                bundleUrl: params.otaBundleUrl,
                expectedSha256: params.otaBundleSha256,
                targetVersion: params.targetVersion,
                targetBuildId: params.targetBuildId,
              })
            : await window.fzinkDesktopUpdater.downloadAndInstall();
        if (activeRunIdRef.current !== runId) return;

        if (res.cancelled) {
          setSession(null);
          addToast(t('Đã hủy cập nhật ứng dụng', 'App update cancelled'), 'info');
          return;
        }

        if (res.ok) {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'completed',
                  mode: res.mode || resolvedUpdateKind,
                  fileName: res.fileName || prev.fileName,
                  destPath: res.destPath,
                  launched: res.launched,
                  platform: res.platform,
                }
              : prev
          );
          return;
        }

        setSession((prev) =>
          prev
            ? {
                ...prev,
                status: 'error',
                errorMessage:
                  res.error ||
                  t(
                    'Không thể tải tệp cập nhật. Vui lòng thử lại hoặc tải qua trình duyệt.',
                    'Could not download the update. Please retry or download via browser.'
                  ),
              }
            : prev
        );
      } catch (err) {
        if (activeRunIdRef.current !== runId) return;
        setSession((prev) =>
          prev
            ? {
                ...prev,
                status: 'error',
                errorMessage:
                  err instanceof Error && err.message
                    ? err.message
                    : t('Có lỗi khi cập nhật ứng dụng.', 'An error occurred while updating.'),
              }
            : prev
        );
      } finally {
        cleanupProgressListener();
      }
    },
    [
      addToast,
      cleanupProgressListener,
      drive,
      onFallbackOpenDesktopModal,
      saveToStorageNow,
      t,
    ]
  );

  const cancelUpdate = useCallback(async () => {
    activeRunIdRef.current += 1;
    cleanupProgressListener();
    if (typeof window !== 'undefined' && window.fzinkDesktopUpdater?.cancelDownload) {
      await window.fzinkDesktopUpdater.cancelDownload();
    }
    setSession(null);
    addToast(t('Đã hủy cập nhật ứng dụng', 'App update cancelled'), 'info');
  }, [addToast, cleanupProgressListener, t]);

  const retryUpdate = useCallback(() => {
    if (!lastParamsRef.current) return;
    void startUpdate(lastParamsRef.current);
  }, [startUpdate]);

  const dismissUpdate = useCallback(() => {
    setSession((prev) => {
      if (!prev) return null;
      if (prev.status === 'completed' || prev.status === 'error') {
        return null;
      }
      return prev;
    });
  }, []);

  return {
    updateSession: session,
    startDesktopUpdate: startUpdate,
    cancelDesktopUpdate: cancelUpdate,
    retryDesktopUpdate: retryUpdate,
    dismissDesktopUpdate: dismissUpdate,
  };
}
