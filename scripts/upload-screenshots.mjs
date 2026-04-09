/**
 * Download screenshots from SimilarWeb CDN and upload to Supabase Storage.
 * Then update the companies table with the new URLs.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/upload-screenshots.mjs
 *
 * Prerequisites:
 *   1. Create a bucket called "screenshots" in Supabase Storage (Dashboard > Storage > New Bucket)
 *   2. Set the bucket to PUBLIC
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykzrabinwggxpxidencn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const rawData = JSON.parse(
  readFileSync(
    join(__dirname, "..", "dataset_similarweb-scraper_2026-04-09_21-35-37-232.json"),
    "utf-8"
  )
);

const BUCKET = "screenshots";

async function downloadImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) {
      console.error("Failed to create bucket:", error.message);
      console.error("Please create a PUBLIC bucket named 'screenshots' manually in Supabase Dashboard > Storage");
      process.exit(1);
    }
    console.log("Created public bucket: screenshots");
  }
}

async function processCompany(item, index, total) {
  const domain = item.domain;
  const screenshotUrl = item.screenshot;

  if (!screenshotUrl) {
    console.log(`[${index + 1}/${total}] ${domain} — no screenshot, skipping`);
    return null;
  }

  const filePath = `${domain}.webp`;

  // Check if already uploaded
  const { data: existing } = await supabase.storage.from(BUCKET).list("", {
    search: `${domain}.webp`,
  });
  if (existing?.some((f) => f.name === filePath)) {
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
    console.log(`[${index + 1}/${total}] ${domain} — already exists, skipping`);
    return { domain, url: publicUrl };
  }

  try {
    const imageBuffer = await downloadImage(screenshotUrl);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, imageBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (error) {
      console.error(`[${index + 1}/${total}] ${domain} — upload failed: ${error.message}`);
      return null;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
    console.log(`[${index + 1}/${total}] ${domain} — uploaded`);
    return { domain, url: publicUrl };
  } catch (err) {
    console.error(`[${index + 1}/${total}] ${domain} — download failed: ${err.message}`);
    return null;
  }
}

async function main() {
  await ensureBucket();

  console.log(`\nProcessing ${rawData.length} companies...\n`);

  const results = [];
  // Process 5 at a time to avoid overwhelming the network
  for (let i = 0; i < rawData.length; i += 5) {
    const batch = rawData.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map((item, j) => processCompany(item, i + j, rawData.length))
    );
    results.push(...batchResults.filter(Boolean));
  }

  // Update companies table with new screenshot URLs
  console.log(`\nUpdating ${results.length} companies with Supabase Storage URLs...`);
  let updated = 0;
  for (const { domain, url } of results) {
    const { error } = await supabase
      .from("companies")
      .update({ screenshot_url: url })
      .eq("domain", domain);

    if (error) {
      console.error(`  Failed to update ${domain}: ${error.message}`);
    } else {
      updated++;
    }
  }

  console.log(`\nDone! ${updated}/${rawData.length} screenshots uploaded and URLs updated.`);
}

main().catch(console.error);
