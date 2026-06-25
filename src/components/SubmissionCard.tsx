"use client";

import { useState, useEffect, useRef } from "react";
import type React from "react";
import type { CompanySubmission } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const STATUS_CONFIG = {
  pending:  { label: "Pending review", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved: { label: "Approved",       className: "bg-success/10 text-success" },
  rejected: { label: "Rejected",       className: "bg-danger/10 text-danger" },
};

const APIFY_CONFIG = {
  pending:  { label: "Queued",        className: "bg-border text-muted" },
  running:  { label: "Fetching data", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  complete: { label: "Data ready",    className: "bg-success/10 text-success" },
  failed:   { label: "Fetch failed",  className: "bg-danger/10 text-danger" },
};

function typeLabel(s: CompanySubmission): string {
  if (s.is_brand && s.is_service_provider) return "Brand & Service Provider";
  if (s.is_service_provider) return "Service Provider";
  return "Brand";
}

function formatVisits(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

interface StagedSnapshot {
  global_rank: number | null;
  visits: number | null;
  bounce_rate: number | null;
  pages_per_visit: number | null;
  time_on_site: number | null;
  top_country_shares: { CountryCode?: string; Value?: number }[] | null;
  traffic_sources: Record<string, number> | null;
  top_keywords: { name?: string; esitmatedValue?: number }[] | null;
}

interface StagedCompany {
  id: string;
  description: string | null;
  description_cn: string | null;
  screenshot_url: string | null;
  logo_url: string | null;
}

interface StagedData {
  company: StagedCompany;
  snapshot: StagedSnapshot | null;
}

function StagedDataView({ stagedData, descriptionNode, descriptionCnNode }: { stagedData: StagedData; descriptionNode?: React.ReactNode; descriptionCnNode?: React.ReactNode }) {
  const { company, snapshot } = stagedData;
  const countries = (snapshot?.top_country_shares ?? []).slice(0, 5);
  const maxCountryShare = countries[0]?.Value ?? 1;
  const trafficEntries = Object.entries(snapshot?.traffic_sources ?? {})
    .map(([source, share]) => ({ source, share: share * 100 }))
    .sort((a, b) => b.share - a.share);
  const maxTrafficShare = trafficEntries[0]?.share ?? 1;
  const keywords = (snapshot?.top_keywords ?? []).slice(0, 5);

  return (
    <>
      {company.screenshot_url && (
        <img
          src={company.screenshot_url}
          alt="Company screenshot"
          className="w-full aspect-video object-cover rounded-lg border border-border"
        />
      )}
      {company.logo_url && (
        <div className="flex items-center gap-3">
          <img
            src={company.logo_url}
            alt="Company logo"
            className="w-10 h-10 rounded-lg object-contain border border-border bg-white p-1"
          />
          <span className="text-xs text-muted">Logo</span>
        </div>
      )}
      {descriptionNode ?? (company.description && (
        <p className="text-xs text-muted leading-relaxed">{company.description}</p>
      ))}
      {descriptionCnNode ?? (company.description_cn && (
        <p className="text-xs text-muted leading-relaxed">{company.description_cn}</p>
      ))}
      {snapshot && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Global Rank",    value: snapshot.global_rank != null ? `#${snapshot.global_rank.toLocaleString()}` : "—" },
              { label: "Monthly Visits", value: snapshot.visits != null ? formatVisits(snapshot.visits) : "—" },
              { label: "Bounce Rate",    value: snapshot.bounce_rate != null ? `${(snapshot.bounce_rate * 100).toFixed(1)}%` : "—" },
              { label: "Pages / Visit",  value: snapshot.pages_per_visit?.toFixed(1) ?? "—" },
              { label: "Avg. Duration",  value: snapshot.time_on_site != null ? formatTime(snapshot.time_on_site) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-background rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted mb-0.5">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {countries.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted">Top Countries</p>
              {countries.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-28 truncate">{c.CountryCode ?? "—"}</span>
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${((c.Value ?? 0) / maxCountryShare) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-10 text-right">
                    {((c.Value ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {trafficEntries.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted">Traffic Sources</p>
              {trafficEntries.map(({ source, share }) => (
                <div key={source} className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-28 truncate">{source}</span>
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${(share / maxTrafficShare) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-10 text-right">{share.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}

          {keywords.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted">Top Keywords</p>
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden">
                {keywords.map((k, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-background">
                    <span className="text-xs text-foreground">{k.name ?? "—"}</span>
                    <span className="text-xs text-muted">
                      {k.esitmatedValue != null ? formatVisits(k.esitmatedValue) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function SubmissionDetailModal({
  submission: s,
  onClose,
  onRefresh,
}: {
  submission: CompanySubmission;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const statusCfg = STATUS_CONFIG[s.status];
  const apifyCfg = APIFY_CONFIG[s.apify_status ?? "pending"];
  const images = s.images as string[];

  const [stagedData, setStagedData] = useState<StagedData | null>(null);
  const [loadingStaged, setLoadingStaged] = useState(false);

  const [actioning, setActioning] = useState<"approve" | "reject" | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [editingDesc, setEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  const [editingDescCn, setEditingDescCn] = useState(false);
  const [descCnInput, setDescCnInput] = useState("");
  const [savingDescCn, setSavingDescCn] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (s.apify_status !== "complete") return;
    setLoadingStaged(true);

    (async () => {
      const { data: company } = await supabase
        .from("staged_companies")
        .select("id, description, description_cn, screenshot_url, logo_url")
        .eq("submission_id", s.id)
        .maybeSingle();

      if (!company) return;

      const { data: snapshot } = await supabase
        .from("staged_snapshots")
        .select("global_rank, visits, bounce_rate, pages_per_visit, time_on_site, top_country_shares, traffic_sources, top_keywords")
        .eq("staged_company_id", company.id)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      setStagedData({ company, snapshot: snapshot ?? null });
      setDescInput(company.description ?? "");
      setDescCnInput(company.description_cn ?? "");
    })().finally(() => setLoadingStaged(false));
  }, [s.id, s.apify_status]);

  const handleApprove = async () => {
    setActioning("approve");
    setActionError(null);
    const { error } = await supabase.rpc("approve_submission", { p_submission_id: s.id });
    if (error) {
      setActionError(error.message);
      setActioning(null);
    } else {
      onRefresh?.();
      onClose();
    }
  };

  const handleReject = async () => {
    setActioning("reject");
    setActionError(null);
    const { error } = await supabase
      .from("company_submissions")
      .update({
        status: "rejected",
        reviewer_notes: rejectNotes.trim() || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", s.id);
    if (error) {
      setActionError(error.message);
      setActioning(null);
    } else {
      onRefresh?.();
      onClose();
    }
  };

  const handleSaveDesc = async () => {
    if (!stagedData) return;
    setSavingDesc(true);
    const { error } = await supabase
      .from("staged_companies")
      .update({ description: descInput })
      .eq("id", stagedData.company.id);
    if (error) {
      alert(`Failed to save: ${error.message}`);
    } else {
      setStagedData(prev => prev ? { ...prev, company: { ...prev.company, description: descInput } } : null);
      setEditingDesc(false);
    }
    setSavingDesc(false);
  };

  const handleSaveDescCn = async () => {
    if (!stagedData) return;
    setSavingDescCn(true);
    const { error } = await supabase
      .from("staged_companies")
      .update({ description_cn: descCnInput })
      .eq("id", stagedData.company.id);
    if (error) {
      alert(`Failed to save: ${error.message}`);
    } else {
      setStagedData(prev => prev ? { ...prev, company: { ...prev.company, description_cn: descCnInput } } : null);
      setEditingDescCn(false);
    }
    setSavingDescCn(false);
  };

  const canAction = s.status === "pending";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="font-bold text-base truncate">{s.name}</p>
            <p className="text-xs text-muted font-mono mt-0.5">{s.domain}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted">{typeLabel(s)}</span>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
            <button
              onClick={onClose}
              className="ml-1 text-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-5">

          {/* Details table */}
          <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <span className="text-xs text-muted self-center">Submitted</span>
            <span className="text-xs text-foreground">{new Date(s.created_at).toLocaleDateString()}</span>

            <span className="text-xs text-muted self-center">Data fetching</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${apifyCfg.className}`}>
              {apifyCfg.label}
            </span>

            {s.is_brand && s.related_service_provider_names.length > 0 && (
              <>
                <span className="text-xs text-muted self-start pt-0.5">Service providers they work with</span>
                <div className="flex flex-wrap gap-1.5">
                  {s.related_service_provider_names.map((name, i) => (
                    <span key={i} className="text-xs px-2.5 py-0.5 rounded-full bg-accent-light text-accent">
                      {name}
                    </span>
                  ))}
                </div>
              </>
            )}
            {s.is_service_provider && s.related_brand_names.length > 0 && (
              <>
                <span className="text-xs text-muted self-start pt-0.5">Brands they serve</span>
                <div className="flex flex-wrap gap-1.5">
                  {s.related_brand_names.map((name, i) => (
                    <span key={i} className="text-xs px-2.5 py-0.5 rounded-full bg-accent-light text-accent">
                      {name}
                    </span>
                  ))}
                </div>
              </>
            )}

            {s.reviewer_notes && (
              <>
                <span className="text-xs text-muted self-start pt-0.5">Notes</span>
                <p className="text-xs text-foreground">{s.reviewer_notes}</p>
              </>
            )}
          </div>

          {/* Promotional images */}
          {images.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted">Promotional images ({images.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`${s.name} image ${i + 1}`}
                    className="w-full aspect-video object-cover rounded-lg border border-border"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Company data */}
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">Company Data</p>
              {s.apify_status !== "complete" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${apifyCfg.className}`}>
                  {apifyCfg.label}
                </span>
              )}
            </div>

            {s.apify_status === "complete" && loadingStaged && (
              <p className="text-xs text-muted">Loading…</p>
            )}
            {s.apify_status === "complete" && !loadingStaged && stagedData && (
              <StagedDataView
                stagedData={stagedData}
                descriptionCnNode={
                  editingDescCn ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] text-muted font-medium">Chinese description</p>
                      <textarea
                        value={descCnInput}
                        onChange={e => setDescCnInput(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveDescCn}
                          disabled={savingDescCn}
                          className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {savingDescCn ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => { setEditingDescCn(false); setDescCnInput(stagedData.company.description_cn ?? ""); }}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-foreground hover:bg-border/40 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted font-medium mb-0.5">Chinese description</p>
                        <p className="text-xs text-muted leading-relaxed">{stagedData.company.description_cn || <span className="italic">Not translated yet.</span>}</p>
                      </div>
                      {canAction && (
                        <button
                          onClick={() => { setDescCnInput(stagedData.company.description_cn ?? ""); setEditingDescCn(true); }}
                          className="text-muted hover:text-foreground transition-colors shrink-0 mt-0.5"
                          title="Edit Chinese description"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                }
                descriptionNode={
                  editingDesc ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={descInput}
                        onChange={e => setDescInput(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveDesc}
                          disabled={savingDesc}
                          className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {savingDesc ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => { setEditingDesc(false); setDescInput(stagedData.company.description ?? ""); }}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-foreground hover:bg-border/40 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="text-xs text-muted leading-relaxed flex-1">{stagedData.company.description || <span className="italic">No description.</span>}</p>
                      {canAction && (
                        <button
                          onClick={() => { setDescInput(stagedData.company.description ?? ""); setEditingDesc(true); }}
                          className="text-muted hover:text-foreground transition-colors shrink-0 mt-0.5"
                          title="Edit description"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                }
              />
            )}
            {s.apify_status === "complete" && !loadingStaged && !stagedData && (
              <p className="text-xs text-muted">No scraped data found for this submission.</p>
            )}
            {s.apify_status === "running" && (
              <p className="text-xs text-muted">Data is being fetched — check back shortly.</p>
            )}
            {s.apify_status === "pending" && (
              <p className="text-xs text-muted">Data fetch not started yet.</p>
            )}
            {s.apify_status === "failed" && (
              <p className="text-xs text-danger">Data fetch failed. The run can be retried manually.</p>
            )}
          </div>
        </div>

        {/* Footer — approve / reject (pending submissions only) */}
        {canAction && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex flex-col gap-3">
            {showRejectForm ? (
              <>
                <textarea
                  value={rejectNotes}
                  onChange={e => setRejectNotes(e.target.value)}
                  placeholder="Rejection reason (optional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-danger/50 focus:border-danger transition-colors resize-none"
                />
                {actionError && <p className="text-xs text-danger">{actionError}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowRejectForm(false); setRejectNotes(""); setActionError(null); }}
                    disabled={!!actioning}
                    className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-border/40 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={!!actioning}
                    className="flex-1 py-2.5 rounded-lg bg-danger text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {actioning === "reject" ? "Rejecting…" : "Confirm Reject"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {actionError && <p className="text-xs text-danger">{actionError}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowRejectForm(true); setActionError(null); }}
                    disabled={!!actioning}
                    className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-border/40 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={!!actioning}
                    className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {actioning === "approve" ? "Approving…" : "Approve"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SubmissionCard({
  submission: s,
  onRefresh,
  selected,
  onSelect,
}: {
  submission: CompanySubmission;
  onRefresh?: () => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const statusCfg = STATUS_CONFIG[s.status];

  return (
    <>
      <div className="flex items-center gap-2 w-full min-w-0">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={e => { e.stopPropagation(); onSelect(s.id, e.target.checked); }}
            className="w-4 h-4 rounded accent-accent shrink-0 cursor-pointer"
          />
        )}
        <button
          onClick={() => setModalOpen(true)}
          className="flex-1 text-left rounded-xl border border-border bg-card px-5 py-4 flex items-center justify-between gap-4 hover:border-accent/50 hover:bg-accent-light/30 transition-colors"
        >
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{s.name}</p>
            <p className="text-xs text-muted font-mono truncate">{s.domain}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted">{typeLabel(s)}</span>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
            <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>
      </div>

      {modalOpen && (
        <SubmissionDetailModal
          submission={s}
          onClose={() => setModalOpen(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
