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

export const DriveBoardsSection: React.FC<DriveBoardsSectionProps> = ({
  drive,
  isFileProtocol,
  boardCount,
  imageCount,
  onOpenBoard,
  onCreateNewClick,
  onOpenAuthBridgeClick,
}) => {
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
    <section id="drive-boards-section" aria-labelledby="drive-boards-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="drive-boards-heading"
          className="text-base font-medium text-slate-900 dark:text-slate-100"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-8 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mb-4">
              <Check className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-medium text-slate-900 dark:text-slate-100 text-balance max-w-md">
              Ứng dụng đang chạy ở chế độ ngoại tuyến
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg leading-relaxed">
              Bản cài đặt lưu trữ toàn bộ bảng trắng trực tiếp trên máy tính của bạn (IndexedDB). Bạn không cần đăng nhập vẫn dùng đầy đủ mọi công cụ vẽ, toán học, máy tính Casio và xuất tệp.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onCreateNewClick}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors duration-150 cursor-pointer"
              >
                <Plus className="w-4 h-4" strokeWidth={1.75} />
                <span>Tạo bảng mới</span>
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
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs transition-colors duration-150 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
                <span>Đăng nhập qua trình duyệt</span>
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              Để đồng bộ Google Drive, bấm <strong className="font-medium text-slate-700 dark:text-slate-300">Đăng nhập qua trình duyệt</strong> và chọn tài khoản Google của bạn.
            </p>
          </div>
        ) : (
          /* Signed-Out Connect Card */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-8 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mb-4">
              <CloudUpload className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-medium text-slate-900 dark:text-slate-100 text-balance max-w-md">
              Đăng nhập Google để đồng bộ bảng đã lưu
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed">
              Tự động lưu dự án bảng trắng và ảnh PNG 4× trong thư mục riêng &ldquo;{APP_DRIVE_FOLDER_NAME}&rdquo;
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
              <span>Dùng chung dung lượng Drive cá nhân</span>
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
                  placeholder="Tìm theo tên"
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
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
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
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl px-6 py-10 text-center space-y-1.5">
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Chưa có tệp nào trong thư mục &ldquo;{APP_DRIVE_FOLDER_NAME}&rdquo;
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Bấm <strong className="font-medium text-slate-700 dark:text-slate-300">Tạo bảng mới</strong> ở góc trên hoặc lưu bản nháp hiện tại để các bảng của bạn xuất hiện tại đây.
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
                            onClick={() => setRenameTarget(file)}
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
                        onClick={() => setRenameTarget(file)}
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

      <RenameBoardModal
        isOpen={Boolean(renameTarget)}
        title="Đổi tên tệp trên Google Drive"
        initialValue={renameTarget ? getDisplayBoardTitle(renameTarget) : ''}
        isSubmitting={Boolean(drive.busyAction)}
        submittingLabel={
          renameTarget && drive.busyAction === `rename:${renameTarget.id}`
            ? 'Đang lưu...'
            : 'Lưu tên mới'
        }
        titleId="rename-board-title"
        inputId="rename-board-input"
        onClose={() => setRenameTarget(null)}
        onSubmit={handleSubmitRename}
      />

      <DeleteBoardConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Xóa tệp khỏi Google Drive?"
        description={
          deleteTarget ? (
            <>
              Bạn có chắc muốn xóa vĩnh viễn &ldquo;{deleteTarget.name}&rdquo; khỏi Google Drive? Thao tác này không thể hoàn tác.
            </>
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
