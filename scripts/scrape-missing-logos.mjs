/**
 * Scrape logos for companies that don't have one yet.
 *
 * Usage:
 *   APIFY_TOKEN=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-missing-logos.mjs
 */

import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";

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

async function main() {
  const { data: companies } = await supabase
    .from("companies")
    .select("domain")
    .is("logo_url", null)
    .order("domain");

  console.log(`${companies.length} companies without logo. Starting Apify...\n`);

  const urls = companies.map((c) => ({ url: `https://${c.domain}` }));
  const run = await apify.actor("8Gic54XXaFVLfPzgj").call({ urls });
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();

  console.log(`Apify returned ${items.length} results.\n`);

  let uploaded = 0, failed = 0;

  for (const item of items) {
    let domain;
    try {
      const rawUrl = item.input_url || item.url || "";
      domain = new URL(rawUrl).hostname.replace(/^www\./, "");
    } catch {
      failed++;
      continue;
    }

    const logoUrl = item.logo_url || item.logoUrl || item.logo || null;
    if (!logoUrl) {
      console.log(`  ${domain} — no logo found`);
      failed++;
      continue;
    }

    try {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) });
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
        continue;
      }

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

  console.log(`\nDone! ${uploaded} uploaded, ${failed} failed.`);
}

main().catch(console.error);
