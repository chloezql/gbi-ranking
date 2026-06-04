/**
 * Scrape website logos using Apify, upload to Supabase Storage, and update DB.
 *
 * Usage:
 *   APIFY_TOKEN=your_token SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/scrape-logos.mjs
 *   node scripts/scrape-logos.mjs --concurrency=32 --timeout=30000
 */

import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykzrabinwggxpxidencn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!APIFY_TOKEN) {
  console.error("Missing APIFY_TOKEN");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const apify = new ApifyClient({ token: APIFY_TOKEN });
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BUCKET = "logos";

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.slice(prefix.length);
}

const concurrency = Math.max(1, parseInt(getArg("concurrency", "8"), 10));
const timeoutMs = Math.max(1000, parseInt(getArg("timeout", "10000"), 10));

function getDomainFromItem(item) {
  const rawUrl = item.input_url || item.url || item.inputUrl || item.websiteUrl || "";
  return new URL(rawUrl).hostname.replace(/^www\./, "");
}

function getLogoUrl(item) {
  return item.logo_url || item.logoUrl || item.logo || item.faviconUrl || item.favicon || null;
}

function getLogoExtension(contentType, logoUrl) {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("png")) return "png";

  try {
    const pathname = new URL(logoUrl).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/);
    if (match && ["svg", "webp", "jpg", "jpeg", "png"].includes(match[1])) {
      return match[1] === "jpeg" ? "jpg" : match[1];
    }
  } catch {
    // Fall back to png below.
  }

  return "png";
}

async function mapWithConcurrency(items, limit, handler) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      await handler(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
}

async function main() {
  // 1. Get all company domains from Supabase
  const { data: companies, error } = await supabase
    .from("companies")
    .select("domain, logo_url")
    .order("domain");

  if (error) {
    console.error("Failed to fetch companies:", error);
    return;
  }

  console.log(`Found ${companies.length} companies.\n`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Timeout: ${timeoutMs}ms\n`);

  const existingLogoDomains = new Set(companies.filter((company) => company.logo_url).map((company) => company.domain));

  const urls = companies.map((c) => ({ url: `https://${c.domain}` }));

  // 2. Run Apify actor (or reuse last run)
  let items;
  const lastRun = await apify.actor("8Gic54XXaFVLfPzgj").lastRun({ status: "SUCCEEDED" });
  if (lastRun) {
    console.log("Reusing last successful Apify run...");
    const dataset = await lastRun.dataset().listItems();
    items = dataset.items;
  } else {
    console.log("Starting new Apify scrape...");
    const run = await apify.actor("8Gic54XXaFVLfPzgj").call({ urls });
    const dataset = await apify.dataset(run.defaultDatasetId).listItems();
    items = dataset.items;
  }

  console.log(`Apify returned ${items.length} results.\n`);

  // Log first result to see structure
  if (items.length > 0) {
    console.log("Sample result structure:", JSON.stringify(items[0], null, 2), "\n");
  }

  // 3. Process each result: download logo → upload to Supabase → update DB
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  const pendingItems = [];
  for (const item of items) {
    try {
      const domain = getDomainFromItem(item);
      if (existingLogoDomains.has(domain)) {
        skipped++;
        continue;
      }
      pendingItems.push(item);
    } catch {
      failed++;
      console.error("  Could not parse URL from item:", item);
    }
  }

  console.log(`Skipping ${skipped} domains that already have logo_url.`);
  console.log(`Processing ${pendingItems.length} logo results.\n`);

  await mapWithConcurrency(pendingItems, concurrency, async (item) => {
    const domain = getDomainFromItem(item);
    const logoUrl = getLogoUrl(item);

    if (!logoUrl) {
      console.log(`  ${domain} - no logo found, skipping`);
      failed++;
      return;
    }

    try {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/png";
      const ext = getLogoExtension(contentType, logoUrl);
      const filePath = `${domain}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, {
          contentType,
          upsert: true,
      });

      if (uploadErr) {
        console.error(`  ${domain} - upload failed: ${uploadErr.message || JSON.stringify(uploadErr)}`);
        failed++;
        return;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;

      const { error: updateErr } = await supabase
        .from("companies")
        .update({ logo_url: publicUrl })
        .eq("domain", domain);

      if (updateErr) {
        console.error(`  ${domain} - DB update failed: ${updateErr.message || JSON.stringify(updateErr)}`);
        failed++;
        return;
      }

      console.log(`  ${domain} - done`);
      uploaded++;
    } catch (err) {
      console.error(`  ${domain} - failed: ${err.message}`);
      failed++;
    }
  });

  console.log(`\nDone! ${uploaded} uploaded, ${failed} failed, ${skipped} skipped out of ${items.length} results.`);
}

main().catch(console.error);
