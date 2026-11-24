import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDriveFileName,
  buildMultipartRelatedBody,
  DRIVE_FOLDER_MIME_TYPE,
  DriveWhiteboardFile,
  filterAndSortDriveFiles,
  filterOutDriveFolders,
  findUnorganizedDriveFiles,
  formatDriveErrorMessage,
  getDisplayBoardTitle,
  isDriveFolder,
  isWhiteboardProjectFile,
  parseWhiteboardPayload,
} from './googleDriveUtils';

test('buildDriveFileName sanitizes illegal characters and avoids duplicate extensions', () => {
  assert.equal(
    buildDriveFileName('Bài giảng: Toán / Chương 1?', '.whiteboard.json'),
    'Bài giảng Toán Chương 1.whiteboard.json'
  );
  assert.equal(
    buildDriveFileName('so-do.whiteboard.json', '.whiteboard.json'),
    'so-do.whiteboard.json'
  );
  assert.equal(buildDriveFileName('   ', '.png'), 'Bang-Trang-Moi.png');
});

test('getDisplayBoardTitle strips known board and image suffixes', () => {
  assert.equal(getDisplayBoardTitle({ name: 'Toán Hình Học.whiteboard.json' }), 'Toán Hình Học');
  assert.equal(getDisplayBoardTitle({ name: 'Sơ đồ tư duy.png' }), 'Sơ đồ tư duy');
  assert.equal(getDisplayBoardTitle({ name: 'backup.json' }), 'backup');
});

test('isWhiteboardProjectFile identifies board JSON files vs PNG exports', () => {
  assert.equal(
    isWhiteboardProjectFile({
      name: 'note.whiteboard.json',
      mimeType: 'application/json',
    }),
    true
  );
  assert.equal(
    isWhiteboardProjectFile({
      name: 'snapshot.png',
      mimeType: 'image/png',
      appProperties: { kind: 'png' },
    }),
    false
  );
});

test('filterAndSortDriveFiles filters by kind, supports Vietnamese diacritics-insensitive search, and sorts', () => {
  const sample: DriveWhiteboardFile[] = [
    {
      id: '1',
      name: 'Bài giảng Toán 12.whiteboard.json',
      mimeType: 'application/json',
      size: '12000',
      modifiedTime: '2026-11-19T10:00:00Z',
    },
    {
      id: '2',
      name: 'Ảnh xuất Sơ đồ.png',
      mimeType: 'image/png',
      size: '540000',
      modifiedTime: '2026-11-21T08:00:00Z',
      appProperties: { kind: 'png' },
    },
    {
      id: '3',
      name: 'Đề cương Vật Lý.whiteboard.json',
      mimeType: 'application/json',
      size: '45000',
      modifiedTime: '2026-11-20T09:00:00Z',
    },
  ];

  // Filter boards only, default modifiedDesc
  const boards = filterAndSortDriveFiles(sample, {
    filter: 'boards',
    query: '',
    sort: 'modifiedDesc',
  });
  assert.deepEqual(
    boards.map((f) => f.id),
    ['3', '1']
  );

  // Filter images only
  const images = filterAndSortDriveFiles(sample, {
    filter: 'images',
    query: '',
    sort: 'modifiedDesc',
  });
  assert.deepEqual(
    images.map((f) => f.id),
    ['2']
  );

  // Search without diacritics matches "Đề cương Vật Lý"
  const searchRes = filterAndSortDriveFiles(sample, {
    filter: 'all',
    query: 'de cuong vat ly',
    sort: 'modifiedDesc',
  });
  assert.deepEqual(
    searchRes.map((f) => f.id),
    ['3']
  );

  // Sort by sizeDesc
  const bySize = filterAndSortDriveFiles(sample, {
    filter: 'all',
    query: '',
    sort: 'sizeDesc',
  });
  assert.deepEqual(
    bySize.map((f) => f.id),
    ['2', '3', '1']
  );

  // Sort by nameAsc
  const byName = filterAndSortDriveFiles(sample, {
    filter: 'boards',
    query: '',
    sort: 'nameAsc',
  });
  assert.deepEqual(
    byName.map((f) => f.id),
    ['1', '3']
  );
});

test('formatDriveErrorMessage parses disabled Google Drive API errors with direct console link', () => {
  const formatted = formatDriveErrorMessage(
    'Google Drive API has not been used in project 557032613106 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=557032613106 then retry.'
  );
  assert.ok(formatted.message.includes('557032613106'));
  assert.equal(
    formatted.actionUrl,
    'https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=557032613106'
  );
  assert.ok(formatted.actionLabel);

  const generic = formatDriveErrorMessage('Network timeout');
  assert.equal(generic.message, 'Network timeout');
  assert.equal(generic.actionUrl, undefined);
});

test('parseWhiteboardPayload validates structure and rejects invalid files', () => {
  const valid = parseWhiteboardPayload({
    title: 'Bảng A',
    elements: [{ id: '1', type: 'rectangle' }],
    assets: { a1: 'data:image/png;base64,abc' },
  });
  assert.equal(valid.title, 'Bảng A');
  assert.equal(valid.elements.length, 1);
  assert.equal(valid.assets.a1, 'data:image/png;base64,abc');

  assert.throws(() => parseWhiteboardPayload({ title: 'No elements' }));
  assert.throws(() => parseWhiteboardPayload(null));
});

test('buildMultipartRelatedBody produces valid multipart/related payload', async () => {
  const { body, contentTypeHeader } = buildMultipartRelatedBody(
    { name: 'test.whiteboard.json', mimeType: 'application/json' },
    '{"hello":"world"}',
    'application/json',
    'test_boundary'
  );
  assert.equal(contentTypeHeader, 'multipart/related; boundary=test_boundary');
  const text = await body.text();
  assert.ok(text.includes('--test_boundary'));
  assert.ok(text.includes('"name":"test.whiteboard.json"'));
  assert.ok(text.includes('{"hello":"world"}'));
  assert.ok(text.includes('--test_boundary--'));
});

test('folder helpers exclude Drive folders and find files outside the app folder', () => {
  const folder: DriveWhiteboardFile = {
    id: 'folder_1',
    name: 'fzInK',
    mimeType: DRIVE_FOLDER_MIME_TYPE,
  };
  const insideFile: DriveWhiteboardFile = {
    id: 'file_in',
    name: 'Toán.whiteboard.json',
    mimeType: 'application/json',
    parents: ['folder_1'],
  };
  const outsideFile: DriveWhiteboardFile = {
    id: 'file_out',
    name: 'Cũ.whiteboard.json',
    mimeType: 'application/json',
    parents: ['root_id'],
  };

  assert.equal(isDriveFolder(folder), true);
  assert.equal(isWhiteboardProjectFile(folder), false);
  assert.deepEqual(
    filterOutDriveFolders([folder, insideFile, outsideFile]).map((f) => f.id),
    ['file_in', 'file_out']
  );
  assert.deepEqual(
    findUnorganizedDriveFiles([folder, insideFile, outsideFile], 'folder_1').map((f) => f.id),
    ['file_out']
  );
});
