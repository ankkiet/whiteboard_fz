const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const otaUpdater = require('./otaUpdater.cjs');

const tempDirs = [];
function makeTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors on temp dirs
    }
  }
});

describe('otaUpdater — ZIP packaging, integrity verification, and 2-tier resolution', () => {
  it('packs and extracts a directory cleanly while honoring exclude filters', () => {
    const srcDir = makeTempDir('fzink-ota-src-');
    const destDir = makeTempDir('fzink-ota-dest-');
    const zipPath = path.join(makeTempDir('fzink-ota-zip-'), 'web-update.zip');

    fs.mkdirSync(path.join(srcDir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(srcDir, 'demo'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'index.html'), '<!doctype html><html><body>fzInK OTA</body></html>', 'utf8');
    fs.writeFileSync(path.join(srcDir, 'assets', 'app.js'), 'console.log("hello fzInK");\n'.repeat(20), 'utf8');
    fs.writeFileSync(path.join(srcDir, 'demo', 'skip.png'), Buffer.from([1, 2, 3, 4]));

    const archiveInfo = otaUpdater.createZipFromDirectory(srcDir, zipPath, {
      exclude: (rel) => rel.startsWith('demo/'),
    });

    assert.equal(archiveInfo.fileCount, 2);
    assert.ok(archiveInfo.sizeBytes > 0);
    assert.equal(archiveInfo.sha256.length, 64);

    const extractedCount = otaUpdater.extractZipFile(zipPath, destDir);
    assert.equal(extractedCount, 2);
    assert.equal(
      fs.readFileSync(path.join(destDir, 'index.html'), 'utf8'),
      '<!doctype html><html><body>fzInK OTA</body></html>'
    );
    assert.equal(
      fs.readFileSync(path.join(destDir, 'assets', 'app.js'), 'utf8'),
      'console.log("hello fzInK");\n'.repeat(20)
    );
    assert.equal(fs.existsSync(path.join(destDir, 'demo', 'skip.png')), false);
  });

  it('rejects OTA installation when SHA-256 checksum does not match', () => {
    const srcDir = makeTempDir('fzink-ota-sha-src-');
    const userDataDir = makeTempDir('fzink-ota-ud-');
    const zipPath = path.join(makeTempDir('fzink-ota-sha-zip-'), 'web-update.zip');

    fs.writeFileSync(path.join(srcDir, 'index.html'), '<html></html>', 'utf8');
    otaUpdater.createZipFromDirectory(srcDir, zipPath);

    assert.throws(
      () =>
        otaUpdater.installOtaFromZip({
          userDataDir,
          zipPath,
          expectedSha256: '0'.repeat(64),
          targetVersion: '1.2.12.1',
          targetBuildId: 'abc123',
          nativeVersion: '1.2.12',
        }),
      /SHA-256/
    );
  });

  it('activates OTA updates on matching native shell and cleans up after native upgrade', () => {
    const userDataDir = makeTempDir('fzink-ota-userdata-');
    const bundledDistDir = makeTempDir('fzink-ota-bundled-');
    const otaBuild1Dir = makeTempDir('fzink-ota-b1-');
    const otaBuild2Dir = makeTempDir('fzink-ota-b2-');
    const zipDir = makeTempDir('fzink-ota-zips-');

    const writeEmbeddedHtml = (dir, version) => {
      const manifest = { version, nativeVersion: '1.2.12', buildId: `b-${version}` };
      fs.writeFileSync(
        path.join(dir, 'index.html'),
        `<head><script>window.__BTTM_EMBEDDED_BUILD__=${JSON.stringify(manifest)};</script></head>`,
        'utf8'
      );
    };

    writeEmbeddedHtml(bundledDistDir, 'v_fz.1.1.1.2.12');
    writeEmbeddedHtml(otaBuild1Dir, 'v_fz.1.1.1.2.13');
    writeEmbeddedHtml(otaBuild2Dir, 'v_fz.1.1.1.2.14');

    // Before any OTA -> resolves to bundled dist
    const initialEntry = otaUpdater.resolveWebEntry({
      userDataDir,
      bundledDistDir,
      nativeVersion: '1.2.12',
    });
    assert.equal(initialEntry.isOta, false);
    assert.equal(initialEntry.entryHtmlPath, path.join(bundledDistDir, 'index.html'));

    // Install OTA v_fz.1.1.1.2.13
    const zip1Path = path.join(zipDir, 'ota1.zip');
    const zip1Info = otaUpdater.createZipFromDirectory(otaBuild1Dir, zip1Path);
    const install1 = otaUpdater.installOtaFromZip({
      userDataDir,
      zipPath: zip1Path,
      expectedSha256: zip1Info.sha256,
      targetVersion: 'v_fz.1.1.1.2.13',
      targetBuildId: 'b-v_fz.1.1.1.2.13',
      nativeVersion: '1.2.12',
    });

    const afterOta1 = otaUpdater.resolveWebEntry({
      userDataDir,
      bundledDistDir,
      nativeVersion: '1.2.12',
    });
    assert.equal(afterOta1.isOta, true);
    assert.equal(afterOta1.activeVersion, 'v_fz.1.1.1.2.13');
    assert.equal(afterOta1.entryHtmlPath, install1.entryHtmlPath);

    // Install OTA v_fz.1.1.1.2.14 and verify old OTA 1 folder gets pruned on next startup resolution
    const zip2Path = path.join(zipDir, 'ota2.zip');
    const zip2Info = otaUpdater.createZipFromDirectory(otaBuild2Dir, zip2Path);
    const install2 = otaUpdater.installOtaFromZip({
      userDataDir,
      zipPath: zip2Path,
      expectedSha256: zip2Info.sha256,
      targetVersion: 'v_fz.1.1.1.2.14',
      targetBuildId: 'b-v_fz.1.1.1.2.14',
      nativeVersion: '1.2.12',
    });

    const afterOta2 = otaUpdater.resolveWebEntry({
      userDataDir,
      bundledDistDir,
      nativeVersion: '1.2.12',
    });
    assert.equal(afterOta2.isOta, true);
    assert.equal(afterOta2.activeVersion, 'v_fz.1.1.1.2.14');
    assert.equal(afterOta2.entryHtmlPath, install2.entryHtmlPath);
    assert.equal(
      fs.existsSync(path.join(userDataDir, 'web-updates', 'releases', install1.dirName)),
      false
    );

    // Simulate native installer upgrade to v_fz.1.1.1.3.0 / 1.3.0 -> stale OTA must be cleared
    writeEmbeddedHtml(bundledDistDir, 'v_fz.1.1.1.3.0');
    const afterNativeUpgrade = otaUpdater.resolveWebEntry({
      userDataDir,
      bundledDistDir,
      nativeVersion: '1.3.0',
    });
    assert.equal(afterNativeUpgrade.isOta, false);
    assert.equal(afterNativeUpgrade.entryHtmlPath, path.join(bundledDistDir, 'index.html'));
    assert.equal(
      fs.existsSync(path.join(userDataDir, 'web-updates', 'active.json')),
      false
    );
  });
});
