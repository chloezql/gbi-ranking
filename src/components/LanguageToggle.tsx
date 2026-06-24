"use client";

import { useLanguage } from "@/context/LanguageContext";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center h-7 rounded-full bg-white/10 border border-white/20 p-0.5 text-xs font-semibold">
      <button
        onClick={() => setLang("en")}
        className={`flex items-center justify-center px-2 h-6 rounded-full transition-all duration-200 ${lang === "en" ? "bg-white shadow-sm text-accent" : "text-white/60 hover:text-white"}`}
        aria-label="English"
      >
        En
      </button>
      <button
        onClick={() => setLang("zh")}
        className={`flex items-center justify-center px-2 h-6 rounded-full transition-all duration-200 ${lang === "zh" ? "bg-white shadow-sm text-accent" : "text-white/60 hover:text-white"}`}
        aria-label="中文"
      >
        中
      </button>
    </div>
  );
}
