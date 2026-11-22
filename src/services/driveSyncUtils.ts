import { BoardElement } from '../types/board';

export type DriveSyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Produces a fast, deterministic fingerprint of the board's title, elements, and assets
 * so auto-save only fires when meaningful board content actually changes.
 */
export function computeBoardSignature(
  title: string,
  elements: BoardElement[],
  assets: Record<string, string>
): string {
  const assetEntries = Object.keys(assets)
    .sort()
    .map((key) => {
      const val = assets[key] || '';
      return `${key}:${val.length}:${val.slice(0, 24)}:${val.slice(-16)}`;
    });

  return JSON.stringify({
    t: title || 'Bảng Trắng Mới',
    e: elements,
    a: assetEntries,
  });
}

export interface AutoSaveDecisionInput {
  autoSaveEnabled: boolean;
  isAuthenticated: boolean;
  hasLoaded: boolean;
  hasActiveDriveFile: boolean;
  elementCount: number;
  currentSignature: string;
  lastSyncedSignature: string | null;
  isManualActionBusy: boolean;
}

/**
 * Pure decision rule for Google Drive auto-save:
 * - Never auto-saves when disabled, signed out, still loading, or during manual Drive operations.
 * - Never creates blank empty files on Drive when no Drive file is linked yet.
 * - Updates linked Drive files whenever content or title changes (even if cleared).
 */
export function shouldTriggerDriveAutoSave(
  input: AutoSaveDecisionInput
): 'create' | 'update' | 'skip' {
  if (
    !input.autoSaveEnabled ||
    !input.isAuthenticated ||
    !input.hasLoaded ||
    input.isManualActionBusy
  ) {
    return 'skip';
  }

  if (input.lastSyncedSignature !== null && input.currentSignature === input.lastSyncedSignature) {
    return 'skip';
  }

  if (input.hasActiveDriveFile) {
    return 'update';
  }

  if (input.elementCount > 0) {
    return 'create';
  }

  return 'skip';
}

export function formatSyncTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export type LocalDraftActionKind = 'none' | 'synced' | 'syncing' | 'update-existing' | 'save-new';

/**
 * Determines what Drive action/status should appear on the Home Page's local draft strip:
 * - Already linked & saved: never prompt to save again (show clean "synced" status).
 * - Already linked & has unsaved changes (pending/error/idle with auto-save off): offer "update-existing".
 * - Unlinked non-empty local draft while signed in: offer "save-new".
 */
export function getLocalDraftActionState(input: {
  isAuthenticated: boolean;
  elementCount: number;
  hasActiveDriveFile: boolean;
  syncStatus: DriveSyncStatus;
}): LocalDraftActionKind {
  if (!input.isAuthenticated) return 'none';
  if (input.syncStatus === 'saving') return 'syncing';

  if (input.hasActiveDriveFile) {
    if (input.syncStatus === 'saved') return 'synced';
    if (input.syncStatus === 'pending' || input.syncStatus === 'error') {
      return 'update-existing';
    }
    return 'synced';
  }

  if (input.elementCount > 0) {
    return 'save-new';
  }

  return 'none';
}
