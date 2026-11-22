import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import { formatFileSize } from '../../engine/documentUtils';
import { GoogleDriveWorkspaceState } from '../../hooks/useGoogleDriveWorkspace';
import {
  APP_DRIVE_FOLDER_NAME,
  DriveFileFilter,
  DriveFileSort,
  DriveWhiteboardFile,
  filterAndSortDriveFiles,
  formatDriveModifiedTime,
  getDisplayBoardTitle,
  isWhiteboardProjectFile,
} from '../../services/googleDriveUtils';
import { formatSyncTime, getLocalDraftActionState } from '../../services/driveSyncUtils';
import { BOARD_TEMPLATES, getBoardTypeLabel } from '../../engine/boardTemplates';
import { BoardType } from '../../types/board';
import { BoardTemplatePreview } from './BoardTemplatePreview';
import { CreateBoardModal } from '../modals/CreateBoardModal';
import { HomeSettingsMenu, PWAInstallTriggerButton } from '../modals/DesktopAppModal';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  Plus,
  Search,
  RefreshCw,
  FolderOpen,
  Trash2,
  Pencil,
  ExternalLink,
  LogOut,
  Loader2,
  LayoutGrid,
  List,
  Sun,
  Moon,
  PenTool,
  CloudUpload,
  AlertTriangle,
  FileJson,
  Image as ImageIcon,
  ArrowRight,
  Folder,
  Check,
  X,
  ChevronDown,
  UserRoundCog,
  KeyRound,
  Laptop,
} from 'lucide-react';

interface HomePageProps {
  drive: GoogleDriveWorkspaceState;
  onEnterEditor: () => void;
  onOpenDesktopAppClick: () => void;
  onOpenAuthBridgeClick?: () => void;
}

