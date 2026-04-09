/**
 * Import JSON data into Supabase.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/import-data.mjs
 *
 * Get the service_role key from Supabase Dashboard > Settings > API > service_role (secret)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykzrabinwggxpxidencn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Get it from Supabase Dashboard > Settings > API");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const rawData = JSON.parse(
  readFileSync(
    join(__dirname, "..", "dataset_similarweb-scraper_2026-04-09_21-35-37-232.json"),
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

async function importData() {
  console.log(`Importing ${rawData.length} companies...`);

  // 1. Collect unique categories (parent + child)
  const categoryMap = new Map();

  for (const item of rawData) {
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
        categoryMap.set(childSlug, {
          slug: childSlug,
          name: humanizeSlug(parts[parts.length - 1]),
          parentSlug,
        });
      }
    }
  }

  // Also add "other" for empty categories
  categoryMap.set("other", { slug: "other", name: "Other", parentSlug: null });

  // 2. Insert parent categories first, then children
  const parentCats = [...categoryMap.values()].filter((c) => !c.parentSlug);
  const childCats = [...categoryMap.values()].filter((c) => c.parentSlug);

  console.log(`Creating ${parentCats.length} parent categories...`);
  const { data: insertedParents, error: parentErr } = await supabase
    .from("categories")
    .upsert(parentCats.map((c) => ({ slug: c.slug, name: c.name, parent_id: null })), {
      onConflict: "slug",
    })
    .select("id, slug");

  if (parentErr) {
    console.error("Error inserting parent categories:", parentErr);
    return;
  }
  console.log(`  Inserted ${insertedParents.length} parents`);

  const slugToId = new Map();
  for (const p of insertedParents) {
    slugToId.set(p.slug, p.id);
  }

  console.log(`Creating ${childCats.length} child categories...`);
  const { data: insertedChildren, error: childErr } = await supabase
    .from("categories")
    .upsert(
      childCats.map((c) => ({
        slug: c.slug,
        name: c.name,
        parent_id: slugToId.get(c.parentSlug) || null,
      })),
      { onConflict: "slug" }
    )
    .select("id, slug");

  if (childErr) {
    console.error("Error inserting child categories:", childErr);
    return;
  }
  for (const c of insertedChildren) {
    slugToId.set(c.slug, c.id);
  }
  console.log(`  Inserted ${insertedChildren.length} children`);

  // 3. Insert companies
  console.log(`Creating ${rawData.length} companies...`);
  const companies = rawData.map((item) => {
    const cat = item.category || "";
    const categoryId = slugToId.get(cat) || slugToId.get(cat.split("/")[0]) || slugToId.get("other");
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

  if (compErr) {
    console.error("Error inserting companies:", compErr);
    return;
  }
  console.log(`  Inserted ${insertedCompanies.length} companies`);

  const domainToId = new Map();
  for (const c of insertedCompanies) {
    domainToId.set(c.domain, c.id);
  }

  // 4. Insert snapshots
  console.log("Creating snapshots...");
  const snapshots = rawData.map((item) => ({
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

  const { error: snapErr } = await supabase.from("snapshots").upsert(snapshots, {
    onConflict: "company_id,snapshot_date",
  });

  if (snapErr) {
    console.error("Error inserting snapshots:", snapErr);
    return;
  }

  console.log("\nDone! All data imported successfully.");
  console.log(`  ${parentCats.length + childCats.length} categories`);
  console.log(`  ${insertedCompanies.length} companies`);
  console.log(`  ${snapshots.length} snapshots`);
}

importData().catch(console.error);
