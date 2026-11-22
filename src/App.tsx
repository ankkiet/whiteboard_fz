import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardStore } from './store/useBoardStore';
import { classifyFile } from './engine/documentUtils';
import { readFileAsDataUrl } from './engine/documentProcessor';
import { useGoogleDriveWorkspace } from './hooks/useGoogleDriveWorkspace';
import { HomePage } from './components/home/HomePage';
import { TopLeftBar } from './components/toolbar/TopLeftBar';
import { TopRightBar } from './components/toolbar/TopRightBar';
import { BottomDock } from './components/toolbar/BottomDock';
import { ContextualToolbar } from './components/toolbar/ContextualToolbar';
import { WhiteboardCanvas } from './components/canvas/WhiteboardCanvas';
import { MathFormulaLayer } from './components/canvas/MathFormulaLayer';
import { SelectionOverlay } from './components/canvas/SelectionOverlay';
import { ExportModal } from './components/modals/ExportModal';
import { GoogleDriveModal } from './components/modals/GoogleDriveModal';
import {
  DocumentImportModal,
  PendingDocumentImport,
} from './components/modals/DocumentImportModal';
import { DocumentPreviewModal } from './components/modals/DocumentPreviewModal';
import { DesktopAppModal, OfflineIndicator } from './components/modals/DesktopAppModal';
import { PresentMode } from './components/present/PresentMode';
import { MathPanel } from './components/math/MathPanel';
import { VirtualGeometryToolsOverlay } from './components/math/VirtualGeometryToolsOverlay';
import { FloatingCalculator } from './components/math/FloatingCalculator';
import { PinnedProblemBar } from './components/math/PinnedProblemBar';
import { ToastContainer } from './components/ui/ToastContainer';
import { Minimize2 } from 'lucide-react';

function getInitialView(): 'home' | 'editor' {
  if (typeof window === 'undefined') return 'home';
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1' ? 'editor' : 'home';
}

