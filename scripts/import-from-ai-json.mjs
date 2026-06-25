/**
 * Import companies from an AI-analyzed JSON file into company_submissions,
 * then trigger Apify scraping (or AI enrichment for slug-only companies).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... SUBMITTED_BY=<user-uuid> node scripts/import-from-ai-json.mjs <path-to-json>
 *
 * The JSON file should have shape: { "companies": [{ name, domain, slug, is_brand, is_service_provider }] }
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = "https://ykzrabinwggxpxidencn.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUBMITTED_BY = process.env.SUBMITTED_BY;

if (!SUPABASE_SERVICE_ROLE_KEY) { console.error("Missing SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
if (!SUBMITTED_BY) { console.error("Missing SUBMITTED_BY (user uuid)"); process.exit(1); }

const filePath = process.argv[2];
const startIdx = parseInt(process.argv[3] ?? "0", 10);
const endIdx = parseInt(process.argv[4] ?? "9999", 10);
if (!filePath) { console.error("Usage: node import-from-ai-json.mjs <path-to-json> [start] [end]"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { companies: allCompanies } = JSON.parse(readFileSync(filePath, "utf-8"));
if (!Array.isArray(allCompanies) || allCompanies.length === 0) {
  console.error("No companies found in JSON");
  process.exit(1);
}
const companies = allCompanies.slice(startIdx, endIdx);
console.log(`Processing ${companies.length} companies (${startIdx}–${Math.min(endIdx, allCompanies.length) - 1} of ${allCompanies.length})\n`);

console.log(`Found ${companies.length} companies to import\n`);

let queued = 0, skipped = 0, failed = 0;

for (const c of companies) {
  const domain = c.domain ?? c.slug;

  if (!domain) {
    console.log(`SKIP  ${c.name} — no domain or slug`);
    skipped++;
    continue;
  }

  // Check for existing company or submission
  const [{ data: existingCompany }, { data: existingSubmission }] = await Promise.all([
    supabase.from("companies").select("id, domain").eq("domain", domain).maybeSingle(),
    supabase.from("company_submissions").select("domain").eq("domain", domain).in("status", ["pending", "approved"]).maybeSingle(),
  ]);

  if (existingSubmission) {
    console.log(`EXIST ${c.name} (${domain}) — already in submissions`);
    skipped++;
    continue;
  }

  if (existingCompany) {
    const companyId = existingCompany.id;
    const ops = [];
    if (c.is_brand) {
      ops.push(supabase.from("brands").upsert({ company_id: companyId, domain }, { onConflict: "company_id" }));
    }
    if (c.is_service_provider) {
      ops.push(supabase.from("service_providers").upsert({ company_id: companyId, domain }, { onConflict: "company_id" }));
    }
    if (ops.length) {
      await Promise.all(ops);
      console.log(`TAG   ${c.name} (${domain}) — tagged as ${[c.is_brand && "brand", c.is_service_provider && "service_provider"].filter(Boolean).join(" + ")}`);
    } else {
      console.log(`EXIST ${c.name} (${domain}) — already exists, no type to add`);
    }
    skipped++;
    continue;
  }

  const is_brand = c.is_brand ?? true;
  const is_service_provider = c.is_service_provider ?? false;

  // Insert submission
  const { data: submission, error: insertErr } = await supabase
    .from("company_submissions")
    .insert({
      submitted_by: SUBMITTED_BY,
      name: c.name,
      domain,
      is_brand: (!is_brand && !is_service_provider) ? true : is_brand,
      is_service_provider,
      related_brand_names: [],
      related_service_provider_names: [],
    })
    .select("id")
    .single();

  if (insertErr || !submission) {
    console.log(`FAIL  ${c.name} (${domain}) — ${insertErr?.message}`);
    failed++;
    continue;
  }

  // Trigger Apify (or AI enrichment for slug-only)
  const { error: fnErr } = await supabase.functions.invoke("trigger-apify", {
    body: { submissionId: submission.id },
  });

  if (fnErr) {
    console.log(`WARN  ${c.name} (${domain}) — submitted but trigger failed: ${fnErr.message}`);
  } else {
    console.log(`OK    ${c.name} (${domain})`);
  }

  queued++;

  // Small delay to avoid rate limits
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\nDone — ${queued} queued, ${skipped} skipped, ${failed} failed`);
