/**
 * Scrape website logos using Apify, upload to Supabase Storage, and update DB.
 *
 * Usage:
 *   APIFY_TOKEN=your_token SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/scrape-logos.mjs
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

async function main() {
  // 1. Get all company domains from Supabase
  const { data: companies, error } = await supabase
    .from("companies")
    .select("domain")
    .order("domain");

  if (error) {
    console.error("Failed to fetch companies:", error);
    return;
  }

  console.log(`Found ${companies.length} companies.\n`);

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

  for (const item of items) {
    let domain;
    try {
      const rawUrl = item.input_url || item.url || item.inputUrl || item.websiteUrl || "";
      domain = new URL(rawUrl).hostname.replace(/^www\./, "");
    } catch {
      console.error("  Could not parse URL from item:", item);
      failed++;
      continue;
    }

    const logoUrl =
      item.logo_url || item.logoUrl || item.logo || item.faviconUrl || item.favicon || null;

    if (!logoUrl) {
      console.log(`  ${domain} — no logo found, skipping`);
      failed++;
      continue;
    }

    try {
      // Download the logo
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/png";
      const ext = contentType.includes("svg") ? "svg" : contentType.includes("png") ? "png" : "png";
      const filePath = `${domain}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadErr) {
        console.error(`  ${domain} — upload failed: ${uploadErr.message}`);
        failed++;
        continue;
      }

      // Get public URL and update DB
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;

      const { error: updateErr } = await supabase
        .from("companies")
        .update({ logo_url: publicUrl })
        .eq("domain", domain);

      if (updateErr) {
        console.error(`  ${domain} — DB update failed: ${updateErr.message}`);
        failed++;
        continue;
      }

      console.log(`  ${domain} — done`);
      uploaded++;
    } catch (err) {
      console.error(`  ${domain} — failed: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! ${uploaded} uploaded, ${failed} failed out of ${items.length} results.`);
}

main().catch(console.error);
