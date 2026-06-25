"use client";

import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type ModalStep = "input" | "review" | "importing";
type DomainStatus = "queued" | "processing" | "done" | "existing" | "failed";

interface AnalyzedCompany {
  name: string;
  domain: string | null;
  is_brand: boolean;
  is_service_provider: boolean;
}

interface ImportResult {
  name: string;
  domain: string;
  status: DomainStatus;
  error?: string;
}

function typeLabel(c: AnalyzedCompany): string {
  if (c.is_brand && c.is_service_provider) return "Brand & Service Provider";
  if (c.is_service_provider) return "Service Provider";
  return "Brand";
}

export function BatchImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<ModalStep>("input");
  const [rawInput, setRawInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [analyzed, setAnalyzed] = useState<AnalyzedCompany[]>([]);
  const [editingDomainIdx, setEditingDomainIdx] = useState<number | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);

  const isBlocked = analyzing || importing;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !isBlocked) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, isBlocked]);

  const names = rawInput
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean)
    .filter((n, i, arr) => arr.indexOf(n) === i);

  const handleAnalyze = async () => {
    if (names.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);

    const { data, error } = await supabase.functions.invoke("analyze-companies", {
      body: { names },
    });

    setAnalyzing(false);

    if (error || data?.error) {
      setAnalyzeError(error?.message ?? data?.error ?? "Analysis failed");
      return;
    }

    setAnalyzed(data.companies ?? []);
    setStep("review");
  };

  const handleImport = async () => {
    if (!user || analyzed.length === 0) return;

    const valid = analyzed.filter(c => c.domain);
    setResults(valid.map(c => ({ name: c.name, domain: c.domain!, status: "queued" })));
    setImporting(true);
    setStep("importing");

    for (let i = 0; i < valid.length; i++) {
      const company = valid[i];
      const domain = company.domain!;

      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "processing" } : r));

      try {
        const [{ data: existingCompany }, { data: existingSubmission }] = await Promise.all([
          supabase.from("companies").select("domain").eq("domain", domain).maybeSingle(),
          supabase.from("company_submissions").select("domain").eq("domain", domain).in("status", ["pending", "approved"]).maybeSingle(),
        ]);

        if (existingCompany || existingSubmission) {
          setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "existing" } : r));
          continue;
        }

        const { data: submission, error: insertErr } = await supabase
          .from("company_submissions")
          .insert({
            submitted_by: user.id,
            is_brand: company.is_brand,
            is_service_provider: company.is_service_provider,
            name: company.name,
            domain,
            related_service_provider_names: [],
            related_brand_names: [],
          })
          .select("id")
          .single();

        if (insertErr) throw new Error(insertErr.message);

        const { error: fnErr } = await supabase.functions.invoke("trigger-apify", {
          body: { submissionId: submission.id },
        });

        if (fnErr) throw new Error(fnErr.message);

        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done" } : r));
      } catch (err) {
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: "failed", error: err instanceof Error ? err.message : "Unknown error" } : r
        ));
      }
    }

    setImporting(false);
  };

  const updateAnalyzed = (i: number, patch: Partial<AnalyzedCompany>) =>
    setAnalyzed(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  const doneCount     = results.filter(r => r.status === "done").length;
  const existingCount = results.filter(r => r.status === "existing").length;
  const failedCount   = results.filter(r => r.status === "failed").length;
  const finished      = step === "importing" && !importing;

  const summaryParts = [
    doneCount > 0     && `${doneCount} queued`,
    existingCount > 0 && `${existingCount} skipped (existing)`,
    failedCount > 0   && `${failedCount} failed`,
  ].filter(Boolean).join(", ");

  const noDomainCount = analyzed.filter(c => !c.domain).length;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === overlayRef.current && !isBlocked) onClose(); }}
    >
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div>
            <p className="font-bold text-base">Batch Import</p>
            <p className="text-xs text-muted mt-0.5">
              {step === "input"     && "Enter company names for AI analysis"}
              {step === "review"    && "Review AI results before importing"}
              {step === "importing" && (importing ? "Importing companies…" : "Import complete")}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isBlocked}
            className="text-muted hover:text-foreground transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-4">

          {/* Step 1: Input */}
          {step === "input" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Company names <span className="text-muted font-normal">(one per line)</span>
                </label>
                <textarea
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  placeholder={"Nike\nApple\nSalesforce"}
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none"
                />
                {names.length > 0 && (
                  <p className="text-xs text-muted">{names.length} company name{names.length !== 1 ? "s" : ""} detected</p>
                )}
              </div>
              {analyzeError && (
                <p className="text-xs text-danger bg-danger/10 px-3 py-2 rounded-lg">{analyzeError}</p>
              )}
            </>
          )}

          {/* Step 2: Review */}
          {step === "review" && (
            <>
              {noDomainCount > 0 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 rounded-lg">
                  {noDomainCount} company{noDomainCount !== 1 ? " names" : " name"} could not be resolved — enter a domain manually or they will be skipped.
                </p>
              )}
              <div className="flex flex-col gap-2">
                {analyzed.map((c, i) => (
                  <div key={i} className="flex flex-col gap-2 px-3 py-3 rounded-lg border border-border bg-background">

                    {/* Name + domain */}
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium shrink-0 w-28 truncate" title={c.name}>{c.name}</p>
                      {editingDomainIdx === i ? (
                        <input
                          autoFocus
                          type="text"
                          value={c.domain ?? ""}
                          onChange={e => updateAnalyzed(i, {
                            domain: e.target.value.trim().toLowerCase()
                              .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || null
                          })}
                          onBlur={() => setEditingDomainIdx(null)}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingDomainIdx(null); }}
                          placeholder="domain.com"
                          className="flex-1 px-2 py-1 rounded-md border border-accent text-xs font-mono bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <p className={`text-xs font-mono truncate ${c.domain ? "text-muted" : "text-danger italic"}`}>
                            {c.domain ?? "no domain — click to add"}
                          </p>
                          <button
                            type="button"
                            onClick={() => setEditingDomainIdx(i)}
                            className="text-muted hover:text-foreground transition-colors shrink-0"
                            title="Edit domain"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Type toggles */}
                    <div className="flex gap-1.5">
                      {([
                        { label: "Brand", active: c.is_brand, toggle: () => updateAnalyzed(i, { is_brand: !c.is_brand }) },
                        { label: "Service Provider", active: c.is_service_provider, toggle: () => updateAnalyzed(i, { is_service_provider: !c.is_service_provider }) },
                      ]).map(({ label, active, toggle }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={toggle}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                            active
                              ? "border-accent bg-accent text-white"
                              : "border-border text-muted hover:border-accent hover:text-accent"
                          }`}
                        >
                          {active && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {label}
                        </button>
                      ))}
                      {!c.is_brand && !c.is_service_provider && (
                        <p className="text-xs text-danger self-center ml-1">Select at least one</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Step 3: Import progress */}
          {step === "importing" && (
            <>
              {finished && (
                <p className="text-sm font-medium">Done — {summaryParts}</p>
              )}
              <div className="flex flex-col gap-2">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-background">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs font-mono text-muted truncate">{r.domain}</p>
                    </div>
                    {r.status === "queued"     && <span className="text-xs text-muted shrink-0">Queued</span>}
                    {r.status === "processing" && <span className="text-xs text-yellow-600 dark:text-yellow-400 shrink-0">Processing…</span>}
                    {r.status === "done"       && <span className="text-xs text-success shrink-0">Queued for review</span>}
                    {r.status === "existing"   && <span className="text-xs text-muted shrink-0">Already exists — skipped</span>}
                    {r.status === "failed"     && <span className="text-xs text-danger shrink-0" title={r.error}>Failed</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3">
          {step === "input" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-border/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || names.length === 0}
                className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? "Analyzing…" : `Analyze ${names.length > 0 ? `${names.length} ` : ""}compan${names.length === 1 ? "y" : "ies"}`}
              </button>
            </>
          )}

          {step === "review" && (
            <>
              <button
                type="button"
                onClick={() => setStep("input")}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-border/40 transition-colors"
              >
                Back
              </button>
              {(() => {
                const valid = analyzed.filter(c => c.domain && (c.is_brand || c.is_service_provider));
                const hasTypeError = analyzed.some(c => c.domain && !c.is_brand && !c.is_service_provider);
                return (
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={valid.length === 0 || hasTypeError}
                    className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import {valid.length} compan{valid.length === 1 ? "y" : "ies"}
                  </button>
                );
              })()}
            </>
          )}

          {step === "importing" && (
            <button
              type="button"
              onClick={() => { onDone(); onClose(); }}
              disabled={importing}
              className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {importing ? "Importing…" : "Done"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
