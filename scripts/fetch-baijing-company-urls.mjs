/**
 * Fetch company website URLs from baijing.cn company directory.
 *
 * Usage:
 *   node scripts/fetch-baijing-company-urls.mjs
 *   node scripts/fetch-baijing-company-urls.mjs --scales=5,6 --delay=800
 *   node scripts/fetch-baijing-company-urls.mjs --pages=2 --ps=20
 *   node scripts/fetch-baijing-company-urls.mjs --scales=6 --output-prefix=baijing-scale-6
 *
 * Scale values from baijing.cn:
 *   5 = 500-1999 people
 *   6 = 2000+ people
 *
 * Outputs:
 *   scripts/baijing-company-urls.json
 *   scripts/apify-input-baijing-company-urls.json
 */

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://www.baijing.cn";
const COMPANY_API_URL = `${BASE_URL}/company/ajax/get_companys/`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
const INVALID_URL_VALUES = new Set([
  "网址",
  "官网",
  "无",
  "暂无",
  "http://网址",
  "https://网址",
]);
const INTERNAL_DOMAINS = new Set(["baijing.cn", "baijingapp.com"]);

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.slice(prefix.length);
}

const outputPrefix = getArg("output-prefix", "baijing");
const OUTPUT_FILE = join(__dirname, `${outputPrefix}-company-urls.json`);
const APIFY_OUTPUT_FILE = join(
  __dirname,
  `apify-input-${outputPrefix}-company-urls.json`
);
const scales = getArg("scales", "5")
  .split(",")
  .map((scale) => scale.trim())
  .filter(Boolean);
const ps = parseInt(getArg("ps", "20"), 10);
const requestedPages = parseInt(getArg("pages", "0"), 10);
const delayMs = parseInt(getArg("delay", "600"), 10);
const checkpointEvery = parseInt(getArg("checkpoint-every", "10"), 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;

  const value = String(rawUrl).trim();
  if (
    !value ||
    INVALID_URL_VALUES.has(value.toLowerCase()) ||
    value.startsWith("javascript:") ||
    value.startsWith("mailto:")
  ) {
    return null;
  }

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!hostname.includes(".")) return null;
    if (INTERNAL_DOMAINS.has(hostname)) return null;

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeDomain(rawUrl) {
  const normalizedUrl = normalizeUrl(rawUrl);
  if (!normalizedUrl) return null;

  try {
    const hostname = new URL(normalizedUrl).hostname.toLowerCase().replace(/^www\./, "");
    return hostname.includes(".") ? hostname : null;
  } catch {
    return null;
  }
}

function buildFormBody({ scale, page }) {
  const form = new URLSearchParams({
    order: "",
    status: "",
    area: "",
    scale,
    exchange: "",
    type: "",
    type2: "",
    round: "",
    ps: String(ps),
    pn: String(page),
  });
  return form.toString();
}

async function fetchCompanyPage({ scale, page }) {
  const response = await fetch(COMPANY_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: BASE_URL,
      referer: `${BASE_URL}/company/?scale=${encodeURIComponent(scale)}&ps=${ps}&pn=${page}`,
      "user-agent": USER_AGENT,
      "x-requested-with": "XMLHttpRequest",
    },
    body: buildFormBody({ scale, page }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for scale=${scale} page=${page}`);
  }

  const json = await response.json();
  if (!json?.success || !json?.data || !Array.isArray(json.data.posts_list)) {
    throw new Error(`Unexpected response for scale=${scale} page=${page}`);
  }

  return json.data;
}

function normalizeCompany(item, scale) {
  const websiteUrl = normalizeUrl(item.company_url);
  const domain = normalizeDomain(item.company_url);

  return {
    id: item.id,
    uid: item.uid,
    company_name: item.company_name || "",
    company_short_name: item.company_short_name || "",
    raw_company_url: item.company_url || null,
    company_url: websiteUrl,
    domain,
    scale,
    company_people: item.company_people || null,
    company_type_new: item.company_type_new || null,
    round: item.round || null,
    company_state: item.company_state || null,
    company_province: item.company_province || null,
    company_city: item.company_city || null,
    source_url: `${BASE_URL}/company/?scale=${scale}&ps=${ps}&pn=1`,
    detail_url: `${BASE_URL}/people/${item.uid}`,
  };
}

function writeOutputs(results) {
  const uniqueByDomain = [];
  const seenDomains = new Set();

  for (const item of results) {
    if (!item.domain || seenDomains.has(item.domain)) continue;
    seenDomains.add(item.domain);
    uniqueByDomain.push(item);
  }

  const domains = uniqueByDomain.map((item) => item.domain);
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  writeFileSync(APIFY_OUTPUT_FILE, JSON.stringify({ domains }, null, 2));
  return { domains, uniqueByDomain };
}

async function fetchScale(scale) {
  const firstPage = await fetchCompanyPage({ scale, page: 1 });
  const total = Number(firstPage.total || 0);
  const maxPages = Math.ceil(total / ps);
  const pageCount = requestedPages > 0 ? Math.min(requestedPages, maxPages) : maxPages;

  console.log(`Scale ${scale}: total=${total}, pages=${pageCount}, ps=${ps}`);

  const results = firstPage.posts_list.map((item) => normalizeCompany(item, scale));
  console.log(`  Page 1/${pageCount}: ${firstPage.posts_list.length} companies`);

  for (let page = 2; page <= pageCount; page++) {
    await sleep(delayMs);
    const data = await fetchCompanyPage({ scale, page });
    results.push(...data.posts_list.map((item) => normalizeCompany(item, scale)));
    console.log(`  Page ${page}/${pageCount}: ${data.posts_list.length} companies`);
  }

  return results;
}

async function main() {
  if (!scales.length) {
    throw new Error("No scales requested. Use --scales=5 or --scales=5,6.");
  }

  console.log("=== Fetch baijing company URLs ===");
  console.log(`Scales: ${scales.join(", ")}`);
  console.log(`Delay: ${delayMs}ms`);

  const results = [];
  for (let i = 0; i < scales.length; i++) {
    if (i > 0) await sleep(delayMs);
    const scaleResults = await fetchScale(scales[i]);
    results.push(...scaleResults);

    if (checkpointEvery > 0 && (i + 1) % checkpointEvery === 0) {
      const { domains } = writeOutputs(results);
      console.log(`  Checkpoint saved: ${results.length} rows, ${domains.length} unique domains`);
    }
  }

  const withUrl = results.filter((item) => item.company_url).length;
  const { domains } = writeOutputs(results);

  console.log("\nDone.");
  console.log(`Companies fetched: ${results.length}`);
  console.log(`Rows with URL: ${withUrl}`);
  console.log(`Unique domains: ${domains.length}`);
  console.log(`Companies output: ${OUTPUT_FILE}`);
  console.log(`Apify input: ${APIFY_OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error("Fatal:", error.message);
  process.exit(1);
});
