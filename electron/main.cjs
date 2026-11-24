/**
 * Electron Main Process (Windows .exe & macOS .dmg / .app)
 * Cho phép đóng gói dự án fzInK thành ứng dụng desktop độc lập
 * mà vẫn dùng chung 100% mã nguồn với phiên bản website.
 */
const { app, BrowserWindow, shell, Menu, ipcMain, safeStorage, net } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const GITHUB_LATEST_DOWNLOAD = 'https://github.com/ankkiet/whiteboard_fz/releases/latest/download';
let mainWindow = null;
let isDownloadingUpdate = false;

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
  return 'fzInK-Setup.exe';
}

function sendUpdaterProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('fzink:updater:progress', payload);
  }
}

ipcMain.handle('fzink:updater:download-and-install', async () => {
  if (isDownloadingUpdate) {
    return { ok: false, error: 'Đang tải bản cập nhật, vui lòng chờ hoàn tất.' };
  }
  isDownloadingUpdate = true;
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
    sendUpdaterProgress({ phase: 'downloading', percent: 0, fileName });
    const response = await net.fetch(downloadUrl, { redirect: 'follow' });
    if (!response.ok || !response.body) {
      throw new Error(`Máy chủ tải về trả về mã lỗi ${response.status}.`);
    }

    const totalBytes = Number(response.headers.get('content-length') || 0);
    let receivedBytes = 0;
    const writeStream = fs.createWriteStream(tempPath);
    const reader = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          writeStream.write(Buffer.from(value));
          receivedBytes += value.byteLength;
          const percent = totalBytes > 0 ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100)) : -1;
          sendUpdaterProgress({ phase: 'downloading', percent, receivedBytes, totalBytes, fileName });
        }
      }
    } finally {
      await new Promise((resolve, reject) => {
        writeStream.end((err) => (err ? reject(err) : resolve()));
      });
    }

    fs.renameSync(tempPath, destPath);
    sendUpdaterProgress({ phase: 'launching', percent: 100, fileName });

    const openErr = await shell.openPath(destPath);
    if (openErr) {
      shell.showItemInFolder(destPath);
      return { ok: true, fileName, destPath, launched: false };
    }

    return { ok: true, fileName, destPath, launched: true };
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    sendUpdaterProgress({ phase: 'error', percent: 0, fileName });
    return {
      ok: false,
      error: err && err.message ? err.message : 'Không thể tải tệp cập nhật.',
    };
  } finally {
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

  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Mở các liên kết ngoài (như Google Drive) bằng trình duyệt mặc định của hệ điều hành
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
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
