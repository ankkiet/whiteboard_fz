import React from 'react';
import { GoogleDriveWorkspaceState } from '../../hooks/useGoogleDriveWorkspace';
import { APP_DRIVE_FOLDER_NAME } from '../../services/googleDriveUtils';
import { formatSyncTime, getLocalDraftActionState } from '../../services/driveSyncUtils';
import { getBoardTypeLabel } from '../../engine/boardTemplates';
import { BoardType } from '../../types/board';
import { isDesktopApp } from '../../services/appUpdater';
import { useI18n } from '../../i18n/useI18n';
import { BoardTemplatePreview } from './BoardTemplatePreview';
import {
  ArrowRight,
  Check,
  CloudUpload,
  ExternalLink,
  Folder,
  Loader2,
} from 'lucide-react';

interface CurrentDraftCardProps {
  drive: GoogleDriveWorkspaceState;
  localTitle: string;
  localBoardType: BoardType;
  localElementCount: number;
  localBoardCount?: number;
  boardCount: number;
  imageCount: number;
  onEnterEditor: () => void;
}

export const CurrentDraftCard: React.FC<CurrentDraftCardProps> = ({
  drive,
  localTitle,
  localBoardType,
  localElementCount,
  localBoardCount = 0,
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
      className="space-y-5"
    >
      {/* Opening Workspace Masthead */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <h1
            id="workspace-heading"
            className="text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-slate-900 dark:text-slate-100"
          >
            {t('Không gian bảng trắng', 'Whiteboard workspace')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {t(
              'Tiếp tục bảng đang làm việc hoặc mở một mặt giấy mới bên dưới.',
              'Resume your active canvas or start from a fresh board surface below.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
          {!drive.needsAuth ? (
            <>
              <span>{t(`${boardCount} bảng trên Drive`, `${boardCount} Drive boards`)}</span>
              <span aria-hidden="true">·</span>
              <span>{t(`${imageCount} ảnh PNG`, `${imageCount} PNG images`)}</span>
              <span aria-hidden="true">·</span>
              {drive.appFolder?.webViewLink ? (
                <a
                  href={drive.appFolder.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 hover:text-[#1d5fbf] dark:hover:text-[#669df6] font-medium transition-colors duration-150"
                >
                  <Folder className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
                  <span>{drive.appFolder.name}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Folder className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.75} />
                  <span>{APP_DRIVE_FOLDER_NAME}</span>
                </span>
              )}
            </>
          ) : (
            <span>
              {isDesktop
                ? t(`${localBoardCount} bảng lưu trên máy`, `${localBoardCount} local boards`)
                : t(`${localBoardCount} bảng trên trình duyệt`, `${localBoardCount} browser boards`)}
            </span>
          )}
        </div>
      </div>

      {/* Architectural Horizontal Active Draft Strip */}
      <div className="bg-white dark:bg-[#19191d] border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden flex flex-col sm:flex-row sm:items-stretch justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center min-w-0 flex-1">
          <div className="w-full h-24 sm:w-44 sm:h-full sm:min-h-[96px] border-b sm:border-b-0 sm:border-r border-slate-200/80 dark:border-slate-800/80 shrink-0 overflow-hidden">
            <BoardTemplatePreview type={localBoardType} className="w-full h-full" />
          </div>

          <div className="min-w-0 px-4 py-4 sm:px-5 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                {localTitle || t('Bảng trắng mới', 'Untitled board')}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700 shrink-0">
                ·
              </span>
              <span className="text-xs font-medium text-[#1d5fbf] dark:text-[#669df6] shrink-0">
                {isDesktop
                  ? t('Đang mở trên máy', 'Open on desktop')
                  : t('Đang mở trên trình duyệt', 'Open in browser')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-slate-600 dark:text-slate-400 tabular-nums">
              <span className="inline-flex items-center gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {getBoardTypeLabel(localBoardType, language)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{itemCountLabel}</span>
              </span>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
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

        <div className="px-4 pb-4 sm:px-5 sm:py-4 flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          {draftAction === 'save-new' && (
            <button
              type="button"
              onClick={() => void drive.saveNewBoard({ onlyIfUnlinked: true })}
              disabled={Boolean(drive.busyAction)}
              className="h-10 flex-1 sm:flex-initial justify-center inline-flex items-center gap-2 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
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
              className="h-10 flex-1 sm:flex-initial justify-center inline-flex items-center gap-2 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
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
            className="h-10 flex-1 sm:flex-initial justify-center inline-flex items-center gap-2 px-4 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white active:scale-[0.98] text-white dark:text-slate-900 text-[13px] font-medium transition-[background-color,transform] duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{t('Tiếp tục chỉnh sửa', 'Continue editing')}</span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </section>
  );
};
