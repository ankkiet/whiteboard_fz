import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { classifyFile, readFileAsDataUrl } from '../engine/documentUtils';
import { GoogleDriveWorkspaceState } from '../hooks/useGoogleDriveWorkspace';
import { UnifiedTopBar } from '../components/toolbar/UnifiedTopBar';
import { ContextualToolbar } from '../components/toolbar/ContextualToolbar';
import { WhiteboardCanvas } from '../components/canvas/WhiteboardCanvas';
import { MathFormulaLayer } from '../components/canvas/MathFormulaLayer';
import { SelectionOverlay } from '../components/canvas/SelectionOverlay';
import { GoogleDriveModal } from '../components/modals/GoogleDriveModal';
import type { PendingDocumentImport } from '../components/modals/DocumentImportModal';
import { VirtualGeometryToolsOverlay } from '../components/math/VirtualGeometryToolsOverlay';
import { PinnedProblemBar } from '../components/math/PinnedProblemBar';
import { Minimize2 } from 'lucide-react';

// Lazy-loaded heavy feature chunks (only downloaded when opened)
const FloatingCalculator = lazy(() =>
  import('../components/math/FloatingCalculator').then((m) => ({ default: m.FloatingCalculator }))
);
const MathPanel = lazy(() => import('../components/math/MathPanel'));
const ExportModal = lazy(() =>
  import('../components/modals/ExportModal').then((m) => ({ default: m.ExportModal }))
);
const DocumentImportModal = lazy(() =>
  import('../components/modals/DocumentImportModal').then((m) => ({
    default: m.DocumentImportModal,
  }))
);
const DocumentPreviewModal = lazy(() =>
  import('../components/modals/DocumentPreviewModal').then((m) => ({
    default: m.DocumentPreviewModal,
  }))
);
const PresentMode = lazy(() =>
  import('../components/present/PresentMode').then((m) => ({ default: m.PresentMode }))
);

interface EditorPageProps {
  drive: GoogleDriveWorkspaceState;
  authBridgeVersion: number;
  onReturnHome: () => void;
  onOpenAuthBridgeClick: () => void;
}

export const EditorPage: React.FC<EditorPageProps> = ({
  drive,
  authBridgeVersion,
  onReturnHome,
  onOpenAuthBridgeClick,
}) => {
  const insertImageFromDataUrl = useBoardStore((s) => s.insertImageFromDataUrl);
  const insertFileCard = useBoardStore((s) => s.insertFileCard);
  const addToast = useBoardStore((s) => s.addToast);
  const boardType = useBoardStore((s) => s.boardType);
  const isCalculatorOpen = useBoardStore((s) => s.isCalculatorOpen);
  const previewFileCardId = useBoardStore((s) => s.previewFileCardId);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [isPresentOpen, setIsPresentOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isMathPanelOpen, setIsMathPanelOpen] = useState(true);
  const [pendingDoc, setPendingDoc] = useState<PendingDocumentImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (boardType === 'math') {
      setIsMathPanelOpen(true);
    }
  }, [boardType]);

  // Close Google Drive modal automatically after Browser Auth Bridge succeeds
  useEffect(() => {
    if (authBridgeVersion > 0) {
      setIsDriveOpen(false);
    }
  }, [authBridgeVersion]);

  const handleToggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev);
  }, []);

  const handleReturnHomeClick = useCallback(() => {
    setIsExportOpen(false);
    setIsDriveOpen(false);
    setIsPresentOpen(false);
    setIsFocusMode(false);
    setPendingDoc(null);
    onReturnHome();
  }, [onReturnHome]);

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

  const showMathPanel = boardType === 'math' && isMathPanelOpen && !isFocusMode;

  return (
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

      {isCalculatorOpen && (
        <Suspense fallback={null}>
          <FloatingCalculator />
        </Suspense>
      )}

      {/* Floating Chrome */}
      {!isFocusMode ? (
        <UnifiedTopBar
          onHomeClick={handleReturnHomeClick}
          onExportClick={() => setIsExportOpen(true)}
          onDriveClick={() => setIsDriveOpen(true)}
          onPresentClick={() => setIsPresentOpen(true)}
          onToggleFocusMode={handleToggleFocusMode}
          onTriggerImageUpload={handleTriggerFileUpload}
          isDriveConnected={!drive.needsAuth && Boolean(drive.user)}
          syncStatus={drive.syncStatus}
          lastSyncedAt={drive.lastSyncedAt}
          autoSaveEnabled={drive.autoSaveEnabled}
          boardType={boardType}
          isMathPanelOpen={isMathPanelOpen}
          onToggleMathPanel={() => setIsMathPanelOpen((v) => !v)}
        />
      ) : (
        <button
          type="button"
          onClick={handleToggleFocusMode}
          title="Thoát chế độ tập trung (F)"
          aria-label="Thoát chế độ tập trung (F)"
          className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none transition-colors duration-150 whitespace-nowrap cursor-pointer"
        >
          <Minimize2 className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
          <span>Thoát tập trung</span>
          <kbd className="kbd-keycap">F</kbd>
        </button>
      )}

      {showMathPanel && (
        <Suspense fallback={null}>
          <MathPanel isOpen onClose={() => setIsMathPanelOpen(false)} />
        </Suspense>
      )}

      {/* Contextual Selection Inspector */}
      <ContextualToolbar />

      {/* Modals, Document Viewer & Presentation */}
      {isExportOpen && (
        <Suspense fallback={null}>
          <ExportModal
            isOpen
            onClose={() => setIsExportOpen(false)}
            onOpenDriveClick={() => setIsDriveOpen(true)}
          />
        </Suspense>
      )}
      <GoogleDriveModal
        isOpen={isDriveOpen}
        onClose={() => setIsDriveOpen(false)}
        drive={drive}
        onOpenAuthBridgeClick={onOpenAuthBridgeClick}
      />
      {pendingDoc && (
        <Suspense fallback={null}>
          <DocumentImportModal pendingDoc={pendingDoc} onClose={() => setPendingDoc(null)} />
        </Suspense>
      )}
      {previewFileCardId && (
        <Suspense fallback={null}>
          <DocumentPreviewModal />
        </Suspense>
      )}
      {isPresentOpen && (
        <Suspense fallback={null}>
          <PresentMode isOpen onClose={() => setIsPresentOpen(false)} />
        </Suspense>
      )}
    </>
  );
};

export default EditorPage;
