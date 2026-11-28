import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUpdateOriginCandidates,
  classifyDesktopUpdateKind,
  classifyUpdateCheckFailure,
  compareVersionStrings,
  formatVersionJsonpScript,
  isAiStudioPreviewOrigin,
  isLocalhostOrigin,
  resolveEffectiveVersionConfig,
  resolveOtaBundleUrl,
  shouldPromptDesktopUpdate,
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

  it('returns empty candidates when file:// build has no embedded updateOrigin and no fallback', () => {
    assert.deepEqual(buildUpdateOriginCandidates('file:', 'null', ''), []);
  });

  it('appends production Cloudflare fallback origin when provided for file:// builds', () => {
    assert.deepEqual(
      buildUpdateOriginCandidates('file:', 'null', 'https://ais-dev-demo.run.app', 'https://whiteboardfz.pages.dev'),
      [
        'https://ais-dev-demo.run.app',
        'https://ais-pre-demo.run.app',
        'https://whiteboardfz.pages.dev',
      ]
    );
  });

  it('uses fallback origin directly when file:// build has empty embedded updateOrigin', () => {
    assert.deepEqual(
      buildUpdateOriginCandidates('file:', 'null', '', 'https://whiteboardfz.pages.dev'),
      ['https://whiteboardfz.pages.dev']
    );
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

  it('compares fzInK version strings numerically (including multi-digit segments)', () => {
    assert.equal(compareVersionStrings('v_fz.1.1.1.1.8', 'v_fz.1.1.1.1.8'), 0);
    assert.ok(compareVersionStrings('v_fz.1.1.1.1.9', 'v_fz.1.1.1.1.8') > 0);
    assert.ok(compareVersionStrings('v_fz.1.1.1.1.10', 'v_fz.1.1.1.1.9') > 0);
    assert.ok(compareVersionStrings('v_fz.1.1.1.1.7', 'v_fz.1.1.1.1.8') < 0);
  });

  it('never reports false update when installed version equals latest even if buildId differs across CI OSes', () => {
    assert.equal(
      shouldPromptDesktopUpdate({
        installedVersion: 'v_fz.1.1.1.1.8',
        installedBuildId: 'win-gh-actions-hash',
        latest: { version: 'v_fz.1.1.1.1.8', buildId: 'linux-cloudflare-hash' },
      }),
      false
    );

    // Installed newer than stale CDN cache -> also false
    assert.equal(
      shouldPromptDesktopUpdate({
        installedVersion: 'v_fz.1.1.1.1.9',
        installedBuildId: 'new-hash',
        latest: { version: 'v_fz.1.1.1.1.8', buildId: 'old-hash' },
      }),
      false
    );

    // Genuine newer version available -> true
    assert.equal(
      shouldPromptDesktopUpdate({
        installedVersion: 'v_fz.1.1.1.1.8',
        installedBuildId: 'old-hash',
        latest: { version: 'v_fz.1.1.1.1.9', buildId: 'new-hash' },
      }),
      true
    );
  });

  it('classifies 2-tier desktop updates between fast OTA and full native installer', () => {
    const otaLatest = {
      version: 'v_fz.1.1.1.2.13',
      buildId: 'web-hash-2',
      nativeVersion: '1.2.12',
      minNativeVersion: '1.2.12',
      otaBundleUrl: 'web-update.zip',
      otaBundleSha256: 'abc123',
    };

    assert.equal(
      classifyDesktopUpdateKind({
        installedVersion: 'v_fz.1.1.1.2.13',
        installedNativeVersion: '1.2.12',
        hasOtaBridge: true,
        latest: otaLatest,
      }),
      'none'
    );

    assert.equal(
      classifyDesktopUpdateKind({
        installedVersion: 'v_fz.1.1.1.2.12',
        installedNativeVersion: '1.2.12',
        hasOtaBridge: true,
        latest: otaLatest,
      }),
      'ota'
    );

    assert.equal(
      classifyDesktopUpdateKind({
        installedVersion: 'v_fz.1.1.1.2.12',
        installedNativeVersion: '1.2.12',
        hasOtaBridge: false,
        latest: otaLatest,
      }),
      'native'
    );

    assert.equal(
      classifyDesktopUpdateKind({
        installedVersion: 'v_fz.1.1.1.2.13',
        installedNativeVersion: '1.2.12',
        hasOtaBridge: true,
        latest: {
          ...otaLatest,
          version: 'v_fz.1.1.1.3.0',
          nativeVersion: '1.3.0',
          minNativeVersion: '1.3.0',
        },
      }),
      'native'
    );
  });

  it('resolves OTA bundle URLs and effective version configs cleanly', () => {
    assert.equal(
      resolveOtaBundleUrl('https://whiteboardfz.pages.dev/', 'web-update.zip'),
      'https://whiteboardfz.pages.dev/web-update.zip'
    );
    assert.equal(
      resolveOtaBundleUrl('https://whiteboardfz.pages.dev', 'https://cdn.example.com/ota.zip'),
      'https://cdn.example.com/ota.zip'
    );
    assert.equal(resolveOtaBundleUrl('', 'web-update.zip'), null);

    assert.deepEqual(
      resolveEffectiveVersionConfig({
        packageVersion: '1.2.12',
        versionConfig: {
          version: 'v_fz.1.1.1.2.12',
          minNativeVersion: '1.2.12',
          notes: 'Hotfix',
        },
      }),
      {
        version: 'v_fz.1.1.1.2.12',
        nativeVersion: '1.2.12',
        minNativeVersion: '1.2.12',
        notes: 'Hotfix',
      }
    );

    // Bumping package.json above version.json minNativeVersion automatically lifts minNativeVersion while keeping v_fz.* version
    assert.deepEqual(
      resolveEffectiveVersionConfig({
        packageVersion: '1.3.0',
        versionConfig: {
          version: 'v_fz.1.1.1.3.0',
          minNativeVersion: '1.2.12',
          notes: 'Major upgrade',
        },
      }),
      {
        version: 'v_fz.1.1.1.3.0',
        nativeVersion: '1.3.0',
        minNativeVersion: '1.3.0',
        notes: 'Major upgrade',
      }
    );
  });
});
