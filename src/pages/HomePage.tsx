import React, { useMemo, useState } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { GoogleDriveWorkspaceState } from '../hooks/useGoogleDriveWorkspace';
import { StartDesktopUpdateParams } from '../hooks/useDesktopUpdate';
import { isWhiteboardProjectFile } from '../services/googleDriveUtils';
import { getBoardTemplates } from '../engine/boardTemplates';
import { useI18n } from '../i18n/useI18n';
import { BoardPattern, BoardType, NotebookPaperSize } from '../types/board';
import { BoardTemplatePreview } from '../components/home/BoardTemplatePreview';
import { HomeHeader } from '../components/home/HomeHeader';
import { CurrentDraftCard } from '../components/home/CurrentDraftCard';
import { LocalBoardsSection } from '../components/home/LocalBoardsSection';
import { DriveBoardsSection } from '../components/home/DriveBoardsSection';
import { CreateBoardModal } from '../components/modals/CreateBoardModal';

interface HomePageProps {
  drive: GoogleDriveWorkspaceState;
  onEnterEditor: () => void;
  onOpenDesktopAppClick: () => void;
  onOpenAuthBridgeClick?: () => void;
  onStartDesktopUpdate?: (params: StartDesktopUpdateParams) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  drive,
  onEnterEditor,
  onOpenDesktopAppClick,
  onOpenAuthBridgeClick,
  onStartDesktopUpdate,
}) => {
  const localTitle = useBoardStore((s) => s.title);
  const localBoardType = useBoardStore((s) => s.boardType);
  const localElementCount = useBoardStore((s) => s.elements.length);
  const theme = useBoardStore((s) => s.theme);
  const setTheme = useBoardStore((s) => s.setTheme);
  const startNewBoard = useBoardStore((s) => s.startNewBoard);
  const { language, t } = useI18n();

  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

  const [createModalState, setCreateModalState] = useState<{
    open: boolean;
    initialType: BoardType;
  }>({ open: false, initialType: 'basic' });

  const templates = useMemo(() => getBoardTemplates(language), [language]);

  const boardCount = useMemo(
    () => drive.files.filter((f) => isWhiteboardProjectFile(f)).length,
    [drive.files]
  );
  const imageCount = useMemo(
    () => drive.files.length - boardCount,
    [drive.files.length, boardCount]
  );

  // Previous boards are automatically preserved in the local library when starting a new board.
  const hasUnsavedLocalDraft = false;

  const handleOpenCreateModal = (initialType: BoardType = 'basic') => {
    setCreateModalState({ open: true, initialType });
  };

  const handleCreateBoard = (options: {
    title?: string;
    boardType: BoardType;
    boardPattern?: BoardPattern;
    notebookPaperSize?: NotebookPaperSize;
  }) => {
    setCreateModalState((prev) => ({ ...prev, open: false }));
    drive.resetBoardSyncContext();
    startNewBoard(options);
    onEnterEditor();
  };

  const handleQuickTemplateClick = (boardType: BoardType) => {
    handleCreateBoard({ boardType });
  };

  return (
    <div
      data-testid="home-dashboard"
      className="h-full w-full overflow-y-auto touch-pan-y select-text bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors"
    >
      <HomeHeader
        drive={drive}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        isFileProtocol={isFileProtocol}
        onCreateNewClick={() => handleOpenCreateModal('basic')}
        onOpenDesktopAppClick={onOpenDesktopAppClick}
        onOpenAuthBridgeClick={onOpenAuthBridgeClick}
        onStartDesktopUpdate={onStartDesktopUpdate}
      />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <CurrentDraftCard
          drive={drive}
          localTitle={localTitle}
          localBoardType={localBoardType}
          localElementCount={localElementCount}
          boardCount={boardCount}
          imageCount={imageCount}
          onEnterEditor={onEnterEditor}
        />

        {/* Quick-Create Board Templates */}
        <section
          id="board-templates-section"
          aria-labelledby="board-templates-heading"
          className="space-y-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2
              id="board-templates-heading"
              className="text-base font-medium text-slate-900 dark:text-slate-100"
            >
              {t('Tạo nhanh theo mẫu', 'Quick-start templates')}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              {t(
                'Chọn mẫu bảng phù hợp để bắt đầu ngay',
                'Pick a board template to start right away'
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                data-testid={`template-card-${tpl.id}`}
                onClick={() => handleQuickTemplateClick(tpl.id)}
                className="group text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl overflow-hidden transition-colors duration-150 cursor-pointer flex flex-col"
              >
                <div className="border-b border-slate-100 dark:border-slate-800 overflow-hidden">
                  <BoardTemplatePreview type={tpl.id} className="w-full h-24 sm:h-28" />
                </div>
                <div className="p-4 space-y-1 flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150">
                    {tpl.name}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {tpl.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Multi-board Offline Local Library (IndexedDB) */}
        <LocalBoardsSection
          onOpenBoard={onEnterEditor}
          onCreateNewClick={() => handleOpenCreateModal()}
          onBoardOpenedFromLocal={() => drive.resetBoardSyncContext()}
        />

        {/* Google Drive Saved Boards Workspace */}
        <DriveBoardsSection
          drive={drive}
          isFileProtocol={isFileProtocol}
          boardCount={boardCount}
          imageCount={imageCount}
          onOpenBoard={onEnterEditor}
          onCreateNewClick={() => handleOpenCreateModal()}
          onOpenAuthBridgeClick={onOpenAuthBridgeClick}
        />

        <footer className="pt-4 pb-2 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>fzInK</span>
          <div className="flex items-center gap-4">
            <a
              href="./privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              {t('Chính sách quyền riêng tư', 'Privacy policy')}
            </a>
            <a
              href="./terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              {t('Điều khoản sử dụng', 'Terms of service')}
            </a>
          </div>
        </footer>
      </div>

      {/* Create New Board Template Modal */}
      <CreateBoardModal
        isOpen={createModalState.open}
        initialType={createModalState.initialType}
        hasUnsavedLocalDraft={hasUnsavedLocalDraft}
        localDraftTitle={localTitle}
        localDraftElementCount={localElementCount}
        onClose={() => setCreateModalState((prev) => ({ ...prev, open: false }))}
        onCreate={(opts) => handleCreateBoard(opts)}
      />
    </div>
  );
};
