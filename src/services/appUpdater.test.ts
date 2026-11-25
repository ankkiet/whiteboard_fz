import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDownloadEta } from './appUpdater';

describe('appUpdater — download ETA formatting', () => {
  it('returns empty string when speed is zero or download is complete', () => {
    assert.equal(formatDownloadEta(1000, 10000, 0, 'vi'), '');
    assert.equal(formatDownloadEta(10000, 10000, 1024, 'vi'), '');
  });

  it('formats seconds and minutes in Vietnamese and English', () => {
    assert.equal(formatDownloadEta(0, 10_000, 1000, 'vi'), 'Còn ~10 giây');
    assert.equal(formatDownloadEta(0, 10_000, 1000, 'en'), '~10s left');
    assert.equal(formatDownloadEta(0, 120_000, 1000, 'vi'), 'Còn ~2 phút');
    assert.equal(formatDownloadEta(0, 75_000, 1000, 'vi'), 'Còn ~1 phút 15 giây');
    assert.equal(formatDownloadEta(0, 75_000, 1000, 'en'), '~1m 15s left');
  });
});
