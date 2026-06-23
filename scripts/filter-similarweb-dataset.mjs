/**
 * Filter one Similarweb dataset before enrichment/import.
 *
 * Keeps rows that have:
 * - a domain
 * - positive visits
 * - at least two countries with a positive traffic share
 *
 * Description is intentionally not required because source-specific enrichment
 * runs after this step.
 *
 * Usage:
 *   node scripts/filter-similarweb-dataset.mjs input.json \
 *     --source=baijing --output=dataset-baijing-filtered.json
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, extname, join, resolve } from "path";

function getArg(name, defaultValue = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : defaultValue;
}

const inputArg = process.argv.find(
  (arg) => arg.endsWith(".json") && !arg.startsWith("--")
);

if (!inputArg) {
  console.error(
    "Usage: node scripts/filter-similarweb-dataset.mjs <input.json> --source=<source> [--output=file.json]"
  );
  process.exit(1);
}

const inputPath = resolve(inputArg);
const source = getArg("source");
const minCountries = Math.max(1, parseInt(getArg("min-countries", "2"), 10));
const outputPath = resolve(
  getArg(
    "output",
    join(
      dirname(inputPath),
      `${basename(inputPath, extname(inputPath))}.filtered.json`
    )
  )
);

if (!existsSync(inputPath)) {
  throw new Error(`Input file not found: ${inputPath}`);
}
if (!source) {
  throw new Error("Missing --source=<source>.");
}

function normalizeDomain(value) {
  return String(value || "").trim().toLowerCase().replace(/^www\./, "");
}

function parseVisits(value) {
  return parseInt(value, 10) || 0;
}

function validCountryShares(item) {
  if (!Array.isArray(item.topCountryShares)) return [];
  return item.topCountryShares.filter(
    (share) => share?.CountryCode && Number(share.Value || 0) > 0
  );
}

const rows = JSON.parse(readFileSync(inputPath, "utf8"));
if (!Array.isArray(rows)) {
  throw new Error("Expected the input JSON to contain an array.");
}

const stats = {
  inputRows: rows.length,
  missingDomain: 0,
  nonPositiveVisits: 0,
  insufficientCountries: 0,
  duplicateDomains: 0,
};
const byDomain = new Map();

for (const item of rows) {
  const domain = normalizeDomain(item.domain);
  const visits = parseVisits(item.visits);
  const countryShares = validCountryShares(item);

  if (!domain) {
    stats.missingDomain++;
    continue;
  }
  if (visits <= 0) {
    stats.nonPositiveVisits++;
    continue;
  }
  if (countryShares.length < minCountries) {
    stats.insufficientCountries++;
    continue;
  }

  const normalized = {
    ...item,
    domain,
    topCountryShares: countryShares,
    source_dataset: source,
  };
  const existing = byDomain.get(domain);

  if (!existing) {
    byDomain.set(domain, normalized);
    continue;
  }

  stats.duplicateDomains++;
  if (visits > parseVisits(existing.visits)) {
    byDomain.set(domain, normalized);
  }
}

const outputRows = [...byDomain.values()].sort(
  (a, b) => parseVisits(b.visits) - parseVisits(a.visits)
);

writeFileSync(outputPath, `${JSON.stringify(outputRows, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      ...stats,
      source,
      minCountries,
      outputRows: outputRows.length,
      missingDescriptions: outputRows.filter((item) => !item.description).length,
      outputPath,
    },
    null,
    2
  )
);
