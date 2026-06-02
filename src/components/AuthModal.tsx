"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type Mode = "login" | "signup" | "signup-success";

export function AuthModal() {
  const { modalOpen, closeModal } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modalOpen) {
      setEmail("");
      setPassword("");
      setError(null);
      setMode("login");
      setLoading(false);
    }
  }, [modalOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    if (modalOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  if (!modalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else closeModal();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMode("signup-success");
        setTimeout(() => {
          setPassword("");
          setError(null);
          setMode("login");
        }, 2000);
      }
    }

    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const switchMode = () => {
    setMode(m => m === "login" ? "signup" : "login");
    setError(null);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) closeModal(); }}
    >
      <div className="relative w-full max-w-sm mx-4 bg-card border border-border rounded-2xl shadow-2xl p-8">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {mode === "signup-success" ? (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Account created!</h2>
              <p className="text-muted text-sm">Your account has been successfully created. Taking you to sign in…</p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-1">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-muted text-sm mb-6">
              {mode === "login" ? "Sign in to your GBI account" : "Get started with GBI"}
            </p>

            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg border border-border bg-card hover:bg-border/40 transition-colors text-sm font-medium mb-4"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
                  placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"}
                />
              </div>

              {error && (
                <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>

            <p className="text-sm text-muted text-center mt-5">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button onClick={switchMode} className="text-accent font-medium hover:underline">
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
