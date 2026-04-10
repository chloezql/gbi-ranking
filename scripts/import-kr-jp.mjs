/**
 * Import KR/JP company data into Supabase (filtered: visits>0 & description!=null)
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/import-kr-jp.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykzrabinwggxpxidencn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const rawData = JSON.parse(
  readFileSync(
    join(__dirname, "..", "dataset_similarweb-scraper_2026-04-10_02-57-48-740.json"),
    "utf-8"
  )
);

function humanizeSlug(slug) {
  if (!slug) return "Other";
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/ And /g, " & ");
}

async function main() {
  // Filter: visits > 0 AND description is not null/empty
  const valid = rawData.filter((item) => {
    const visits = parseInt(item.visits) || 0;
    return visits > 0 && item.description;
  });

  console.log(`Total: ${rawData.length}, Valid after filter: ${valid.length}, Filtered out: ${rawData.length - valid.length}\n`);

  // 1. Collect and insert categories
  const categoryMap = new Map();
  for (const item of valid) {
    const cat = item.category || "";
    if (!cat) continue;
    const parts = cat.split("/");
    const parentSlug = parts[0];
    if (!categoryMap.has(parentSlug)) {
      categoryMap.set(parentSlug, { slug: parentSlug, name: humanizeSlug(parentSlug), parentSlug: null });
    }
    if (parts.length > 1) {
      const childSlug = cat;
      if (!categoryMap.has(childSlug)) {
        categoryMap.set(childSlug, { slug: childSlug, name: humanizeSlug(parts[parts.length - 1]), parentSlug });
      }
    }
  }

  // Insert parent categories
  const parentCats = [...categoryMap.values()].filter((c) => !c.parentSlug);
  if (parentCats.length > 0) {
    const { data: insertedParents, error: parentErr } = await supabase
      .from("categories")
      .upsert(parentCats.map((c) => ({ slug: c.slug, name: c.name, parent_id: null })), { onConflict: "slug" })
      .select("id, slug");
    if (parentErr) { console.error("Parent categories error:", parentErr); return; }
    console.log(`Categories (parent): ${insertedParents.length}`);

    const slugToId = new Map();
    for (const p of insertedParents) slugToId.set(p.slug, p.id);

    // Also fetch existing parent categories we didn't insert
    const { data: allParents } = await supabase.from("categories").select("id, slug").is("parent_id", null);
    for (const p of allParents || []) slugToId.set(p.slug, p.id);

    // Insert child categories
    const childCats = [...categoryMap.values()].filter((c) => c.parentSlug);
    if (childCats.length > 0) {
      const { data: insertedChildren, error: childErr } = await supabase
        .from("categories")
        .upsert(childCats.map((c) => ({ slug: c.slug, name: c.name, parent_id: slugToId.get(c.parentSlug) || null })), { onConflict: "slug" })
        .select("id, slug");
      if (childErr) { console.error("Child categories error:", childErr); return; }
      for (const c of insertedChildren) slugToId.set(c.slug, c.id);
      console.log(`Categories (child): ${insertedChildren.length}`);
    }

    // Also fetch all existing categories
    const { data: allCats } = await supabase.from("categories").select("id, slug");
    for (const c of allCats || []) slugToId.set(c.slug, c.id);

    // 2. Insert companies
    const companies = valid.map((item) => {
      const cat = item.category || "";
      const categoryId = slugToId.get(cat) || slugToId.get(cat.split("/")[0]) || slugToId.get("other") || null;
      return {
        domain: item.domain,
        title: item.title || item.domain,
        description: item.description || "",
        screenshot_url: item.screenshot || "",
        category_id: categoryId,
      };
    });

    const { data: insertedCompanies, error: compErr } = await supabase
      .from("companies")
      .upsert(companies, { onConflict: "domain" })
      .select("id, domain");
    if (compErr) { console.error("Companies error:", compErr); return; }
    console.log(`Companies: ${insertedCompanies.length}`);

    const domainToId = new Map();
    for (const c of insertedCompanies) domainToId.set(c.domain, c.id);

    // 3. Insert snapshots
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
    if (snapErr) { console.error("Snapshots error:", snapErr); return; }
    console.log(`Snapshots: ${snapshots.length}`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
