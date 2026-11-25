export type AppLanguage = 'vi' | 'en';

export const LANGUAGE_STORAGE_KEY = 'fzink_language';

export function normalizeAppLanguage(raw: unknown): AppLanguage {
  return raw === 'en' ? 'en' : 'vi';
}

export function readSavedLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'vi';
  try {
    return normalizeAppLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return 'vi';
  }
}

let activeLanguage: AppLanguage = readSavedLanguage();

export function getAppLanguage(): AppLanguage {
  return activeLanguage;
}

export function applyDocumentLanguage(lang: AppLanguage): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  const desc =
    lang === 'en'
      ? 'Infinite whiteboard app with smooth drawing pens, sticky notes, shapes, math tools, and image insertion.'
      : 'Ứng dụng bảng trắng vô tận hiện đại với bút vẽ mượt, ghi chú dán, hình khối và chèn ảnh.';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', desc);
}

export function setAppLanguageState(lang: AppLanguage): void {
  const safe = normalizeAppLanguage(lang);
  activeLanguage = safe;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, safe);
    } catch {
      // ignore storage errors
    }
  }
  applyDocumentLanguage(safe);
}

export function tr(vi: string, en: string, lang: AppLanguage = activeLanguage): string {
  return lang === 'en' ? en : vi;
}
