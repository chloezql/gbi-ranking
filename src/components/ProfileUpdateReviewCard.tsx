"use client";

import { useState } from "react";
import type { CompanyProfileUpdate } from "@/lib/types";
import { categoryName } from "@/lib/company-taxonomy";
import { supabase } from "@/lib/supabase";

function formatValue(key: string, value: unknown): string {
  if (key === "company_type") return value === "service_provider" ? "Service Provider" : "Brand";
  if (key === "primary_category_slug") return categoryName(String(value));
  if (key === "category_slugs" && Array.isArray(value)) return value.map((slug) => categoryName(String(slug))).join(", ");
  if (key === "country_code") return String(value).toUpperCase();
  return String(value);
}

const LABELS: Record<string, string> = {
  title: "Company name",
  description: "Description",
  logo_url: "Logo URL",
  country_code: "Origin market",
  company_type: "Company type",
  primary_category_slug: "Primary category",
  category_slugs: "Additional categories",
};

export function ProfileUpdateReviewCard({ update, onRefresh }: { update: CompanyProfileUpdate; onRefresh: () => void }) {
  const [note, setNote] = useState("");
  const [actioning, setActioning] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (status: "approved" | "rejected") => {
    setActioning(status);
    setError(null);
    const { error: rpcError } = await supabase.rpc("review_company_profile_update", {
      p_update_id: update.id,
      p_status: status,
      p_reviewer_note: note.trim() || null,
    });
    setActioning(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onRefresh();
  };

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <p className="font-semibold truncate">{update.companies?.title || update.companies?.domain}</p>
          <p className="text-xs text-muted font-mono truncate">{update.companies?.domain}</p>
        </div>
        <time className="text-xs text-muted shrink-0">{new Date(update.created_at).toLocaleDateString()}</time>
      </div>
      <dl className="space-y-3">
        {Object.entries(update.changes).map(([key, value]) => (
          <div key={key} className="grid grid-cols-[112px_1fr] gap-3 text-sm">
            <dt className="text-muted">{LABELS[key] ?? key}</dt>
            <dd className="break-words">{formatValue(key, value)}</dd>
          </div>
        ))}
      </dl>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reviewer note (optional)" rows={2} className="mt-4 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-accent/50" />
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" onClick={() => review("rejected")} disabled={actioning !== null} className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-danger disabled:opacity-50">{actioning === "rejected" ? "Rejecting..." : "Reject"}</button>
        <button type="button" onClick={() => review("approved")} disabled={actioning !== null} className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50">{actioning === "approved" ? "Approving..." : "Approve"}</button>
      </div>
    </article>
  );
}
