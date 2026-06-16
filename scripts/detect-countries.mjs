/**
 * Use OpenAI to detect the origin country of each company, then update Supabase.
 *
 * Usage:
 *   OPENAI_API_KEY=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/detect-countries.mjs
 *   node scripts/detect-countries.mjs --batch-size=30 --concurrency=4
 */

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykzrabinwggxpxidencn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.slice(prefix.length);
}

const batchSize = Math.max(1, parseInt(getArg("batch-size", "30"), 10));
const concurrency = Math.max(1, parseInt(getArg("concurrency", "4"), 10));

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

async function detectCountries(companies) {
  const list = companies
    .map((c) => `- ${c.domain} | ${c.title || ""} | ${(c.description || "").slice(0, 100)}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are a business analyst. Given a list of companies (domain, title, description), determine the origin country of each company (where it was founded/headquartered). Return ONLY a JSON array of objects with 'domain' and 'country_code' (ISO 3166-1 alpha-2, e.g. CN, KR, JP, US, TW). If unsure, make your best guess based on the brand name and description language. No explanation, just JSON.",
      },
      {
        role: "user",
        content: list,
      },
    ],
  });

  const text = response.choices[0].message.content.trim();
  const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(jsonStr);
}

async function main() {
  // Get companies without country_code
  const { data: companies, error } = await supabase
    .from("companies")
    .select("domain, title, description")
    .is("country_code", null)
    .order("domain");

  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  if (companies.length === 0) {
    console.log("All companies already have country codes!");
    return;
  }

  console.log(`${companies.length} companies need country detection.\n`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Concurrency: ${concurrency}\n`);

  let total = 0;
  let failedBatches = 0;
  const batches = [];

  for (let i = 0; i < companies.length; i += batchSize) {
    batches.push(companies.slice(i, i + batchSize));
  }

  await mapWithConcurrency(batches, concurrency, async (batch, batchIndex) => {
    console.log(`Batch ${batchIndex + 1}/${batches.length}: ${batch.length} companies...`);

    try {
      const results = await detectCountries(batch);

      await Promise.all(
        results.map(async ({ domain, country_code }) => {
          const { error: updateErr } = await supabase
            .from("companies")
            .update({ country_code })
            .eq("domain", domain);

          if (updateErr) {
            console.error(`  ${domain} - update failed: ${updateErr.message}`);
          } else {
            console.log(`  ${domain} -> ${country_code}`);
            total++;
          }
        })
      );
    } catch (err) {
      failedBatches++;
      console.error(`  Batch ${batchIndex + 1} failed: ${err.message}`);
    }
  });

  console.log(`\nDone! Updated ${total} companies. Failed batches: ${failedBatches}.`);
}

main().catch(console.error);
