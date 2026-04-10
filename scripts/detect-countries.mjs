/**
 * Use OpenAI to detect the origin country of each company, then update Supabase.
 *
 * Usage:
 *   OPENAI_API_KEY=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/detect-countries.mjs
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

  // Process in batches of 30 to stay within token limits
  const BATCH = 30;
  let total = 0;

  for (let i = 0; i < companies.length; i += BATCH) {
    const batch = companies.slice(i, i + BATCH);
    console.log(`Batch ${Math.floor(i / BATCH) + 1}: ${batch.length} companies...`);

    try {
      const results = await detectCountries(batch);

      for (const { domain, country_code } of results) {
        const { error: updateErr } = await supabase
          .from("companies")
          .update({ country_code })
          .eq("domain", domain);

        if (updateErr) {
          console.error(`  ${domain} — update failed: ${updateErr.message}`);
        } else {
          console.log(`  ${domain} → ${country_code}`);
          total++;
        }
      }
    } catch (err) {
      console.error(`  Batch failed: ${err.message}`);
    }
  }

  console.log(`\nDone! Updated ${total} companies.`);
}

main().catch(console.error);
