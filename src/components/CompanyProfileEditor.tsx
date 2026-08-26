"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { COMPANY_CATEGORIES, COMPANY_TYPES, type CompanyType } from "@/lib/company-taxonomy";
import { getClaimStatus } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export type EditableCompanyProfile = {
  domain: string;
  title: string;
  description: string;
  logoUrl: string;
  originCountry: string;
  companyType: CompanyType;
  primaryCategory: string;
  categorySlugs: string[];
};

export function CompanyProfileEditor({ profile }: { profile: EditableCompanyProfile }) {
  const { user, loading: authLoading, openModal } = useAuth();
  const [claimStatus, setClaimStatus] = useState<"loading" | "approved" | "unclaimed">("loading");
  const [title, setTitle] = useState(profile.title);
  const [description, setDescription] = useState(profile.description);
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl);
  const [originCountry, setOriginCountry] = useState(profile.originCountry);
  const [companyType, setCompanyType] = useState<CompanyType>(profile.companyType);
  const [primaryCategory, setPrimaryCategory] = useState(profile.primaryCategory || "other");
  const [categories, setCategories] = useState<string[]>(profile.categorySlugs);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setClaimStatus("unclaimed");
      return;
    }
    getClaimStatus(profile.domain)
      .then((status) => setClaimStatus(status === "approved" ? "approved" : "unclaimed"))
      .catch(() => setClaimStatus("unclaimed"));
  }, [authLoading, profile.domain, user]);

  const proposedChanges = useMemo(() => {
    const changes: Record<string, unknown> = {};
    if (title.trim() !== profile.title) changes.title = title.trim();
    if (description.trim() !== profile.description) changes.description = description.trim();
    if (logoUrl.trim() !== profile.logoUrl) changes.logo_url = logoUrl.trim();
    if (originCountry.trim().toUpperCase() !== profile.originCountry) changes.country_code = originCountry.trim().toUpperCase();
    if (companyType !== profile.companyType) changes.company_type = companyType;
    if (primaryCategory !== profile.primaryCategory) changes.primary_category_slug = primaryCategory;
    const categorySlugs = [primaryCategory, ...categories.filter((slug) => slug !== primaryCategory)];
    if (JSON.stringify(categorySlugs) !== JSON.stringify(profile.categorySlugs)) changes.category_slugs = categorySlugs;
    return changes;
  }, [categories, companyType, description, logoUrl, originCountry, primaryCategory, profile, title]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (Object.keys(proposedChanges).length === 0) {
      setError("Change at least one field before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("submit_company_profile_update", {
      p_domain: profile.domain,
      p_changes: proposedChanges,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSubmitted(true);
  };

  if (authLoading || claimStatus === "loading") {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-sm text-muted">Loading profile access...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold">Manage company profile</h1>
        <p className="mt-3 text-muted">Sign in with the verified company owner account to manage this profile.</p>
        <button onClick={openModal} className="mt-6 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold">Sign in</button>
      </div>
    );
  }

  if (claimStatus !== "approved") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold">Profile access required</h1>
        <p className="mt-3 text-muted">Only the verified owner of {profile.domain} can propose company profile changes.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold text-accent">Company profile</p>
        <h1 className="mt-1 text-3xl font-bold">Edit {profile.title}</h1>
        <p className="mt-2 text-sm text-muted">Updates are reviewed by GBI before they appear on the public company profile.</p>
      </div>

      {submitted ? (
        <div className="border border-success/30 bg-success/10 rounded-lg p-6">
          <h2 className="font-semibold text-success">Update submitted for review</h2>
          <p className="mt-2 text-sm text-muted">The public profile will update after an administrator approves the changes.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <section className="border-b border-border pb-6">
            <h2 className="text-lg font-semibold">Basic profile</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium">Company name
                <input value={title} onChange={(event) => setTitle(event.target.value)} required className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background font-normal focus:outline-none focus:ring-2 focus:ring-accent/50" />
              </label>
              <label className="block text-sm font-medium">Description
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background font-normal resize-y focus:outline-none focus:ring-2 focus:ring-accent/50" />
              </label>
              <label className="block text-sm font-medium">Logo URL
                <input type="url" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://" className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background font-normal focus:outline-none focus:ring-2 focus:ring-accent/50" />
              </label>
            </div>
          </section>

          <section className="border-b border-border pb-6">
            <h2 className="text-lg font-semibold">Business classification</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm font-medium">Company type
                <select value={companyType} onChange={(event) => setCompanyType(event.target.value as CompanyType)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background font-normal focus:outline-none focus:ring-2 focus:ring-accent/50">
                  {COMPANY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Origin market
                <input value={originCountry} maxLength={2} onChange={(event) => setOriginCountry(event.target.value.toUpperCase())} placeholder="US" className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background font-normal focus:outline-none focus:ring-2 focus:ring-accent/50" />
              </label>
            </div>
            <label className="block text-sm font-medium mt-4">Primary category
              <select value={primaryCategory} onChange={(event) => {
                const next = event.target.value;
                setPrimaryCategory(next);
                setCategories((current) => current.filter((slug) => slug !== next));
              }} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background font-normal focus:outline-none focus:ring-2 focus:ring-accent/50">
                {!COMPANY_CATEGORIES.some((category) => category.slug === profile.primaryCategory) && (
                  <option value={profile.primaryCategory}>{profile.primaryCategory}</option>
                )}
                {COMPANY_CATEGORIES.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
              </select>
            </label>
            <div className="mt-4">
              <p className="text-sm font-medium">Additional categories <span className="font-normal text-muted">(optional)</span></p>
              <div className="flex flex-wrap gap-2 mt-2">
                {COMPANY_CATEGORIES.filter((category) => category.slug !== primaryCategory).map((category) => {
                  const selected = categories.includes(category.slug);
                  return <button key={category.slug} type="button" onClick={() => setCategories((current) => selected ? current.filter((slug) => slug !== category.slug) : [...current, category.slug])} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${selected ? "bg-accent border-accent text-white" : "border-border text-muted hover:border-accent"}`}>{category.name}</button>;
                })}
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={submitting} className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50">{submitting ? "Submitting..." : "Submit changes for review"}</button>
        </form>
      )}
    </div>
  );
}
