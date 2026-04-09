"use client";

import { useEffect, useState } from "react";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark";
    setDark(isDark);
    applyTheme(isDark);
    setMounted(true);
  }, []);

  const toggle = (value: boolean) => {
    setDark(value);
    localStorage.setItem("theme", value ? "dark" : "light");
    applyTheme(value);
  };

  if (!mounted) return <div className="w-16 h-8" />;

  return (
    <div className="flex items-center h-8 rounded-full bg-gray-100 dark:bg-gray-800 border border-border p-0.5">
      <button
        onClick={() => toggle(false)}
        className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 ${!dark ? "bg-white shadow-sm text-amber-500" : "text-muted"}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>
      <button
        onClick={() => toggle(true)}
        className={`flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 ${dark ? "bg-gray-600 shadow-sm text-yellow-300" : "text-muted"}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
    </div>
  );
}
