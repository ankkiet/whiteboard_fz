/**
 * Electron Main Process (Windows .exe & macOS .dmg / .app)
 * Cho phép đóng gói dự án Bảng Trắng Thông Minh thành ứng dụng Desktop độc lập
 * mà vẫn dùng chung 100% mã nguồn với phiên bản Website.
 */
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createMainWindow() {
  const mainWindow = new BrowserWindow({
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
}

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
