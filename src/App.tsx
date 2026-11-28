import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useBoardStore } from './store/useBoardStore';
import { applyDocumentLanguage } from './i18n';
import { useI18n } from './i18n/useI18n';
import { useGoogleDriveWorkspace } from './hooks/useGoogleDriveWorkspace';
import { useDesktopUpdate } from './hooks/useDesktopUpdate';
import { HomePage } from './pages/HomePage';
import { DesktopAppModal } from './components/modals/DesktopAppModal';
import { DesktopUpdateModal } from './components/modals/DesktopUpdateModal';
import { AuthBridgeModal } from './components/modals/AuthBridgeModal';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { ToastContainer } from './components/ui/ToastContainer';

const loadEditorPage = () => import('./pages/EditorPage');
const EditorPage = lazy(loadEditorPage);

type AppView = 'home' | 'editor';

const HOME_HASH = '#/';
const EDITOR_HASH = '#/board';

function getViewFromHash(hash: string): AppView {
  return hash.startsWith(EDITOR_HASH) ? 'editor' : 'home';
}

function getInitialView(): AppView {
  if (typeof window === 'undefined') return 'home';
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') return 'editor';
  return getViewFromHash(window.location.hash);
}

function shouldAutoOpenAuthBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('auth_bridge') === '1' || window.location.hash.includes('auth_bridge');
}

const EditorLoadingFallback: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-2.5 text-sm font-medium">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
        <span>{t('Đang mở bảng viết...', 'Opening whiteboard...')}</span>
      </div>
    </div>
  );
};

export default function App() {
  const loadFromStorage = useBoardStore((s) => s.loadFromStorage);
  const saveToStorageNow = useBoardStore((s) => s.saveToStorageNow);
  const language = useBoardStore((s) => s.language);

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  const drive = useGoogleDriveWorkspace();

  const [activeView, setActiveView] = useState<AppView>(getInitialView);
  const activeViewRef = useRef<AppView>(activeView);
  const [isDesktopAppOpen, setIsDesktopAppOpen] = useState(false);
  const [isAuthBridgeOpen, setIsAuthBridgeOpen] = useState<boolean>(shouldAutoOpenAuthBridge);
  const isAuthBridgeOpenRef = useRef(isAuthBridgeOpen);
  const [authBridgeVersion, setAuthBridgeVersion] = useState(0);

  const {
    updateSession,
    startDesktopUpdate,
    cancelDesktopUpdate,
    retryDesktopUpdate,
    dismissDesktopUpdate,
  } = useDesktopUpdate({
    drive,
    onFallbackOpenDesktopModal: () => setIsDesktopAppOpen(true),
  });

  useEffect(() => {
    isAuthBridgeOpenRef.current = isAuthBridgeOpen;
  }, [isAuthBridgeOpen]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const isHome = activeView === 'home';
    document.documentElement.classList.toggle('view-home', isHome);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    return () => {
      document.documentElement.classList.remove('view-home');
    };
  }, [activeView]);

  useEffect(() => {
    void loadFromStorage();
  }, [loadFromStorage]);

  // Warm up the lazy Editor chunk during browser idle time after Home paints
  useEffect(() => {
    if (activeView !== 'home' || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      void loadEditorPage();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [activeView]);

  const flushEditorBeforeLeave = useCallback(() => {
    void saveToStorageNow();
    if (!drive.needsAuth) {
      void drive.flushAutoSaveNow().then(() => drive.refreshFiles());
    }
  }, [drive, saveToStorageNow]);

  const handleEnterEditor = useCallback(() => {
    setActiveView('editor');
    if (
      typeof window !== 'undefined' &&
      !window.location.hash.startsWith(EDITOR_HASH) &&
      !window.location.hash.includes('auth_bridge')
    ) {
      window.location.hash = EDITOR_HASH;
    }
  }, []);

  const handleReturnHome = useCallback(() => {
    flushEditorBeforeLeave();
    setActiveView('home');
    if (
      typeof window !== 'undefined' &&
      window.location.hash.startsWith(EDITOR_HASH)
    ) {
      window.location.hash = HOME_HASH;
    }
  }, [flushEditorBeforeLeave]);

  // Sync URL hash for ?autostart=1 and listen to browser Back / Forward via hashchange
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (
      activeViewRef.current === 'editor' &&
      !window.location.hash.startsWith(EDITOR_HASH) &&
      !window.location.hash.includes('auth_bridge')
    ) {
      window.location.hash = EDITOR_HASH;
    }

    const onHashChange = () => {
      if (window.location.hash.includes('auth_bridge')) return;
      const nextView = getViewFromHash(window.location.hash);
      if (nextView === activeViewRef.current) return;
      if (activeViewRef.current === 'editor' && nextView === 'home') {
        flushEditorBeforeLeave();
      }
      setActiveView(nextView);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [flushEditorBeforeLeave]);

  // Global listener for automatic 1-click Browser Auth Bridge
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BTTM_AUTH_SUCCESS' && typeof event.data.token === 'string') {
        // When AuthBridgeModal is open on desktop, it handles the token with visual progress UI.
        if (isAuthBridgeOpenRef.current && window.location.protocol === 'file:') {
          return;
        }
        const ok = drive.applyBridgeToken(event.data.token);
        if (ok) {
          setIsAuthBridgeOpen(false);
          setAuthBridgeVersion((v) => v + 1);
        }
      }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [drive]);

  return (
    <main
      className={
        activeView === 'home'
          ? 'relative min-h-dvh w-full bg-[#fafafa] dark:bg-[#111113] text-slate-900 dark:text-slate-100 font-sans select-text'
          : 'relative w-screen h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans select-none'
      }
    >
      {activeView === 'home' ? (
        <HomePage
          drive={drive}
          onEnterEditor={handleEnterEditor}
          onOpenDesktopAppClick={() => setIsDesktopAppOpen(true)}
          onOpenAuthBridgeClick={() => setIsAuthBridgeOpen(true)}
          onStartDesktopUpdate={startDesktopUpdate}
        />
      ) : (
        <Suspense fallback={<EditorLoadingFallback />}>
          <EditorPage
            drive={drive}
            authBridgeVersion={authBridgeVersion}
            onReturnHome={handleReturnHome}
            onOpenAuthBridgeClick={() => setIsAuthBridgeOpen(true)}
          />
        </Suspense>
      )}

      <DesktopAppModal
        isOpen={isDesktopAppOpen}
        onClose={() => setIsDesktopAppOpen(false)}
      />
      <DesktopUpdateModal
        session={updateSession}
        onCancel={() => void cancelDesktopUpdate()}
        onRetry={retryDesktopUpdate}
        onClose={dismissDesktopUpdate}
      />
      <AuthBridgeModal
        isOpen={isAuthBridgeOpen}
        onClose={() => setIsAuthBridgeOpen(false)}
        drive={drive}
      />
      <OfflineIndicator />
      <ToastContainer />
    </main>
  );
}
