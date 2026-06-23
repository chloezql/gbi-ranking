"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

export function Dropdown({
  label,
  icon,
  prefix,
  value,
  options,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  prefix?: string;
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={label}
        className={cn(
          "flex items-center gap-2 min-w-[150px] pl-3 pr-8 py-2 bg-card border rounded-full text-sm font-medium text-foreground transition-colors",
          open ? "border-accent/50 ring-1 ring-accent/20" : "border-border hover:border-accent/40"
        )}
      >
        {icon && <span className="shrink-0 text-muted flex items-center">{icon}</span>}
        <span className="truncate">
          {prefix ? `${prefix}: ` : ""}
          {selected?.label || value}
        </span>
        <svg
          className={cn("absolute right-2.5 w-3.5 h-3.5 text-muted transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 min-w-full max-w-72 max-h-60 overflow-y-auto bg-card border border-border rounded-xl shadow-lg py-1.5 animate-[fadeIn_0.15s_ease-out]">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
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
  );
}
