import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUpdateOriginCandidates,
  classifyUpdateCheckFailure,
  formatVersionJsonpScript,
  isAiStudioPreviewOrigin,
  isLocalhostOrigin,
} from './versionCheck';

describe('versionCheck — update origin resolution and honest failure classification', () => {
  it('uses current origin when running on http/https', () => {
    assert.deepEqual(
      buildUpdateOriginCandidates('https:', 'https://ais-dev-demo.asia-northeast1.run.app/', 'https://ignored.example'),
      ['https://ais-dev-demo.asia-northeast1.run.app']
    );
  });

  it('includes sibling ais-pre origin fallback when running from file:// with an ais-dev origin', () => {
    assert.deepEqual(
      buildUpdateOriginCandidates(
        'file:',
        'null',
        'https://ais-dev-qtj5cexjmyqzlcadgs6erw-750670418863.asia-northeast1.run.app/'
      ),
      [
        'https://ais-dev-qtj5cexjmyqzlcadgs6erw-750670418863.asia-northeast1.run.app',
        'https://ais-pre-qtj5cexjmyqzlcadgs6erw-750670418863.asia-northeast1.run.app',
      ]
    );
  });

  it('returns empty candidates when file:// build has no embedded updateOrigin', () => {
    assert.deepEqual(buildUpdateOriginCandidates('file:', 'null', ''), []);
  });

  it('never classifies as offline when navigator.onLine is true and AI Studio 403/CORS blocks file://', () => {
    const res = classifyUpdateCheckFailure({
      isOnline: true,
      protocol: 'file:',
      primaryOrigin: 'https://ais-dev-qtj5cexjmyqzlcadgs6erw-750670418863.asia-northeast1.run.app',
      httpStatuses: [403],
      hadNetworkOrCorsError: true,
    });
    assert.equal(res.reason, 'auth-or-cors-blocked');
    assert.equal(res.httpStatus, 403);
    assert.equal(
      res.portalUrl,
      'https://ais-dev-qtj5cexjmyqzlcadgs6erw-750670418863.asia-northeast1.run.app'
    );
  });

  it('classifies localhost connection refusal from file:// as local-server-stopped', () => {
    const res = classifyUpdateCheckFailure({
      isOnline: true,
      protocol: 'file:',
      primaryOrigin: 'http://localhost:3000',
      hadNetworkOrCorsError: true,
    });
    assert.equal(res.reason, 'local-server-stopped');
    assert.equal(res.portalUrl, 'http://localhost:3000');
  });

  it('classifies genuinely offline device as offline', () => {
    const res = classifyUpdateCheckFailure({
      isOnline: false,
      protocol: 'file:',
      primaryOrigin: 'https://ais-dev-demo.asia-northeast1.run.app',
      hadNetworkOrCorsError: true,
    });
    assert.equal(res.reason, 'offline');
  });

  it('classifies missing updateOrigin as no-update-origin when online', () => {
    const res = classifyUpdateCheckFailure({
      isOnline: true,
      protocol: 'file:',
      primaryOrigin: '',
    });
    assert.equal(res.reason, 'no-update-origin');
  });

  it('detects localhost and AI Studio preview origins accurately', () => {
    assert.equal(isLocalhostOrigin('http://localhost:3000'), true);
    assert.equal(isLocalhostOrigin('https://ais-dev-abc.asia-northeast1.run.app'), false);
    assert.equal(isAiStudioPreviewOrigin('https://ais-dev-abc.asia-northeast1.run.app'), true);
    assert.equal(isAiStudioPreviewOrigin('https://example.com'), false);
  });

  it('formats CORS-free JSONP script cleanly', () => {
    const script = formatVersionJsonpScript({
      version: '1.2.abcd',
      buildId: 'abcdef123456',
      notes: 'Test note',
    });
    assert.ok(script.includes('window.__BTTM_VERSION_CALLBACK__'));
    assert.ok(script.includes('"buildId":"abcdef123456"'));
  });
});
