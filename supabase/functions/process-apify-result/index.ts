import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RawRow {
  domain?: string;
  visits?: string | number;
  description?: string;
  title?: string;
  screenshot?: string;
  favicon?: string;
  logo?: string;
  category?: string;
  snapshotDate?: string;
  globalRank?: number;
  countryRank?: { CountryCode?: string; Rank?: number };
  "countryRank.countryCode"?: string;
  "countryRank.rank"?: number;
  categoryRank?: string | number;
  bounceRate?: string | number;
  pagesPerVisit?: string | number;
  timeOnSite?: string | number;
  estimatedMonthlyVisits?: Record<string, number>;
  topCountryShares?: { Country?: number; CountryCode?: string; Value?: number }[];
  trafficSources?: Record<string, number>;
  topKeywords?: { name?: string; esitmatedValue?: number; cpc?: number | null }[];
}

function humanizeSlug(slug: string): string {
  if (!slug) return "Other";
  return slug
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/ And /g, " & ");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function detectOriginCountry(domain: string, title: string, description: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Determine each company's origin country — where the company or brand was founded. Return ONLY the ISO 3166-1 alpha-2 code (e.g. CN, US, KR). Use current headquarters only when founding country cannot be established. Do not use website traffic country. No explanation." },
          { role: "user", content: `domain: ${domain}\ntitle: ${title}\ndescription: ${description.slice(0, 200)}` },
        ],
        max_tokens: 5,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const code = data.choices?.[0]?.message?.content?.trim().toUpperCase().replace(/[^A-Z]/g, "");
    return code?.length === 2 ? code : null;
  } catch {
    return null;
  }
}

function getLogoUrl(item: Record<string, unknown>): string | null {
  return (
    (item["logo_url"] as string) ??
    (item["logoUrl"] as string) ??
    (item["logo"] as string) ??
    (item["faviconUrl"] as string) ??
    (item["favicon"] as string) ??
    null
  );
}

function getLogoExt(contentType: string, url: string): string {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("png")) return "png";
  try {
    const match = new URL(url).pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
    if (match && ["svg", "webp", "jpg", "jpeg", "png"].includes(match[1])) {
      return match[1] === "jpeg" ? "jpg" : match[1];
    }
  } catch { /* ignore */ }
  return "png";
}

// Handles the logo actor webhook: downloads logo → uploads to `logos` bucket → updates staged_companies.
// NOTE: logo actor often completes before SimilarWeb actor, so staged_companies may not exist yet.
// We always upload to the bucket and update staged_companies if it exists; handleSimilarWebRun
// will pick up the already-uploaded logo from the bucket when it creates staged_companies later.
async function handleLogoRun(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  status: string,
  submissionId: string
): Promise<Response> {
  if (status !== "SUCCEEDED") return json({ ok: true, result: "logo_run_failed" });

  // Get domain from company_submissions — staged_companies may not exist yet
  const { data: sub } = await supabase
    .from("company_submissions")
    .select("domain")
    .eq("id", submissionId)
    .single();

  if (!sub) return json({ ok: true, result: "submission_not_found" });

  const datasetRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&clean=true&format=json`
  );
  if (!datasetRes.ok) throw new Error(`Logo dataset download failed: ${datasetRes.status}`);
  const items: Record<string, unknown>[] = await datasetRes.json();

  for (const item of items) {
    const logoUrl = getLogoUrl(item);
    if (!logoUrl) continue;

    try {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/png";
      const ext = getLogoExt(contentType, logoUrl);
      const path = `${sub.domain}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("logos")
        .upload(path, buffer, { upsert: true, contentType });

      if (!uploadErr) {
        const { data } = supabase.storage.from("logos").getPublicUrl(path);
        // Update staged_companies if it exists (SimilarWeb completed first).
        // If it doesn't exist yet, handleSimilarWebRun will check the bucket.
        await supabase
          .from("staged_companies")
          .update({ logo_url: data.publicUrl })
          .eq("submission_id", submissionId);
      }
      break;
    } catch {
      continue;
    }
  }

  return json({ ok: true, result: "logo_processed" });
}

