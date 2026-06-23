/**
 * Detect description language locally and translate only non-English text.
 *
 * High-confidence English is skipped without an OpenAI request. Obvious
 * non-Latin scripts and high-confidence non-English text are translated.
 * Short or low-confidence text is sent to OpenAI for classification and
 * conditional translation.
 *
 * Usage:
 *   node scripts/translate-dataset-descriptions.mjs dataset-final.json
 *   node scripts/translate-dataset-descriptions.mjs dataset-final.json --translate
 *   node scripts/translate-dataset-descriptions.mjs dataset-final.json --translate --review-all
 *   node scripts/translate-dataset-descriptions.mjs dataset-final.json --translate --limit=10
 *   node scripts/translate-dataset-descriptions.mjs dataset-final.json --translate --concurrency=3
 */

import OpenAI from "openai";
import { detectAll } from "tinyld";
import { ProxyAgent } from "undici";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, extname, join, resolve } from "path";
import { loadEnvFile } from "process";

const ENV_FILE = resolve(".env.local");
if (existsSync(ENV_FILE)) loadEnvFile(ENV_FILE);

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
    "Usage: node scripts/translate-dataset-descriptions.mjs <input.json> [--translate]"
  );
  process.exit(1);
}

const inputPath = resolve(inputArg);
const translate = process.argv.includes("--translate");
const reviewAll = process.argv.includes("--review-all");
const model = getArg("model", "gpt-4o-mini");
const promptVersion = "company-description-v3";
const minLanguageConfidence = parseFloat(
  getArg("min-language-confidence", "0.25")
);
const minLanguageMargin = parseFloat(getArg("min-language-margin", "0.08"));
const minLocalLength = parseInt(getArg("min-local-length", "24"), 10);
const limit = parseInt(getArg("limit", "0"), 10);
const delayMs = parseInt(getArg("delay", "250"), 10);
const concurrency = Math.max(1, parseInt(getArg("concurrency", "1"), 10));
const outputPath = resolve(
  getArg(
    "output",
    join(
      dirname(inputPath),
      `${basename(inputPath, extname(inputPath))}.english.json`
    )
  )
);
const cachePath = resolve(
  getArg(
    "cache",
    join(
      dirname(inputPath),
      `${basename(inputPath, extname(inputPath))}.translation-cache.json`
    )
  )
);
const auditPath = resolve(
  getArg(
    "audit",
    join(
      dirname(inputPath),
      `${basename(inputPath, extname(inputPath))}.language-audit.csv`
    )
  )
);

if (!existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);
if (translate && !process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required with --translate.");
}

const openai = translate
  ? new OpenAI({
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
    })
  : null;

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function mapWithConcurrency(items, workerCount, handler) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(workerCount, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        await handler(items[index], index);
      }
    }
  );
  await Promise.all(workers);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function detectScriptLanguage(text) {
  if (/[\uac00-\ud7af]/u.test(text)) return "ko";
  if (/[\u3040-\u30ff]/u.test(text)) return "ja";
  if (/[\u3400-\u9fff]/u.test(text)) return "zh";
  if (/[\u0400-\u04ff]/u.test(text)) return "ru";
  if (/[\u0600-\u06ff]/u.test(text)) return "ar";
  if (/[\u0590-\u05ff]/u.test(text)) return "he";
  if (/[\u0900-\u097f]/u.test(text)) return "hi";
  if (/[\u0e00-\u0e7f]/u.test(text)) return "th";
  return null;
}

const ENGLISH_WORDS = new Set([
  "a", "about", "all", "and", "are", "as", "at", "available", "be", "best",
  "brand", "business", "buy", "by", "company", "designed", "discover", "for",
  "from", "get", "global", "high", "in", "is", "it", "latest", "made", "more",
  "new", "of", "official", "on", "online", "our", "product", "products", "shop",
  "solutions", "that", "the", "their", "to", "with", "we", "website", "you",
  "your",
]);

