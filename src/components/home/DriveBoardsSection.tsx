import React, { useMemo, useState } from 'react';
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
import { getWebPortalOrigin } from '../../services/authBridge';
import { useI18n } from '../../i18n/useI18n';
import { GoogleSignInButton } from './GoogleSignInButton';
import { DeleteBoardConfirmModal, RenameBoardModal } from './BoardActionModals';
import {
  AlertTriangle,
  Check,
  CloudUpload,
  ExternalLink,
  FileJson,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

interface DriveBoardsSectionProps {
  drive: GoogleDriveWorkspaceState;
  isFileProtocol: boolean;
  boardCount: number;
  imageCount: number;
  onOpenBoard: () => void;
  onCreateNewClick: () => void;
  onOpenAuthBridgeClick?: () => void;
}

const BoardThumbnail: React.FC<{ file: DriveWhiteboardFile; isBoard: boolean }> = ({
  file,
  isBoard,
}) => {
  const { t } = useI18n();
  const [imgFailed, setImgFailed] = useState(false);

  if (!isBoard && file.thumbnailLink && !imgFailed) {
    return (
      <img
        src={file.thumbnailLink}
        alt={t(`Xem trước ${getDisplayBoardTitle(file)}`, `Preview ${getDisplayBoardTitle(file)}`)}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover"
      />
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-slate-950/70">
      <svg
        viewBox="0 0 240 120"
        className="w-full h-full text-slate-300 dark:text-slate-700"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="drive-thumb-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="0.9" className="fill-slate-300/80 dark:fill-slate-700/80" />
          </pattern>
        </defs>
        <rect width="240" height="120" fill="url(#drive-thumb-dots)" />
        {isBoard ? (
          <g>
            <rect
              x="24"
              y="24"
              width="64"
              height="40"
              rx="6"
              className="fill-white dark:fill-slate-900 stroke-[#1d5fbf]/55 dark:stroke-[#669df6]/55"
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
              className="stroke-[#1d5fbf] dark:stroke-[#669df6]"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <path
              d="M142 68 L 148 73 L 142 78"
              className="stroke-[#1d5fbf] dark:stroke-[#669df6]"
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
          </g>
        ) : null}
      </svg>
      {!isBoard && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500 dark:text-slate-400">
          <ImageIcon className="w-6 h-6" />
          <span className="text-xs font-medium">{t('Ảnh PNG 4×', '4× PNG Image')}</span>
        </div>
      )}
    </div>
  );
};

export const DriveBoardsSection: React.FC<DriveBoardsSectionProps> = ({
  drive,
  isFileProtocol,
  boardCount,
  imageCount,
  onOpenBoard,
  onCreateNewClick,
  onOpenAuthBridgeClick,
}) => {
  const { language, t } = useI18n();
  const [filter, setFilter] = useState<DriveFileFilter>('all');
  const [sort, setSort] = useState<DriveFileSort>('modifiedDesc');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [deleteTarget, setDeleteTarget] = useState<DriveWhiteboardFile | null>(null);
  const [renameTarget, setRenameTarget] = useState<DriveWhiteboardFile | null>(null);

  const visibleFiles = useMemo(
    () => filterAndSortDriveFiles(drive.files, { filter, query, sort }),
    [drive.files, filter, query, sort]
  );

  const handleOpenDriveBoard = async (file: DriveWhiteboardFile) => {
    const ok = await drive.openBoardFile(file, { resetHistory: true });
    if (ok) {
      onOpenBoard();
    }
  };

  const handleSubmitRename = async (trimmedName: string) => {
    if (!renameTarget) return false;
    const ok = await drive.renameFile(renameTarget, trimmedName);
    if (ok) {
      setRenameTarget(null);
    }
    return ok;
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await drive.deleteFile(target);
  };

  return (
    <section
      id="drive-boards-section"
      aria-labelledby="drive-boards-heading"
      className="max-w-[1200px] mx-auto px-5 sm:px-8 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="drive-boards-heading"
          className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-100"
        >
          {t('Bảng đã lưu trên Google Drive', 'Saved boards on Google Drive')}
        </h2>

        {!drive.needsAuth && (
          <div className="flex flex-wrap items-center gap-2">
            {drive.unorganizedCount > 0 && (
              <button
                type="button"
                disabled={Boolean(drive.busyAction)}
                onClick={() => void drive.organizeFilesIntoFolder()}
                className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-[#1d5fbf]/10 dark:bg-[#669df6]/15 hover:bg-[#1d5fbf]/15 dark:hover:bg-[#669df6]/25 text-[#1d5fbf] dark:text-[#669df6] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {drive.busyAction === 'organize' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Folder className="w-3.5 h-3.5" />
                )}
                <span>
                  {t(
                    `Gom ${drive.unorganizedCount} tệp vào thư mục`,
                    `Move ${drive.unorganizedCount} files into folder`
                  )}
                </span>
              </button>
            )}

            <div className="h-8 inline-flex items-center gap-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#19191d]">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {t('Tự động lưu', 'Auto-save')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={drive.autoSaveEnabled}
                aria-label={t(
                  'Bật hoặc tắt tự động lưu lên Google Drive',
                  'Toggle Google Drive auto-save'
                )}
                onClick={() => drive.setAutoSaveEnabled(!drive.autoSaveEnabled)}
                className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                  drive.autoSaveEnabled
                    ? 'bg-[#1d5fbf] dark:bg-[#669df6]'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    drive.autoSaveEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void drive.refreshFiles()}
              disabled={drive.isLoadingFiles || Boolean(drive.busyAction)}
              aria-label={t('Làm mới danh sách Google Drive', 'Refresh Google Drive list')}
              title={t('Làm mới danh sách', 'Refresh list')}
              className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#19191d] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shrink-0 cursor-pointer disabled:opacity-60"
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
                <span>{drive.error.actionLabel || t('Mở bảng điều khiển', 'Open console')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {!drive.needsAuth && (
              <button
                type="button"
                onClick={() => void drive.refreshFiles()}
                className="h-8 px-3 rounded-lg border border-red-300 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-200 hover:bg-red-100/60 dark:hover:bg-red-900/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('Thử lại', 'Retry')}
              </button>
            )}
          </div>
        </div>
      )}

      {drive.needsAuth ? (
        isFileProtocol ? (
          <div className="bg-white dark:bg-[#19191d] border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-7 p-6 sm:p-8 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{t('Sẵn sàng ngoại tuyến', 'Offline ready')}</span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 text-balance">
                {t('Ứng dụng đang chạy ở chế độ ngoại tuyến', 'Running in offline mode')}
              </h3>
              <p className="text-[13px] sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                {t(
                  'Bản cài đặt lưu trữ toàn bộ bảng trắng trực tiếp trên máy tính của bạn (IndexedDB). Bạn không cần đăng nhập vẫn dùng đầy đủ mọi công cụ vẽ, toán học, máy tính Casio và xuất tệp.',
                  'The desktop app stores all whiteboards locally on your computer (IndexedDB). No sign-in is required to use all drawing, math, Casio calculator, and export features.'
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                {language === 'en' ? (
                  <>
                    To sync with Google Drive, click{' '}
                    <strong className="font-medium text-slate-800 dark:text-slate-200">
                      Sign in via browser
                    </strong>{' '}
                    and choose your Google account.
                  </>
                ) : (
                  <>
                    Để đồng bộ Google Drive, bấm{' '}
                    <strong className="font-medium text-slate-800 dark:text-slate-200">
                      Đăng nhập qua trình duyệt
                    </strong>{' '}
                    và chọn tài khoản Google của bạn.
                  </>
                )}
              </p>
            </div>

            <div className="lg:col-span-5 p-6 sm:p-8 bg-[#f7f7f9] dark:bg-[#131317] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-center items-start lg:items-center gap-3">
              <button
                type="button"
                onClick={onCreateNewClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#1d5fbf] hover:bg-[#174ea1] dark:bg-[#2a6fd1] dark:hover:bg-[#3b80e0] text-white font-medium text-xs transition-colors duration-150 cursor-pointer"
              >
                <Plus className="w-4 h-4" strokeWidth={1.75} />
                <span>{t('Tạo bảng mới', 'New board')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenAuthBridgeClick?.();
                  const portal = getWebPortalOrigin();
                  window.open(
                    `${portal}?auth_bridge=1`,
                    'bttm_auth_bridge',
                    'width=540,height=700,menubar=no,toolbar=no,location=no,status=no'
                  );
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs transition-colors duration-150 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                <span>{t('Đăng nhập qua trình duyệt', 'Sign in via browser')}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Signed-Out Connect Split Panel */
          <div className="bg-white dark:bg-[#19191d] border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-7 p-6 sm:p-8 space-y-3">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 text-balance">
                {t(
                  'Đăng nhập Google để đồng bộ bảng đã lưu',
                  'Sign in with Google to sync saved boards'
                )}
              </h3>
              <p className="text-[13px] sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                {t(
                  `Tự động lưu dự án bảng trắng và ảnh PNG 4× trong thư mục riêng "${APP_DRIVE_FOLDER_NAME}"`,
                  `Automatically save whiteboard projects and 4× PNG exports in a dedicated "${APP_DRIVE_FOLDER_NAME}" folder`
                )}
              </p>

              <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span>{t('Chỉ truy cập tệp do ứng dụng tạo', 'Only accesses files created by this app')}</span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span>{t('Dùng chung dung lượng Drive cá nhân', 'Uses your personal Google Drive storage')}</span>
              </div>
            </div>

            <div className="lg:col-span-5 p-6 sm:p-8 bg-[#f7f7f9] dark:bg-[#131317] border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-center items-start lg:items-center gap-2.5">
              <GoogleSignInButton
                testId="home-google-signin-button"
                onClick={() => void drive.signIn()}
                isLoading={drive.isLoggingIn}
              />
            </div>
          </div>
        )
      ) : (
        <>
          {/* Sticky Balanced Filter, Search, Sort & Layout Bar */}
          <div className="sticky top-14 z-10 -mx-5 sm:-mx-8 px-5 sm:px-8 py-3 bg-[#f2f2f4] dark:bg-[#16161a] border-b border-slate-200/70 dark:border-slate-800/70 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            {/* Segmented Filter Tabs */}
            <div
              role="tablist"
              aria-label={t('Lọc loại tệp Google Drive', 'Filter Google Drive file types')}
              className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 self-start"
            >
              {(
                [
                  { id: 'all', label: t('Tất cả', 'All'), count: drive.files.length },
                  { id: 'boards', label: t('Bảng trắng', 'Boards'), count: boardCount },
                  { id: 'images', label: t('Ảnh PNG', 'PNG Images'), count: imageCount },
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
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
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
                  aria-label={t('Tìm bảng theo tên', 'Search boards by name')}
                  placeholder={t('Tìm theo tên', 'Search by name')}
                  className="h-9 w-full pl-8 pr-3 rounded-lg bg-white dark:bg-[#19191d] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#1d5fbf] dark:focus:border-[#669df6] transition-colors"
                />
              </div>

              <select
                aria-label={t('Sắp xếp bảng', 'Sort boards')}
                value={sort}
                onChange={(e) => setSort(e.target.value as DriveFileSort)}
                className="h-9 px-2.5 rounded-lg bg-white dark:bg-[#19191d] border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
              >
                <option value="modifiedDesc">{t('Mới cập nhật', 'Recently modified')}</option>
                <option value="nameAsc">{t('Tên A → Z', 'Name A → Z')}</option>
                <option value="sizeDesc">{t('Dung lượng lớn nhất', 'Largest size')}</option>
              </select>

              <div className="h-9 inline-flex items-center p-0.5 rounded-lg bg-white dark:bg-[#19191d] border border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label={t('Hiển thị dạng lưới', 'Grid view')}
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
                  aria-label={t('Hiển thị dạng danh sách', 'List view')}
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
                  className="bg-white dark:bg-[#19191d] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
                >
                  <div className="h-32 bg-slate-100 dark:bg-slate-800/70" />
                  <div className="p-4 space-y-2">
                    <div className="h-3.5 w-2/3 rounded bg-slate-200/80 dark:bg-slate-800" />
                    <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : drive.files.length === 0 ? (
            /* Calm Empty Account State */
            <div className="bg-white dark:bg-[#19191d] border border-dashed border-slate-300 dark:border-slate-800 rounded-xl px-6 py-10 text-center space-y-1.5">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {t(
                  `Chưa có tệp nào trong thư mục "${APP_DRIVE_FOLDER_NAME}"`,
                  `No files in "${APP_DRIVE_FOLDER_NAME}" folder yet`
                )}
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {language === 'en' ? (
                  <>
                    Click <strong className="font-medium text-slate-700 dark:text-slate-300">New board</strong> above or save your current draft to see your boards here.
                  </>
                ) : (
                  <>
                    Bấm <strong className="font-medium text-slate-700 dark:text-slate-300">Tạo bảng mới</strong> ở góc trên hoặc lưu bản nháp hiện tại để các bảng của bạn xuất hiện tại đây.
                  </>
                )}
              </p>
            </div>
          ) : visibleFiles.length === 0 ? (
            /* Empty Search / Filter State */
            <div className="bg-white dark:bg-[#19191d] border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-9 text-center space-y-3">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                {t(
                  'Không tìm thấy tệp nào khớp với từ khóa hoặc bộ lọc hiện tại.',
                  'No files match your current search or filter.'
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
                className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
              >
                {t('Xóa bộ lọc', 'Clear filters')}
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
                    className={`bg-white dark:bg-[#19191d] border rounded-xl overflow-hidden flex flex-col transition-colors ${
                      isCurrent
                        ? 'border-[#1d5fbf] dark:border-[#669df6]'
                        : 'border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {isBoard ? (
                      <button
                        type="button"
                        disabled={Boolean(drive.busyAction)}
                        onClick={() => void handleOpenDriveBoard(file)}
                        aria-label={t(`Mở bảng ${displayTitle}`, `Open board ${displayTitle}`)}
                        className="h-32 w-full border-b border-slate-100 dark:border-slate-800 block text-left cursor-pointer group focus-visible:outline-none overflow-hidden"
                      >
                        <div className="w-full h-full">
                          <BoardThumbnail file={file} isBoard={isBoard} />
                        </div>
                      </button>
                    ) : (
                      <div className="h-32 w-full border-b border-slate-100 dark:border-slate-800 overflow-hidden">
                        <BoardThumbnail file={file} isBoard={isBoard} />
                      </div>
                    )}

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {displayTitle}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>{isBoard ? t('Bảng trắng', 'Whiteboard') : t('Ảnh PNG', 'PNG Image')}</span>
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
                                {t('Đang mở', 'Open')}
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
                            className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-[#1d5fbf]/10 dark:bg-[#669df6]/15 hover:bg-[#1d5fbf]/15 dark:hover:bg-[#669df6]/25 text-[#1d5fbf] dark:text-[#669df6] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                          >
                            {isOpening ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FolderOpen className="w-3.5 h-3.5" />
                            )}
                            <span>{isOpening ? t('Đang mở...', 'Opening...') : t('Mở', 'Open')}</span>
                          </button>
                        ) : file.webViewLink ? (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{t('Xem ảnh', 'View image')}</span>
                          </a>
                        ) : (
                          <span />
                        )}

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={Boolean(drive.busyAction)}
                            onClick={() => setRenameTarget(file)}
                            aria-label={t(`Đổi tên ${displayTitle}`, `Rename ${displayTitle}`)}
                            title={t('Đổi tên', 'Rename')}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(drive.busyAction)}
                            onClick={() => setDeleteTarget(file)}
                            aria-label={t(`Xóa ${displayTitle}`, `Delete ${displayTitle}`)}
                            title={t('Xóa khỏi Google Drive', 'Delete from Google Drive')}
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
            <div className="bg-white dark:bg-[#19191d] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200/80 dark:divide-slate-800">
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
                            ? 'bg-[#1d5fbf]/10 dark:bg-[#669df6]/15 text-[#1d5fbf] dark:text-[#669df6]'
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
                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                          {isBoard ? t('Bảng trắng', 'Whiteboard') : t('Ảnh PNG', 'PNG Image')}
                          {file.modifiedTime
                            ? ` · ${formatDriveModifiedTime(file.modifiedTime)}`
                            : ''}
                          {sizeNum > 0 ? ` · ${formatFileSize(sizeNum)}` : ''}
                          {isCurrent ? ` · ${t('Đang mở', 'Open')}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isBoard ? (
                        <button
                          type="button"
                          disabled={Boolean(drive.busyAction)}
                          onClick={() => void handleOpenDriveBoard(file)}
                          className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-[#1d5fbf]/10 dark:bg-[#669df6]/15 hover:bg-[#1d5fbf]/15 dark:hover:bg-[#669df6]/25 text-[#1d5fbf] dark:text-[#669df6] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isOpening ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FolderOpen className="w-3.5 h-3.5" />
                          )}
                          <span>{t('Mở', 'Open')}</span>
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
                            <span>{t('Xem', 'View')}</span>
                          </a>
                        )
                      )}
                      <button
                        type="button"
                        disabled={Boolean(drive.busyAction)}
                        onClick={() => setRenameTarget(file)}
                        aria-label={t(`Đổi tên ${displayTitle}`, `Rename ${displayTitle}`)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(drive.busyAction)}
                        onClick={() => setDeleteTarget(file)}
                        aria-label={t(`Xóa ${displayTitle}`, `Delete ${displayTitle}`)}
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

      <RenameBoardModal
        isOpen={Boolean(renameTarget)}
        title={t('Đổi tên tệp trên Google Drive', 'Rename file on Google Drive')}
        initialValue={renameTarget ? getDisplayBoardTitle(renameTarget) : ''}
        isSubmitting={Boolean(drive.busyAction)}
        submittingLabel={
          renameTarget && drive.busyAction === `rename:${renameTarget.id}`
            ? t('Đang lưu...', 'Saving...')
            : t('Lưu tên mới', 'Save name')
        }
        titleId="rename-board-title"
        inputId="rename-board-input"
        onClose={() => setRenameTarget(null)}
        onSubmit={handleSubmitRename}
      />

      <DeleteBoardConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={t('Xóa tệp khỏi Google Drive?', 'Delete file from Google Drive?')}
        description={
          deleteTarget ? (
            language === 'en' ? (
              <>
                Are you sure you want to permanently delete &ldquo;{deleteTarget.name}&rdquo; from
                Google Drive? This action cannot be undone.
              </>
            ) : (
              <>
                Bạn có chắc muốn xóa vĩnh viễn &ldquo;{deleteTarget.name}&rdquo; khỏi Google Drive?
                Thao tác này không thể hoàn tác.
              </>
            )
          ) : null
        }
        isSubmitting={Boolean(drive.busyAction)}
        titleId="delete-board-title"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
};
