/**
 * Preload script for fzInK Electron Desktop App.
 * Exposes a minimal, context-isolated bridge so the Google Drive auth session
 * persists in userData across app updates and Portable runs.
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
