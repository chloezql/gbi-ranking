"use client";

import { useEffect, useState } from "react";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark";
    setDark(isDark);
    applyTheme(isDark);
  }, []);

  const toggle = (value: boolean) => {
    setDark(value);
    localStorage.setItem("theme", value ? "dark" : "light");
    applyTheme(value);
  };

  return (
    <div className="flex items-center h-7 rounded-full bg-white/10 border border-white/20 p-0.5">
      <button
        onClick={() => toggle(false)}
        className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${!dark ? "bg-white shadow-sm text-amber-500" : "text-white/60 hover:text-white"}`}
        aria-label="Use light theme"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>
      <button
        onClick={() => toggle(true)}
        className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${dark ? "bg-slate-600 shadow-sm text-yellow-300" : "text-white/60 hover:text-white"}`}
        aria-label="Use dark theme"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
    </div>
  );
}
