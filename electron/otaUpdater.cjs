const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c >>> 0;
  }
  return crcTable;
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parseVersionSegments(version) {
  if (!version || typeof version !== 'string') return [];
  const matches = version.match(/\d+/g);
  if (!matches) return [];
  return matches.map((n) => Number.parseInt(n, 10));
}

function compareVersions(a, b) {
  const segA = parseVersionSegments(a);
  const segB = parseVersionSegments(b);
  if (segA.length === 0 || segB.length === 0) return 0;
  const maxLen = Math.max(segA.length, segB.length);
  for (let i = 0; i < maxLen; i += 1) {
    const va = segA[i] ?? 0;
    const vb = segB[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function collectFilesRecursive(rootDir, currentDir, results) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(rootDir, fullPath, results);
    } else if (entry.isFile()) {
      const relPosix = path.relative(rootDir, fullPath).split(path.sep).join('/');
      results.push({ fullPath, relPosix });
    }
  }
}

/**
 * Creates a deterministic standard ZIP archive from a directory using Node built-in zlib.
 * Returns { sha256, sizeBytes, fileCount }.
 */
function createZipFromDirectory(srcDir, outZipPath, options = {}) {
  const exclude = typeof options.exclude === 'function' ? options.exclude : () => false;
  const files = [];
  collectFilesRecursive(srcDir, srcDir, files);
  files.sort((a, b) => (a.relPosix < b.relPosix ? -1 : a.relPosix > b.relPosix ? 1 : 0));

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  let fileCount = 0;

  for (const item of files) {
    if (exclude(item.relPosix)) continue;
    const rawData = fs.readFileSync(item.fullPath);
    const deflated = zlib.deflateRawSync(rawData, { level: 9 });
    const useDeflate = deflated.length < rawData.length;
    const method = useDeflate ? 8 : 0;
    const payload = useDeflate ? deflated : rawData;
    const checksum = crc32(rawData);
    const nameBuf = Buffer.from(item.relPosix, 'utf8');
    const flags = 0x0800; // UTF-8 filename

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x5421, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x5421, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + payload.length;
    fileCount += 1;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const part of centralParts) {
    centralDirSize += part.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(fileCount, 8);
  eocd.writeUInt16LE(fileCount, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const zipBuffer = Buffer.concat([...localParts, ...centralParts, eocd]);
  fs.mkdirSync(path.dirname(outZipPath), { recursive: true });
  fs.writeFileSync(outZipPath, zipBuffer);

  const sha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  return {
    sha256,
    sizeBytes: zipBuffer.length,
    fileCount,
  };
}

function findEocdOffset(buf) {
  const minOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOffset; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      const commentLen = buf.readUInt16LE(i + 20);
      if (i + 22 + commentLen === buf.length) {
        return i;
      }
    }
  }
  return -1;
}

function sanitizeZipEntryPath(rawName, destRoot) {
  if (!rawName || rawName.includes('\0')) {
    throw new Error(`Invalid archive entry path: ${rawName}`);
  }
  const normalized = rawName.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) {
    throw new Error('Empty archive entry path');
  }
  const segments = normalized.split('/');
  if (segments.some((seg) => seg === '..' || /^[a-zA-Z]:/.test(seg))) {
    throw new Error(`Unsafe archive path traversal detected: ${rawName}`);
  }
  const resolvedDest = path.resolve(destRoot);
  const resolvedTarget = path.resolve(resolvedDest, normalized);
  if (resolvedTarget !== resolvedDest && !resolvedTarget.startsWith(resolvedDest + path.sep)) {
    throw new Error(`Archive path escapes destination directory: ${rawName}`);
  }
  return { normalized, resolvedTarget };
}

/**
 * Extracts a ZIP archive into destDir with Zip-Slip protection and CRC-32 validation.
 */
