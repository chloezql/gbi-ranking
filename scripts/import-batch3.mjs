/**
 * Import batch 3 data, scrape logos, detect countries - all in one.
 */

import { ApifyClient } from "apify-client";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = "https://ykzrabinwggxpxidencn.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const rawData = JSON.parse(
  readFileSync(join(__dirname, "..", "dataset_similarweb-scraper_2026-04-10_06-27-54-913.json"), "utf-8")
);

function humanizeSlug(slug) {
  if (!slug) return "Other";
  return slug.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").replace(/ And /g, " & ");
}

async function step1_importData() {
  const valid = rawData.filter((item) => {
    const visits = parseInt(item.visits) || 0;
    return visits > 0 && item.description;
  });
  console.log(`\n=== STEP 1: Import Data (${valid.length} valid / ${rawData.length} total) ===\n`);

  // Categories
  const categoryMap = new Map();
  for (const item of valid) {
    const cat = item.category || "";
    if (!cat) continue;
    const parts = cat.split("/");
    if (!categoryMap.has(parts[0])) categoryMap.set(parts[0], { slug: parts[0], name: humanizeSlug(parts[0]), parentSlug: null });
    if (parts.length > 1 && !categoryMap.has(cat)) categoryMap.set(cat, { slug: cat, name: humanizeSlug(parts[parts.length - 1]), parentSlug: parts[0] });
  }

  const parents = [...categoryMap.values()].filter((c) => !c.parentSlug);
  if (parents.length) {
    await supabase.from("categories").upsert(parents.map((c) => ({ slug: c.slug, name: c.name, parent_id: null })), { onConflict: "slug" });
  }
  const { data: allParents } = await supabase.from("categories").select("id, slug").is("parent_id", null);
  const slugToId = new Map(allParents.map((p) => [p.slug, p.id]));

  const children = [...categoryMap.values()].filter((c) => c.parentSlug);
  if (children.length) {
    await supabase.from("categories").upsert(children.map((c) => ({ slug: c.slug, name: c.name, parent_id: slugToId.get(c.parentSlug) || null })), { onConflict: "slug" });
  }
  const { data: allCats } = await supabase.from("categories").select("id, slug");
  for (const c of allCats) slugToId.set(c.slug, c.id);

  // Companies
  const companies = valid.map((item) => {
    const cat = item.category || "";
    return {
      domain: item.domain,
      title: item.title || item.domain,
      description: item.description || "",
      screenshot_url: item.screenshot || "",
      category_id: slugToId.get(cat) || slugToId.get(cat.split("/")[0]) || slugToId.get("other") || null,
    };
  });
  const { data: inserted, error: compErr } = await supabase.from("companies").upsert(companies, { onConflict: "domain" }).select("id, domain");
  if (compErr) { console.error("Companies error:", compErr); return; }
  console.log(`Companies: ${inserted.length}`);

  const domainToId = new Map(inserted.map((c) => [c.domain, c.id]));

  // Snapshots
  const snapshots = valid.map((item) => ({
    company_id: domainToId.get(item.domain),
    snapshot_date: item.snapshotDate ? item.snapshotDate.split("T")[0] : "2026-03-01",
    global_rank: item.globalRank || null,
    country_code: item.countryRank?.CountryCode || item["countryRank.countryCode"] || null,
    country_rank: item.countryRank?.Rank || item["countryRank.rank"] || null,
    category_rank: parseInt(item.categoryRank) || null,
    visits: parseInt(item.visits) || 0,
    bounce_rate: parseFloat(item.bounceRate) || null,
    pages_per_visit: parseFloat(item.pagesPerVisit) || null,
    time_on_site: parseFloat(item.timeOnSite) || null,
    monthly_visits: item.estimatedMonthlyVisits || {},
    top_country_shares: item.topCountryShares || [],
    traffic_sources: item.trafficSources || {},
    top_keywords: item.topKeywords || [],
  }));
  const { error: snapErr } = await supabase.from("snapshots").upsert(snapshots, { onConflict: "company_id,snapshot_date" });
  if (snapErr) console.error("Snapshots error:", snapErr);
  else console.log(`Snapshots: ${snapshots.length}`);
}

async function step2_scrapeLogos() {
  const { data: noLogo } = await supabase.from("companies").select("domain").is("logo_url", null).order("domain");
  if (!noLogo?.length) { console.log("\n=== STEP 2: All companies have logos ===\n"); return; }

  console.log(`\n=== STEP 2: Scrape Logos (${noLogo.length} missing) ===\n`);
  const urls = noLogo.map((c) => ({ url: `https://${c.domain}` }));
  const run = await apify.actor("8Gic54XXaFVLfPzgj").call({ urls });
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();

  let ok = 0, fail = 0;
  for (const item of items) {
    let domain;
    try { domain = new URL(item.input_url || item.url || "").hostname.replace(/^www\./, ""); } catch { fail++; continue; }
    const logoUrl = item.logo_url || item.logoUrl || null;
    if (!logoUrl) { console.log(`  ${domain} — no logo`); fail++; continue; }
    try {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") || "image/png";
      const ext = ct.includes("svg") ? "svg" : "png";
      const fp = `${domain}.${ext}`;
      await supabase.storage.from("logos").upload(fp, buf, { contentType: ct, upsert: true });
      const pubUrl = `${SUPABASE_URL}/storage/v1/object/public/logos/${fp}`;
      await supabase.from("companies").update({ logo_url: pubUrl }).eq("domain", domain);
      console.log(`  ${domain} — done`);
      ok++;
    } catch (e) { console.error(`  ${domain} — ${e.message}`); fail++; }
  }
  console.log(`Logos: ${ok} uploaded, ${fail} failed`);
}

async function step3_detectCountries() {
  const { data: noCountry } = await supabase.from("companies").select("domain, title, description").is("country_code", null).order("domain");
  if (!noCountry?.length) { console.log("\n=== STEP 3: All companies have countries ===\n"); return; }

  console.log(`\n=== STEP 3: Detect Countries (${noCountry.length} missing) ===\n`);
  const BATCH = 30;
  let total = 0;

  for (let i = 0; i < noCountry.length; i += BATCH) {
    const batch = noCountry.slice(i, i + BATCH);
    const list = batch.map((c) => `- ${c.domain} | ${c.title || ""} | ${(c.description || "").slice(0, 100)}`).join("\n");

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini", temperature: 0,
      messages: [
        { role: "system", content: "You are a business analyst. Given companies (domain, title, description), determine origin country. Many are Chinese companies going global - check carefully. Return ONLY a JSON array of {\"domain\",\"country_code\"} (ISO 3166-1 alpha-2). No explanation." },
        { role: "user", content: list },
      ],
    });

    const text = resp.choices[0].message.content.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const results = JSON.parse(text);
    for (const { domain, country_code } of results) {
      await supabase.from("companies").update({ country_code }).eq("domain", domain);
      console.log(`  ${domain} → ${country_code}`);
      total++;
    }
  }
  console.log(`Countries: ${total} updated`);
}

async function main() {
  await step1_importData();
  await step2_scrapeLogos();
  await step3_detectCountries();
  console.log("\n=== ALL DONE ===");
}

main().catch(console.error);
