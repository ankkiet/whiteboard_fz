import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LocalBoardMeta,
  filterAndSortLocalBoards,
  findLocalBoardByDriveFileId,
  formatLocalBoardTime,
  normalizeLocalBoardMeta,
  removeLocalBoardMeta,
  shouldPersistBoardToLibrary,
  upsertLocalBoardMeta,
} from './localBoardLibrary';

const sampleBoards: LocalBoardMeta[] = [
  {
    id: 'local_1',
    title: 'Bài giảng Đại số 10',
    boardType: 'math',
    boardPattern: 'grid',
    notebookPaperSize: 'a4',
    mathGradeMode: 'high',
    elementCount: 18,
    createdAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-24T09:00:00.000Z',
  },
  {
    id: 'local_2',
    title: 'Ghi chú Vật lý chương 2',
    boardType: 'notebook',
    boardPattern: 'lined',
    notebookPaperSize: 'a4',
    mathGradeMode: 'high',
    elementCount: 42,
    createdAt: '2026-11-21T08:00:00.000Z',
    updatedAt: '2026-11-24T10:30:00.000Z',
  },
  {
    id: 'local_3',
    title: 'Sơ đồ tư duy ôn tập',
    boardType: 'basic',
    boardPattern: 'dots',
    notebookPaperSize: 'a4',
    mathGradeMode: 'high',
    elementCount: 7,
    createdAt: '2026-11-22T08:00:00.000Z',
    updatedAt: '2026-11-23T12:00:00.000Z',
  },
];

describe('localBoardLibrary — multi-board offline index helpers', () => {
  it('upserts and keeps boards sorted by latest updatedAt', () => {
    const updated = upsertLocalBoardMeta(sampleBoards, {
      ...sampleBoards[2],
      title: 'Sơ đồ tư duy mới sửa',
      updatedAt: '2026-11-24T11:00:00.000Z',
    });

    assert.equal(updated.length, 3);
    assert.equal(updated[0].id, 'local_3');
    assert.equal(updated[0].title, 'Sơ đồ tư duy mới sửa');
    assert.equal(updated[1].id, 'local_2');
  });

  it('removes a board cleanly by id', () => {
    const remaining = removeLocalBoardMeta(sampleBoards, 'local_2');
    assert.deepEqual(
      remaining.map((b) => b.id),
      ['local_1', 'local_3']
    );
  });

  it('filters by board type and Vietnamese diacritics-insensitive query', () => {
    const byQuery = filterAndSortLocalBoards(sampleBoards, {
      filter: 'all',
      query: 'dai so',
      sort: 'updatedDesc',
    });
    assert.deepEqual(
      byQuery.map((b) => b.id),
      ['local_1']
    );

    const byType = filterAndSortLocalBoards(sampleBoards, {
      filter: 'notebook',
      query: '',
      sort: 'updatedDesc',
    });
    assert.deepEqual(
      byType.map((b) => b.id),
      ['local_2']
    );
  });

  it('sorts by updatedDesc, nameAsc, and elementsDesc', () => {
    assert.deepEqual(
      filterAndSortLocalBoards(sampleBoards, { filter: 'all', query: '', sort: 'updatedDesc' }).map(
        (b) => b.id
      ),
      ['local_2', 'local_1', 'local_3']
    );

    assert.deepEqual(
      filterAndSortLocalBoards(sampleBoards, { filter: 'all', query: '', sort: 'nameAsc' }).map(
        (b) => b.id
      ),
      ['local_1', 'local_2', 'local_3']
    );

    assert.deepEqual(
      filterAndSortLocalBoards(sampleBoards, { filter: 'all', query: '', sort: 'elementsDesc' }).map(
        (b) => b.id
      ),
      ['local_2', 'local_1', 'local_3']
    );
  });

  it('formats relative Vietnamese timestamps accurately', () => {
    const now = new Date('2026-11-24T10:30:00.000Z').getTime();
    assert.equal(formatLocalBoardTime('2026-11-24T10:29:40.000Z', now), 'Vừa xong');
    assert.equal(formatLocalBoardTime('2026-11-24T10:15:00.000Z', now), '15 phút trước');
    assert.equal(formatLocalBoardTime('2026-11-24T07:30:00.000Z', now), '3 giờ trước');
    assert.equal(formatLocalBoardTime('2026-11-22T10:30:00.000Z', now), '2 ngày trước');
  });

  it('normalizes partial metadata safely and rejects missing id', () => {
    assert.equal(normalizeLocalBoardMeta({}), null);
    const meta = normalizeLocalBoardMeta({ id: 'local_abc', title: '  Bài 1  ', elementCount: 5 });
    assert.ok(meta);
    assert.equal(meta.title, 'Bài 1');
    assert.equal(meta.boardType, 'basic');
    assert.equal(meta.elementCount, 5);
  });

  it('never persists empty or untouched template boards into the local library', () => {
    // Blank new board -> never persist
    assert.equal(
      shouldPersistBoardToLibrary({
        elementCount: 0,
        activeLocalBoardId: null,
        hasUserEditedCurrentBoard: false,
      }),
      false
    );
    // Blank board even after edit/clear -> never persist empty board
    assert.equal(
      shouldPersistBoardToLibrary({
        elementCount: 0,
        activeLocalBoardId: 'local_1',
        hasUserEditedCurrentBoard: true,
      }),
      false
    );
    // Untouched starter template (e.g. mindmap preview) -> do not persist until user edits
    assert.equal(
      shouldPersistBoardToLibrary({
        elementCount: 10,
        activeLocalBoardId: null,
        hasUserEditedCurrentBoard: false,
      }),
      false
    );
    // User wrote/drew on a new board -> persist
    assert.equal(
      shouldPersistBoardToLibrary({
        elementCount: 1,
        activeLocalBoardId: null,
        hasUserEditedCurrentBoard: true,
      }),
      true
    );
    // Existing saved board with content -> persist
    assert.equal(
      shouldPersistBoardToLibrary({
        elementCount: 5,
        activeLocalBoardId: 'local_1',
        hasUserEditedCurrentBoard: false,
      }),
      true
    );
  });

  it('links and finds local boards by driveFileId without duplicating', () => {
    const linkedMeta = normalizeLocalBoardMeta({
      id: 'local_drive_1',
      title: 'Bảng từ Drive',
      elementCount: 3,
      driveFileId: 'drive_abc',
      driveSyncedSignature: 'sig_1',
    });
    assert.ok(linkedMeta);
    assert.equal(linkedMeta.driveFileId, 'drive_abc');
    assert.equal(linkedMeta.driveSyncedSignature, 'sig_1');

    const list = upsertLocalBoardMeta(sampleBoards, linkedMeta);
    assert.equal(findLocalBoardByDriveFileId(list, 'drive_abc')?.id, 'local_drive_1');
    assert.equal(findLocalBoardByDriveFileId(list, 'missing_id'), undefined);
    assert.equal(findLocalBoardByDriveFileId(list, null), undefined);
  });
});
