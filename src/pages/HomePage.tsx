import React, { useMemo, useState } from 'react';
import { ArrowUp, SlidersHorizontal } from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import { GoogleDriveWorkspaceState } from '../hooks/useGoogleDriveWorkspace';
import { StartDesktopUpdateParams } from '../hooks/useDesktopUpdate';
import {
  HomeSectionId,
  useHomeScrollState,
  useScrollReveal,
} from '../hooks/useHomeScrollState';
import { isWhiteboardProjectFile } from '../services/googleDriveUtils';
import { getWebPortalUrl } from '../services/authBridge';
import { getBoardTemplates } from '../engine/boardTemplates';
import { useI18n } from '../i18n/useI18n';
import { BoardPattern, BoardType, NotebookPaperSize, ToolType } from '../types/board';
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

const HOME_SECTIONS: readonly HomeSectionId[] = [
  'local-draft-section',
  'board-templates-section',
  'local-boards-section',
  'drive-boards-section',
];

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
  const localBoardCount = useBoardStore((s) => s.localBoards.length);
  const theme = useBoardStore((s) => s.theme);
  const setTheme = useBoardStore((s) => s.setTheme);
  const startNewBoard = useBoardStore((s) => s.startNewBoard);
  const { language, t } = useI18n();

  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

  const {
    activeSection,
    isScrolled,
    showBackToTop,
    progressBarRef,
    scrollToSection,
    scrollToTop,
  } = useHomeScrollState(HOME_SECTIONS);

  const templatesReveal = useScrollReveal<HTMLDivElement>();

  const [createModalState, setCreateModalState] = useState<{
    open: boolean;
    initialType: BoardType;
  }>({ open: false, initialType: 'basic' });
  const [focusedTemplateId, setFocusedTemplateId] = useState<BoardType>('basic');

  const templates = useMemo(() => getBoardTemplates(language), [language]);
  const focusedIndex = useMemo(() => {
    const idx = templates.findIndex((tpl) => tpl.id === focusedTemplateId);
    return idx >= 0 ? idx : 0;
  }, [templates, focusedTemplateId]);
  const focusedTemplate = templates[focusedIndex] ?? templates[0];

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

  const getPatternLabel = (pattern: BoardPattern, id: BoardType) => {
    if (id === 'math') return t('Tọa độ & ô ly', 'Math grid');
    if (pattern === 'lined') return t('Dòng kẻ A4', 'Ruled lines');
    if (pattern === 'dots') return t('Nền chấm bi', 'Dot grid');
    return t('Nền ô ly', 'Square grid');
  };

  const getToolLabel = (tool: ToolType) => {
    if (tool === 'select') return t('Con trỏ chọn', 'Selection pointer');
    return t('Bút viết', 'Ink pen');
  };

  return (
    <div
      data-testid="home-dashboard"
      className="min-h-dvh w-full bg-[#fafafa] dark:bg-[#111113] text-slate-900 dark:text-slate-100 transition-colors"
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
        activeSection={activeSection}
        isScrolled={isScrolled}
        progressBarRef={progressBarRef}
        onNavigateSection={scrollToSection}
      />

      {/* Band 1: Opening Workspace Masthead */}
      <div className="bg-[#fafafa] dark:bg-[#111113] pt-7 pb-10 sm:pt-9 sm:pb-12">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
          <CurrentDraftCard
            drive={drive}
            localTitle={localTitle}
            localBoardType={localBoardType}
            localElementCount={localElementCount}
            localBoardCount={localBoardCount}
            boardCount={boardCount}
            imageCount={imageCount}
            onEnterEditor={onEnterEditor}
          />
        </div>
      </div>

      {/* Band 2: Pinned-Rail Quick-Start Board Templates */}
      <section
        id="board-templates-section"
        aria-labelledby="board-templates-heading"
        className="bg-[#f2f2f4] dark:bg-[#16161a] py-12 sm:py-16"
      >
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Sticky Left Rail */}
          <div className="lg:col-span-4 lg:sticky lg:top-[84px] self-start space-y-5">
            <div className="space-y-2">
              <h2
                id="board-templates-heading"
                className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-100"
              >
                {t('Tạo nhanh theo mẫu', 'Quick-start templates')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t(
                  'Chọn mặt giấy phù hợp để mở khung vẽ ngay lập tức.',
                  'Pick a paper surface to launch a new canvas immediately.'
                )}
              </p>
            </div>

            {focusedTemplate && (
              <div className="bg-white dark:bg-[#19191d] border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {focusedTemplate.name}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                    {focusedIndex + 1} / {templates.length}
                  </span>
                </div>

                <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {focusedTemplate.description}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1 text-[13px]">
                  <div className="rounded-lg bg-[#f6f6f8] dark:bg-[#131317] px-3 py-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {t('Nền giấy', 'Paper surface')}
                    </div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                      {getPatternLabel(focusedTemplate.pattern, focusedTemplate.id)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#f6f6f8] dark:bg-[#131317] px-3 py-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {t('Công cụ mặc định', 'Default tool')}
                    </div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                      {getToolLabel(focusedTemplate.defaultTool)}
                    </div>
                  </div>
                </div>

                {/* Compact Index Switcher on Desktop */}
                <div className="hidden lg:grid grid-cols-2 gap-1.5 pt-1">
                  {templates.map((tpl) => {
                    const active = tpl.id === focusedTemplate.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setFocusedTemplateId(tpl.id)}
                        className={`h-8 px-2.5 rounded-lg text-xs font-medium text-left truncate transition-colors duration-150 cursor-pointer ${
                          active
                            ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                            : 'bg-[#f6f6f8] dark:bg-[#131317] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                        }`}
                      >
                        {tpl.shortName}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenCreateModal(focusedTemplate.id)}
                  className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-[13px] font-medium transition-colors duration-150 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                  <span>{t('Tùy chỉnh mẫu bảng', 'Customize template')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Right 2x2 Showcase Grid */}
          <div
            ref={templatesReveal.ref}
            data-revealed={templatesReveal.isRevealed ? 'true' : 'false'}
            className="home-reveal-item lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 items-stretch"
          >
            {templates.map((tpl) => {
              const isFocused = focusedTemplate?.id === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  data-testid={`template-card-${tpl.id}`}
                  onMouseEnter={() => setFocusedTemplateId(tpl.id)}
                  onFocus={() => setFocusedTemplateId(tpl.id)}
                  onClick={() => handleQuickTemplateClick(tpl.id)}
                  className={`group text-left bg-white dark:bg-[#19191d] border rounded-xl overflow-hidden transition-colors duration-150 cursor-pointer flex flex-col ${
                    isFocused
                      ? 'border-[#1d5fbf] dark:border-[#669df6]'
                      : 'border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="border-b border-slate-100 dark:border-slate-800/80 overflow-hidden">
                    <BoardTemplatePreview type={tpl.id} className="w-full h-36 sm:h-40" />
                  </div>
                  <div className="p-4 sm:p-5 space-y-1.5 flex-1">
                    <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-[#1d5fbf] dark:group-hover:text-[#669df6] transition-colors duration-150">
                      {tpl.name}
                    </div>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {tpl.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Band 3: Multi-board Offline Local Library (IndexedDB) */}
      <div className="bg-[#fafafa] dark:bg-[#111113] py-12 sm:py-16">
        <LocalBoardsSection
          onOpenBoard={onEnterEditor}
          onCreateNewClick={() => handleOpenCreateModal()}
          onBoardOpenedFromLocal={() => drive.resetBoardSyncContext()}
        />
      </div>

      {/* Band 4: Google Drive Saved Boards Workspace */}
      <div className="bg-[#f2f2f4] dark:bg-[#16161a] py-12 sm:py-16">
        <DriveBoardsSection
          drive={drive}
          isFileProtocol={isFileProtocol}
          boardCount={boardCount}
          imageCount={imageCount}
          onOpenBoard={onEnterEditor}
          onCreateNewClick={() => handleOpenCreateModal()}
          onOpenAuthBridgeClick={onOpenAuthBridgeClick}
        />
      </div>

      {/* Band 5: Designed Close Footer */}
      <footer className="bg-[#fafafa] dark:bg-[#111113] py-10 sm:py-12 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-fzink-brand text-2xl leading-none text-slate-900 dark:text-slate-100 block">
              fzInK
            </span>
            <p className="text-[13px] text-slate-600 dark:text-slate-400">
              {t(
                'Bảng trắng tương tác & không gian toán học',
                'Interactive whiteboard & math workspace'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[13px] text-slate-600 dark:text-slate-400">
            <a
              href={getWebPortalUrl('/privacy.html')}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-100 hover:underline transition-colors cursor-pointer"
            >
              {t('Chính sách quyền riêng tư', 'Privacy policy')}
            </a>
            <a
              href={getWebPortalUrl('/terms.html')}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-100 hover:underline transition-colors cursor-pointer"
            >
              {t('Điều khoản sử dụng', 'Terms of service')}
            </a>
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#19191d] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-[13px] font-medium transition-colors duration-150 cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>{t('Lên đầu trang', 'Back to top')}</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Back-to-Top Action */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label={t('Cuộn lên đầu trang', 'Scroll back to top')}
        title={t('Lên đầu trang', 'Back to top')}
        tabIndex={showBackToTop ? 0 : -1}
        aria-hidden={!showBackToTop}
        className={`fixed bottom-5 right-5 z-20 w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white active:scale-[0.96] flex items-center justify-center transition-[opacity,transform,background-color] duration-200 cursor-pointer ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <ArrowUp className="w-4 h-4" strokeWidth={2} />
      </button>

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
