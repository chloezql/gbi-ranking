/**
 * Fill missing Similarweb descriptions from baijing.cn company detail pages.
 *
 * Usage:
 *   OPENAI_API_KEY=xxx node scripts/enrich-baijing-descriptions.mjs dataset_similarweb-scraper_2026-06-08_14-16-21-677.json
 *   node scripts/enrich-baijing-descriptions.mjs dataset_similarweb-scraper_2026-06-08_14-16-21-677.json --no-translate
 *   node scripts/enrich-baijing-descriptions.mjs dataset_similarweb-scraper_2026-06-08_14-16-21-677.json --limit=5
 *
 * Outputs:
 *   <input>.baijing-enriched.json
 *   scripts/baijing-description-cache.json
 */

import OpenAI from "openai";
import { ProxyAgent } from "undici";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, extname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BAIJING_FILE = join(__dirname, "baijing-company-urls.json");
const DEFAULT_CACHE_FILE = join(__dirname, "baijing-description-cache.json");
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.slice(prefix.length);
}

const inputArg = process.argv.find((arg) => arg.endsWith(".json") && !arg.startsWith("--"));
const baijingFile = resolve(getArg("baijing-file", DEFAULT_BAIJING_FILE));
const cacheFile = resolve(getArg("cache-file", DEFAULT_CACHE_FILE));
const outputArg = getArg("output");
const model = getArg("model", "gpt-4o-mini");
const limit = parseInt(getArg("limit", "0"), 10);
const delayMs = parseInt(getArg("delay", "600"), 10);
const translateDelayMs = parseInt(getArg("translate-delay", "250"), 10);
const includeZeroVisits = process.argv.includes("--include-zero-visits");
const noTranslate = process.argv.includes("--no-translate");
const dryRun = process.argv.includes("--dry-run");

if (!inputArg) {
  console.error("Usage: node scripts/enrich-baijing-descriptions.mjs <similarweb-dataset.json> [--output=file.json]");
  process.exit(1);
}

const inputPath = resolve(inputArg);
if (!existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}
if (!existsSync(baijingFile)) {
  console.error(`Baijing mapping file not found: ${baijingFile}`);
  process.exit(1);
}

const outputPath = outputArg
  ? resolve(outputArg)
  : join(dirname(inputPath), `${basename(inputPath, extname(inputPath))}.baijing-enriched.json`);

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function normalizeDomain(domain) {
  return String(domain || "").trim().toLowerCase().replace(/^www\./, "");
}

function parseVisits(value) {
  return parseInt(value, 10) || 0;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value) {
  return decodeHtml(value)
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function extractCompanyIntro(html) {
  const match = html.match(
    /<dt[^>]*>\s*(?:<span[^>]*>)?\s*公司介绍[：:]?\s*(?:<\/span>)?\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i
  );
  if (!match) return null;

  const text = match[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return cleanText(text);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "user-agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.text();
}

async function fetchBaijingIntro(detailUrl) {
  const html = await fetchText(detailUrl);
  return extractCompanyIntro(html);
}

async function translateDescription(client, chineseDescription, context) {
  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "Translate Chinese company profile text into clear, concise English for a business directory. Preserve facts, company names, dates, locations, and product names. Do not add commentary.",
      },
      {
        role: "user",
        content: [
          `Company: ${context.company_name || context.company_short_name || context.domain}`,
          `Domain: ${context.domain}`,
          "Chinese profile:",
          chineseDescription,
        ].join("\n"),
      },
    ],
  });

  return cleanText(response.choices?.[0]?.message?.content || "");
}

function readJsonArray(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(data)) {
    throw new Error(`Expected ${path} to contain a JSON array.`);
  }
  return data;
}

function readCache(path) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeCache(path, cache) {
  writeFileSync(path, JSON.stringify(cache, null, 2));
}

function buildBaijingDomainMap(rows) {
  const map = new Map();
  for (const item of rows) {
    const domain = normalizeDomain(item.domain);
    if (!domain) continue;
    if (!map.has(domain)) map.set(domain, []);
    map.get(domain).push(item);
  }
  return map;
}