// Handles the SimilarWeb actor webhook: writes staged_companies + staged_snapshots, detects country via OpenAI
async function handleSimilarWebRun(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  status: string,
  submissionId: string
): Promise<Response> {
  if (status !== "SUCCEEDED") {
    await supabase
      .from("company_submissions")
      .update({ apify_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", submissionId);
    return json({ ok: true, result: "marked_failed" });
  }

  const datasetRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&clean=true&format=json`
  );
  if (!datasetRes.ok) throw new Error(`Dataset download failed: ${datasetRes.status}`);
  const rawData: RawRow[] = await datasetRes.json();

  const seen = new Set<string>();
  const valid: (RawRow & { domain: string })[] = [];
  for (const item of rawData) {
    const domain = String(item.domain ?? "").trim().replace(/^www\./, "");
    const visits = parseInt(String(item.visits ?? "0"), 10);
    if (!domain || visits <= 0 || !item.description) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    valid.push({ ...item, domain });
  }

  if (valid.length === 0) {
    await supabase
      .from("company_submissions")
      .update({ apify_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", submissionId);
    return json({ ok: true, result: "no_valid_rows" });
  }

  // Upsert categories
  const categoryMap = new Map<string, { slug: string; name: string; parentSlug: string | null }>();
  for (const item of valid) {
    const category = item.category ?? "";
    const parts = category.split("/").filter(Boolean);
    if (!parts.length) continue;
    const parentSlug = parts[0];
    if (!categoryMap.has(parentSlug))
      categoryMap.set(parentSlug, { slug: parentSlug, name: humanizeSlug(parentSlug), parentSlug: null });
    if (parts.length > 1 && !categoryMap.has(category))
      categoryMap.set(category, { slug: category, name: humanizeSlug(parts[parts.length - 1]), parentSlug });
  }
  categoryMap.set("other", { slug: "other", name: "Other", parentSlug: null });

  const parents = [...categoryMap.values()].filter(c => !c.parentSlug);
  const children = [...categoryMap.values()].filter(c => c.parentSlug);

  await supabase.from("categories").upsert(
    parents.map(c => ({ slug: c.slug, name: c.name, parent_id: null })),
    { onConflict: "slug" }
  );

  const { data: allParents } = await supabase.from("categories").select("id, slug").is("parent_id", null);
  const slugToId = new Map((allParents ?? []).map((c: { slug: string; id: string }) => [c.slug, c.id]));

  await supabase.from("categories").upsert(
    children.map(c => ({
      slug: c.slug,
      name: c.name,
      parent_id: slugToId.get(c.parentSlug!) ?? null,
    })),
    { onConflict: "slug" }
  );

  const { data: allCategories } = await supabase.from("categories").select("id, slug");
  for (const c of allCategories ?? []) slugToId.set(c.slug, c.id);

  for (const item of valid) {
    const categoryId =
      slugToId.get(item.category ?? "") ??
      slugToId.get((item.category ?? "").split("/")[0]) ??
      slugToId.get("other");

    // Check if logo actor already uploaded a logo to the bucket (it's usually faster than SimilarWeb)
    const { data: bucketFiles } = await supabase.storage
      .from("logos")
      .list("", { search: item.domain, limit: 5 });
    const logoFile = (bucketFiles ?? []).find((f: { name: string }) => f.name.startsWith(item.domain + "."));
    const existingLogoUrl = logoFile
      ? supabase.storage.from("logos").getPublicUrl(logoFile.name).data.publicUrl
      : null;

    const { data: staged } = await supabase
      .from("staged_companies")
      .insert({
        submission_id: submissionId,
        domain: item.domain,
        title: item.title ?? item.domain,
        description: item.description ?? "",
        screenshot_url: item.screenshot ?? "",
        logo_url: existingLogoUrl,
        // country_code: set by OpenAI below
        category_id: categoryId ?? null,
      })
      .select("id")
      .single();

    if (!staged) continue;

    // Detect origin country (where founded/HQ'd) via OpenAI
    const originCountry = await detectOriginCountry(
      item.domain,
      item.title ?? item.domain,
      item.description ?? ""
    );
    if (originCountry) {
      await supabase.from("staged_companies").update({ country_code: originCountry }).eq("id", staged.id);
    }

    await supabase.from("staged_snapshots").insert({
      staged_company_id: staged.id,
      snapshot_date: item.snapshotDate
        ? item.snapshotDate.split("T")[0]
        : new Date().toISOString().split("T")[0],
      global_rank: item.globalRank ?? null,
      country_code: item.countryRank?.CountryCode ?? (item as unknown as Record<string, string>)["countryRank.countryCode"] ?? null,
      country_rank: item.countryRank?.Rank ?? (item as unknown as Record<string, number>)["countryRank.rank"] ?? null,
      category_rank: parseInt(String(item.categoryRank ?? ""), 10) || null,
      visits: parseInt(String(item.visits ?? "0"), 10),
      bounce_rate: parseFloat(String(item.bounceRate ?? "")) || null,
      pages_per_visit: parseFloat(String(item.pagesPerVisit ?? "")) || null,
      time_on_site: parseFloat(String(item.timeOnSite ?? "")) || null,
      monthly_visits: item.estimatedMonthlyVisits ?? {},
      top_country_shares: item.topCountryShares ?? [],
      traffic_sources: item.trafficSources ?? {},
      top_keywords: item.topKeywords ?? [],
    });
  }

  await supabase
    .from("company_submissions")
    .update({ apify_status: "complete", updated_at: new Date().toISOString() })
    .eq("id", submissionId);

  return json({ ok: true, rows: valid.length });
}

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const runId: string = payload.eventData?.actorRunId ?? payload.resource?.id;
    const status: string = payload.eventData?.status ?? payload.resource?.status ?? "";

    if (!runId) return new Response("Missing runId", { status: 400 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check SimilarWeb run first, then logo run
    const { data: swSubmission } = await supabase
      .from("company_submissions")
      .select("id")
      .eq("apify_run_id", runId)
      .maybeSingle();

    if (swSubmission) {
      return await handleSimilarWebRun(supabase, runId, status, swSubmission.id);
    }

    const { data: logoSubmission } = await supabase
      .from("company_submissions")
      .select("id")
      .eq("apify_logo_run_id", runId)
      .maybeSingle();

    if (logoSubmission) {
      return await handleLogoRun(supabase, runId, status, logoSubmission.id);
    }

    return new Response("Submission not found", { status: 404 });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
