/**
 * Use OpenAI to detect the origin country of each company, then update Supabase.
 *
 * Usage:
 *   OPENAI_API_KEY=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/detect-countries.mjs
 *   node scripts/detect-countries.mjs --batch-size=30 --concurrency=4
 */

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { ProxyAgent } from "undici";
import { existsSync } from "fs";
import { resolve } from "path";
import { loadEnvFile } from "process";

const ENV_FILE = resolve(".env.local");
if (existsSync(ENV_FILE)) loadEnvFile(ENV_FILE);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykzrabinwggxpxidencn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  maxRetries: 2,
  timeout: 120_000,
  ...(process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    ? {
        fetchOptions: {
          dispatcher: new ProxyAgent(
            process.env.HTTPS_PROXY || process.env.HTTP_PROXY
          ),
        },
      }
    : {}),
});

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.slice(prefix.length);
}

const batchSize = Math.max(1, parseInt(getArg("batch-size", "30"), 10));
const concurrency = Math.max(1, parseInt(getArg("concurrency", "4"), 10));
const limit = Math.max(0, parseInt(getArg("limit", "0"), 10));

function isCountryCode(value) {
  return /^[A-Z]{2}$/.test(String(value || "").toUpperCase());
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

async function detectCountries(companies) {
  const list = companies
    .map((c) => `- ${c.domain} | ${c.title || ""} | ${(c.description || "").slice(0, 100)}`)
    .join("\n");

  const response = await openai.responses.create({
    model: "gpt-4o-mini",
    instructions:
      "Determine each company's origin country, meaning where the company or brand was founded. Return ISO 3166-1 alpha-2 codes. Use the current headquarters only when the founding country cannot be established. Do not use website traffic country.",
    input: list,
    text: {
      format: {
        type: "json_schema",
        name: "company_origin_countries",
        strict: true,
        schema: {
          type: "object",
          properties: {
            companies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  domain: { type: "string" },
                  country_code: {
                    type: "string",
                    pattern: "^[A-Z]{2}$",
                  },
                },
                required: ["domain", "country_code"],
                additionalProperties: false,
              },
            },
          },
          required: ["companies"],
          additionalProperties: false,
        },
      },
    },
  });

  return JSON.parse(response.output_text).companies;
}

async function main() {
  // Get companies without country_code
  const { data: companies, error } = await supabase
    .from("companies")
    .select("domain, title, description")
    .is("country_code", null)
    .eq("description_usable", true)
    .order("domain");

  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  if (companies.length === 0) {
    console.log("All companies already have country codes!");
    return;
  }

  const selectedCompanies = limit > 0 ? companies.slice(0, limit) : companies;
  console.log(`${companies.length} visible companies need country detection.`);
  console.log(`${selectedCompanies.length} companies selected.\n`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Concurrency: ${concurrency}\n`);

  let total = 0;
  let failedBatches = 0;
  const batches = [];

  for (let i = 0; i < selectedCompanies.length; i += batchSize) {
    batches.push(selectedCompanies.slice(i, i + batchSize));
  }

  await mapWithConcurrency(batches, concurrency, async (batch, batchIndex) => {
    console.log(`Batch ${batchIndex + 1}/${batches.length}: ${batch.length} companies...`);

    try {
      const results = (await detectCountries(batch)).filter(
        ({ domain, country_code }) =>
          batch.some((company) => company.domain === domain) &&
          isCountryCode(country_code)
      );

      await Promise.all(
        results.map(async ({ domain, country_code }) => {
          const { error: updateErr } = await supabase
            .from("companies")
            .update({ country_code: country_code.toUpperCase() })
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
