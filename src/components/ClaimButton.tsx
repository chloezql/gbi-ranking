"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getClaimStatus, submitClaim } from "@/lib/data";

type ClaimStatus = "loading" | "unclaimed" | "approved" | "submitting";

function domainsMatch(userEmail: string, companyDomain: string): boolean {
  const emailDomain = userEmail.split("@")[1]?.toLowerCase() ?? "";
  const clean = companyDomain.toLowerCase().replace(/^www\./, "");
  return emailDomain === clean || emailDomain.endsWith("." + clean);
}

export function ClaimButton({ domain }: { domain: string }) {
  const { user, openModal, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<ClaimStatus>("loading");
  const [showMismatch, setShowMismatch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus("unclaimed");
      return;
    }
    let cancelled = false;
    getClaimStatus(domain)
      .then((s) => { if (!cancelled) setStatus(s === "approved" ? "approved" : "unclaimed"); })
      .catch(() => { if (!cancelled) setStatus("unclaimed"); });
    return () => { cancelled = true; };
  }, [user, domain, authLoading]);

  const handleClaim = async () => {
    if (!user) {
      openModal();
      return;
    }

    if (!domainsMatch(user.email ?? "", domain)) {
      setShowMismatch(true);
      return;
    }

    setStatus("submitting");
    setError(null);
    try {
      await submitClaim(domain);
      setStatus("approved");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("unclaimed");
    }
  };

  if (status === "loading") {
    return (
      <span className="inline-flex items-center mt-3 px-4 py-2">
        <svg className="w-4 h-4 animate-spin text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v4m0 8v4M4 12h4m8 0h4" />
        </svg>
      </span>
    );
  }

  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium border border-green-200 dark:border-green-800">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Company Claimed
      </span>
    );
  }

  return (
    <>
      <div className="flex flex-col items-start">
        <button
          onClick={handleClaim}
          disabled={status === "submitting"}
          className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 border border-accent text-accent rounded-lg text-sm font-medium hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
        >
          {status === "submitting" ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v4m0 8v4M4 12h4m8 0h4" />
              </svg>
              Submitting…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Claim this company
            </>
          )}
        </button>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      {showMismatch && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setShowMismatch(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-base">Email domain doesn&apos;t match</h3>
              </div>
              <button
                onClick={() => setShowMismatch(false)}
                className="text-muted hover:text-foreground transition-colors shrink-0 mt-0.5"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <p className="text-sm text-muted leading-relaxed mb-6">
              To claim <span className="font-medium text-foreground">{domain}</span>, you need to sign in
              with a <span className="font-medium text-foreground">@{domain.replace(/^www\./, "")}</span> email
              address so we can verify your ownership.
            </p>

            <button
              onClick={() => setShowMismatch(false)}
              className="w-full px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
