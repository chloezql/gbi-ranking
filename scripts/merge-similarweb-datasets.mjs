/**
 * Merge multiple Similarweb dataset JSON files, dedupe by domain, and optionally filter country outliers.
 *
 * Usage:
 *   node scripts/merge-similarweb-datasets.mjs file1.json file2.json --output=dataset-final.json
 *   node scripts/merge-similarweb-datasets.mjs file1.json file2.json --filter-single-country --output=dataset-final.json
 *   node scripts/merge-similarweb-datasets.mjs file1.json file2.json --exclude-single-country=US
 *   node scripts/merge-similarweb-datasets.mjs file1.json file2.json --require-description
 *   node scripts/merge-similarweb-datasets.mjs file1.json file2.json --prefer-latest
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.slice(prefix.length);
}

const inputArgs = process.argv.filter((arg) => arg.endsWith(".json") && !arg.startsWith("--"));
const outputPath = resolve(getArg("output", "dataset_similarweb-final-merged.json"));
const filterSingleCountry = process.argv.includes("--filter-single-country");
const requireDescription = process.argv.includes("--require-description");
const preferLatest = process.argv.includes("--prefer-latest");
const excludeSingleCountry = getArg("exclude-single-country");
const countryShareThreshold = parseFloat(getArg("country-share-threshold", "0.999"));

if (inputArgs.length < 2) {
  console.error("Usage: node scripts/merge-similarweb-datasets.mjs <file1.json> <file2.json> [--output=file.json]");
  process.exit(1);
}

function normalizeDomain(domain) {
  return String(domain || "").trim().toLowerCase().replace(/^www\./, "");
}

function parseVisits(value) {
  return parseInt(value, 10) || 0;
}

function topCountryShares(item) {
  return Array.isArray(item.topCountryShares) ? item.topCountryShares : [];
}

function shouldFilter(item) {
  const shares = topCountryShares(item);
  if (filterSingleCountry && shares.length === 1) return true;

  if (
    excludeSingleCountry &&
    shares.length === 1 &&
    shares[0]?.CountryCode === excludeSingleCountry &&
    Number(shares[0]?.Value || 0) >= countryShareThreshold
  ) {
    return true;
  }

  return false;
}

function scoreItem(item) {
  let score = parseVisits(item.visits);
  if (item.description) score += 1_000_000_000;
  if (item.description_source) score += 500_000_000;
  return score;
}

function snapshotTime(item) {
  const time = Date.parse(item.snapshotDate || "");
  return Number.isFinite(time) ? time : 0;
}

function shouldReplace(existing, incoming) {
  if (preferLatest) {
    const existingTime = snapshotTime(existing);
    const incomingTime = snapshotTime(incoming);
    if (incomingTime !== existingTime) return incomingTime > existingTime;

    const existingUsable = existing.description_usable === true;
    const incomingUsable = incoming.description_usable === true;
    if (incomingUsable !== existingUsable) return incomingUsable;
  }

  return scoreItem(incoming) > scoreItem(existing);
}

function mergeSources(existing, incoming) {
  return [...new Set([
    existing?.source_dataset,
    incoming?.source_dataset,
    ...(existing?.source_datasets || []),
    ...(incoming?.source_datasets || []),
  ].filter(Boolean))];
}

function readRows(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(data)) {
    throw new Error(`Expected array JSON: ${path}`);
  }
  return data;
}

const byDomain = new Map();
const stats = {
  inputFiles: inputArgs.length,
  inputRows: 0,
  duplicateRows: 0,
  filteredRows: 0,
  missingDescriptionRows: 0,
  missingDomainRows: 0,
};

for (const inputArg of inputArgs) {
  const inputPath = resolve(inputArg);
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const rows = readRows(inputPath);
  stats.inputRows += rows.length;

  for (const item of rows) {
    const domain = normalizeDomain(item.domain);
    if (!domain) {
      stats.missingDomainRows++;
      continue;
    }

    if (shouldFilter(item)) {
      stats.filteredRows++;
      continue;
    }
    if (requireDescription && !item.description) {
      stats.missingDescriptionRows++;
      continue;
    }

    const normalizedItem = {
      ...item,
      domain,
      source_datasets: mergeSources(null, item),
    };
    const existing = byDomain.get(domain);
    if (!existing) {
      byDomain.set(domain, normalizedItem);
      continue;
    }

    stats.duplicateRows++;
    if (shouldReplace(existing, normalizedItem)) {
      byDomain.set(domain, {
        ...normalizedItem,
        source_datasets: mergeSources(existing, normalizedItem),
      });
    } else {
      byDomain.set(domain, {
        ...existing,
        source_datasets: mergeSources(existing, normalizedItem),
      });
    }
  }
}

const mergedRows = [...byDomain.values()].sort((a, b) => parseVisits(b.visits) - parseVisits(a.visits));
writeFileSync(outputPath, JSON.stringify(mergedRows, null, 2));

console.log(JSON.stringify(
  {
    ...stats,
    outputRows: mergedRows.length,
    outputPath,
  },
  null,
  2
));
