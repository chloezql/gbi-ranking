/**
 * Fill companies.description_cn (Chinese) on the production `main` project by
 * translating the English `description` with gpt-4o-mini.
 *
 * - Only touches usable rows with a non-empty English description and an
 *   empty description_cn (so it is resumable / re-runnable).
 * - Caches every translation locally so reruns never re-pay for the same text.
 *
 * Usage:
 *   node scripts/translate-descriptions-to-cn.mjs                 # dry run, no writes
 *   node scripts/translate-descriptions-to-cn.mjs --limit=30      # pilot dry run
 *   node scripts/translate-descriptions-to-cn.mjs --limit=30 --apply
 *   node scripts/translate-descriptions-to-cn.mjs --apply         # full run
 */
import OpenAI from "openai";
import { ProxyAgent } from "undici";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENV_PATH = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(ENV_PATH)) {
  for (const l of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    if (l.startsWith("#")) continue;
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
  }
}

const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const APPLY = process.argv.includes("--apply");
const LIMIT = parseInt(arg("limit", "0"), 10);
const MODEL = arg("model", "gpt-4o-mini");
const CONCURRENCY = Math.max(1, parseInt(arg("concurrency", "4"), 10));
const CACHE_PATH = fileURLToPath(new URL("../scripts/description-cn-cache.json", import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("Missing SUPABASE env"); process.exit(1); }
const main = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Reuse genuine Chinese originals instead of round-tripping EN->中文.
// Trust the `description_original_language` tag only — `hasCJK` cannot tell
// Japanese kanji apart from Chinese, which previously caused Japanese
// descriptions to be written into description_cn unchanged.
const HAS_KANA = (s) => /[぀-ヿ]/.test(s || "");
const cnOriginal = new Map();
for (const f of ["dataset-gbi-combined-final.english.json", "dataset-baijing-2000-plus.english.json"]) {
  const p = fileURLToPath(new URL("../" + f, import.meta.url));
  if (!existsSync(p)) continue;
  for (const r of JSON.parse(readFileSync(p, "utf8"))) {
    const orig = (r.description_original || "").trim();
    const lang = (r.description_original_language || "").toLowerCase();
    if (orig && (lang === "zh" || lang === "chinese") && !HAS_KANA(orig) && !cnOriginal.has(r.domain)) cnOriginal.set(r.domain, orig);
  }
}
console.log(`Chinese originals available for reuse: ${cnOriginal.size}`);

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, ...(proxy ? { fetchOptions: { dispatcher: new ProxyAgent(proxy) } } : {}) });

const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const saveCache = () => writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));

const SYSTEM = "You translate company descriptions from English into Simplified Chinese for a business directory. Return only the translation: natural, concise, professional Simplified Chinese. Keep brand names, product names and well-known acronyms in their original form. Do not add quotes, notes, or explanations.";

async function translate(text) {
  if (cache[text]) return cache[text];
  const res = await openai.chat.completions.create({
    model: MODEL, temperature: 0.2,
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: text }],
  });
  const out = (res.choices[0]?.message?.content || "").trim();
  cache[text] = out;
  return out;
}

async function pageAll() {
  const out = []; let from = 0;
  while (true) {
    const { data, error } = await main.from("companies")
      .select("id,domain,description,description_cn,description_usable")
      .eq("description_usable", true)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break; from += 1000;
  }
  return out;
}

const rows = await pageAll();
let targets = rows.filter((r) => (r.description || "").trim() && !(r.description_cn || "").trim());
console.log(`usable rows=${rows.length}  need description_cn=${targets.length}`);
if (LIMIT) targets = targets.slice(0, LIMIT);
console.log(`${APPLY ? "APPLY" : "DRY RUN"} on ${targets.length} rows (model=${MODEL})`);

let done = 0, failed = 0, reused = 0;
async function worker(list) {
  for (const r of list) {
    try {
      const reuse = cnOriginal.get(r.domain);
      const zh = reuse || await translate(r.description.trim());
      if (reuse) reused++;
      if (APPLY) {
        const { error } = await main.from("companies").update({ description_cn: zh }).eq("id", r.id);
        if (error) throw new Error(error.message);
      }
      done++;
      if (done <= 30 || done % 200 === 0) console.log(`\n[${r.domain}]${reuse ? " (reused original)" : ""}\n  EN: ${r.description.trim().slice(0, 90)}\n  中: ${zh.slice(0, 90)}`);
    } catch (e) { failed++; console.error(`FAIL ${r.domain}: ${e.message}`); }
  }
}
const parts = Array.from({ length: CONCURRENCY }, (_, i) => targets.filter((_, j) => j % CONCURRENCY === i));
await Promise.all(parts.map(worker));
saveCache();
console.log(`\nDONE filled=${done} (reused-original=${reused}, translated=${done - reused}) failed=${failed}  cache=${Object.keys(cache).length}  ${APPLY ? "(written to main)" : "(dry run, nothing written)"}`);