export default function App() {
  const loadFromStorage = useBoardStore((s) => s.loadFromStorage);
  const insertImageFromDataUrl = useBoardStore((s) => s.insertImageFromDataUrl);
  const insertFileCard = useBoardStore((s) => s.insertFileCard);
  const addToast = useBoardStore((s) => s.addToast);
  const boardType = useBoardStore((s) => s.boardType);

  const drive = useGoogleDriveWorkspace();

  const [activeView, setActiveView] = useState<'home' | 'editor'>(getInitialView);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [isPresentOpen, setIsPresentOpen] = useState(false);
  const [isDesktopAppOpen, setIsDesktopAppOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isMathPanelOpen, setIsMathPanelOpen] = useState(true);
  const [pendingDoc, setPendingDoc] = useState<PendingDocumentImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (boardType === 'math') {
      setIsMathPanelOpen(true);
    }
  }, [boardType]);

  const handleToggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev);
  }, []);

  const handleReturnHome = useCallback(() => {
    setIsExportOpen(false);
    setIsDriveOpen(false);
    setIsPresentOpen(false);
    setIsFocusMode(false);
    setPendingDoc(null);
    setActiveView('home');
    if (!drive.needsAuth) {
      void drive.flushAutoSaveNow().then(() => drive.refreshFiles());
    }
  }, [drive]);

  const handleTriggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleIncomingFiles = useCallback(
    (files: File[], worldDropPoint?: { x: number; y: number }) => {
      if (files.length === 0) return;
      let openedDocModal = false;

      files.forEach((file, idx) => {
        const kind = classifyFile(file.name, file.type);
        const offsetPoint = worldDropPoint
          ? { x: worldDropPoint.x + idx * 32, y: worldDropPoint.y + idx * 32 }
          : undefined;

        if (kind === 'image') {
          void readFileAsDataUrl(file)
            .then((dataUrl) => insertImageFromDataUrl(dataUrl, file.name, offsetPoint))
            .catch(() => addToast(`Không thể đọc ảnh "${file.name}".`, 'error'));
        } else if ((kind === 'pdf' || kind === 'word' || kind === 'text') && !openedDocModal) {
          openedDocModal = true;
          setPendingDoc({ file, worldDropPoint: offsetPoint });
        } else {
          void readFileAsDataUrl(file)
            .then((dataUrl) =>
              insertFileCard({
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || 'application/octet-stream',
                fileCategory: kind,
                dataUrl,
                worldDropPoint: offsetPoint,
              })
            )
            .catch(() => addToast(`Không thể đọc tệp "${file.name}".`, 'error'));
        }
      });
    },
    [addToast, insertFileCard, insertImageFromDataUrl]
  );

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleIncomingFiles(Array.from(files));
    e.target.value = '';
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans select-none">
      {activeView === 'home' ? (
        <HomePage
          drive={drive}
          onEnterEditor={() => setActiveView('editor')}
          onOpenDesktopAppClick={() => setIsDesktopAppOpen(true)}
        />
      ) : (
        <>
          {/* Shared hidden file input for Images, PDF, Word (.doc/.docx), and attachments */}
          <input
            ref={fileInputRef}
            data-testid="file-upload-input"
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.pptx,.ppt"
            multiple
            onChange={handleFileSelected}
            className="hidden"
            aria-hidden="true"
          />

          {/* Main Infinite Canvas, KaTeX Formulas, Virtual Instruments & Selection Layer */}
          <WhiteboardCanvas
            onTriggerImageUpload={handleTriggerFileUpload}
            onFilesDropped={handleIncomingFiles}
            onToggleFocusMode={handleToggleFocusMode}
          />
          <MathFormulaLayer />
          <VirtualGeometryToolsOverlay />
          <SelectionOverlay />
          <PinnedProblemBar />
          <FloatingCalculator />

          {/* Floating Chrome */}
          {!isFocusMode ? (
            <div className="pointer-events-none absolute top-3 inset-x-2.5 sm:top-3.5 sm:inset-x-3.5 z-20 flex items-center justify-between gap-2">
              <TopLeftBar
                onHomeClick={handleReturnHome}
                onExportClick={() => setIsExportOpen(true)}
                onDriveClick={() => setIsDriveOpen(true)}
                isDriveConnected={!drive.needsAuth && Boolean(drive.user)}
                syncStatus={drive.syncStatus}
                lastSyncedAt={drive.lastSyncedAt}
                autoSaveEnabled={drive.autoSaveEnabled}
                boardType={boardType}
                isMathPanelOpen={isMathPanelOpen}
                onToggleMathPanel={() => setIsMathPanelOpen((v) => !v)}
              />
              <TopRightBar
                onPresentClick={() => setIsPresentOpen(true)}
                onToggleFocusMode={handleToggleFocusMode}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleToggleFocusMode}
              title="Thoát chế độ tập trung (F)"
              aria-label="Thoát chế độ tập trung (F)"
              className="absolute top-3.5 right-3.5 z-30 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/92 dark:bg-slate-900/92 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-md text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/85 dark:border-slate-800 shadow-lg shadow-slate-900/8 dark:shadow-black/35 transition-colors whitespace-nowrap"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Thoát tập trung (F)</span>
            </button>
          )}
          <MathPanel
            isOpen={boardType === 'math' && isMathPanelOpen && !isFocusMode}
            onClose={() => setIsMathPanelOpen(false)}
          />
          <ContextualToolbar />
          <BottomDock onTriggerImageUpload={handleTriggerFileUpload} />

          {/* Modals, Document Viewer & Presentation */}
          <ExportModal
            isOpen={isExportOpen}
            onClose={() => setIsExportOpen(false)}
            onOpenDriveClick={() => setIsDriveOpen(true)}
          />
          <GoogleDriveModal
            isOpen={isDriveOpen}
            onClose={() => setIsDriveOpen(false)}
            drive={drive}
          />
          <DocumentImportModal pendingDoc={pendingDoc} onClose={() => setPendingDoc(null)} />
          <DocumentPreviewModal />
          <PresentMode isOpen={isPresentOpen} onClose={() => setIsPresentOpen(false)} />
        </>
      )}

      <DesktopAppModal
        isOpen={isDesktopAppOpen}
        onClose={() => setIsDesktopAppOpen(false)}
      />
      <OfflineIndicator />
      <ToastContainer />
    </main>
  );
}
