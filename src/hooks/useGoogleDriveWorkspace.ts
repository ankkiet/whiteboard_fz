import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { useBoardStore } from '../store/useBoardStore';
import {
  googleLogout,
  googleSignIn,
  initGoogleAuth,
  setBridgeSession,
} from '../services/googleAuth';
import { parseAuthBridgeToken } from '../services/authBridge';
import {
  clearCachedDriveFolder,
  createDriveWhiteboardFile,
  deleteDriveFile,
  downloadDriveWhiteboardFile,
  DriveAuthError,
  ensureAppDriveFolder,
  listDriveWorkspace,
  moveDriveFileToFolder,
  renameDriveFile,
  updateDriveWhiteboardFile,
  uploadDrivePngSnapshot,
} from '../services/googleDrive';
import {
  DriveAppFolder,
  DriveWhiteboardFile,
  findUnorganizedDriveFiles,
  formatDriveErrorMessage,
  FormattedDriveError,
  getDisplayBoardTitle,
  getGoogleAuthErrorMessage,
  isWhiteboardProjectFile,
} from '../services/googleDriveUtils';
import {
  computeBoardSignature,
  DriveSyncStatus,
  shouldTriggerDriveAutoSave,
} from '../services/driveSyncUtils';

const AUTOSAVE_PREF_KEY = 'smart_whiteboard_drive_autosave';
const AUTOSAVE_DEBOUNCE_MS = 2500;

function readAutoSavePreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(AUTOSAVE_PREF_KEY);
    if (saved === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

export interface GoogleDriveWorkspaceState {
  user: User | null;
  needsAuth: boolean;
  files: DriveWhiteboardFile[];
  appFolder: DriveAppFolder | null;
  unorganizedCount: number;
  isLoadingFiles: boolean;
  isLoggingIn: boolean;
  busyAction: string | null;
  error: FormattedDriveError | null;
  activeDriveFile: DriveWhiteboardFile | null;
  autoSaveEnabled: boolean;
  syncStatus: DriveSyncStatus;
  lastSyncedAt: string | null;
  setAutoSaveEnabled: (enabled: boolean) => void;
  clearError: () => void;
  setActiveDriveFile: (file: DriveWhiteboardFile | null) => void;
  resetBoardSyncContext: () => void;
  flushAutoSaveNow: () => Promise<void>;
  organizeFilesIntoFolder: () => Promise<void>;
  signIn: (options?: { forceAccountPicker?: boolean }) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  saveNewBoard: () => Promise<DriveWhiteboardFile | null>;
  overwriteBoard: (file: DriveWhiteboardFile) => Promise<DriveWhiteboardFile | null>;
  savePngSnapshot: () => Promise<DriveWhiteboardFile | null>;
  openBoardFile: (
    file: DriveWhiteboardFile,
    options?: { resetHistory?: boolean }
  ) => Promise<boolean>;
  renameFile: (file: DriveWhiteboardFile, newTitle: string) => Promise<boolean>;
  deleteFile: (file: DriveWhiteboardFile) => Promise<boolean>;
  applyBridgeToken: (tokenString: string) => boolean;
}

export function useGoogleDriveWorkspace(): GoogleDriveWorkspaceState {
  const addToast = useBoardStore((s) => s.addToast);
  const importBoardData = useBoardStore((s) => s.importBoardData);
  const title = useBoardStore((s) => s.title);
  const elements = useBoardStore((s) => s.elements);
  const assets = useBoardStore((s) => s.assets);
  const hasLoaded = useBoardStore((s) => s.hasLoaded);

  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [files, setFiles] = useState<DriveWhiteboardFile[]>([]);
  const [appFolder, setAppFolder] = useState<DriveAppFolder | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<FormattedDriveError | null>(null);
  const [activeDriveFile, setActiveDriveFileState] = useState<DriveWhiteboardFile | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState<boolean>(readAutoSavePreference);
  const [syncStatus, setSyncStatus] = useState<DriveSyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Refs for race-free debounced background auto-save
  const activeDriveFileRef = useRef<DriveWhiteboardFile | null>(null);
  const needsAuthRef = useRef(true);
  const autoSaveEnabledRef = useRef(autoSaveEnabled);
  const busyActionRef = useRef<string | null>(null);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const isAutoSavingRef = useRef(false);
  const boardSessionRef = useRef(0);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    needsAuthRef.current = needsAuth;
  }, [needsAuth]);

  useEffect(() => {
    autoSaveEnabledRef.current = autoSaveEnabled;
  }, [autoSaveEnabled]);

  useEffect(() => {
    busyActionRef.current = busyAction;
  }, [busyAction]);

  const setActiveDriveFile = useCallback((file: DriveWhiteboardFile | null) => {
    activeDriveFileRef.current = file;
    setActiveDriveFileState(file);
  }, []);

  const clearPendingAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  const setAutoSaveEnabled = useCallback(
    (enabled: boolean) => {
      setAutoSaveEnabledState(enabled);
      autoSaveEnabledRef.current = enabled;
      try {
        window.localStorage.setItem(AUTOSAVE_PREF_KEY, String(enabled));
      } catch {
        // ignore storage errors
      }
      if (!enabled) {
        clearPendingAutoSaveTimer();
        setSyncStatus((prev) => (prev === 'pending' ? 'idle' : prev));
      }
      addToast(
        enabled ? 'Đã bật tự động lưu lên Google Drive' : 'Đã tắt tự động lưu lên Google Drive',
        'info'
      );
    },
    [addToast, clearPendingAutoSaveTimer]
  );

  const resetBoardSyncContext = useCallback(() => {
    clearPendingAutoSaveTimer();
    boardSessionRef.current += 1;
    lastSyncedSignatureRef.current = null;
    setActiveDriveFile(null);
    setSyncStatus('idle');
    setLastSyncedAt(null);
  }, [clearPendingAutoSaveTimer, setActiveDriveFile]);

  const clearError = useCallback(() => setError(null), []);

  const handleDriveError = useCallback(
    (err: unknown, fallback: string, silentToast = false) => {
      if (err instanceof DriveAuthError) {
        setNeedsAuth(true);
        needsAuthRef.current = true;
        setError({ message: err.message });
        setSyncStatus('error');
        addToast(err.message, 'info');
      } else {
        const raw = err instanceof Error && err.message ? err.message : fallback;
        const formatted = formatDriveErrorMessage(raw);
        setError(formatted);
        setSyncStatus('error');
        if (!silentToast) {
          addToast(formatted.message, 'error');
        }
      }
    },
    [addToast]
  );

  const buildCurrentPayload = () => {
    const state = useBoardStore.getState();
    return {
      title: state.title || 'Bảng Trắng Mới',
      elements: state.elements,
      assets: state.assets,
      boardType: state.boardType,
      boardPattern: state.boardPattern,
      version: 2,
      exportedAt: new Date().toISOString(),
    };
  };

  const getCurrentSignature = () => {
    const state = useBoardStore.getState();
    return computeBoardSignature(state.title, state.elements, state.assets);
  };

  const runAutoSave = useCallback(async () => {
    clearPendingAutoSaveTimer();
    if (isAutoSavingRef.current) return;

    const state = useBoardStore.getState();
    const currentSig = computeBoardSignature(state.title, state.elements, state.assets);
    const decision = shouldTriggerDriveAutoSave({
      autoSaveEnabled: autoSaveEnabledRef.current,
      isAuthenticated: !needsAuthRef.current,
      hasLoaded: state.hasLoaded,
      hasActiveDriveFile: Boolean(activeDriveFileRef.current),
      elementCount: state.elements.length,
      currentSignature: currentSig,
      lastSyncedSignature: lastSyncedSignatureRef.current,
      isManualActionBusy: Boolean(busyActionRef.current),
    });

    if (decision === 'skip') {
      if (lastSyncedSignatureRef.current === currentSig && activeDriveFileRef.current) {
        setSyncStatus('saved');
      }
      return;
    }

    const sessionId = boardSessionRef.current;
    const targetFile = activeDriveFileRef.current;
    const payload = buildCurrentPayload();

    isAutoSavingRef.current = true;
    setSyncStatus('saving');

    try {
      const saved =
        decision === 'update' && targetFile
          ? await updateDriveWhiteboardFile(targetFile.id, payload.title, payload)
          : await createDriveWhiteboardFile(payload.title, payload);

      // Ignore result if user switched or reset board mid-upload
      if (boardSessionRef.current !== sessionId) return;

      setActiveDriveFile(saved);
      setFiles((prev) => [saved, ...prev.filter((f) => f.id !== saved.id)]);
      lastSyncedSignatureRef.current = currentSig;
      setLastSyncedAt(saved.modifiedTime || new Date().toISOString());
      setError(null);

      // If user kept drawing during upload, schedule one follow-up sync
      const latestSig = getCurrentSignature();
      if (latestSig !== currentSig && autoSaveEnabledRef.current && !needsAuthRef.current) {
        setSyncStatus('pending');
        autoSaveTimerRef.current = setTimeout(() => {
          void runAutoSave();
        }, AUTOSAVE_DEBOUNCE_MS);
      } else {
        setSyncStatus('saved');
      }
    } catch (err) {
      if (boardSessionRef.current !== sessionId) return;
      handleDriveError(err, 'Tự động lưu lên Google Drive không thành công.', true);
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [clearPendingAutoSaveTimer, handleDriveError, setActiveDriveFile]);

  const flushAutoSaveNow = useCallback(async () => {
    if (!autoSaveEnabledRef.current || needsAuthRef.current) return;
    await runAutoSave();
  }, [runAutoSave]);

  // Debounced auto-save watcher whenever board content/title changes
  useEffect(() => {
    if (!hasLoaded || needsAuth || !autoSaveEnabled) return;

    const currentSig = computeBoardSignature(title, elements, assets);
    const decision = shouldTriggerDriveAutoSave({
      autoSaveEnabled,
      isAuthenticated: !needsAuth,
      hasLoaded,
      hasActiveDriveFile: Boolean(activeDriveFile),
      elementCount: elements.length,
      currentSignature: currentSig,
      lastSyncedSignature: lastSyncedSignatureRef.current,
      isManualActionBusy: Boolean(busyAction),
    });

    if (decision === 'skip') return;

    clearPendingAutoSaveTimer();
    if (!isAutoSavingRef.current) {
      setSyncStatus('pending');
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void runAutoSave();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      clearPendingAutoSaveTimer();
    };
  }, [
    title,
    elements,
    assets,
    hasLoaded,
    needsAuth,
    autoSaveEnabled,
    activeDriveFile,
    busyAction,
    clearPendingAutoSaveTimer,
    runAutoSave,
  ]);

  const refreshFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    setError(null);
    try {
      const workspace = await listDriveWorkspace();
      setAppFolder(workspace.folder);
      setFiles(workspace.files);
    } catch (err) {
      handleDriveError(err, 'Không thể tải danh sách bảng từ Google Drive.');
    } finally {
      setIsLoadingFiles(false);
    }
  }, [handleDriveError]);

  const organizeFilesIntoFolder = useCallback(async () => {
    setBusyAction('organize');
    setError(null);
    try {
      const folder = appFolder || (await ensureAppDriveFolder());
      setAppFolder(folder);
      const targets = findUnorganizedDriveFiles(files, folder.id);
      if (targets.length === 0) {
        addToast(`Tất cả tệp đã nằm gọn trong thư mục "${folder.name}".`, 'info');
        return;
      }

      const updatedById = new Map<string, DriveWhiteboardFile>();
      for (const file of targets) {
        const moved = await moveDriveFileToFolder(file, folder.id);
        updatedById.set(moved.id, moved);
      }

      setFiles((prev) => prev.map((f) => updatedById.get(f.id) || f));
      addToast(
        `Đã gom ${targets.length} tệp vào thư mục "${folder.name}" trên Google Drive`,
        'success'
      );
    } catch (err) {
      handleDriveError(err, 'Không thể gom các tệp cũ vào thư mục Google Drive.');
    } finally {
      setBusyAction(null);
    }
  }, [addToast, appFolder, files, handleDriveError]);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (signedInUser) => {
        setUser(signedInUser);
        setNeedsAuth(false);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setNeedsAuth(true);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!needsAuth) {
      void refreshFiles();
    }
  }, [needsAuth, refreshFiles]);

  const signIn = useCallback(async (options?: { forceAccountPicker?: boolean }) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      clearCachedDriveFolder();
      setAppFolder(null);
      const result = await googleSignIn(options);
      setUser(result.user);
      setNeedsAuth(false);
      needsAuthRef.current = false;
      addToast(
        `Đã kết nối Google Drive (${result.user.email || result.user.displayName})`,
        'success'
      );
      return true;
    } catch (err) {
      setError({ message: getGoogleAuthErrorMessage(err) });
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, [addToast]);

  const applyBridgeToken = useCallback(
    (tokenString: string): boolean => {
      try {
        const session = parseAuthBridgeToken(tokenString);
        setBridgeSession(session, (u) => {
          setUser(u);
          setNeedsAuth(false);
          needsAuthRef.current = false;
        });
        clearCachedDriveFolder();
        setAppFolder(null);
        setError(null);
        addToast(
          `Đã kết nối Google Drive qua trình duyệt (${session.user.email || session.user.displayName})`,
          'success'
        );
        void refreshFiles();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Mã kết nối không hợp lệ.';
        setError({ message: msg });
        addToast(msg, 'error');
        return false;
      }
    },
    [addToast, refreshFiles]
  );

  const signOut = useCallback(async () => {
    clearPendingAutoSaveTimer();
    clearCachedDriveFolder();
    boardSessionRef.current += 1;
    setBusyAction('logout');
    setError(null);
    try {
      await googleLogout();
      setUser(null);
      setNeedsAuth(true);
      needsAuthRef.current = true;
      setFiles([]);
      setAppFolder(null);
      setActiveDriveFile(null);
      lastSyncedSignatureRef.current = null;
      setSyncStatus('idle');
      setLastSyncedAt(null);
      addToast('Đã ngắt kết nối Google Drive', 'info');
    } finally {
      setBusyAction(null);
    }
  }, [addToast, clearPendingAutoSaveTimer, setActiveDriveFile]);

  const saveNewBoard = useCallback(async () => {
    clearPendingAutoSaveTimer();
    setBusyAction('save-new');
    setError(null);
    setSyncStatus('saving');
    try {
      const payload = buildCurrentPayload();
      const sig = getCurrentSignature();
      const saved = await createDriveWhiteboardFile(payload.title, payload);
      setActiveDriveFile(saved);
      lastSyncedSignatureRef.current = sig;
      setLastSyncedAt(saved.modifiedTime || new Date().toISOString());
      setSyncStatus('saved');
      setFiles((prev) => [saved, ...prev.filter((f) => f.id !== saved.id)]);
      addToast(`Đã lưu "${saved.name}" lên Google Drive`, 'success');
      return saved;
    } catch (err) {
      handleDriveError(err, 'Không thể lưu tệp bảng trắng lên Google Drive.');
      return null;
    } finally {
      setBusyAction(null);
    }
  }, [addToast, clearPendingAutoSaveTimer, handleDriveError, setActiveDriveFile]);

  const overwriteBoard = useCallback(
    async (file: DriveWhiteboardFile) => {
      clearPendingAutoSaveTimer();
      setBusyAction(`overwrite:${file.id}`);
      setError(null);
      setSyncStatus('saving');
      try {
        const payload = buildCurrentPayload();
        const sig = getCurrentSignature();
        const updated = await updateDriveWhiteboardFile(file.id, payload.title, payload);
        setActiveDriveFile(updated);
        lastSyncedSignatureRef.current = sig;
        setLastSyncedAt(updated.modifiedTime || new Date().toISOString());
        setSyncStatus('saved');
        setFiles((prev) => [updated, ...prev.filter((f) => f.id !== updated.id)]);
        addToast(`Đã cập nhật "${updated.name}" trên Google Drive`, 'success');
        return updated;
      } catch (err) {
        handleDriveError(err, 'Không thể cập nhật tệp trên Google Drive.');
        return null;
      } finally {
        setBusyAction(null);
      }
    },
    [addToast, clearPendingAutoSaveTimer, handleDriveError, setActiveDriveFile]
  );

  const savePngSnapshot = useCallback(async () => {
    setBusyAction('save-png');
    setError(null);
    try {
      const state = useBoardStore.getState();
      const { exportBoardToPng } = await import('../engine/boardExporter');
      const rendered = await exportBoardToPng({
        elements: state.elements,
        assets: state.assets,
        isDarkMode: state.isDarkMode,
        boardPattern: state.boardPattern,
        includeBackground: true,
        includePattern: true,
        scale: 4,
      });
      const saved = await uploadDrivePngSnapshot(state.title, rendered.blob);
      setFiles((prev) => [saved, ...prev.filter((f) => f.id !== saved.id)]);
      addToast(
        `Đã lưu ảnh PNG (${rendered.pixelWidth} × ${rendered.pixelHeight} px) lên Google Drive`,
        'success'
      );
      return saved;
    } catch (err) {
      handleDriveError(err, 'Không thể tải ảnh PNG lên Google Drive.');
      return null;
    } finally {
      setBusyAction(null);
    }
  }, [addToast, handleDriveError]);

  const openBoardFile = useCallback(
    async (file: DriveWhiteboardFile, options?: { resetHistory?: boolean }) => {
      clearPendingAutoSaveTimer();
      boardSessionRef.current += 1;
      setBusyAction(`open:${file.id}`);
      setError(null);
      try {
        const payload = await downloadDriveWhiteboardFile(file.id);
        const resolvedTitle = payload.title || getDisplayBoardTitle(file);
        importBoardData({
          title: resolvedTitle,
          elements: payload.elements,
          assets: payload.assets,
          boardType: payload.boardType,
          boardPattern: payload.boardPattern,
          resetHistory: options?.resetHistory ?? false,
        });
        setActiveDriveFile(file);
        const nextState = useBoardStore.getState();
        lastSyncedSignatureRef.current = computeBoardSignature(
          nextState.title,
          nextState.elements,
          nextState.assets
        );
        setLastSyncedAt(file.modifiedTime || new Date().toISOString());
        setSyncStatus('saved');
        return true;
      } catch (err) {
        handleDriveError(err, 'Không thể mở tệp bảng trắng từ Google Drive.');
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [clearPendingAutoSaveTimer, handleDriveError, importBoardData, setActiveDriveFile]
  );

  const renameFile = useCallback(
    async (file: DriveWhiteboardFile, newTitle: string) => {
      setBusyAction(`rename:${file.id}`);
      setError(null);
      try {
        const updated = await renameDriveFile(file.id, newTitle, isWhiteboardProjectFile(file));
        setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        if (activeDriveFileRef.current?.id === updated.id) {
          setActiveDriveFile(updated);
          const displayTitle = getDisplayBoardTitle(updated);
          useBoardStore.getState().setTitle(displayTitle);
          const nextState = useBoardStore.getState();
          lastSyncedSignatureRef.current = computeBoardSignature(
            nextState.title,
            nextState.elements,
            nextState.assets
          );
        }
        addToast(`Đã đổi tên thành "${getDisplayBoardTitle(updated)}"`, 'success');
        return true;
      } catch (err) {
        handleDriveError(err, 'Không thể đổi tên tệp trên Google Drive.');
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [addToast, handleDriveError, setActiveDriveFile]
  );

  const deleteFile = useCallback(
    async (file: DriveWhiteboardFile) => {
      setBusyAction(`delete:${file.id}`);
      setError(null);
      try {
        await deleteDriveFile(file.id);
        setFiles((prev) => prev.filter((f) => f.id !== file.id));
        if (activeDriveFileRef.current?.id === file.id) {
          clearPendingAutoSaveTimer();
          setActiveDriveFile(null);
          lastSyncedSignatureRef.current = null;
          setSyncStatus('idle');
          setLastSyncedAt(null);
        }
        addToast(`Đã xóa "${file.name}" khỏi Google Drive`, 'info');
        return true;
      } catch (err) {
        handleDriveError(err, 'Không thể xóa tệp trên Google Drive.');
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [addToast, clearPendingAutoSaveTimer, handleDriveError, setActiveDriveFile]
  );

  const unorganizedCount = appFolder ? findUnorganizedDriveFiles(files, appFolder.id).length : 0;

  return {
    user,
    needsAuth,
    files,
    appFolder,
    unorganizedCount,
    isLoadingFiles,
    isLoggingIn,
    busyAction,
    error,
    activeDriveFile,
    autoSaveEnabled,
    syncStatus,
    lastSyncedAt,
    setAutoSaveEnabled,
    clearError,
    setActiveDriveFile,
    resetBoardSyncContext,
    flushAutoSaveNow,
    organizeFilesIntoFolder,
    signIn,
    signOut,
    refreshFiles,
    saveNewBoard,
    overwriteBoard,
    savePngSnapshot,
    openBoardFile,
    renameFile,
    deleteFile,
    applyBridgeToken,
  };
}