function englishWordCount(text) {
  return text
    .toLowerCase()
    .match(/[a-z]+(?:'[a-z]+)?/g)
    ?.filter((word) => ENGLISH_WORDS.has(word)).length || 0;
}

function inspectLanguage(value) {
  const text = cleanText(value);
  const scriptLanguage = detectScriptLanguage(text);
  if (scriptLanguage) {
    return {
      decision: "translate",
      language: scriptLanguage,
      confidence: 1,
      reason: "non_latin_script",
    };
  }

  const results = detectAll(text).slice(0, 3);
  const best = results[0] || { lang: "unknown", accuracy: 0 };
  const second = results[1] || { lang: "unknown", accuracy: 0 };
  const margin = best.accuracy - second.accuracy;
  const commonEnglishWords = englishWordCount(text);

  if (
    text.length >= minLocalLength &&
    (
      (best.lang === "en" && margin >= minLanguageMargin) ||
      commonEnglishWords >= 4
    )
  ) {
    return {
      decision: "skip",
      language: "en",
      confidence: best.accuracy,
      reason: "local_english_signals",
    };
  }

  if (
    text.length >= minLocalLength &&
    best.lang !== "en" &&
    best.accuracy >= minLanguageConfidence &&
    margin >= minLanguageMargin &&
    commonEnglishWords < 2
  ) {
    return {
      decision: "translate",
      language: best.lang,
      confidence: best.accuracy,
      reason: "local_high_confidence_non_english",
    };
  }

  return {
    decision: "review",
    language: best.lang || "unknown",
    confidence: best.accuracy || 0,
    reason: "local_low_confidence",
  };
}

function readCache() {
  if (!existsSync(cachePath)) return {};
  return JSON.parse(readFileSync(cachePath, "utf8"));
}

function writeCache(cache) {
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function classifyAndTranslate(item) {
  const response = await openai.responses.create({
    model,
    instructions: [
      "Determine whether the source text broadly introduces a company, brand, or platform.",
      "A description of its main purpose, products, services, business, or users is valid, even if it does not explicitly describe the corporate entity.",
      "Reject only text focused on a specific product, product category, campaign, article, policy, promotion, unrelated page, or unusable content.",
      "If it is, translate it faithfully into natural English.",
      "If it is already English, return it unchanged.",
      "Preserve all names, numbers, dates, locations, products, and factual claims.",
      "Do not infer or invent English names for proper nouns; keep the original name if uncertain.",
      "If it is not a company or brand introduction, mark it unusable and do not translate it.",
      "Do not add, remove, summarize, or rewrite information.",
    ].join(" "),
    input: [`Domain: ${item.domain}`, "Source description:", item.description].join(
      "\n"
    ),
    text: {
      format: {
        type: "json_schema",
        name: "description_language_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            is_company_description: { type: "boolean" },
            source_language: { type: "string" },
            english_description: { type: "string" },
            reason: { type: "string" },
          },
          required: [
            "is_company_description",
            "source_language",
            "english_description",
            "reason",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text);
  const english = cleanText(parsed.english_description);
  if (parsed.is_company_description && !english) {
    throw new Error("OpenAI accepted the description but returned no English text.");
  }
  return {
    isCompanyDescription: parsed.is_company_description,
    sourceLanguage: parsed.source_language,
    english,
    reason: parsed.reason,
  };
}

async function main() {
  const rows = JSON.parse(readFileSync(inputPath, "utf8"));
  if (!Array.isArray(rows)) throw new Error("Expected an array JSON input.");

  const cache = readCache();
  const inspections = rows.map((item) => ({
    item,
    source: cleanText(item.description),
    local: item.description
      ? inspectLanguage(item.description)
      : {
          decision: "missing",
          language: "unknown",
          confidence: 0,
          reason: "missing_description",
        },
  }));
  const apiTargets = inspections.filter(({ local }) =>
    reviewAll
      ? local.decision !== "missing"
      : local.decision === "translate" || local.decision === "review"
  );
  const selectedTargets = limit > 0 ? apiTargets.slice(0, limit) : apiTargets;

  console.log(
    JSON.stringify(
      {
        inputRows: rows.length,
        localEnglishSkipped: inspections.filter(
          ({ local }) => local.decision === "skip"
        ).length,
        localNonEnglish: inspections.filter(
          ({ local }) => local.decision === "translate"
        ).length,
        lowConfidenceReview: inspections.filter(
          ({ local }) => local.decision === "review"
        ).length,
        missingDescriptions: inspections.filter(
          ({ local }) => local.decision === "missing"
        ).length,
        selectedApiTargets: selectedTargets.length,
        concurrency,
        reviewAll,
        mode: translate ? "translate" : "audit",
      },
      null,
      2
    )
  );

  if (translate) {
    await mapWithConcurrency(selectedTargets, concurrency, async ({ item, source, local }, index) => {
      const domain = String(item.domain || "").toLowerCase();
      const cached = cache[domain];
      process.stdout.write(`[${index + 1}/${selectedTargets.length}] ${domain} ... `);

      if (
        cached?.source === source &&
        cached?.prompt_version === promptVersion &&
        typeof cached?.is_company_description === "boolean"
      ) {
        console.log("cached");
        return;
      }

      try {
        const result = await classifyAndTranslate(item);
        const isEnglish =
          result.isCompanyDescription &&
          result.sourceLanguage.toLowerCase() === "en";

        cache[domain] = {
          source,
          local,
          is_company_description: result.isCompanyDescription,
          is_english: isEnglish,
          source_language: result.sourceLanguage,
          english: result.english,
          reason: result.reason,
          model,
          prompt_version: promptVersion,
          processed_at: new Date().toISOString(),
        };
        writeCache(cache);
        console.log(
          !result.isCompanyDescription
            ? "unusable"
            : isEnglish
              ? "English, unchanged"
              : "translated"
        );
        await sleep(delayMs);
      } catch (error) {
        console.log(`failed: ${error.message}`);
      }
    });
  }

  const outputRows = rows.map((item) => {
    const domain = String(item.domain || "").toLowerCase();
    const cached = cache[domain];
    const source = cleanText(item.description);
    if (!cached || cached.source !== source) return item;
    if (cached.is_company_description === false) {
      return {
        ...item,
        description_usable: false,
        description_rejection_reason: cached.reason,
        description_original_language: cached.source_language,
      };
    }
    if (cached.is_english) {
      return {
        ...item,
        description_usable: true,
        description_original_language: cached.source_language,
      };
    }

    return {
      ...item,
      description_usable: true,
      description_original: source,
      description_original_language: cached.source_language,
      description: cached.english,
      description_en: cached.english,
      description_translation_model: cached.model,
      description_translated_at: cached.processed_at,
    };
  });

  const auditRows = [
    [
      "domain",
      "local_decision",
      "local_language",
      "local_confidence",
      "reason",
      "api_is_english",
      "is_company_description",
      "api_language",
      "translated",
      "reason",
    ],
    ...inspections.map(({ item, local }) => {
      const cached = cache[String(item.domain || "").toLowerCase()];
      return [
        item.domain,
        local.decision,
        local.language,
        local.confidence,
        local.reason,
        cached?.is_english ?? "",
        cached?.is_company_description ?? "",
        cached?.source_language ?? "",
        cached?.is_company_description && cached?.english ? "yes" : "no",
        cached?.reason ?? "",
      ];
    }),
  ];

  writeFileSync(
    auditPath,
    `${auditRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`
  );
  if (translate) {
    writeFileSync(outputPath, `${JSON.stringify(outputRows, null, 2)}\n`);
  }

  console.log(`Audit: ${auditPath}`);
  if (translate) console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
  console.error("Fatal:", error.message);
  process.exit(1);
});
