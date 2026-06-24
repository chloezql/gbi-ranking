"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "zh";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "zh" || stored === "en") setLangState(stored);
  }, []);

  const setLang = (value: Lang) => {
    setLangState(value);
    localStorage.setItem("lang", value);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

/** Pick the description for the active language, falling back to the other one. */
export function pickDescription(
  lang: Lang,
  description: string,
  descriptionCn: string
): string {
  const en = (description || "").trim();
  const zh = (descriptionCn || "").trim();
  return lang === "zh" ? zh || en : en || zh;
}