function extractZipFile(zipPath, destDir) {
  const buf = fs.readFileSync(zipPath);
  const eocdOffset = findEocdOffset(buf);
  if (eocdOffset < 0) {
    throw new Error('Gói cập nhật không đúng định dạng ZIP hợp lệ.');
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);
  if (centralDirOffset >= buf.length) {
    throw new Error('Cấu trúc gói cập nhật ZIP bị hỏng.');
  }

  fs.mkdirSync(destDir, { recursive: true });

  let ptr = centralDirOffset;
  let extractedCount = 0;

  for (let i = 0; i < totalEntries; i += 1) {
    if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error('Dữ liệu mục lục trong gói cập nhật ZIP không hợp lệ.');
    }

    const compressionMethod = buf.readUInt16LE(ptr + 10);
    const expectedCrc = buf.readUInt32LE(ptr + 16);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const uncompressedSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);

    const rawName = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    ptr += 46 + nameLen + extraLen + commentLen;

    const { normalized, resolvedTarget } = sanitizeZipEntryPath(rawName, destDir);

    if (normalized.endsWith('/')) {
      fs.mkdirSync(resolvedTarget, { recursive: true });
      continue;
    }

    if (
      localHeaderOffset + 30 > buf.length ||
      buf.readUInt32LE(localHeaderOffset) !== 0x04034b50
    ) {
      throw new Error(`Header tệp trong gói ZIP không hợp lệ: ${normalized}`);
    }

    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) {
      throw new Error(`Kích thước tệp trong gói ZIP vượt quá giới hạn: ${normalized}`);
    }

    const compressedSlice = buf.subarray(dataStart, dataEnd);
    let content;
    if (compressionMethod === 0) {
      content = compressedSlice;
    } else if (compressionMethod === 8) {
      content = zlib.inflateRawSync(compressedSlice);
    } else {
      throw new Error(`Phương thức nén ZIP không được hỗ trợ (${compressionMethod}): ${normalized}`);
    }

    if (content.length !== uncompressedSize || crc32(content) !== expectedCrc) {
      throw new Error(`Tệp trong gói cập nhật bị hỏng (CRC mismatch): ${normalized}`);
    }

    fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
    fs.writeFileSync(resolvedTarget, content);
    extractedCount += 1;
  }

  return extractedCount;
}

function computeFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const chunk = Buffer.alloc(65536);
    let bytesRead = 0;
    while ((bytesRead = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      hash.update(chunk.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function readEmbeddedVersionFromHtml(htmlPath, fallbackVersion) {
  try {
    if (!fs.existsSync(htmlPath)) return fallbackVersion;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const match = html.match(/window\.__BTTM_EMBEDDED_BUILD__\s*=\s*(\{[^<]*?\})\s*;/);
    if (match && match[1]) {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed.version === 'string' && parsed.version.trim()) {
        return parsed.version.trim();
      }
    }
  } catch {
    // ignore parse failure
  }
  return fallbackVersion;
}

function getOtaRootDir(userDataDir) {
  return path.join(userDataDir, 'web-updates');
}

function getOtaActivePointerPath(userDataDir) {
  return path.join(getOtaRootDir(userDataDir), 'active.json');
}

function getOtaReleasesDir(userDataDir) {
  return path.join(getOtaRootDir(userDataDir), 'releases');
}

function removeDirSafe(targetDir) {
  try {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore locked files on Windows (e.g. active Chromium handles); cleaned up on next startup
  }
}

function cleanupOldReleases(userDataDir, keepDirName) {
  const releasesDir = getOtaReleasesDir(userDataDir);
  if (!fs.existsSync(releasesDir)) return;
  try {
    for (const entry of fs.readdirSync(releasesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (keepDirName && entry.name === keepDirName) continue;
      removeDirSafe(path.join(releasesDir, entry.name));
    }
  } catch {
    // ignore cleanup errors
  }
}

function clearOtaUpdates(userDataDir) {
  try {
    const pointerPath = getOtaActivePointerPath(userDataDir);
    if (fs.existsSync(pointerPath)) {
      fs.unlinkSync(pointerPath);
    }
  } catch {
    // ignore
  }
  cleanupOldReleases(userDataDir, null);
}

/**
 * Resolves which index.html the Electron BrowserWindow should load at startup.
 * Automatically discards stale OTA overrides when the native app was upgraded.
 */
function resolveWebEntry({ userDataDir, bundledDistDir, nativeVersion }) {
  const bundledIndexPath = path.join(bundledDistDir, 'index.html');
  const bundledVersion = readEmbeddedVersionFromHtml(bundledIndexPath, nativeVersion);

  try {
    const pointerPath = getOtaActivePointerPath(userDataDir);
    if (!fs.existsSync(pointerPath)) {
      cleanupOldReleases(userDataDir, null);
      return {
        entryHtmlPath: bundledIndexPath,
        isOta: false,
        activeVersion: bundledVersion,
      };
    }

    const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
    const dirName = pointer && typeof pointer.dirName === 'string' ? pointer.dirName : '';
    const otaVersion = pointer && typeof pointer.version === 'string' ? pointer.version : '';
    const targetNativeVersion =
      pointer && typeof pointer.targetNativeVersion === 'string'
        ? pointer.targetNativeVersion
        : '';

    const otaDir = dirName ? path.join(getOtaReleasesDir(userDataDir), dirName) : '';
    const otaIndexPath = otaDir ? path.join(otaDir, 'index.html') : '';

    const isSameNativeShell = Boolean(targetNativeVersion && targetNativeVersion === nativeVersion);
    const isNewerThanBundled = Boolean(otaVersion && compareVersions(otaVersion, bundledVersion) > 0);

    if (isSameNativeShell && isNewerThanBundled && otaIndexPath && fs.existsSync(otaIndexPath)) {
      cleanupOldReleases(userDataDir, dirName);
      return {
        entryHtmlPath: otaIndexPath,
        isOta: true,
        activeVersion: otaVersion,
        activeBuildId: pointer.buildId || null,
      };
    }

    // Native app was upgraded or OTA metadata is stale/missing -> discard old OTA
    clearOtaUpdates(userDataDir);
  } catch {
    clearOtaUpdates(userDataDir);
  }

  return {
    entryHtmlPath: bundledIndexPath,
    isOta: false,
    activeVersion: bundledVersion,
  };
}

/**
 * Verifies SHA-256 of a downloaded OTA zip, extracts it into a fresh generation folder,
 * validates index.html presence, and atomically updates active.json.
 */
function installOtaFromZip({
  userDataDir,
  zipPath,
  expectedSha256,
  targetVersion,
  targetBuildId,
  nativeVersion,
}) {
  if (expectedSha256) {
    const actualSha256 = computeFileSha256(zipPath);
    if (actualSha256.toLowerCase() !== String(expectedSha256).trim().toLowerCase()) {
      throw new Error('Gói cập nhật không khớp mã kiểm tra toàn vẹn (SHA-256).');
    }
  }

  const safeVersion = String(targetVersion || 'ota').replace(/[^a-zA-Z0-9._-]/g, '_');
  const dirName = `${safeVersion}-${Date.now()}`;
  const releaseDir = path.join(getOtaReleasesDir(userDataDir), dirName);

  try {
    extractZipFile(zipPath, releaseDir);
    const entryHtmlPath = path.join(releaseDir, 'index.html');
    if (!fs.existsSync(entryHtmlPath)) {
      throw new Error('Gói cập nhật thiếu tệp khởi chạy index.html.');
    }

    const pointer = {
      dirName,
      version: targetVersion || '',
      buildId: targetBuildId || '',
      targetNativeVersion: nativeVersion || '',
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(releaseDir, 'ota-meta.json'), JSON.stringify(pointer, null, 2), 'utf8');

    const pointerPath = getOtaActivePointerPath(userDataDir);
    const pointerTmpPath = `${pointerPath}.tmp`;
    fs.mkdirSync(path.dirname(pointerPath), { recursive: true });
    fs.writeFileSync(pointerTmpPath, JSON.stringify(pointer, null, 2), 'utf8');
    fs.renameSync(pointerTmpPath, pointerPath);

    return {
      entryHtmlPath,
      dirName,
      version: pointer.version,
      buildId: pointer.buildId,
    };
  } catch (err) {
    removeDirSafe(releaseDir);
    throw err;
  }
}

module.exports = {
  crc32,
  compareVersions,
  createZipFromDirectory,
  extractZipFile,
  computeFileSha256,
  resolveWebEntry,
  installOtaFromZip,
  clearOtaUpdates,
  cleanupOldReleases,
};
