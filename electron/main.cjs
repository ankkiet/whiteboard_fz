/**
 * Electron Main Process (Windows .exe & macOS .dmg / .app)
 * Cho phép đóng gói dự án fzInK thành ứng dụng desktop độc lập
 * mà vẫn dùng chung 100% mã nguồn với phiên bản website.
 */
const { app, BrowserWindow, shell, Menu, ipcMain, safeStorage, net } = require('electron');
const fs = require('fs');
const path = require('path');
const otaUpdater = require('./otaUpdater.cjs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const GITHUB_LATEST_DOWNLOAD = 'https://github.com/ankkiet/whiteboard_fz/releases/latest/download';
let mainWindow = null;
let isUsingOtaEntry = false;
let isDownloadingUpdate = false;
let activeUpdateAbortController = null;
let activeUpdateCancelReason = null;

function getAuthSessionFilePath() {
  return path.join(app.getPath('userData'), 'auth-session.bin');
}

function readPersistedAuthSession() {
  try {
    const filePath = getAuthSessionFilePath();
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath);
    if (!raw || raw.length === 0) return null;
    const prefix = raw.subarray(0, 4).toString('ascii');
    if (prefix === 'ENC:' && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(raw.subarray(4));
    }
    if (prefix === 'RAW:') {
      return raw.subarray(4).toString('utf8');
    }
    return raw.toString('utf8');
  } catch {
    return null;
  }
}

function writePersistedAuthSession(serialized) {
  try {
    const filePath = getAuthSessionFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(serialized);
      fs.writeFileSync(filePath, Buffer.concat([Buffer.from('ENC:', 'ascii'), encrypted]));
    } else {
      fs.writeFileSync(filePath, Buffer.concat([Buffer.from('RAW:', 'ascii'), Buffer.from(serialized, 'utf8')]));
    }
    return true;
  } catch {
    return false;
  }
}

function clearPersistedAuthSession() {
  try {
    const filePath = getAuthSessionFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch {
    return false;
  }
}

ipcMain.on('fzink:auth:load', (event) => {
  event.returnValue = readPersistedAuthSession();
});

ipcMain.handle('fzink:auth:save', (_event, serialized) => {
  if (typeof serialized !== 'string' || !serialized) return false;
  return writePersistedAuthSession(serialized);
});

ipcMain.handle('fzink:auth:clear', () => clearPersistedAuthSession());

function getPlatformInstallerFileName() {
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'fzInK-macOS-arm64.dmg' : 'fzInK-macOS-x64.dmg';
  }
  if (process.env.PORTABLE_EXECUTABLE_FILE) {
    return 'fzInK-Portable.exe';
  }
  return 'fzInK-Setup.exe';
}

function sendUpdaterProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('fzink:updater:progress', payload);
  }
}

function moveDownloadedInstaller(tempPath, destPath) {
  try {
    fs.renameSync(tempPath, destPath);
    return destPath;
  } catch (err) {
    if (err && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES')) {
      const parsed = path.parse(destPath);
      const fallbackPath = path.join(parsed.dir, `${parsed.name}-${Date.now()}${parsed.ext}`);
      fs.renameSync(tempPath, fallbackPath);
      return fallbackPath;
    }
    throw err;
  }
}

const UPDATE_IDLE_TIMEOUT_MS = 20000;
const UPDATE_PROGRESS_THROTTLE_MS = 120;

function isAllowedUpdateBundleUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    if (parsed.protocol === 'https:') return true;
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function streamDownloadToFile(downloadUrl, tempPath, fileName) {
  let idleTimer = null;
  const clearIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };
  const resetIdleTimer = () => {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      if (activeUpdateAbortController && !activeUpdateAbortController.signal.aborted) {
        activeUpdateCancelReason = 'timeout';
        activeUpdateAbortController.abort();
      }
    }, UPDATE_IDLE_TIMEOUT_MS);
  };

  try {
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    sendUpdaterProgress({ phase: 'preparing', percent: 0, fileName });
    resetIdleTimer();

    const response = await net.fetch(downloadUrl, {
      redirect: 'follow',
      signal: activeUpdateAbortController.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Máy chủ tải về trả về mã lỗi ${response.status}.`);
    }

    const totalBytes = Number(response.headers.get('content-length') || 0);
    let receivedBytes = 0;
    let speedWindowStart = Date.now();
    let speedWindowBytes = 0;
    let lastSpeedBps = 0;
    let lastSentAt = 0;
    let lastSentPercent = -2;

    const writeStream = fs.createWriteStream(tempPath);
    const reader = response.body.getReader();

    sendUpdaterProgress({
      phase: 'downloading',
      percent: totalBytes > 0 ? 0 : -1,
      receivedBytes: 0,
      totalBytes,
      speedBps: 0,
      fileName,
    });

    try {
      while (true) {
        resetIdleTimer();
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          const canContinue = writeStream.write(Buffer.from(value));
          if (!canContinue) {
            await new Promise((resolve) => writeStream.once('drain', resolve));
          }
          receivedBytes += value.byteLength;
          speedWindowBytes += value.byteLength;

          const now = Date.now();
          const windowElapsed = now - speedWindowStart;
          if (windowElapsed >= 500) {
            lastSpeedBps = Math.round((speedWindowBytes * 1000) / windowElapsed);
            speedWindowStart = now;
            speedWindowBytes = 0;
          } else if (lastSpeedBps === 0 && windowElapsed > 80) {
            lastSpeedBps = Math.round((speedWindowBytes * 1000) / windowElapsed);
          }

          const percent = totalBytes > 0 ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100)) : -1;
          if (
            now - lastSentAt >= UPDATE_PROGRESS_THROTTLE_MS ||
            (percent === 99 && lastSentPercent !== 99)
          ) {
            lastSentAt = now;
            lastSentPercent = percent;
            sendUpdaterProgress({
              phase: 'downloading',
              percent,
              receivedBytes,
              totalBytes,
              speedBps: lastSpeedBps,
              fileName,
            });
          }
        }
      }
    } finally {
      clearIdleTimer();
      await new Promise((resolve, reject) => {
        writeStream.end((err) => (err ? reject(err) : resolve()));
      });
    }

    return {
      receivedBytes,
      totalBytes: totalBytes || receivedBytes,
      speedBps: lastSpeedBps,
    };
  } finally {
    clearIdleTimer();
  }
}

ipcMain.on('fzink:updater:native-version', (event) => {
  event.returnValue = app.getVersion();
});

ipcMain.handle('fzink:updater:cancel', () => {
  if (isDownloadingUpdate && activeUpdateAbortController) {
    activeUpdateCancelReason = 'user';
    activeUpdateAbortController.abort();
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('fzink:updater:apply-ota', async (_event, payload) => {
  if (isDownloadingUpdate) {
    return { ok: false, error: 'Đang tải bản cập nhật, vui lòng chờ hoàn tất.' };
  }
  const bundleUrl = payload && typeof payload.bundleUrl === 'string' ? payload.bundleUrl.trim() : '';
  if (!isAllowedUpdateBundleUrl(bundleUrl)) {
    return { ok: false, error: 'Địa chỉ gói cập nhật OTA không hợp lệ.' };
  }

  isDownloadingUpdate = true;
  activeUpdateAbortController = new AbortController();
  activeUpdateCancelReason = null;

  const fileName = 'web-update.zip';
  const userDataDir = app.getPath('userData');
  const tempZipPath = path.join(userDataDir, 'web-updates', 'staging.zip.downloading');

  try {
    const dlStats = await streamDownloadToFile(bundleUrl, tempZipPath, fileName);

    sendUpdaterProgress({
      phase: 'launching',
      percent: 100,
      receivedBytes: dlStats.receivedBytes,
      totalBytes: dlStats.totalBytes,
      speedBps: dlStats.speedBps,
      fileName,
    });

    const installRes = otaUpdater.installOtaFromZip({
      userDataDir,
      zipPath: tempZipPath,
      expectedSha256: payload && payload.expectedSha256 ? String(payload.expectedSha256) : undefined,
      targetVersion: payload && payload.targetVersion ? String(payload.targetVersion) : '',
      targetBuildId: payload && payload.targetBuildId ? String(payload.targetBuildId) : '',
      nativeVersion: app.getVersion(),
    });

    try {
      if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
    } catch {}

    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        isUsingOtaEntry = true;
        mainWindow.loadFile(installRes.entryHtmlPath);
      }
    }, 450);

    return {
      ok: true,
      mode: 'ota',
      fileName,
      destPath: installRes.entryHtmlPath,
      launched: true,
      platform: process.platform,
    };
  } catch (err) {
    try {
      if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
    } catch {}

    if (activeUpdateCancelReason === 'user') {
      sendUpdaterProgress({ phase: 'cancelled', percent: 0, fileName });
      return { ok: false, cancelled: true, fileName };
    }

    const errorMessage =
      activeUpdateCancelReason === 'timeout'
        ? 'Kết nối tải bản cập nhật bị gián đoạn quá lâu (hết thời gian chờ).'
        : err && err.message
        ? err.message
        : 'Không thể áp dụng bản cập nhật nhanh.';

    sendUpdaterProgress({ phase: 'error', percent: 0, fileName });
    return {
      ok: false,
      fileName,
      error: errorMessage,
    };
  } finally {
    activeUpdateAbortController = null;
    activeUpdateCancelReason = null;
    isDownloadingUpdate = false;
  }
});

ipcMain.handle('fzink:updater:download-and-install', async () => {
  if (isDownloadingUpdate) {
    return { ok: false, error: 'Đang tải bản cập nhật, vui lòng chờ hoàn tất.' };
  }
  isDownloadingUpdate = true;
  activeUpdateAbortController = new AbortController();
  activeUpdateCancelReason = null;

  const fileName = getPlatformInstallerFileName();
  const downloadUrl = `${GITHUB_LATEST_DOWNLOAD}/${fileName}`;
  const targetDir = (() => {
    try {
      return app.getPath('downloads');
    } catch {
      return app.getPath('temp');
    }
  })();
  const destPath = path.join(targetDir, fileName);
  const tempPath = `${destPath}.downloading`;

  try {
    const dlStats = await streamDownloadToFile(downloadUrl, tempPath, fileName);

    const finalPath = moveDownloadedInstaller(tempPath, destPath);
    sendUpdaterProgress({
      phase: 'launching',
      percent: 100,
      receivedBytes: dlStats.receivedBytes,
      totalBytes: dlStats.totalBytes,
      speedBps: dlStats.speedBps,
      fileName,
    });

    if (process.platform === 'win32') {
      app.releaseSingleInstanceLock();
    }

    const openErr = await shell.openPath(finalPath);
    if (openErr) {
      shell.showItemInFolder(finalPath);
      return {
        ok: true,
        mode: 'native',
        fileName,
        destPath: finalPath,
        launched: false,
        platform: process.platform,
      };
    }

    if (process.platform === 'win32') {
      // Allow IPC reply to reach renderer before quitting so NSIS Setup / Portable can proceed cleanly
      setTimeout(() => {
        app.quit();
      }, 450);
    }

    return {
      ok: true,
      mode: 'native',
      fileName,
      destPath: finalPath,
      launched: true,
      platform: process.platform,
    };
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}

    if (activeUpdateCancelReason === 'user') {
      sendUpdaterProgress({ phase: 'cancelled', percent: 0, fileName });
      return { ok: false, cancelled: true, fileName };
    }

    const errorMessage =
      activeUpdateCancelReason === 'timeout'
        ? 'Kết nối tải bản cập nhật bị gián đoạn quá lâu (hết thời gian chờ).'
        : err && err.message
        ? err.message
        : 'Không thể tải tệp cập nhật.';

    sendUpdaterProgress({ phase: 'error', percent: 0, fileName });
    return {
      ok: false,
      fileName,
      error: errorMessage,
    };
  } finally {
    activeUpdateAbortController = null;
    activeUpdateCancelReason = null;
    isDownloadingUpdate = false;
  }
});

// Đăng ký custom protocol fzink:// (và bttm:// để tương thích ngược) để Web có thể mở lại Desktop App
for (const scheme of ['fzink', 'bttm']) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(scheme, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(scheme);
  }
}

function sendProtocolTokenToRenderer(urlStr) {
  if (!urlStr || !mainWindow) return;
  try {
    const parsed = new URL(urlStr);
    const token = parsed.searchParams.get('token');
    if (token && mainWindow.webContents) {
      mainWindow.webContents.executeJavaScript(
        `window.postMessage({ type: 'BTTM_AUTH_SUCCESS', token: ${JSON.stringify(token)} }, '*')`
      );
    }
  } catch {
    // Bỏ qua lỗi phân tích URL
  }
}

// Single Instance Lock: Đảm bảo chỉ có 1 cửa sổ ứng dụng chạy và nhận lệnh từ trình duyệt
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();

      // Tìm URL protocol trong commandLine (Windows)
      const protocolUrl = commandLine.find(
        (arg) => typeof arg === 'string' && (arg.startsWith('fzink://') || arg.startsWith('bttm://'))
      );
      if (protocolUrl) {
        sendProtocolTokenToRenderer(protocolUrl);
      }
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'fzInK',
    icon: path.join(__dirname, '../dist/pwa-512x512.png'),
    backgroundColor: '#fafafa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  const bundledDistDir = path.join(__dirname, '../dist');
  const bundledIndexPath = path.join(bundledDistDir, 'index.html');

  if (isDev && process.env.ELECTRON_START_URL) {
    isUsingOtaEntry = false;
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    const resolvedEntry = otaUpdater.resolveWebEntry({
      userDataDir: app.getPath('userData'),
      bundledDistDir,
      nativeVersion: app.getVersion(),
    });
    isUsingOtaEntry = Boolean(resolvedEntry.isOta);
    mainWindow.loadFile(resolvedEntry.entryHtmlPath);
  }

  mainWindow.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, _validatedURL, isMainFrame) => {
    if (isMainFrame && isUsingOtaEntry) {
      isUsingOtaEntry = false;
      otaUpdater.clearOtaUpdates(app.getPath('userData'));
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(bundledIndexPath);
      }
    }
  });

  // Mở các liên kết ngoài (như Google Drive, Chính sách, Điều khoản) bằng trình duyệt mặc định của hệ điều hành
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (url === currentUrl) return;
    if (isDev && process.env.ELECTRON_START_URL && url.startsWith(process.env.ELECTRON_START_URL)) {
      return;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// macOS protocol handler
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    sendProtocolTokenToRenderer(url);
  }
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const template = [
      {
        label: app.name,
        submenu: [
          { role: 'about', label: 'Giới thiệu fzInK' },
          { type: 'separator' },
          { role: 'services', label: 'Dịch vụ' },
          { type: 'separator' },
          { role: 'hide', label: 'Ẩn ứng dụng' },
          { role: 'hideOthers', label: 'Ẩn ứng dụng khác' },
          { role: 'unhide', label: 'Hiện tất cả' },
          { type: 'separator' },
          { role: 'quit', label: 'Thoát' },
        ],
      },
      {
        label: 'Chỉnh sửa',
        submenu: [
          { role: 'undo', label: 'Hoàn tác' },
          { role: 'redo', label: 'Làm lại' },
          { type: 'separator' },
          { role: 'cut', label: 'Cắt' },
          { role: 'copy', label: 'Sao chép' },
          { role: 'paste', label: 'Dán' },
          { role: 'selectAll', label: 'Chọn tất cả' },
        ],
      },
      {
        label: 'Cửa sổ',
        submenu: [
          { role: 'minimize', label: 'Thu nhỏ' },
          { role: 'zoom', label: 'Phóng to' },
          { type: 'separator' },
          { role: 'front', label: 'Đưa lên trước' },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } else {
    Menu.setApplicationMenu(null);
  }
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
