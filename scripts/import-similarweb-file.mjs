/**
 * Import one SimilarWeb Apify dataset JSON file into Supabase.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/import-similarweb-file.mjs dataset_similarweb-scraper_2026-06-01_batch5.json
 *   node scripts/import-similarweb-file.mjs dataset_similarweb-scraper_2026-06-01_batch5.json --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const inputArg = process.argv.find((arg) => arg.endsWith(".json"));
const dryRun = process.argv.includes("--dry-run");

if (!inputArg) {
  console.error("Usage: node scripts/import-similarweb-file.mjs <dataset.json> [--dry-run]");
  process.exit(1);
}

const inputPath = resolve(inputArg);
if (!existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykzrabinwggxpxidencn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Use --dry-run to validate without importing.");
  process.exit(1);
}

const rawData = JSON.parse(readFileSync(inputPath, "utf-8"));
if (!Array.isArray(rawData)) {
  console.error("Expected the dataset JSON to be an array.");
  process.exit(1);
}

const supabase = dryRun ? null : createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function humanizeSlug(slug) {
  if (!slug) return "Other";
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .replace(/ And /g, " & ");
}

function normalizeRows(rows) {
  const seen = new Set();
  const invalid = [];
  const valid = [];

  for (const item of rows) {
    const domain = String(item.domain || "").trim().replace(/^www\./, "");
    const visits = parseInt(item.visits, 10) || 0;

    if (!domain || visits <= 0 || !item.description) {
      invalid.push({ domain: domain || "(missing)", visits, hasDescription: Boolean(item.description) });
      continue;
    }

    if (seen.has(domain)) continue;
    seen.add(domain);
    valid.push({ ...item, domain });
  }

  return { valid, invalid };
}

async function upsertCategories(valid) {
  const categoryMap = new Map();

  for (const item of valid) {
    const category = item.category || "";
    const parts = category.split("/").filter(Boolean);
    if (!parts.length) continue;

    const parentSlug = parts[0];
    if (!categoryMap.has(parentSlug)) {
      categoryMap.set(parentSlug, { slug: parentSlug, name: humanizeSlug(parentSlug), parentSlug: null });
    }

    if (parts.length > 1 && !categoryMap.has(category)) {
      categoryMap.set(category, {
        slug: category,
        name: humanizeSlug(parts[parts.length - 1]),
        parentSlug,
      });
    }
  }

  categoryMap.set("other", { slug: "other", name: "Other", parentSlug: null });

  const parents = [...categoryMap.values()].filter((category) => !category.parentSlug);
  const children = [...categoryMap.values()].filter((category) => category.parentSlug);

  await supabase.from("categories").upsert(
    parents.map((category) => ({ slug: category.slug, name: category.name, parent_id: null })),
    { onConflict: "slug" }
  );

  const { data: allParents, error: parentError } = await supabase
    .from("categories")
    .select("id, slug")
    .is("parent_id", null);

  if (parentError) throw parentError;

  const slugToId = new Map(allParents.map((category) => [category.slug, category.id]));

  await supabase.from("categories").upsert(
    children.map((category) => ({
      slug: category.slug,
      name: category.name,
      parent_id: slugToId.get(category.parentSlug) || null,
    })),
    { onConflict: "slug" }
  );

  const { data: allCategories, error: categoryError } = await supabase
    .from("categories")
    .select("id, slug");

  if (categoryError) throw categoryError;

  for (const category of allCategories) {
    slugToId.set(category.slug, category.id);
  }

  return { slugToId, categoryCount: parents.length + children.length };
}

async function importData() {
  const { valid, invalid } = normalizeRows(rawData);
  const domains = valid.map((item) => item.domain);

  console.log(`Input: ${inputPath}`);
  console.log(`Rows: ${rawData.length}`);
  console.log(`Valid unique rows: ${valid.length}`);
  console.log(`Skipped rows: ${invalid.length}`);
  console.log(`Domains: ${domains.join(", ")}`);

  if (invalid.length) {
    console.log("Skipped detail:", JSON.stringify(invalid, null, 2));
  }

  if (dryRun) {
    console.log("Dry run only. No data was imported.");
    return;
  }

  const { slugToId, categoryCount } = await upsertCategories(valid);

  const companies = valid.map((item) => {
    const category = item.category || "";
    return {
      domain: item.domain,
      title: item.title || item.domain,
      description: item.description || "",
      screenshot_url: item.screenshot || "",
      category_id: slugToId.get(category) || slugToId.get(category.split("/")[0]) || slugToId.get("other"),
    };
  });

  const { data: insertedCompanies, error: companyError } = await supabase
    .from("companies")
    .upsert(companies, { onConflict: "domain" })
    .select("id, domain");

  if (companyError) throw companyError;

  const domainToId = new Map(insertedCompanies.map((company) => [company.domain, company.id]));

  const snapshots = valid
    .map((item) => ({
      company_id: domainToId.get(item.domain),
      snapshot_date: item.snapshotDate ? item.snapshotDate.split("T")[0] : "2026-04-01",
      global_rank: item.globalRank || null,
      country_code: item.countryRank?.CountryCode || item["countryRank.countryCode"] || null,
      country_rank: item.countryRank?.Rank || item["countryRank.rank"] || null,
      category_rank: parseInt(item.categoryRank, 10) || null,
      visits: parseInt(item.visits, 10) || 0,
      bounce_rate: parseFloat(item.bounceRate) || null,
      pages_per_visit: parseFloat(item.pagesPerVisit) || null,
      time_on_site: parseFloat(item.timeOnSite) || null,
      monthly_visits: item.estimatedMonthlyVisits || {},
      top_country_shares: item.topCountryShares || [],
      traffic_sources: item.trafficSources || {},
      top_keywords: item.topKeywords || [],
    }))
    .filter((snapshot) => snapshot.company_id);

  const { error: snapshotError } = await supabase
    .from("snapshots")
    .upsert(snapshots, { onConflict: "company_id,snapshot_date" });

  if (snapshotError) throw snapshotError;

  console.log("Import complete.");
  console.log(`Categories touched: ${categoryCount}`);
  console.log(`Companies upserted: ${insertedCompanies.length}`);
  console.log(`Snapshots upserted: ${snapshots.length}`);
}

importData().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
