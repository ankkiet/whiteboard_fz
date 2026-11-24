import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type DetectedOS = 'windows' | 'macos' | 'ios' | 'android' | 'linux';

export function detectUserOS(): DetectedOS {
  if (typeof window === 'undefined') return 'windows';
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/macintosh|mac os x/.test(ua)) return 'macos';
  if (/linux/.test(ua)) return 'linux';
  return 'windows';
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [os, setOs] = useState<DetectedOS>('windows');

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const detected = detectUserOS();
    setOs(detected);
    setIsIOS(detected === 'ios');

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    os,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Generates a native 1-click desktop launcher script for Windows (.bat) or macOS (.command)
 * that opens the fzINK web app in a dedicated chromeless standalone desktop window.
 */
export function buildDesktopLauncherScript(targetOs: 'windows' | 'macos', appUrl: string): {
  fileName: string;
  mimeType: string;
  content: string;
} {
  const cleanUrl = appUrl || 'http://localhost:3000';
  if (targetOs === 'macos') {
    const content = [
      '#!/bin/bash',
      '# Khởi chạy fzINK ở chế độ ứng dụng desktop độc lập trên macOS',
      `APP_URL="${cleanUrl}"`,
      'if [ -d "/Applications/Google Chrome.app" ]; then',
      '  open -n -a "Google Chrome" --args --app="$APP_URL"',
      'elif [ -d "/Applications/Microsoft Edge.app" ]; then',
      '  open -n -a "Microsoft Edge" --args --app="$APP_URL"',
      'elif [ -d "/Applications/Brave Browser.app" ]; then',
      '  open -n -a "Brave Browser" --args --app="$APP_URL"',
      'else',
      '  open "$APP_URL"',
      'fi',
      '',
    ].join('\n');
    return {
      fileName: 'fzINK-macOS.command',
      mimeType: 'text/plain;charset=utf-8',
      content,
    };
  }

  const content = [
    '@echo off',
    'REM Khoi chay fzINK o che do ung dung desktop doc lap tren Windows',
    `set APP_URL=${cleanUrl}`,
    'where msedge >nul 2>nul',
    'if %errorlevel%==0 (',
    '  start "" msedge --app="%APP_URL%"',
    '  exit /b',
    ')',
    'where chrome >nul 2>nul',
    'if %errorlevel%==0 (',
    '  start "" chrome --app="%APP_URL%"',
    '  exit /b',
    ')',
    'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (',
    '  start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%"',
    '  exit /b',
    ')',
    'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (',
    '  start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%"',
    '  exit /b',
    ')',
    'start "" "%APP_URL%"',
    '',
  ].join('\r\n');

  return {
    fileName: 'fzINK-Windows.bat',
    mimeType: 'text/plain;charset=utf-8',
    content,
  };
}