function needsDescription(item) {
  if (item.description) return false;
  if (includeZeroVisits) return true;
  return parseVisits(item.visits) > 0;
}

async function main() {
  const similarwebRows = readJsonArray(inputPath);
  const baijingRows = readJsonArray(baijingFile);
  const baijingByDomain = buildBaijingDomainMap(baijingRows);
  const cache = readCache(cacheFile);
  const client = noTranslate
    ? null
    : new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
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

  if (!noTranslate && !process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Use --no-translate to fetch Chinese descriptions only.");
  }

  const targets = similarwebRows
    .filter(needsDescription)
    .map((item) => {
      const domain = normalizeDomain(item.domain);
      return {
        item,
        domain,
        baijingMatches: baijingByDomain.get(domain) || [],
      };
    })
    .filter((entry) => entry.domain && entry.baijingMatches.length > 0);

  const selectedTargets = limit > 0 ? targets.slice(0, limit) : targets;
  console.log(`Input rows: ${similarwebRows.length}`);
  console.log(`Missing-description rows matched to Baijing: ${targets.length}`);
  console.log(`Rows to process: ${selectedTargets.length}`);
  console.log(`Output: ${outputPath}`);

  const enrichedByDomain = new Map();

  for (let i = 0; i < selectedTargets.length; i++) {
    const { domain, baijingMatches } = selectedTargets[i];
    const baijing = baijingMatches[0];
    const cacheKey = baijing.detail_url || domain;

    process.stdout.write(`  [${i + 1}/${selectedTargets.length}] ${domain} ...`);

    try {
      if (!cache[cacheKey]?.chineseDescription) {
        const chineseDescription = await fetchBaijingIntro(baijing.detail_url);
        if (!chineseDescription) {
          throw new Error("company intro not found");
        }

        cache[cacheKey] = {
          domain,
          detail_url: baijing.detail_url,
          company_name: baijing.company_name,
          chineseDescription,
          englishDescription: null,
        };
        writeCache(cacheFile, cache);
        await sleep(delayMs);
      }

      if (!noTranslate && !cache[cacheKey].englishDescription) {
        cache[cacheKey].englishDescription = await translateDescription(
          client,
          cache[cacheKey].chineseDescription,
          {
            domain,
            company_name: baijing.company_name,
            company_short_name: baijing.company_short_name,
          }
        );
        writeCache(cacheFile, cache);
        await sleep(translateDelayMs);
      }

      const description = noTranslate
        ? cache[cacheKey].chineseDescription
        : cache[cacheKey].englishDescription;

      if (!description) {
        throw new Error("translated description is empty");
      }

      enrichedByDomain.set(domain, {
        description,
        baijing_description_zh: cache[cacheKey].chineseDescription,
        baijing_detail_url: baijing.detail_url,
        baijing_company_name: baijing.company_name,
        description_source: noTranslate ? "baijing_company_intro_zh" : "baijing_company_intro_gpt_translation",
      });

      console.log(" done");
    } catch (error) {
      console.log(` error: ${error.message}`);
    }
  }

  const outputRows = similarwebRows.map((item) => {
    const domain = normalizeDomain(item.domain);
    const enrichment = enrichedByDomain.get(domain);
    if (!enrichment || item.description) return item;
    return {
      ...item,
      description: enrichment.description,
      baijing_description_zh: enrichment.baijing_description_zh,
      baijing_detail_url: enrichment.baijing_detail_url,
      baijing_company_name: enrichment.baijing_company_name,
      description_source: enrichment.description_source,
    };
  });

  const filled = outputRows.filter((item, index) => !similarwebRows[index].description && item.description).length;
  console.log(`Descriptions filled in output: ${filled}`);

  if (dryRun) {
    console.log("Dry run only. Output file was not written.");
    return;
  }

  writeFileSync(outputPath, JSON.stringify(outputRows, null, 2));
  console.log("Done.");
}

main().catch((error) => {
  console.error("Fatal:", error.message);
  process.exit(1);
});
