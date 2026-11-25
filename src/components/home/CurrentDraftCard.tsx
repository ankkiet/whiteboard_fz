import React from 'react';
import { GoogleDriveWorkspaceState } from '../../hooks/useGoogleDriveWorkspace';
import { APP_DRIVE_FOLDER_NAME } from '../../services/googleDriveUtils';
import { formatSyncTime, getLocalDraftActionState } from '../../services/driveSyncUtils';
import { getBoardTypeLabel } from '../../engine/boardTemplates';
import { BoardType } from '../../types/board';
import { isDesktopApp } from '../../services/appUpdater';
import { useI18n } from '../../i18n/useI18n';
import {
  ArrowRight,
  Check,
  CloudUpload,
  ExternalLink,
  Folder,
  Loader2,
  PenTool,
} from 'lucide-react';

interface CurrentDraftCardProps {
  drive: GoogleDriveWorkspaceState;
  localTitle: string;
  localBoardType: BoardType;
  localElementCount: number;
  boardCount: number;
  imageCount: number;
  onEnterEditor: () => void;
}

export const CurrentDraftCard: React.FC<CurrentDraftCardProps> = ({
  drive,
  localTitle,
  localBoardType,
  localElementCount,
  boardCount,
  imageCount,
  onEnterEditor,
}) => {
  const { language, t } = useI18n();
  const isDesktop = isDesktopApp();
  const draftAction = getLocalDraftActionState({
    isAuthenticated: !drive.needsAuth,
    elementCount: localElementCount,
    hasActiveDriveFile: Boolean(drive.activeDriveFile),
    syncStatus: drive.syncStatus,
  });

  const itemCountLabel =
    language === 'en'
      ? `${localElementCount} ${localElementCount === 1 ? 'item' : 'items'}`
      : `${localElementCount} đối tượng`;

  return (
    <section
      id="local-draft-section"
      aria-labelledby="workspace-heading"
      className="space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <h1
          id="workspace-heading"
          className="text-2xl font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-100"
        >
          {t('Không gian bảng trắng', 'Whiteboard workspace')}
        </h1>
        {!drive.needsAuth && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            <span>{t(`${boardCount} bảng trắng`, `${boardCount} boards`)}</span>
            <span aria-hidden="true">·</span>
            <span>{t(`${imageCount} ảnh PNG`, `${imageCount} PNG images`)}</span>
            <span aria-hidden="true">·</span>
            {drive.appFolder?.webViewLink ? (
              <a
                href={drive.appFolder.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-sans font-medium transition-colors duration-150"
              >
                <Folder className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.75} />
                <span>{drive.appFolder.name}</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 font-sans">
                <Folder className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.75} />
                <span>{APP_DRIVE_FOLDER_NAME}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Current Draft Quick-Resume Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <div
            aria-hidden="true"
            className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0"
          >
            <PenTool className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {localTitle || t('Bảng trắng mới', 'Untitled board')}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700 shrink-0">
                ·
              </span>
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
                {isDesktop
                  ? t('Đang mở trên máy', 'Open on desktop')
                  : t('Đang mở trên trình duyệt', 'Open in browser')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {getBoardTypeLabel(localBoardType, language)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{itemCountLabel}</span>
              <span aria-hidden="true">·</span>
              {drive.activeDriveFile ? (
                <span className="inline-flex items-center gap-1">
                  {draftAction === 'synced' ? (
                    <>
                      <Check
                        className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                        strokeWidth={1.75}
                      />
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        {t('Đã đồng bộ Drive', 'Synced to Drive')}
                        {drive.lastSyncedAt
                          ? ` ${t('lúc', 'at')} ${formatSyncTime(drive.lastSyncedAt, language)}`
                          : ''}
                      </span>
                    </>
                  ) : draftAction === 'syncing' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 shrink-0" />
                      <span>{t('Đang đồng bộ lên Drive', 'Syncing to Drive')}</span>
                    </>
                  ) : (
                    <span>
                      {t('Có thay đổi chưa đồng bộ lên Drive', 'Unsynced changes on Drive')}
                    </span>
                  )}
                </span>
              ) : (
                <span>
                  {isDesktop
                    ? t('Tự động lưu vào thư viện trên máy', 'Auto-saved to device library')
                    : t('Tự động lưu trên trình duyệt này', 'Auto-saved in this browser')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 sm:pl-2">
          {draftAction === 'save-new' && (
            <button
              type="button"
              onClick={() => void drive.saveNewBoard({ onlyIfUnlinked: true })}
              disabled={Boolean(drive.busyAction)}
              className="h-9 flex-1 sm:flex-initial justify-center inline-flex items-center gap-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {drive.busyAction === 'save-new' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
              )}
              <span>{t('Lưu lên Drive', 'Save to Drive')}</span>
            </button>
          )}

          {draftAction === 'update-existing' && drive.activeDriveFile && (
            <button
              type="button"
              onClick={() => void drive.overwriteBoard(drive.activeDriveFile!)}
              disabled={Boolean(drive.busyAction)}
              className="h-9 flex-1 sm:flex-initial justify-center inline-flex items-center gap-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {drive.busyAction === `overwrite:${drive.activeDriveFile.id}` ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.75} />
              )}
              <span>{t('Đồng bộ ngay', 'Sync now')}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="continue-local-board-button"
            onClick={onEnterEditor}
            className="h-9 flex-1 sm:flex-initial justify-center inline-flex items-center gap-2 px-4 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white active:scale-[0.98] text-white dark:text-slate-900 text-xs font-medium transition-[background-color,transform] duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{t('Tiếp tục chỉnh sửa', 'Continue editing')}</span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </section>
  );
};
