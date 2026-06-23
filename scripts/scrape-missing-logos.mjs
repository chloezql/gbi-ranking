/**
 * Scrape logos for companies that don't have one yet.
 *
 * Usage:
 *   APIFY_TOKEN=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-missing-logos.mjs
 *   node scripts/scrape-missing-logos.mjs --limit=3
 *   node scripts/scrape-missing-logos.mjs --concurrency=8 --timeout=15000
 */

import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "fs";
import { resolve } from "path";
import { loadEnvFile } from "process";

const ENV_FILE = resolve(".env.local");
if (existsSync(ENV_FILE)) loadEnvFile(ENV_FILE);

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykzrabinwggxpxidencn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!APIFY_TOKEN || !SERVICE_ROLE_KEY) {
  console.error("Missing APIFY_TOKEN or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const apify = new ApifyClient({ token: APIFY_TOKEN });
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BUCKET = "logos";

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : defaultValue;
}

const limit = Math.max(0, parseInt(getArg("limit", "0"), 10));
const concurrency = Math.max(1, parseInt(getArg("concurrency", "8"), 10));
const timeoutMs = Math.max(1000, parseInt(getArg("timeout", "15000"), 10));

async function mapWithConcurrency(items, workerCount, handler) {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(workerCount, items.length) },
    async () => {
      while (index < items.length) {
        const currentIndex = index++;
        await handler(items[currentIndex], currentIndex);
      }
    }
  );
  await Promise.all(workers);
}

async function main() {
  const { data: companies } = await supabase
    .from("companies")
    .select("domain")
    .is("logo_url", null)
    .eq("description_usable", true)
    .order("domain");

  const selectedCompanies = limit > 0 ? companies.slice(0, limit) : companies;
  console.log(`${companies.length} visible companies without logo.`);
  console.log(`${selectedCompanies.length} companies selected. Starting Apify...\n`);
  console.log(`Upload concurrency: ${concurrency}`);
  console.log(`Download timeout: ${timeoutMs}ms\n`);

  const urls = selectedCompanies.map((c) => ({ url: `https://${c.domain}` }));
  const run = await apify.actor("8Gic54XXaFVLfPzgj").call({ urls });
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();

  console.log(`Apify returned ${items.length} results.\n`);

  let uploaded = 0, failed = 0;

  await mapWithConcurrency(items, concurrency, async (item) => {
    let domain;
    try {
      const rawUrl = item.input_url || item.url || "";
      domain = new URL(rawUrl).hostname.replace(/^www\./, "");
    } catch {
      failed++;
      return;
    }

    const logoUrl = item.logo_url || item.logoUrl || item.logo || null;
    if (!logoUrl) {
      console.log(`  ${domain} — no logo found`);
      failed++;
      return;
    }

    try {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/png";
      const ext = contentType.includes("svg") ? "svg" : "png";
      const filePath = `${domain}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, { contentType, upsert: true });

      if (uploadErr) {
        console.error(`  ${domain} — upload failed: ${uploadErr.message}`);
        failed++;
        return;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
      const { error: updateErr } = await supabase
        .from("companies")
        .update({ logo_url: publicUrl })
        .eq("domain", domain);

      if (updateErr) {
        console.error(`  ${domain} — DB update failed: ${updateErr.message}`);
        failed++;
        return;
      }

      console.log(`  ${domain} — done`);
      uploaded++;
    } catch (err) {
      console.error(`  ${domain} — failed: ${err.message}`);
      failed++;
    }
  });

  console.log(`\nDone! ${uploaded} uploaded, ${failed} failed.`);
}

main().catch(console.error);
