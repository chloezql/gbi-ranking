"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

export function SignInGate({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  const { user, loading, openModal } = useAuth();

  if (user) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[5px] opacity-45" aria-hidden>
        {children}
      </div>
      {!loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-5">
          <div className="max-w-xs rounded-lg border border-border bg-card/95 p-4 text-center shadow-lg backdrop-blur-sm">
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent-light text-accent">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 10.5V7.75a4.5 4.5 0 10-9 0v2.75m-1 0h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7a1 1 0 011-1z" />
              </svg>
            </div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
            <button
              type="button"
              onClick={openModal}
              className="mt-3 px-3 py-1.5 text-xs font-semibold text-white bg-accent rounded-md hover:opacity-90 transition-opacity"
            >
              Sign in to unlock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