const BoardThumbnail: React.FC<{ file: DriveWhiteboardFile; isBoard: boolean }> = ({
  file,
  isBoard,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (!isBoard && file.thumbnailLink && !imgFailed) {
    return (
      <img
        src={file.thumbnailLink}
        alt={`Xem trước ${getDisplayBoardTitle(file)}`}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover"
      />
    );
  }

  return (
    <div
      className="w-full h-full relative overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-slate-950/70"
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(148, 163, 184, 0.32) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    >
      {isBoard ? (
        <svg
          viewBox="0 0 240 120"
          className="w-40 h-20 text-slate-300 dark:text-slate-700"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="24"
            y="24"
            width="64"
            height="40"
            rx="6"
            className="fill-white dark:fill-slate-900 stroke-indigo-300 dark:stroke-indigo-700"
            strokeWidth="1.5"
          />
          <rect
            x="148"
            y="52"
            width="68"
            height="42"
            rx="6"
            className="fill-amber-50 dark:fill-amber-950/40 stroke-amber-300 dark:stroke-amber-700"
            strokeWidth="1.5"
          />
          <path
            d="M88 44 C 118 44, 118 73, 148 73"
            className="stroke-indigo-400 dark:stroke-indigo-500"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M142 68 L 148 73 L 142 78"
            className="stroke-indigo-400 dark:stroke-indigo-500"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="36"
            y1="40"
            x2="74"
            y2="40"
            className="stroke-slate-300 dark:stroke-slate-700"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="36"
            y1="50"
            x2="62"
            y2="50"
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <div className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500">
          <ImageIcon className="w-6 h-6" />
          <span className="text-[11px] font-medium">Ảnh PNG 4×</span>
        </div>
      )}
    </div>
  );
};

export const HomePage: React.FC<HomePageProps> = ({
  drive,
  onEnterEditor,
  onOpenDesktopAppClick,
  onOpenAuthBridgeClick,
}) => {
  const localTitle = useBoardStore((s) => s.title);
  const localBoardType = useBoardStore((s) => s.boardType);
  const localElementCount = useBoardStore((s) => s.elements.length);
  const theme = useBoardStore((s) => s.theme);
  const setTheme = useBoardStore((s) => s.setTheme);
  const startNewBoard = useBoardStore((s) => s.startNewBoard);

  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

  const [filter, setFilter] = useState<DriveFileFilter>('all');
  const [sort, setSort] = useState<DriveFileSort>('modifiedDesc');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<DriveWhiteboardFile | null>(null);
  const [renameTarget, setRenameTarget] = useState<DriveWhiteboardFile | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [createModalState, setCreateModalState] = useState<{
    open: boolean;
    initialType: BoardType;
  }>({ open: false, initialType: 'basic' });

  useEffect(() => {
    if (!showAccountMenu) return;
    const onOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showAccountMenu]);

  const boardCount = useMemo(
    () => drive.files.filter((f) => isWhiteboardProjectFile(f)).length,
    [drive.files]
  );
  const imageCount = useMemo(() => drive.files.length - boardCount, [drive.files.length, boardCount]);

  const visibleFiles = useMemo(
    () => filterAndSortDriveFiles(drive.files, { filter, query, sort }),
    [drive.files, filter, query, sort]
  );

  const draftAction = getLocalDraftActionState({
    isAuthenticated: !drive.needsAuth,
    elementCount: localElementCount,
    hasActiveDriveFile: Boolean(drive.activeDriveFile),
    syncStatus: drive.syncStatus,
  });

  const hasUnsavedLocalDraft = localElementCount > 0 && !drive.activeDriveFile;

  const handleOpenCreateModal = (initialType: BoardType = 'basic') => {
    setCreateModalState({ open: true, initialType });
  };

  const handleCreateBoard = (options: { title?: string; boardType: BoardType }) => {
    setCreateModalState((prev) => ({ ...prev, open: false }));
    drive.resetBoardSyncContext();
    startNewBoard(options);
    onEnterEditor();
  };

  const handleQuickTemplateClick = (boardType: BoardType) => {
    if (hasUnsavedLocalDraft) {
      setCreateModalState({ open: true, initialType: boardType });
      return;
    }
    handleCreateBoard({ boardType });
  };

  const handleOpenDriveBoard = async (file: DriveWhiteboardFile) => {
    const ok = await drive.openBoardFile(file, { resetHistory: true });
    if (ok) {
      onEnterEditor();
    }
  };

  const handleOpenRename = (file: DriveWhiteboardFile) => {
    setRenameTarget(file);
    setRenameValue(getDisplayBoardTitle(file));
    setRenameError(null);
  };

  const handleSubmitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError('Vui lòng nhập tên bảng hợp lệ.');
      return;
    }
    const ok = await drive.renameFile(renameTarget, trimmed);
    if (ok) {
      setRenameTarget(null);
      setRenameValue('');
      setRenameError(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await drive.deleteFile(target);
  };

  return (
    <div
      data-testid="home-dashboard"
      className="h-full w-full overflow-y-auto touch-pan-y select-text bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors"
    >
      {/* Compact Single-Row Header (Zero Duplicate Controls) */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div
              aria-hidden="true"
              className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0"
            >
              <PenTool className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm sm:text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
              Bảng Trắng
            </span>
          </div>

          {/* Right Controls: Single Theme Toggle + Account Dropdown (if signed in) + Single Primary CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {!drive.needsAuth && drive.user && (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowAccountMenu((v) => !v)}
                  aria-expanded={showAccountMenu}
                  aria-label="Tài khoản Google"
                  className="h-9 pl-1.5 pr-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                >
                  {drive.user.photoURL ? (
                    <img
                      src={drive.user.photoURL}
                      alt={drive.user.displayName || 'Tài khoản Google'}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {(drive.user.displayName || drive.user.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="hidden md:inline text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
                    {drive.user.displayName || drive.user.email}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                {showAccountMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-30"
                  >
                    <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {drive.user.displayName || 'Tài khoản Google'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {drive.user.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={drive.isLoggingIn || Boolean(drive.busyAction)}
                      onClick={() => {
                        setShowAccountMenu(false);
                        void drive.signIn();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <UserRoundCog className="w-3.5 h-3.5 text-slate-400" />
                      <span>Đổi tài khoản Google</span>
                    </button>
                    {!isFileProtocol && onOpenAuthBridgeClick && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowAccountMenu(false);
                          onOpenAuthBridgeClick();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                      >
                        <Laptop className="w-3.5 h-3.5" />
                        <span>Mã kết nối cho app máy tính</span>
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      disabled={Boolean(drive.busyAction)}
                      onClick={() => {
                        setShowAccountMenu(false);
                        void drive.signOut();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <HomeSettingsMenu
              onOpenDesktopModal={onOpenDesktopAppClick}
              theme={theme}
              onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            />

            <PWAInstallTriggerButton onOpenModal={onOpenDesktopAppClick} />

            <button
              type="button"
              data-testid="create-new-board-button"
              onClick={() => handleOpenCreateModal('basic')}
              className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo bảng mới</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-7 space-y-6">
        {/* Compact Workspace Intro & Current Session Strip */}
        <section
          id="local-draft-section"
          aria-labelledby="workspace-heading"
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <h1
              id="workspace-heading"
              className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
            >
              Không gian bảng trắng
            </h1>
            {!drive.needsAuth && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>{boardCount} bảng trắng</span>
                <span aria-hidden="true">·</span>
                <span>{imageCount} ảnh PNG</span>
                <span aria-hidden="true">·</span>
                {drive.appFolder?.webViewLink ? (
                  <a
                    href={drive.appFolder.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                  >
                    <Folder className="w-3.5 h-3.5 shrink-0" />
                    <span>{drive.appFolder.name}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Folder className="w-3.5 h-3.5 shrink-0" />
                    <span>{APP_DRIVE_FOLDER_NAME}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Sleek Current Draft Quick-Resume Strip */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-3">
              <div
                aria-hidden="true"
                className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
              >
                <PenTool className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {localTitle || 'Bảng Trắng Mới'}
                  </span>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600 shrink-0">
                    ·
                  </span>
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
                    Đang mở trên máy
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {getBoardTypeLabel(localBoardType)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{localElementCount} đối tượng</span>
                  <span aria-hidden="true">·</span>
                  {drive.activeDriveFile ? (
                    <span className="inline-flex items-center gap-1">
                      {draftAction === 'synced' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            Đã đồng bộ Drive
                            {drive.lastSyncedAt ? ` lúc ${formatSyncTime(drive.lastSyncedAt)}` : ''}
                          </span>
                        </>
                      ) : draftAction === 'syncing' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>Đang đồng bộ lên Drive...</span>
                        </>
                      ) : (
                        <span>Có thay đổi mới chưa đẩy lên Drive</span>
                      )}
                    </span>
                  ) : (
                    <span>Tự động lưu trên trình duyệt</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 sm:pl-2">
              {draftAction === 'save-new' && (
                <button
                  type="button"
                  onClick={() => void drive.saveNewBoard()}
                  disabled={Boolean(drive.busyAction)}
                  className="h-9 flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {drive.busyAction === 'save-new' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  )}
                  <span>Lưu lên Drive</span>
                </button>
              )}

              {draftAction === 'update-existing' && drive.activeDriveFile && (
                <button
                  type="button"
                  onClick={() => void drive.overwriteBoard(drive.activeDriveFile!)}
                  disabled={Boolean(drive.busyAction)}
                  className="h-9 flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {drive.busyAction === `overwrite:${drive.activeDriveFile.id}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  )}
                  <span>Đồng bộ ngay</span>
                </button>
              )}

              <button
                type="button"
                data-testid="continue-local-board-button"
                onClick={onEnterEditor}
                className="h-9 flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Tiếp tục chỉnh sửa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* Quick-Create Board Templates */}
        <section
          id="board-templates-section"
          aria-labelledby="board-templates-heading"
          className="space-y-3"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2
              id="board-templates-heading"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Tạo nhanh theo mẫu
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              Chọn mẫu bảng phù hợp để bắt đầu ngay
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {BOARD_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                data-testid={`template-card-${tpl.id}`}
                onClick={() => handleQuickTemplateClick(tpl.id)}
                className="group text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl overflow-hidden transition-colors cursor-pointer flex flex-col"
              >
                <div className="border-b border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="group-hover:scale-[1.03] transition-transform duration-200">
                    <BoardTemplatePreview type={tpl.id} className="w-full h-24 sm:h-28" />
                  </div>
                </div>
                <div className="p-3 space-y-1 flex-1">
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {tpl.name}
                  </div>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {tpl.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Google Drive Saved Boards Workspace */}
        <section id="drive-boards-section" aria-labelledby="drive-boards-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <h2
              id="drive-boards-heading"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Bảng đã lưu trên Google Drive
            </h2>

            {!drive.needsAuth && (
              <div className="flex flex-wrap items-center gap-2">
                {drive.unorganizedCount > 0 && (
                  <button
                    type="button"
                    disabled={Boolean(drive.busyAction)}
                    onClick={() => void drive.organizeFilesIntoFolder()}
                    className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    {drive.busyAction === 'organize' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Folder className="w-3.5 h-3.5" />
                    )}
                    <span>Gom {drive.unorganizedCount} tệp vào thư mục</span>
                  </button>
                )}

                <div className="h-8 inline-flex items-center gap-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    Tự động lưu
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={drive.autoSaveEnabled}
                    aria-label="Bật hoặc tắt tự động lưu lên Google Drive"
                    onClick={() => drive.setAutoSaveEnabled(!drive.autoSaveEnabled)}
                    className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      drive.autoSaveEnabled
                        ? 'bg-indigo-600'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                        drive.autoSaveEnabled ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void drive.refreshFiles()}
                  disabled={drive.isLoadingFiles || Boolean(drive.busyAction)}
                  aria-label="Làm mới danh sách Google Drive"
                  title="Làm mới danh sách"
                  className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${drive.isLoadingFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {drive.error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 text-xs text-red-800 dark:text-red-200 leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                <span>{drive.error.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {drive.error.actionUrl && (
                  <a
                    href={drive.error.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{drive.error.actionLabel || 'Mở bảng điều khiển'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {!drive.needsAuth && (
                  <button
                    type="button"
                    onClick={() => void drive.refreshFiles()}
                    className="h-8 px-3 rounded-lg border border-red-300 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-200 hover:bg-red-100/60 dark:hover:bg-red-900/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Thử lại
                  </button>
                )}
              </div>
            </div>
          )}

          {drive.needsAuth ? (
            isFileProtocol ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-9 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white text-balance max-w-md">
                  Ứng dụng đang chạy ở chế độ ngoại tuyến
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-lg leading-relaxed">
                  Bản tải về máy lưu trữ toàn bộ bảng trắng trực tiếp và an toàn trên máy tính của bạn (IndexedDB). Bạn không cần đăng nhập tài khoản vẫn sử dụng trọn vẹn mọi công cụ vẽ, toán học, máy tính Casio và xuất/nhập tệp.
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal()}
                    className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tạo bảng mới ngay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenAuthBridgeClick) {
                        onOpenAuthBridgeClick();
                      } else {
                        const portal =
                          typeof window !== 'undefined'
                            ? window.__BTTM_EMBEDDED_BUILD__?.updateOrigin
                            : undefined;
                        window.open(
                          portal
                            ? `${portal}?auth_bridge=1`
                            : 'https://whiteboard-34d4d.web.app?auth_bridge=1',
                          '_blank'
                        );
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Đăng nhập qua trình duyệt</span>
                  </button>
                </div>

                <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                  Để đồng bộ Google Drive: Bấm <strong>&ldquo;Đăng nhập qua trình duyệt&rdquo;</strong> để mở trình duyệt lấy mã kết nối an toàn về máy (chỉ cần làm một lần duy nhất).
                </div>
              </div>
            ) : (
              /* Compact, Balanced Signed-Out Connect Card */
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                  <CloudUpload className="w-6 h-6" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white text-balance max-w-md">
                  Đăng nhập Google để đồng bộ toàn bộ bảng đã lưu
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
                  Tự động lưu dự án bảng trắng và ảnh PNG 4× gọn gàng trong thư mục riêng &ldquo;{APP_DRIVE_FOLDER_NAME}&rdquo;.
                </p>

                <div className="mt-5">
                  <GoogleSignInButton
                    testId="home-google-signin-button"
                    onClick={() => void drive.signIn()}
                    isLoading={drive.isLoggingIn}
                  />
                </div>

                <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>Chỉ truy cập tệp do ứng dụng tạo</span>
                  <span aria-hidden="true" className="hidden sm:inline">
                    ·
                  </span>
                  <span>Miễn phí dùng chung dung lượng Drive cá nhân</span>
                </div>
              </div>
            )
          ) : (
            <>
              {/* Balanced Filter, Search, Sort & Layout Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                {/* Segmented Filter Tabs */}
                <div
                  role="tablist"
                  aria-label="Lọc loại tệp Google Drive"
                  className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 self-start"
                >
                  {(
                    [
                      { id: 'all', label: 'Tất cả', count: drive.files.length },
                      { id: 'boards', label: 'Bảng trắng', count: boardCount },
                      { id: 'images', label: 'Ảnh PNG', count: imageCount },
                    ] as const
                  ).map((tab) => {
                    const active = filter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setFilter(tab.id)}
                        className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    );
                  })}
                </div>

                {/* Search + Sort + View Mode */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 md:flex-initial md:w-56">
                    <Search
                      aria-hidden="true"
                      className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Tìm bảng theo tên"
                      placeholder="Tìm theo tên..."
                      className="h-9 w-full pl-8 pr-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <select
                    aria-label="Sắp xếp bảng"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as DriveFileSort)}
                    className="h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
                  >
                    <option value="modifiedDesc">Mới cập nhật</option>
                    <option value="nameAsc">Tên A → Z</option>
                    <option value="sizeDesc">Dung lượng lớn nhất</option>
                  </select>

                  <div className="h-9 inline-flex items-center p-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      aria-label="Hiển thị dạng lưới"
                      aria-pressed={viewMode === 'grid'}
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      aria-label="Hiển thị dạng danh sách"
                      aria-pressed={viewMode === 'list'}
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        viewMode === 'list'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Loading Skeletons */}
              {drive.isLoadingFiles && drive.files.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden animate-pulse"
                    >
                      <div className="h-32 bg-slate-100 dark:bg-slate-800/80" />
                      <div className="p-3.5 space-y-2">
                        <div className="h-3.5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                        <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : drive.files.length === 0 ? (
                /* Calm Empty Account State (No Duplicate CTA Buttons) */
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl px-6 py-10 text-center space-y-1.5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Chưa có tệp nào trong thư mục &ldquo;{APP_DRIVE_FOLDER_NAME}&rdquo;
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    Bấm <strong className="font-semibold text-slate-700 dark:text-slate-300">Tạo bảng mới</strong> ở góc trên hoặc lưu bản nháp hiện tại để các bảng của bạn xuất hiện tại đây.
                  </p>
                </div>
              ) : visibleFiles.length === 0 ? (
                /* Empty Search / Filter State */
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-9 text-center space-y-3">
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    Không tìm thấy tệp nào khớp với từ khóa hoặc bộ lọc hiện tại.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                    className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                /* Proportional 4-Column Desktop Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleFiles.map((file) => {
                    const isBoard = isWhiteboardProjectFile(file);
                    const isCurrent = drive.activeDriveFile?.id === file.id;
                    const displayTitle = getDisplayBoardTitle(file);
                    const sizeNum = file.size ? Number(file.size) : 0;
                    const isOpening = drive.busyAction === `open:${file.id}`;
                    const isDeleting = drive.busyAction === `delete:${file.id}`;

                    return (
                      <article
                        key={file.id}
                        className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden flex flex-col transition-colors ${
                          isCurrent
                            ? 'border-indigo-500 dark:border-indigo-500'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {isBoard ? (
                          <button
                            type="button"
                            disabled={Boolean(drive.busyAction)}
                            onClick={() => void handleOpenDriveBoard(file)}
                            aria-label={`Mở bảng ${displayTitle}`}
                            className="h-32 w-full border-b border-slate-100 dark:border-slate-800 block text-left cursor-pointer group focus-visible:outline-none overflow-hidden"
                          >
                            <div className="w-full h-full group-hover:scale-[1.02] transition-transform duration-200">
                              <BoardThumbnail file={file} isBoard={isBoard} />
                            </div>
                          </button>
                        ) : (
                          <div className="h-32 w-full border-b border-slate-100 dark:border-slate-800 overflow-hidden">
                            <BoardThumbnail file={file} isBoard={isBoard} />
                          </div>
                        )}

                        <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {displayTitle}
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              <span>{isBoard ? 'Bảng trắng' : 'Ảnh PNG'}</span>
                              {file.modifiedTime && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatDriveModifiedTime(file.modifiedTime)}</span>
                                </>
                              )}
                              {sizeNum > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatFileSize(sizeNum)}</span>
                                </>
                              )}
                              {isCurrent && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    Đang mở
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                            {isBoard ? (
                              <button
                                type="button"
                                disabled={Boolean(drive.busyAction)}
                                onClick={() => void handleOpenDriveBoard(file)}
                                className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                              >
                                {isOpening ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <FolderOpen className="w-3.5 h-3.5" />
                                )}
                                <span>{isOpening ? 'Đang mở...' : 'Mở'}</span>
                              </button>
                            ) : file.webViewLink ? (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Xem ảnh</span>
                              </a>
                            ) : (
                              <span />
                            )}

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={Boolean(drive.busyAction)}
                                onClick={() => handleOpenRename(file)}
                                aria-label={`Đổi tên ${displayTitle}`}
                                title="Đổi tên"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(drive.busyAction)}
                                onClick={() => setDeleteTarget(file)}
                                aria-label={`Xóa ${displayTitle}`}
                                title="Xóa khỏi Google Drive"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                /* Compact High-Density List View */
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200/80 dark:divide-slate-800">
                  {visibleFiles.map((file) => {
                    const isBoard = isWhiteboardProjectFile(file);
                    const isCurrent = drive.activeDriveFile?.id === file.id;
                    const displayTitle = getDisplayBoardTitle(file);
                    const sizeNum = file.size ? Number(file.size) : 0;
                    const isOpening = drive.busyAction === `open:${file.id}`;

                    return (
                      <div
                        key={file.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isBoard
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isBoard ? (
                              <FileJson className="w-4 h-4" />
                            ) : (
                              <ImageIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {displayTitle}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                              {isBoard ? 'Bảng trắng' : 'Ảnh PNG'}
                              {file.modifiedTime
                                ? ` · ${formatDriveModifiedTime(file.modifiedTime)}`
                                : ''}
                              {sizeNum > 0 ? ` · ${formatFileSize(sizeNum)}` : ''}
                              {isCurrent ? ' · Đang mở' : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isBoard ? (
                            <button
                              type="button"
                              disabled={Boolean(drive.busyAction)}
                              onClick={() => void handleOpenDriveBoard(file)}
                              className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {isOpening ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FolderOpen className="w-3.5 h-3.5" />
                              )}
                              <span>Mở</span>
                            </button>
                          ) : (
                            file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Xem</span>
                              </a>
                            )
                          )}
                          <button
                            type="button"
                            disabled={Boolean(drive.busyAction)}
                            onClick={() => handleOpenRename(file)}
                            aria-label={`Đổi tên ${displayTitle}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(drive.busyAction)}
                            onClick={() => setDeleteTarget(file)}
                            aria-label={`Xóa ${displayTitle}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Rename Modal */}
      {renameTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-board-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !drive.busyAction) setRenameTarget(null);
          }}
        >
          <form
            onSubmit={(e) => void handleSubmitRename(e)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 id="rename-board-title" className="text-base font-bold">
                Đổi tên tệp trên Google Drive
              </h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                aria-label="Đóng hộp thoại đổi tên"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rename-board-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Tên mới
              </label>
              <input
                id="rename-board-input"
                type="text"
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value);
                  if (renameError) setRenameError(null);
                }}
                autoFocus
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100"
              />
              {renameError && <p className="text-xs text-red-600 dark:text-red-400">{renameError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="h-9 px-3.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={Boolean(drive.busyAction)}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                {drive.busyAction === `rename:${renameTarget.id}` ? 'Đang lưu...' : 'Lưu tên mới'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-board-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !drive.busyAction) setDeleteTarget(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 id="delete-board-title" className="text-sm font-bold">
                  Xóa tệp khỏi Google Drive?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed break-words">
                  Bạn có chắc muốn xóa vĩnh viễn &ldquo;{deleteTarget.name}&rdquo; khỏi Google Drive? Thao tác này không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-3.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="h-9 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

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
