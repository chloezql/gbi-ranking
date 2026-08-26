"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { CompanySubmission, CompanyClaim, CompanyProfileUpdate } from "@/lib/types";
import { SubmissionCard } from "@/components/SubmissionCard";
import { BatchImportModal } from "@/components/BatchImportModal";
import { ProfileUpdateReviewCard } from "@/components/ProfileUpdateReviewCard";
import { getUserClaims } from "@/lib/data";

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: "user" | "admin";
  is_partner: boolean;
}


export default function DashboardPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<CompanySubmission[] | null>(null);
  const [profileUpdates, setProfileUpdates] = useState<CompanyProfileUpdate[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("user_profiles")
      .select("display_name, avatar_url, bio, role, is_partner")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [user]);

  useEffect(() => {
    if (!user || role === null) return;

    const query = supabase
      .from("company_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (role !== "admin") {
      query.eq("submitted_by", user.id);
    }

    query.then(({ data }) => setSubmissions((data as CompanySubmission[]) ?? []));
  }, [user, role, refreshKey]);

  useEffect(() => {
    if (!user || role !== "admin") return;
    supabase
      .from("company_profile_updates")
      .select("id, company_id, submitted_by, status, changes, reviewer_notes, reviewed_at, created_at, companies ( domain, title, logo_url )")
      .order("created_at", { ascending: false })
      .then(({ data }) => setProfileUpdates((data as unknown as CompanyProfileUpdate[]) ?? []));
  }, [user, role, refreshKey]);

  if (loading || !user) return null;

  const isAdmin = role === "admin";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <nav className="text-sm text-muted mb-8">
        <Link href="/" className="hover:text-accent transition-colors">
          Rankings
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Dashboard</span>
      </nav>
      <div className="flex flex-col gap-10">
        <ProfileSection user={user} profile={profile} onSave={setProfile} />
        {isAdmin ? (
          <>
            <GrantPartnerSection />
            <AdminReviewSection submissions={submissions} onRefresh={() => setRefreshKey(k => k + 1)} />
            <ProfileUpdateReviewSection updates={profileUpdates} onRefresh={() => setRefreshKey(k => k + 1)} />
          </>
        ) : (
          <>
            <MyCompanySection user={user} />
            <CompanySection submissions={submissions} />
          </>
        )}
      </div>
    </div>
  );
}

function ProfileUpdateReviewSection({ updates, onRefresh }: { updates: CompanyProfileUpdate[] | null; onRefresh: () => void }) {
  const pending = (updates ?? []).filter((update) => update.status === "pending");
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">Profile Updates</h2>
        {pending.length > 0 && <span className="px-2 py-0.5 rounded-full bg-accent text-white text-xs font-semibold">{pending.length}</span>}
      </div>
      {updates === null ? (
        <div className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted">Loading...</div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted">No pending profile updates.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((update) => <ProfileUpdateReviewCard key={update.id} update={update} onRefresh={onRefresh} />)}
        </div>
      )}
    </section>
  );
}

function typeLabel(s: CompanySubmission): string {
  if (s.is_brand && s.is_service_provider) return "Brand & Service Provider";
  if (s.is_service_provider) return "Service Provider";
  return "Brand";
}

