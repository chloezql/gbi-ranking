"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/context/AuthContext";

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-7 h-7 rounded-full border border-white/25 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
        aria-label="User menu"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted mb-0.5 font-medium">Signed in as</p>
            <p className="text-sm font-semibold text-foreground truncate">{user?.email}</p>
          </div>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="w-full text-left px-4 py-3 text-sm font-medium text-muted hover:text-foreground hover:bg-border/40 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            Dashboard
          </Link>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full text-left px-4 py-3 text-sm font-medium text-muted hover:text-foreground hover:bg-border/40 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { user, loading, openModal } = useAuth();
  const pathname = usePathname();

  if (pathname.startsWith("/tv")) return null;

  return (
    <>
      <section
        aria-label="Featured banner"
        className="bg-background pt-[env(safe-area-inset-top)]"
      >
        <img
          src="/banners/banner-1.png"
          alt=""
          className="w-full h-[72px] sm:h-24 lg:h-[108px] object-cover border-y border-border block"
        />
      </section>

      <header className="sticky top-0 z-50 bg-[#111923] border-y border-white/10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
          <a
            href="https://gbiworld.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center shrink-0"
          >
            <img src="/gbi-white.png" alt="GBI" className="h-7 w-auto" />
          </a>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/#rankings"
              className="px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            >
              Rankings
            </Link>
            <a
              href="https://gbiworld.org"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            >
              About
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {loading ? (
              <button
                type="button"
                disabled
                className="text-sm font-semibold px-3.5 py-1.5 rounded-lg bg-accent text-white opacity-70"
              >
                Sign in
              </button>
            ) : (
              user ? (
                <UserMenu />
              ) : (
                <button
                  onClick={openModal}
                  className="text-sm font-semibold px-3.5 py-1.5 rounded-lg bg-accent text-white hover:brightness-110 transition-all"
                >
                  Sign in
                </button>
              )
            )}
          </div>
        </div>
      </header>
    </>
  );
}
