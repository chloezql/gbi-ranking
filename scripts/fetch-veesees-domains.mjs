/**
 * Fetch brand website domains from veesees.com.
 *
 * Usage:
 *   node scripts/fetch-veesees-domains.mjs
 *   node scripts/fetch-veesees-domains.mjs --pages=10 --limit=1000 --delay=600
 *
 * Outputs:
 *   scripts/veesees-domains.json
 *   scripts/apify-input-veesees.json
 */

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = join(__dirname, "veesees-domains.json");
const APIFY_OUTPUT_FILE = join(__dirname, "apify-input-veesees.json");

const API_BASE = "https://api.veesees.com";

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.slice(prefix.length);
}

const startPage = parseInt(getArg("start-page", "1"), 10);
const pageCount = parseInt(getArg("pages", "10"), 10);
const limit = parseInt(getArg("limit", "1000"), 10);
const delayMs = parseInt(getArg("delay", "600"), 10);
const checkpointEvery = parseInt(getArg("checkpoint-every", "25"), 10);

const HEADERS = {
  accept: "*/*",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
  "ba-user-token": process.env.VEESEES_BA_USER_TOKEN || "3c79a5aa-16df-4fe2-83da-abcdb3817d6b",
  origin: "https://veesees.com",
  referer: "https://veesees.com/",
  server: "true",
  "think-lang": "zh-cn",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDomain(rawUrl) {
  if (!rawUrl) return null;

  const value = String(rawUrl).trim();
  if (!value || value.startsWith("mailto:") || value.startsWith("javascript:")) return null;

  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    const host = value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
    return host.includes(".") ? host : null;
  }
}

function pickDomain(websiteList) {
  if (!Array.isArray(websiteList) || websiteList.length === 0) return null;

  const domains = websiteList
    .map((website) => normalizeDomain(website?.web_url))
    .filter(Boolean);

  if (!domains.length) return null;
  return domains.find((domain) => domain.endsWith(".com")) || domains[0];
}

function writeOutputs(results) {
  const domains = [...new Set(results.map((item) => item.domain).filter(Boolean))];
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  writeFileSync(APIFY_OUTPUT_FILE, JSON.stringify({ domains }, null, 2));
  return domains;
}

function getRetryWaitMs(message) {
  const secondsMatch = String(message || "").match(/Try again in (\d+) seconds?/i);
  if (!secondsMatch) return 1000;
  return (parseInt(secondsMatch[1], 10) + 1) * 1000;
}

async function fetchJson(url, label, retries = 8) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) {
      if (attempt === retries) throw new Error(`${label} HTTP ${response.status}`);
      console.log(`${label}: HTTP ${response.status}; retry ${attempt}/${retries}`);
      await sleep(1000);
      continue;
    }

    const json = await response.json();
    if (json?.code === 1 && json?.data) return json;

    const message = json?.msg || "unexpected response";
    if (attempt === retries) {
      throw new Error(`${label}: ${message}`);
    }

    const waitMs = getRetryWaitMs(message);
    console.log(`${label}: ${message}; wait ${Math.round(waitMs / 1000)}s; retry ${attempt}/${retries}`);
    await sleep(waitMs);
  }

  throw new Error(`${label}: failed`);
}

async function fetchBrandList(page) {
  const url = `${API_BASE}/api/brand/index?limit=100&page=${page}&keywords=`;
  const json = await fetchJson(url, `brand/index page=${page}`);
  if (!Array.isArray(json.data.list)) {
    throw new Error(`brand/index page=${page}: missing data.list`);
  }
  return json.data.list;
}

async function fetchBrandInfo(brandId) {
  const url = `${API_BASE}/api/brand/info?brand_id=${brandId}`;
  const json = await fetchJson(url, `brand/info id=${brandId}`);
  return json.data?.info || null;
}

async function main() {
  console.log("=== Step 1: Fetch veesees brand list ===");
  console.log(`Pages: ${startPage}-${startPage + pageCount - 1}`);
  console.log(`Limit: ${limit}`);
  console.log(`Delay: ${delayMs}ms`);

  const brands = [];
  for (let page = startPage; page < startPage + pageCount; page++) {
    const list = await fetchBrandList(page);
    brands.push(...list);
    console.log(`Page ${page}: ${list.length} brands`);
    await sleep(delayMs);
  }

  const selectedBrands = limit > 0 ? brands.slice(0, limit) : brands;
  console.log(`Brands fetched: ${brands.length}`);
  console.log(`Brands to process: ${selectedBrands.length}`);

  console.log("\n=== Step 2: Fetch brand info and extract websiteList domains ===");
  const results = [];

  for (let i = 0; i < selectedBrands.length; i++) {
    const brand = selectedBrands[i];
    process.stdout.write(`  [${i + 1}/${selectedBrands.length}] ${brand.brand_name || brand.id} ...`);

    try {
      const info = await fetchBrandInfo(brand.id);
      const domain = pickDomain(info?.websiteList);
      results.push({
        id: brand.id,
        brand_name: brand.brand_name || null,
        company_name: brand.company_name || null,
        domain,
        category1: brand.category1 || null,
        category2: brand.category2 || null,
        description: brand.desc || info?.desc || null,
      });
      console.log(` ${domain || "no domain"}`);
    } catch (error) {
      results.push({
        id: brand.id,
        brand_name: brand.brand_name || null,
        company_name: brand.company_name || null,
        domain: null,
        category1: brand.category1 || null,
        category2: brand.category2 || null,
        description: brand.desc || null,
        error: error.message,
      });
      console.log(` error: ${error.message}`);
    }

    await sleep(delayMs);

    if (checkpointEvery > 0 && (i + 1) % checkpointEvery === 0) {
      const domains = writeOutputs(results);
      console.log(`  Checkpoint saved: ${results.length} brands, ${domains.length} unique domains`);
    }
  }

  const domains = writeOutputs(results);
  const withDomain = results.filter((item) => item.domain).length;

  console.log("\nDone.");
  console.log(`Brands processed: ${results.length}`);
  console.log(`Rows with domain: ${withDomain}`);
  console.log(`Unique domains: ${domains.length}`);
  console.log(`Brands output: ${OUTPUT_FILE}`);
  console.log(`Apify input: ${APIFY_OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
