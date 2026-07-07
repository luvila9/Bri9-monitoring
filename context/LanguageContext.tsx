"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { dictionary, Language } from '@/lib/dictionary';

interface LanguageContextType {
  lang: Language;
  toggleLanguage: () => void;
  t: (key: keyof typeof dictionary.id) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Language>('id');

  useEffect(() => {
    // Cek apakah user sudah pernah milih bahasa sebelumnya
    const savedLang = localStorage.getItem('bri9_language') as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  const toggleLanguage = () => {
    const newLang = lang === 'id' ? 'en' : 'id';
    setLang(newLang);
    localStorage.setItem('bri9_language', newLang);
  };

  // Fungsi sakti untuk menerjemahkan teks
  const t = (key: keyof typeof dictionary.id) => {
    return dictionary[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};