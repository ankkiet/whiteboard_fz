/**
 * Preload script for fzInK Electron Desktop App.
 * Exposes minimal, context-isolated bridges for:
 * 1. Persistent Google Drive auth session across updates & Portable runs
 * 2. 1-click desktop app update download & installer launch
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fzinkDesktopAuth', {
  loadSessionSync: () => {
    try {
      return ipcRenderer.sendSync('fzink:auth:load');
    } catch {
      return null;
    }
  },
  saveSession: (serialized) => {
    try {
      return ipcRenderer.invoke('fzink:auth:save', String(serialized || ''));
    } catch {
      return Promise.resolve(false);
    }
  },
  clearSession: () => {
    try {
      return ipcRenderer.invoke('fzink:auth:clear');
    } catch {
      return Promise.resolve(false);
    }
  },
});

contextBridge.exposeInMainWorld('fzinkDesktopUpdater', {
  getNativeVersion: () => {
    try {
      return ipcRenderer.sendSync('fzink:updater:native-version') || null;
    } catch {
      return null;
    }
  },
  downloadAndInstall: () => {
    try {
      return ipcRenderer.invoke('fzink:updater:download-and-install');
    } catch (err) {
      return Promise.resolve({ ok: false, error: err && err.message ? err.message : 'Update failed' });
    }
  },
  applyOtaUpdate: (payload) => {
    try {
      return ipcRenderer.invoke('fzink:updater:apply-ota', payload);
    } catch (err) {
      return Promise.resolve({ ok: false, error: err && err.message ? err.message : 'OTA update failed' });
    }
  },
  cancelDownload: () => {
    try {
      return ipcRenderer.invoke('fzink:updater:cancel');
    } catch {
      return Promise.resolve({ ok: false });
    }
  },
  onProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('fzink:updater:progress', listener);
    return () => {
      ipcRenderer.removeListener('fzink:updater:progress', listener);
    };
  },
});
