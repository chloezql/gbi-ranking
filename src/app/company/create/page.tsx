"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { DuplicateCompanyModal } from "@/components/DuplicateCompanyModal";
import type { CompanyType } from "@/lib/types";

type Step = "domain" | "type" | "form" | "done";
type DuplicateReason = "listed" | "pending";

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function ChipInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  };

  const remove = (val: string) => onChange(values.filter(v => v !== val));

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-border/40 transition-colors"
        >
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {values.map(v => (
            <span
              key={v}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-light text-accent text-xs font-medium"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                className="hover:opacity-70 transition-opacity"
                aria-label={`Remove ${v}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreateCompanyPage() {
  const { user, loading, openModal } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("domain");
  const [domain, setDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);

  const [duplicate, setDuplicate] = useState<{ domain: string; reason: DuplicateReason } | null>(null);

  const [companyType, setCompanyType] = useState<CompanyType | null>(null);

  const [name, setName] = useState("");
  const [relatedCompanies, setRelatedCompanies] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) openModal();
  }, [user, loading, openModal]);

  const handleDomainCheck = async () => {
    const normalized = normalizeDomain(domain);
    if (!normalized) { setDomainError("Please enter a domain."); return; }

    setDomainError(null);
    setCheckingDomain(true);

    const [{ data: company }, { data: submission }] = await Promise.all([
      supabase.from("companies").select("domain").eq("domain", normalized).maybeSingle(),
      supabase
        .from("company_submissions")
        .select("domain")
        .eq("domain", normalized)
        .in("status", ["pending", "approved"])
        .maybeSingle(),
    ]);

    setCheckingDomain(false);

    if (company) { setDuplicate({ domain: normalized, reason: "listed" }); return; }
    if (submission) { setDuplicate({ domain: normalized, reason: "pending" }); return; }

    setDomain(normalized);
    setStep("type");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = 5 - images.length;
    const toAdd = files.slice(0, remaining);
    setImages(prev => [...prev, ...toAdd]);
    setImagePreviews(prev => [
      ...prev,
      ...toAdd.map(f => URL.createObjectURL(f)),
    ]);
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyType) return;
    setSubmitError(null);
    setSubmitting(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of images) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("company-images")
          .upload(path, file, { upsert: false });
        if (error) throw new Error(`Image upload failed: ${error.message}`);
        const { data } = supabase.storage.from("company-images").getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }

      const { error } = await supabase.from("company_submissions").insert({
        submitted_by: user.id,
        company_type: companyType,
        name: name.trim(),
        domain,
        images: uploadedUrls,
        related_companies: relatedCompanies,
      });

      if (error) throw new Error(error.message);
      setStep("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-muted text-sm">Please sign in to add a company.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      {duplicate && (
        <DuplicateCompanyModal
          domain={duplicate.domain}
          reason={duplicate.reason}
          onClose={() => setDuplicate(null)}
        />
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Add a company</h1>
        <p className="text-muted text-sm">Submit a company for review to be listed in the GBI directory.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {(["domain", "type", "form"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === "done" || (["domain", "type", "form"] as const).indexOf(step) > i
                  ? "bg-accent text-white"
                  : step === s
                  ? "bg-accent text-white"
                  : "bg-border text-muted"
              }`}
            >
              {step === "done" || (["domain", "type", "form"] as const).indexOf(step) > i ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && <div className="flex-1 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Domain */}
      {step === "domain" && (
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold mb-0.5">Enter the company domain</h2>
            <p className="text-muted text-sm">e.g. <span className="font-mono">nike.com</span></p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="domain-input">Domain</label>
            <input
              id="domain-input"
              type="text"
              value={domain}
              onChange={e => { setDomain(e.target.value); setDomainError(null); }}
              onKeyDown={e => { if (e.key === "Enter") handleDomainCheck(); }}
              placeholder="nike.com"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
            />
            {domainError && (
              <p className="text-sm text-danger">{domainError}</p>
            )}
          </div>

          <button
            onClick={handleDomainCheck}
            disabled={checkingDomain || !domain.trim()}
            className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkingDomain ? "Checking…" : "Continue"}
          </button>
        </div>
      )}

      {/* Step 2: Type selection */}
      {step === "type" && (
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold mb-0.5">What type of company is this?</h2>
            <p className="text-muted text-sm font-mono text-xs">{domain}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(["brand", "service_provider"] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => { setCompanyType(type); setStep("form"); }}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-accent hover:bg-accent-light transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-border group-hover:bg-accent/10 flex items-center justify-center transition-colors">
                  {type === "brand" ? (
                    <svg className="w-5 h-5 text-muted group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6h.008v.008H6V6z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-muted group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm group-hover:text-accent transition-colors">
                    {type === "brand" ? "Brand" : "Service Provider"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {type === "brand" ? "Product or consumer brand" : "Agency, platform, or tool"}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep("domain")}
            className="text-sm text-muted hover:text-foreground transition-colors text-center"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Form */}
      {step === "form" && companyType && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
          <div>
            <h2 className="font-semibold mb-0.5">
              {companyType === "brand" ? "Brand" : "Service Provider"} details
            </h2>
            <p className="text-muted text-xs font-mono">{domain}</p>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="company-name">
              Company name <span className="text-danger">*</span>
            </label>
            <input
              id="company-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Nike"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
            />
          </div>

          {/* Related companies */}
          <ChipInput
            label={companyType === "brand" ? "Service Providers (optional)" : "Customers (optional)"}
            placeholder={companyType === "brand" ? "e.g. Salesforce" : "e.g. Nike"}
            values={relatedCompanies}
            onChange={setRelatedCompanies}
          />

          {/* Images */}
          <div className="flex flex-col gap-1.5">
            <div>
              <label className="text-sm font-medium">
                Images <span className="text-muted font-normal">(optional, up to 5)</span>
              </label>
              <p className="text-xs text-muted mt-0.5">
                Upload promotional images or banners that represent your company — e.g. campaign visuals, product shots, or brand imagery.
              </p>
            </div>

            {imagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-1">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      aria-label="Remove image"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border hover:border-accent hover:bg-accent-light transition-colors text-sm text-muted hover:text-accent w-fit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                Upload images
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>

          {submitError && (
            <p className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">{submitError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep("type")}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-border/40 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        </form>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold mb-1">Submitted!</h2>
            <p className="text-muted text-sm">
              <span className="font-medium text-foreground">{domain}</span> is pending review.
              We&apos;ll verify the information before it goes live.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-border/40 transition-colors"
            >
              View dashboard
            </button>
            <button
              onClick={() => {
                setStep("domain");
                setDomain("");
                setName("");
                setCompanyType(null);
                setRelatedCompanies([]);
                setImages([]);
                setImagePreviews([]);
              }}
              className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Add another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
