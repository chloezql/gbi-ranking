/**
 * Import batch 4 data, scrape logos, detect countries - all in one.
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
  readFileSync(join(__dirname, "..", "dataset_similarweb-scraper_2026-04-10_06-38-24-655.json"), "utf-8")
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

  // Dedupe within this batch
  const seen = new Set();
  const deduped = valid.filter((item) => {
    if (seen.has(item.domain)) return false;
    seen.add(item.domain);
    return true;
  });

  console.log(`\n=== STEP 1: Import Data (${deduped.length} valid unique / ${rawData.length} total) ===\n`);

  const categoryMap = new Map();
  for (const item of deduped) {
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

  // Insert companies in batches of 50 (Supabase limit)
  const BATCH = 50;
  let totalInserted = 0;
  const allInserted = [];

  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH);
    const companies = batch.map((item) => {
      const cat = item.category || "";
      return {
        domain: item.domain,
        title: item.title || item.domain,
        description: item.description || "",
        screenshot_url: item.screenshot || "",
        category_id: slugToId.get(cat) || slugToId.get(cat.split("/")[0]) || slugToId.get("other") || null,
      };
    });
    const { data: ins, error } = await supabase.from("companies").upsert(companies, { onConflict: "domain" }).select("id, domain");
    if (error) { console.error("Companies error:", error); continue; }
    allInserted.push(...ins);
    totalInserted += ins.length;
  }
  console.log(`Companies: ${totalInserted}`);

  const domainToId = new Map(allInserted.map((c) => [c.domain, c.id]));

  // Snapshots in batches
  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH);
    const snapshots = batch.map((item) => ({
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
    })).filter((s) => s.company_id);
    const { error } = await supabase.from("snapshots").upsert(snapshots, { onConflict: "company_id,snapshot_date" });
    if (error) console.error("Snapshots error:", error);
  }
  console.log(`Snapshots: done`);
}

async function step2_scrapeLogos() {
  const { data: noLogo } = await supabase.from("companies").select("domain").is("logo_url", null).order("domain");
  if (!noLogo?.length) { console.log("\n=== STEP 2: All companies have logos ===\n"); return; }

  console.log(`\n=== STEP 2: Scrape Logos (${noLogo.length} missing) ===\n`);

  // Apify in batches of 100
  const BATCH = 100;
  let totalOk = 0, totalFail = 0;

  for (let i = 0; i < noLogo.length; i += BATCH) {
    const batch = noLogo.slice(i, i + BATCH);
    console.log(`  Logo batch ${Math.floor(i / BATCH) + 1}: ${batch.length} companies...`);
    const urls = batch.map((c) => ({ url: `https://${c.domain}` }));
    const run = await apify.actor("8Gic54XXaFVLfPzgj").call({ urls });
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();

    for (const item of items) {
      let domain;
      try { domain = new URL(item.input_url || item.url || "").hostname.replace(/^www\./, ""); } catch { totalFail++; continue; }
      const logoUrl = item.logo_url || item.logoUrl || null;
      if (!logoUrl) { totalFail++; continue; }
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
        totalOk++;
      } catch { totalFail++; }
    }
  }
  console.log(`Logos: ${totalOk} uploaded, ${totalFail} failed`);
}

async function step3_detectCountries() {
  const { data: noCountry } = await supabase.from("companies").select("domain, title, description").is("country_code", null).order("domain");
  if (!noCountry?.length) { console.log("\n=== STEP 3: All companies have countries ===\n"); return; }

  console.log(`\n=== STEP 3: Detect Countries (${noCountry.length} missing) ===\n`);
  const BATCH = 40;
  let total = 0;

  for (let i = 0; i < noCountry.length; i += BATCH) {
    const batch = noCountry.slice(i, i + BATCH);
    console.log(`  Country batch ${Math.floor(i / BATCH) + 1}: ${batch.length} companies...`);
    const list = batch.map((c) => `- ${c.domain} | ${c.title || ""} | ${(c.description || "").slice(0, 80)}`).join("\n");

    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini", temperature: 0,
        messages: [
          { role: "system", content: "You are a business analyst. Given companies (domain, title, description), determine origin country (where founded/headquartered). Many are Chinese companies going global - check carefully. Companies with .cn domains or Chinese descriptions are almost certainly CN. Return ONLY a JSON array of {\"domain\",\"country_code\"} (ISO 3166-1 alpha-2). No explanation." },
          { role: "user", content: list },
        ],
      });
      const text = resp.choices[0].message.content.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      const results = JSON.parse(text);
      for (const { domain, country_code } of results) {
        await supabase.from("companies").update({ country_code }).eq("domain", domain);
        total++;
      }
      console.log(`    → ${results.length} detected`);
    } catch (err) {
      console.error(`    Batch failed: ${err.message}`);
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
