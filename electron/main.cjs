/**
 * Electron Main Process (Windows .exe & macOS .dmg / .app)
 * Cho phép đóng gói dự án Bảng Trắng Thông Minh thành ứng dụng Desktop độc lập
 * mà vẫn dùng chung 100% mã nguồn với phiên bản Website.
 */
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow = null;

// Đăng ký custom protocol bttm:// để Web có thể mở lại Desktop App
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('bttm', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('bttm');
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
      const protocolUrl = commandLine.find((arg) => typeof arg === 'string' && arg.startsWith('bttm://'));
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
    title: 'Bảng Trắng Thông Minh - Smart Whiteboard',
    icon: path.join(__dirname, '../dist/pwa-512x512.png'),
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
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
          { role: 'about', label: 'Giới thiệu Bảng Trắng Thông Minh' },
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
