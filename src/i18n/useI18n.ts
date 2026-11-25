import { useCallback } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { AppLanguage, tr } from './index';

export type { AppLanguage };

export function useI18n() {
  const language = useBoardStore((s) => s.language);
  const setLanguage = useBoardStore((s) => s.setLanguage);

  const t = useCallback(
    (vi: string, en: string) => tr(vi, en, language),
    [language]
  );

  return {
    language,
    setLanguage,
    isEn: language === 'en',
    t,
  };
}