const STATUS_CONFIG = {
  pending:  { label: "Pending review", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved: { label: "Approved",       className: "bg-success/10 text-success" },
  rejected: { label: "Rejected",       className: "bg-danger/10 text-danger" },
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  approved: {
    label: "Claimed",
    className: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  manual_review: {
    label: "Email mismatch",
    className: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  },
  pending: {
    label: "Pending",
    className: "bg-gray-100 dark:bg-gray-800 text-muted border-border",
  },
};

function MyCompanySection({ user }: { user: User }) {
  const [claims, setClaims] = useState<CompanyClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserClaims()
      .then(setClaims)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.id]);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Claimed Companies</h2>
      {loading ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-muted text-sm">Loading…</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-10 py-12 text-center">
          <p className="text-muted text-sm font-medium">No claimed companies yet.</p>
          <p className="text-muted text-xs mt-2 leading-relaxed">
            Visit a company page and click &ldquo;Claim this company&rdquo; to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {claims.map((claim) => {
            const company = claim.companies;
            const badge = STATUS_LABEL[claim.status] ?? STATUS_LABEL.pending;
            return (
              <div
                key={claim.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
              >
                {company?.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt={company.domain}
                    className="w-10 h-10 rounded-lg object-contain border border-border shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg border border-border bg-background flex items-center justify-center shrink-0 text-sm font-semibold text-foreground">
                    {company?.domain?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base text-foreground truncate">
                    {company?.title && company.title !== company.domain
                      ? company.title
                      : company?.domain}
                  </p>
                  <p className="text-sm text-muted mt-0.5 truncate">{company?.domain}</p>
                </div>
                <span className={`text-sm font-medium px-2.5 py-1 rounded-full border ${badge.className}`}>
                  {badge.label}
                </span>
                <Link
                  href={`/company/${encodeURIComponent(company?.domain ?? "")}`}
                  className="text-sm text-accent hover:underline shrink-0"
                >
                  View
                </Link>
                {claim.status === "approved" && (
                  <Link
                    href={`/company/${encodeURIComponent(company?.domain ?? "")}/edit`}
                    className="text-sm font-semibold text-accent hover:underline shrink-0"
                  >
                    Edit
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CompanySection({ submissions }: { submissions: CompanySubmission[] | null }) {
  const [page, setPage] = useState(1);
  const total = submissions?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginated = (submissions ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Created Companies</h2>
        <Link
          href="/company/create"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
        >
          + Add company
        </Link>
      </div>

      {submissions === null ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-muted text-sm">Loading…</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-muted text-sm font-medium">No companies submitted yet.</p>
          <p className="text-muted text-xs mt-2">Click &ldquo;+ Add company&rdquo; to get started.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {paginated.map(s => {
              const cfg = STATUS_CONFIG[s.status];
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-card px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-2 sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted font-mono truncate">{s.domain}</p>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="hidden sm:inline text-xs text-muted">{typeLabel(s)}</span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap ${cfg.className}`}>
                      {cfg.label}
                    </span>
                    {s.status === "approved" && (
                      <Link
                        href={`/company/${encodeURIComponent(s.domain)}`}
                        className="text-xs text-accent hover:underline shrink-0"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-border/40 transition-colors disabled:opacity-30 disabled:cursor-default"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-muted">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                          page === p ? "bg-accent text-white" : "border border-border text-muted hover:text-foreground hover:bg-border/40"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-border/40 transition-colors disabled:opacity-30 disabled:cursor-default"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

type FilterStatus = "pending" | "approved" | "rejected";

const PAGE_SIZE = 10;

function AdminReviewSection({ submissions, onRefresh }: { submissions: CompanySubmission[] | null; onRefresh: () => void }) {
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [batchOpen, setBatchOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [page, setPage] = useState(1);

  const list = submissions ?? [];
  const filtered = list.filter(s => s.status === filter);
  const counts = {
    pending:  list.filter(s => s.status === "pending").length,
    approved: list.filter(s => s.status === "approved").length,
    rejected: list.filter(s => s.status === "rejected").length,
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPageSelected = paginated.length > 0 && paginated.every(s => selectedIds.has(s.id));

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  const handleFilterChange = (f: FilterStatus) => {
    setFilter(f);
    setSelectedIds(new Set());
    setPage(1);
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0 || approving) return;
    setApproving(true);
    for (const id of selectedIds) {
      await supabase.rpc("approve_submission", { p_submission_id: id });
    }
    setApproving(false);
    setSelectedIds(new Set());
    onRefresh();
  };

  return (
    <section>
      {batchOpen && (
        <BatchImportModal
          onClose={() => setBatchOpen(false)}
          onDone={() => { setBatchOpen(false); onRefresh(); }}
        />
      )}
      <h2 className="text-lg font-semibold mb-4">Company Submissions</h2>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex gap-1 p-1 bg-border/30 rounded-xl">
          {(["pending", "approved", "rejected"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => handleFilterChange(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === tab ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {tab}
              {counts[tab] > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  filter === tab ? "bg-accent text-white" : "bg-border text-muted"
                }`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setBatchOpen(true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
        >
          + Batch Import
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-muted text-sm">No {filter} submissions.</p>
        </div>
      ) : (
        <>
          {filter === "pending" && (
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
                {allPageSelected ? "Deselect page" : "Select page"}
              </label>
              <button
                onClick={handleBatchApprove}
                disabled={approving || selectedIds.size === 0}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg bg-success text-white hover:opacity-90 transition-opacity disabled:opacity-50 ${selectedIds.size === 0 ? "invisible" : ""}`}
              >
                {approving ? "Approving…" : `Approve ${selectedIds.size} selected`}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {paginated.map(s => (
              <SubmissionCard
                key={s.id}
                submission={s}
                onRefresh={onRefresh}
                selected={selectedIds.has(s.id)}
                onSelect={filter === "pending" ? toggleSelect : undefined}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-border/40 transition-colors disabled:opacity-30 disabled:cursor-default"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-muted">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                          page === p
                            ? "bg-accent text-white"
                            : "border border-border text-muted hover:text-foreground hover:bg-border/40"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-border/40 transition-colors disabled:opacity-30 disabled:cursor-default"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface PartnerUser {
  id: string;
  email: string;
  display_name: string | null;
  is_partner: boolean;
}

function GrantPartnerSection() {
  const [tab, setTab] = useState<"search" | "batch">("search");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<PartnerUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<PartnerUser[]>([]);
  const [batchInput, setBatchInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState<{ id: string; display_name: string | null }[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [refreshPartners, setRefreshPartners] = useState(0);

  useEffect(() => {
    supabase
      .from("user_profiles")
      .select("id, display_name")
      .eq("is_partner", true)
      .then(({ data }) => setPartners(data ?? []));
  }, [refreshPartners]);

  useEffect(() => {
    if (!searchEmail.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("search_users_by_email", { p_email: searchEmail.trim() });
      setSearchResults((data as PartnerUser[]) ?? []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [searchEmail]);

  const selectUser = (u: PartnerUser) => {
    if (selectedUsers.some(s => s.id === u.id)) return;
    setSelectedUsers(prev => [...prev, u]);
    setSearchEmail("");
    setSearchResults([]);
  };

  const removeSelected = (id: string) => setSelectedUsers(prev => prev.filter(u => u.id !== id));

  const grant = async (emails: string[]) => {
    if (!emails.length) return;
    setSaving(true);
    setFeedback(null);
    const { error } = await supabase.rpc("grant_partner_role", { p_emails: emails });
    setSaving(false);
    if (error) {
      setFeedback({ ok: false, text: error.message });
    } else {
      setFeedback({ ok: true, text: `Partner granted to ${emails.length} user(s).` });
      setRefreshPartners(k => k + 1);
      if (tab === "batch") setBatchInput("");
      if (tab === "search") setSelectedUsers([]);
    }
  };

  const batchEmails = batchInput.split("\n").map(e => e.trim()).filter(Boolean);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Grant Partner</h2>
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">

        <div className="flex gap-1 p-1 bg-border/30 rounded-xl w-fit">
          {(["search", "batch"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setFeedback(null); setSearchEmail(""); setSearchResults([]); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {t === "search" ? "Search User" : "Batch"}
            </button>
          ))}
        </div>

        {tab === "search" && (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by email…"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">Searching…</span>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {searchResults.map(u => {
                    const alreadySelected = selectedUsers.some(s => s.id === u.id);
                    const initial = (u.display_name ?? u.email).charAt(0).toUpperCase();
                    const selectable = !u.is_partner && !alreadySelected;
                    return (
                      <button
                        key={u.id}
                        onClick={() => selectable && selectUser(u)}
                        disabled={!selectable}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-border/30 transition-colors disabled:cursor-default text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
                          {initial}
                        </div>
                        <span className={`flex-1 text-sm truncate ${!selectable ? "text-muted" : "text-foreground"}`}>
                          {u.email}
                        </span>
                        {u.is_partner
                          ? <span className="w-2 h-2 rounded-full bg-accent shrink-0" title="Already a partner" />
                          : alreadySelected
                          ? <svg className="w-3.5 h-3.5 text-success shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          : <svg className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        }
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedUsers.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <span key={u.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                      {u.display_name ?? u.email}
                      <button onClick={() => removeSelected(u.id)} className="hover:opacity-70 transition-opacity leading-none">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted px-1">{selectedUsers.length} selected</p>
                  <button
                    onClick={() => grant(selectedUsers.map(u => u.email))}
                    disabled={saving}
                    className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? "Granting…" : "Grant All"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "batch" && (
          <div className="flex flex-col gap-3">
            <textarea
              placeholder={"user1@example.com\nuser2@example.com\nuser3@example.com"}
              value={batchInput}
              onChange={e => setBatchInput(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none font-mono"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">{batchEmails.length} email(s)</p>
              <button
                onClick={() => grant(batchEmails)}
                disabled={saving || batchEmails.length === 0}
                className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Granting…" : "Grant All"}
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <p className={`text-sm font-medium ${feedback.ok ? "text-success" : "text-danger"}`}>
            {feedback.text}
          </p>
        )}
      </div>

      {partners.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 mt-4">
          <p className="text-xs font-medium text-muted mb-2">Current partners ({partners.length})</p>
          <div className="flex flex-wrap gap-2">
            {partners.map(p => (
              <span key={p.id} className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                {p.display_name ?? p.id}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ProfileSection({
  user,
  profile,
  onSave,
}: {
  user: User;
  profile: UserProfile | null;
  onSave: (updated: UserProfile) => void;
}) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");

  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");

  const [savingName, setSavingName] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const bioInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setBio(profile?.bio ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
  }, [profile]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    if (editingBio) bioInputRef.current?.focus();
  }, [editingBio]);

  const upsert = async (patch: Partial<UserProfile>) => {
    const row = {
      id: user.id,
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
      bio: bio || null,
      updated_at: new Date().toISOString(),
      ...patch,
    };
    const { error } = await supabase.from("user_profiles").upsert(row);
    if (!error) {
      onSave({ display_name: row.display_name, avatar_url: row.avatar_url, bio: row.bio, role: profile?.role ?? "user", is_partner: profile?.is_partner ?? false });
    }
    return !error;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const newUrl = `${data.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newUrl);
      await upsert({ avatar_url: newUrl });
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSaveName = async () => {
    setSavingName(true);
    const ok = await upsert({ display_name: nameInput || null });
    if (ok) { setDisplayName(nameInput); setEditingName(false); }
    setSavingName(false);
  };

  const handleSaveBio = async () => {
    setSavingBio(true);
    const ok = await upsert({ bio: bioInput || null });
    if (ok) { setBio(bioInput); setEditingBio(false); }
    setSavingBio(false);
  };

  const viewName = displayName || user.email?.split("@")[0] || "User";

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        {profile?.is_partner && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-accent/40 text-accent bg-accent/8">Partner</span>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start gap-6">

          {/* Avatar */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border border-accent"
              />
            ) : (
              <div className="w-20 h-20 rounded-full border border-accent bg-card text-accent flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload photo"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
            >
              {uploading ? (
                <span className="text-[9px] font-bold">…</span>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Fields */}
          <div className="flex-1 min-w-0 flex flex-col gap-3 pt-1">

            {/* Display name */}
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                  placeholder="Your name"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="w-7 h-7 rounded-lg border border-border text-muted flex items-center justify-center hover:text-foreground hover:bg-border/40 transition-colors shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold truncate">{viewName}</span>
                <button
                  onClick={() => { setNameInput(displayName); setEditingName(true); }}
                  className="text-muted hover:text-foreground transition-colors"
                  title="Edit name"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
              </div>
            )}

            {/* Email */}
            <p className="text-sm text-muted -mt-1">{user.email}</p>

            {/* Bio */}
            {editingBio ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={bioInputRef}
                  value={bioInput}
                  onChange={e => setBioInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Escape") setEditingBio(false); }}
                  placeholder="A short bio about yourself"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveBio}
                    disabled={savingBio}
                    className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingBio(false)}
                    className="w-7 h-7 rounded-lg border border-border text-muted flex items-center justify-center hover:text-foreground hover:bg-border/40 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm text-foreground">{bio || <span className="text-muted italic">No bio yet.</span>}</span>
                <button
                  onClick={() => { setBioInput(bio); setEditingBio(true); }}
                  className="text-sm font-medium text-accent hover:underline shrink-0"
                >
                  Edit
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
}
