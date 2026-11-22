import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBoardSignature,
  getLocalDraftActionState,
  shouldTriggerDriveAutoSave,
} from './driveSyncUtils';
import { BoardElement } from '../types/board';

const sampleRect: BoardElement = {
  id: 'el_1',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  color: '#1e293b',
  fillColor: 'transparent',
  strokeWidth: 2,
  zIndex: 1,
};

test('computeBoardSignature changes when title, element, or asset changes', () => {
  const s1 = computeBoardSignature('Bảng 1', [sampleRect], {});
  const s2 = computeBoardSignature('Bảng 1', [sampleRect], {});
  assert.equal(s1, s2);

  const sTitle = computeBoardSignature('Bảng 2', [sampleRect], {});
  assert.notEqual(s1, sTitle);

  const movedRect: BoardElement = { ...sampleRect, x: 50 };
  const sMoved = computeBoardSignature('Bảng 1', [movedRect], {});
  assert.notEqual(s1, sMoved);

  const sAsset = computeBoardSignature('Bảng 1', [sampleRect], { a1: 'data:image/png;base64,AAA' });
  assert.notEqual(s1, sAsset);
});

test('shouldTriggerDriveAutoSave skips when disabled, unauthenticated, or empty unlinked board', () => {
  const sig = computeBoardSignature('Bảng Trắng Mới', [], {});

  assert.equal(
    shouldTriggerDriveAutoSave({
      autoSaveEnabled: false,
      isAuthenticated: true,
      hasLoaded: true,
      hasActiveDriveFile: true,
      elementCount: 1,
      currentSignature: 'sig-2',
      lastSyncedSignature: 'sig-1',
      isManualActionBusy: false,
    }),
    'skip'
  );

  assert.equal(
    shouldTriggerDriveAutoSave({
      autoSaveEnabled: true,
      isAuthenticated: false,
      hasLoaded: true,
      hasActiveDriveFile: false,
      elementCount: 2,
      currentSignature: 'sig-2',
      lastSyncedSignature: null,
      isManualActionBusy: false,
    }),
    'skip'
  );

  // Blank unlinked board should not spam Drive with empty files
  assert.equal(
    shouldTriggerDriveAutoSave({
      autoSaveEnabled: true,
      isAuthenticated: true,
      hasLoaded: true,
      hasActiveDriveFile: false,
      elementCount: 0,
      currentSignature: sig,
      lastSyncedSignature: null,
      isManualActionBusy: false,
    }),
    'skip'
  );
});

test('shouldTriggerDriveAutoSave creates for non-empty unlinked board and updates linked board on diff', () => {
  assert.equal(
    shouldTriggerDriveAutoSave({
      autoSaveEnabled: true,
      isAuthenticated: true,
      hasLoaded: true,
      hasActiveDriveFile: false,
      elementCount: 1,
      currentSignature: 'sig-new',
      lastSyncedSignature: null,
      isManualActionBusy: false,
    }),
    'create'
  );

  assert.equal(
    shouldTriggerDriveAutoSave({
      autoSaveEnabled: true,
      isAuthenticated: true,
      hasLoaded: true,
      hasActiveDriveFile: true,
      elementCount: 1,
      currentSignature: 'sig-v2',
      lastSyncedSignature: 'sig-v1',
      isManualActionBusy: false,
    }),
    'update'
  );

  // Already synced -> skip
  assert.equal(
    shouldTriggerDriveAutoSave({
      autoSaveEnabled: true,
      isAuthenticated: true,
      hasLoaded: true,
      hasActiveDriveFile: true,
      elementCount: 1,
      currentSignature: 'sig-v2',
      lastSyncedSignature: 'sig-v2',
      isManualActionBusy: false,
    }),
    'skip'
  );
});

test('getLocalDraftActionState hides save button when board is already linked and synced', () => {
  assert.equal(
    getLocalDraftActionState({
      isAuthenticated: true,
      elementCount: 72,
      hasActiveDriveFile: true,
      syncStatus: 'saved',
    }),
    'synced'
  );

  assert.equal(
    getLocalDraftActionState({
      isAuthenticated: true,
      elementCount: 72,
      hasActiveDriveFile: true,
      syncStatus: 'pending',
    }),
    'update-existing'
  );

  assert.equal(
    getLocalDraftActionState({
      isAuthenticated: true,
      elementCount: 12,
      hasActiveDriveFile: false,
      syncStatus: 'idle',
    }),
    'save-new'
  );

  assert.equal(
    getLocalDraftActionState({
      isAuthenticated: true,
      elementCount: 12,
      hasActiveDriveFile: true,
      syncStatus: 'saving',
    }),
    'syncing'
  );
});
