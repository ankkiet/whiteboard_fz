import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFile,
  formatFileSize,
  parsePageSelection,
  paginatePlainText,
} from './documentUtils';

test('classifyFile identifies images, PDF, Word, Excel, Slide, Text, and Other files', () => {
  assert.equal(classifyFile('diagram.png', 'image/png'), 'image');
  assert.equal(classifyFile('lecture.PDF', 'application/pdf'), 'pdf');
  assert.equal(
    classifyFile(
      'bai-giang.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ),
    'word'
  );
  assert.equal(classifyFile('old-doc.doc', ''), 'word');
  assert.equal(classifyFile('budget.xlsx', ''), 'sheet');
  assert.equal(classifyFile('deck.pptx', ''), 'slide');
  assert.equal(classifyFile('notes.txt', 'text/plain'), 'text');
  assert.equal(classifyFile('archive.zip', 'application/zip'), 'other');
});

test('formatFileSize formats bytes cleanly into B, KB, MB, GB', () => {
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(153600), '150 KB');
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
});

test('parsePageSelection handles ranges, duplicates, reversed ranges, and clamping', () => {
  assert.deepEqual(parsePageSelection('', 4), [1, 2, 3, 4]);
  assert.deepEqual(parsePageSelection('all', 3), [1, 2, 3]);
  assert.deepEqual(parsePageSelection('1-3, 5, 2, 99', 6), [1, 2, 3, 5]);
  assert.deepEqual(parsePageSelection('4-2', 5), [2, 3, 4]);
  assert.deepEqual(parsePageSelection('abc', 5), []);
});

test('paginatePlainText wraps paragraphs cleanly across A4 pages', () => {
  const longText = Array.from({ length: 40 }, (_, i) => `Dòng nội dung số ${i + 1} của tài liệu Word.`).join('\n');
  const pages = paginatePlainText(longText, 60, 15);
  assert.equal(pages.length, 3);
  assert.equal(pages[0].length, 15);
  assert.equal(pages[2].length, 10);
});
