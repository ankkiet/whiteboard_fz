import React, { useMemo, useRef, useState } from 'react';
import { useBoardStore } from '../../store/useBoardStore';
import {
  LocalBoardFilter,
  LocalBoardMeta,
  LocalBoardSort,
  filterAndSortLocalBoards,
  formatLocalBoardTime,
} from '../../services/localBoardLibrary';
import { parseWhiteboardPayload } from '../../services/googleDriveUtils';
import { BOARD_TEMPLATES, getBoardTypeLabel } from '../../engine/boardTemplates';
import { isDesktopApp } from '../modals/DesktopAppModal';
import { BoardTemplatePreview } from './BoardTemplatePreview';
import {
  AlertTriangle,
  Copy,
  FileUp,
  FolderOpen,
  Globe,
  HardDrive,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface LocalBoardsSectionProps {
  onOpenBoard: () => void;
  onCreateNewClick: () => void;
  onBoardOpenedFromLocal: () => void;
}

export const LocalBoardsSection: React.FC<LocalBoardsSectionProps> = ({
  onOpenBoard,
  onCreateNewClick,
  onBoardOpenedFromLocal,
}) => {
  const localBoards = useBoardStore((s) => s.localBoards);
  const activeLocalBoardId = useBoardStore((s) => s.activeLocalBoardId);
  const isLoadingLocalBoards = useBoardStore((s) => s.isLoadingLocalBoards);
  const openLocalBoard = useBoardStore((s) => s.openLocalBoard);
  const renameLocalBoardById = useBoardStore((s) => s.renameLocalBoardById);
  const duplicateLocalBoardById = useBoardStore((s) => s.duplicateLocalBoardById);
  const deleteLocalBoardById = useBoardStore((s) => s.deleteLocalBoardById);
  const importBoardData = useBoardStore((s) => s.importBoardData);
  const addToast = useBoardStore((s) => s.addToast);

  const [filter, setFilter] = useState<LocalBoardFilter>('all');
  const [sort, setSort] = useState<LocalBoardSort>('updatedDesc');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<LocalBoardMeta | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocalBoardMeta | null>(null);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = isDesktopApp();

  const copy = isDesktop
    ? {
        heading: 'Thư viện bảng trên máy',
        badgeSuffix: 'Lưu trên máy tính',
        filterAria: 'Lọc loại bảng trên máy',
        searchPlaceholder: 'Tìm bảng trên máy...',
        sortAria: 'Sắp xếp bảng trên máy',
        gridAria: 'Hiển thị bảng trên máy dạng lưới',
        listAria: 'Hiển thị bảng trên máy dạng danh sách',
        emptyTitle: 'Chưa có bảng nào được lưu trên máy',
        emptyDesc:
          'Khi bạn bắt đầu viết hoặc vẽ trên một bảng mới, bảng đó sẽ tự động lưu trực tiếp trên ổ cứng máy tính (hoạt động 100% không cần mạng) và hiển thị tại đây.',
        emptyFilter: 'Không tìm thấy bảng nào trên máy khớp với bộ lọc hiện tại.',
        deleteTooltip: 'Xóa khỏi máy',
        renameTitle: 'Đổi tên bảng trên máy',
        deleteTitle: 'Xóa bảng khỏi máy?',
        deleteDescSuffix: 'khỏi bộ nhớ máy tính',
      }
    : {
        heading: 'Thư viện bảng trên trình duyệt',
        badgeSuffix: 'Lưu trên trình duyệt này',
        filterAria: 'Lọc loại bảng trên trình duyệt',
        searchPlaceholder: 'Tìm bảng trên trình duyệt...',
        sortAria: 'Sắp xếp bảng trên trình duyệt',
        gridAria: 'Hiển thị bảng trên trình duyệt dạng lưới',
        listAria: 'Hiển thị bảng trên trình duyệt dạng danh sách',
        emptyTitle: 'Chưa có bảng nào được lưu trên trình duyệt',
        emptyDesc:
          'Khi bạn bắt đầu viết hoặc vẽ trên một bảng mới, bảng đó sẽ tự động lưu trong bộ nhớ trình duyệt này (có thể mất nếu bạn xóa dữ liệu web). Hãy đăng nhập Google Drive hoặc tải ứng dụng máy tính để lưu lâu dài.',
        emptyFilter: 'Không tìm thấy bảng nào trên trình duyệt khớp với bộ lọc hiện tại.',
        deleteTooltip: 'Xóa khỏi trình duyệt',
        renameTitle: 'Đổi tên bảng trên trình duyệt',
        deleteTitle: 'Xóa bảng khỏi trình duyệt?',
        deleteDescSuffix: 'khỏi bộ nhớ trình duyệt này',
      };

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of localBoards) {
      counts[b.boardType] = (counts[b.boardType] || 0) + 1;
    }
    return counts;
  }, [localBoards]);

  const visibleBoards = useMemo(
    () => filterAndSortLocalBoards(localBoards, { filter, query, sort }),
    [localBoards, filter, query, sort]
  );

  const handleOpen = async (board: LocalBoardMeta) => {
    setBusyId(`open:${board.id}`);
    try {
      const ok = await openLocalBoard(board.id);
      if (ok) {
        onBoardOpenedFromLocal();
        onOpenBoard();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (board: LocalBoardMeta) => {
    setBusyId(`dup:${board.id}`);
    try {
      await duplicateLocalBoardById(board.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenRename = (board: LocalBoardMeta) => {
    setRenameTarget(board);
    setRenameValue(board.title);
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
    setBusyId(`rename:${renameTarget.id}`);
    try {
      const ok = await renameLocalBoardById(renameTarget.id, trimmed);
      if (ok) {
        setRenameTarget(null);
        setRenameValue('');
        setRenameError(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setBusyId(`delete:${target.id}`);
    try {
      await deleteLocalBoardById(target.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseWhiteboardPayload(JSON.parse(text));
      if (!parsed) {
        addToast('Tệp không đúng định dạng dự án .whiteboard.json.', 'error');
        return;
      }
      onBoardOpenedFromLocal();
      importBoardData({
        title: parsed.title || file.name.replace(/\.whiteboard\.json$|\.json$/i, ''),
        elements: parsed.elements,
        assets: parsed.assets,
        boardType: parsed.boardType,
        boardPattern: parsed.boardPattern,
        resetHistory: true,
      });
      onOpenBoard();
    } catch {
      addToast('Không thể đọc tệp .whiteboard.json này.', 'error');
    }
  };

  return (
    <section
      id="local-boards-section"
      data-testid="local-boards-section"
      aria-labelledby="local-boards-heading"
      className="space-y-4"
    >
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,.whiteboard.json"
        onChange={(e) => void handleImportJsonFile(e)}
        className="hidden"
        aria-hidden="true"
      />

      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="local-boards-heading"
            className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"
          >
            {isDesktop ? (
              <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            ) : (
              <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            )}
            <span>{copy.heading}</span>
          </h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">
            {localBoards.length} bảng · {copy.badgeSuffix}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Mở tệp .json</span>
          </button>
          <button
            type="button"
            onClick={onCreateNewClick}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm bảng</span>
          </button>
        </div>
      </div>

      {/* Filter, Search, Sort & Layout Controls */}
      {localBoards.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Board Type Filter Pills */}
          <div
            role="tablist"
            aria-label={copy.filterAria}
            className="inline-flex flex-wrap items-center gap-0.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              onClick={() => setFilter('all')}
              className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Tất cả ({localBoards.length})
            </button>
            {BOARD_TEMPLATES.filter((tpl) => (countsByType[tpl.id] || 0) > 0).map((tpl) => {
              const active = filter === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tpl.id)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tpl.shortName} ({countsByType[tpl.id]})
                </button>
              );
            })}
          </div>

          {/* Search + Sort + Grid/List */}
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
                aria-label={copy.searchPlaceholder}
                placeholder={copy.searchPlaceholder}
                className="h-9 w-full pl-8 pr-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-500 transition-colors"
              />
            </div>

            <select
              aria-label={copy.sortAria}
              value={sort}
              onChange={(e) => setSort(e.target.value as LocalBoardSort)}
              className="h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
            >
              <option value="updatedDesc">Mới cập nhật</option>
              <option value="nameAsc">Tên A → Z</option>
              <option value="elementsDesc">Nhiều nội dung nhất</option>
            </select>

            <div className="h-9 inline-flex items-center p-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label={copy.gridAria}
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
                aria-label={copy.listAria}
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
      )}

      {/* Content Area */}
      {isLoadingLocalBoards && localBoards.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden animate-pulse"
            >
              <div className="h-28 bg-slate-100 dark:bg-slate-800/80" />
              <div className="p-3.5 space-y-2">
                <div className="h-3.5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70" />
              </div>
            </div>
          ))}
        </div>
      ) : localBoards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl px-6 py-9 text-center space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {copy.emptyTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {copy.emptyDesc}
          </p>
        </div>
      ) : visibleBoards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-8 text-center space-y-3">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {copy.emptyFilter}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleBoards.map((board) => {
            const isCurrent = activeLocalBoardId === board.id;
            const isBusy = busyId !== null;
            return (
              <article
                key={board.id}
                data-testid={`local-board-card-${board.id}`}
                className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden flex flex-col transition-colors ${
                  isCurrent
                    ? 'border-indigo-500 dark:border-indigo-500 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleOpen(board)}
                  aria-label={`Mở bảng ${board.title}`}
                  className="relative h-28 w-full border-b border-slate-100 dark:border-slate-800 block text-left cursor-pointer group focus-visible:outline-none overflow-hidden"
                >
                  <div className="w-full h-full group-hover:scale-[1.03] transition-transform duration-200">
                    <BoardTemplatePreview type={board.boardType} className="w-full h-full" />
                  </div>
                  {isCurrent && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600/95 text-white text-[10px] font-semibold shadow-xs">
                      Đang mở
                    </span>
                  )}
                </button>

                <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {board.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{getBoardTypeLabel(board.boardType)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{board.elementCount} đối tượng</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatLocalBoardTime(board.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleOpen(board)}
                      className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{isCurrent ? 'Tiếp tục' : 'Mở'}</span>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDuplicate(board)}
                        aria-label={`Nhân bản ${board.title}`}
                        title="Nhân bản"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleOpenRename(board)}
                        aria-label={`Đổi tên ${board.title}`}
                        title="Đổi tên"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setDeleteTarget(board)}
                        aria-label={`Xóa ${board.title}`}
                        title={copy.deleteTooltip}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200/80 dark:divide-slate-800">
          {visibleBoards.map((board) => {
            const isCurrent = activeLocalBoardId === board.id;
            const isBusy = busyId !== null;
            return (
              <div
                key={board.id}
                className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleOpen(board)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="w-11 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <BoardTemplatePreview type={board.boardType} className="w-full h-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {board.title}
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold shrink-0">
                          Đang mở
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                      {getBoardTypeLabel(board.boardType)} · {board.elementCount} đối tượng ·{' '}
                      {formatLocalBoardTime(board.updatedAt)}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleOpen(board)}
                    className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{isCurrent ? 'Tiếp tục' : 'Mở'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDuplicate(board)}
                    aria-label={`Nhân bản ${board.title}`}
                    title="Nhân bản"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleOpenRename(board)}
                    aria-label={`Đổi tên ${board.title}`}
                    title="Đổi tên"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setDeleteTarget(board)}
                    aria-label={`Xóa ${board.title}`}
                    title="Xóa khỏi máy"
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

      {/* Rename Local Board Modal */}
      {renameTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-local-board-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyId) setRenameTarget(null);
          }}
        >
          <form
            onSubmit={(e) => void handleSubmitRename(e)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 id="rename-local-board-title" className="text-base font-bold">
                {copy.renameTitle}
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
                htmlFor="rename-local-board-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Tên mới
              </label>
              <input
                id="rename-local-board-input"
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
                disabled={Boolean(busyId)}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                Lưu tên mới
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Local Board Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-local-board-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyId) setDeleteTarget(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 id="delete-local-board-title" className="text-sm font-bold">
                  {copy.deleteTitle}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed break-words">
                  Bạn có chắc muốn xóa vĩnh viễn &ldquo;{deleteTarget.title}&rdquo; {copy.deleteDescSuffix}? Thao tác này không thể hoàn tác.
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
    </section>
  );
};
