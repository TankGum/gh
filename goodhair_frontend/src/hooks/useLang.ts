'use client';
import { useState, useEffect, useCallback } from 'react';

const KEY = 'gh_lang';

export function useLang() {
  const [lang, setLangState] = useState<'vi' | 'en'>('vi');

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === 'vi' || saved === 'en') setLangState(saved);
  }, []);

  const setLang = useCallback((value: 'vi' | 'en') => {
    localStorage.setItem(KEY, value);
    setLangState(value);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'vi' ? 'en' : 'vi');
  }, [lang, setLang]);

  return { lang, setLang, toggleLang };
}
