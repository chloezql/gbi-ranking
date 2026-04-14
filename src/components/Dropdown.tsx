"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

export function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}:</span>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1 min-w-[140px] pl-2.5 pr-6 py-1.5 bg-card border rounded-lg text-xs font-medium text-foreground transition-colors",
            open ? "border-accent/50 ring-1 ring-accent/20" : "border-border hover:border-accent/30"
          )}
        >
          {selected?.label || value}
          <svg
            className={cn("absolute right-1.5 w-3 h-3 text-muted transition-transform", open && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 left-0 min-w-full max-w-72 max-h-60 overflow-y-auto bg-card border border-border rounded-lg shadow-lg py-1 animate-[fadeIn_0.15s_ease-out]">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs transition-colors",
                  opt.value === value
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-foreground hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
