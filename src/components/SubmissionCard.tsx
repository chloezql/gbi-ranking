"use client";

import { useState, useEffect, useRef } from "react";
import type { CompanySubmission } from "@/lib/types";

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

const MOCK_COMPANY_DATA = {
  description: "A global leader in consumer beauty and personal care products, offering a wide range of skincare, haircare, and cosmetics brands across 150+ countries.",
  screenshotUrl: "https://placehold.co/600x340/e5e7eb/9ca3af?text=Company+Screenshot",
  globalRank: 1_482,
  monthlyVisits: "24.3M",
  bounceRate: "42.1%",
  pagesPerVisit: 4.8,
  avgVisitDuration: "3m 22s",
  topCountries: [
    { code: "US", name: "United States", share: 28.4 },
    { code: "UK", name: "United Kingdom", share: 12.1 },
    { code: "DE", name: "Germany", share: 9.7 },
    { code: "FR", name: "France", share: 8.3 },
  ],
  trafficSources: [
    { source: "Direct",        share: 38.2 },
    { source: "Organic Search", share: 31.5 },
    { source: "Social",        share: 14.7 },
    { source: "Referral",      share: 10.1 },
    { source: "Email",         share: 5.5 },
  ],
  topKeywords: [
    { name: "skincare products",  visits: "320K" },
    { name: "beauty brands",      visits: "210K" },
    { name: "hair care routine",  visits: "185K" },
    { name: "luxury cosmetics",   visits: "142K" },
  ],
};

function SubmissionDetailModal({
  submission: s,
  onClose,
}: {
  submission: CompanySubmission;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const statusCfg = STATUS_CONFIG[s.status];
  const apifyCfg = APIFY_CONFIG[s.apify_status ?? "pending"];
  const images = s.images as string[];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
            <span className="text-xs text-muted">
              {s.company_type === "service_provider" ? "Service Provider" : "Brand"}
            </span>
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

            {s.related_companies.length > 0 && (
              <>
                <span className="text-xs text-muted self-start pt-0.5">
                  {s.company_type === "brand" ? "Service Providers" : "Customers"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {s.related_companies.map((name, i) => (
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

          {/* Images */}
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

          {/* Mock company data — placeholder until Apify data is fetched */}
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">Company Data</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-border text-muted">Mock</span>
            </div>

            {/* Screenshot */}
            <img
              src={MOCK_COMPANY_DATA.screenshotUrl}
              alt="Company screenshot"
              className="w-full aspect-video object-cover rounded-lg border border-border"
            />

            {/* Description */}
            <p className="text-xs text-muted leading-relaxed">{MOCK_COMPANY_DATA.description}</p>

            {/* Traffic stats grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Global Rank",      value: `#${MOCK_COMPANY_DATA.globalRank.toLocaleString()}` },
                { label: "Monthly Visits",   value: MOCK_COMPANY_DATA.monthlyVisits },
                { label: "Bounce Rate",      value: MOCK_COMPANY_DATA.bounceRate },
                { label: "Pages / Visit",    value: MOCK_COMPANY_DATA.pagesPerVisit },
                { label: "Avg. Duration",    value: MOCK_COMPANY_DATA.avgVisitDuration },
              ].map(({ label, value }) => (
                <div key={label} className="bg-background rounded-lg px-3 py-2">
                  <p className="text-[10px] text-muted mb-0.5">{label}</p>
                  <p className="text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {/* Top countries */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted">Top Countries</p>
              {MOCK_COMPANY_DATA.topCountries.map(c => (
                <div key={c.code} className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-28 truncate">{c.name}</span>
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${(c.share / MOCK_COMPANY_DATA.topCountries[0].share) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-10 text-right">{c.share}%</span>
                </div>
              ))}
            </div>

            {/* Traffic sources */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted">Traffic Sources</p>
              {MOCK_COMPANY_DATA.trafficSources.map(t => (
                <div key={t.source} className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-28 truncate">{t.source}</span>
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${(t.share / MOCK_COMPANY_DATA.trafficSources[0].share) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-10 text-right">{t.share}%</span>
                </div>
              ))}
            </div>

            {/* Top keywords */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted">Top Keywords</p>
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden">
                {MOCK_COMPANY_DATA.topKeywords.map((k, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-background">
                    <span className="text-xs text-foreground">{k.name}</span>
                    <span className="text-xs text-muted">{k.visits}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3">
          <button
            disabled
            className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted cursor-not-allowed opacity-50"
          >
            Reject
          </button>
          <button
            disabled
            className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold opacity-50 cursor-not-allowed"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

export function SubmissionCard({ submission: s }: { submission: CompanySubmission }) {
  const [modalOpen, setModalOpen] = useState(false);
  const statusCfg = STATUS_CONFIG[s.status];

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full text-left rounded-xl border border-border bg-card px-5 py-4 flex items-center justify-between gap-4 hover:border-accent/50 hover:bg-accent-light/30 transition-colors"
      >
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{s.name}</p>
          <p className="text-xs text-muted font-mono truncate">{s.domain}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted">
            {s.company_type === "service_provider" ? "Service Provider" : "Brand"}
          </span>
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
          <svg className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </button>

      {modalOpen && (
        <SubmissionDetailModal
          submission={s}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
