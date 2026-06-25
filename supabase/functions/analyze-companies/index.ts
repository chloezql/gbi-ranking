// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function openai(body: object): Promise<Response> {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
}

function domainFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

// Run tasks with max concurrency to avoid rate limits
async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

const SKIP_DOMAINS = new Set([
  "wikipedia.org", "linkedin.com", "bloomberg.com", "reuters.com",
  "forbes.com", "crunchbase.com", "fortune.com", "wsj.com", "ft.com",
  "businesswire.com", "prnewswire.com", "sec.gov", "glassdoor.com",
  "indeed.com", "twitter.com", "x.com", "facebook.com", "instagram.com",
  "youtube.com", "zoominfo.com", "dnb.com", "pitchbook.com",
  "baike.baidu.com", "zhihu.com", "weibo.com", "weixin.qq.com",
]);

function isCompanyDomain(domain: string): boolean {
  if (SKIP_DOMAINS.has(domain)) return false;
  if (domain.endsWith(".wikipedia.org")) return false;
  return true;
}

function extractDomainFromResponse(data: Record<string, unknown>): string | null {
  const message = (data.choices as { message?: { annotations?: unknown[] } }[])?.[0]?.message;
  const urls: string[] = [];

  const annotations = (message?.annotations ?? []) as { type: string; url_citation?: { url: string } }[];
  for (const ann of annotations) {
    if (ann.type === "url_citation" && ann.url_citation?.url) urls.push(ann.url_citation.url);
  }
  const citations = (data.citations ?? []) as { url?: string }[];
  for (const c of citations) {
    if (c.url) urls.push(c.url);
  }

  for (const url of urls) {
    const domain = domainFromUrl(url);
    if (domain && isCompanyDomain(domain)) return domain;
  }
  return null;
}

async function searchOnce(prompt: string): Promise<string | null> {
  try {
    const res = await openai({
      model: "gpt-4o-search-preview",
      messages: [{ role: "user", content: prompt }],
    });
    if (!res.ok) return null;
    return extractDomainFromResponse(await res.json());
  } catch {
    return null;
  }
}

function isChinese(name: string): boolean {
  return /[一-鿿]/.test(name);
}

async function validateDomain(domain: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    return res.status < 500;
  } catch {
    // Try http as fallback
    try {
      const res2 = await fetch(`http://${domain}`, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
      });
      return res2.status < 500;
    } catch {
      return false;
    }
  } finally {
    clearTimeout(timer);
  }
}

// Pass 1: two parallel queries — priority based on input language, validated via HTTP
async function searchDomain(name: string): Promise<string | null> {
  const [en, zh] = await Promise.all([
    searchOnce(`Go to the official homepage of the company "${name}" and tell me the URL of the page you visited.`),
    searchOnce(`访问"${name}"公司的官方网站首页，告诉我你访问的页面URL。`),
  ]);

  const priority = isChinese(name) ? [zh, en] : [en, zh];

  for (const domain of priority) {
    if (!domain) continue;
    if (await validateDomain(domain)) return domain;
  }
  return null;
}

// Pass 2: AI knowledge fallback for companies search couldn't resolve
async function classifyBatch(names: string[]): Promise<Map<string, { domain: string | null; is_brand: boolean; is_service_provider: boolean }>> {
  const list = names.map((n, i) => `${i + 1}. ${n}`).join("\n");

  const prompt = `For each company below, return its type and official domain.

- "domain": best guess at primary domain (lowercase, no www, no protocol). Use correct TLD (.com, .co, .ca, .ai, .io, etc.). Return null only if you have no idea.
- "is_brand": true if recognizable consumer or business-facing brand
- "is_service_provider": true if primarily B2B (logistics, manufacturing, infrastructure). Can be both.
- At least one of is_brand or is_service_provider MUST be true. If unsure, default is_brand to true.

Return JSON: { "companies": [{ "name", "domain", "is_brand", "is_service_provider" }] }

Companies:
${list}`;

  const map = new Map<string, { domain: string | null; is_brand: boolean; is_service_provider: boolean }>();

  try {
    const res = await openai({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a business research assistant. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    });

    if (!res.ok) return map;

    const data = await res.json();
    const companies = JSON.parse(data.choices?.[0]?.message?.content ?? "{}").companies ?? [];
    for (const c of companies) {
      if (c.name) {
        const is_brand = c.is_brand ?? false;
        const is_service_provider = c.is_service_provider ?? false;
        map.set(c.name.toLowerCase(), {
          domain: c.domain ?? null,
          is_brand: (!is_brand && !is_service_provider) ? true : is_brand,
          is_service_provider,
        });
      }
    }
  } catch {}

  return map;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not configured" }, 500);

  let names: string[];
  try {
    const body = await req.json();
    names = body.names;
    if (!Array.isArray(names) || names.length === 0) throw new Error("names must be a non-empty array");
  } catch (e) {
    return json({ error: e.message }, 400);
  }

  try {
    // Pass 1: web search for all companies in parallel (max 10 concurrent)
    const searchTasks = names.map(name => () => searchDomain(name));
    const searchedDomains = await withConcurrency(searchTasks, 10);

    const domainMap = new Map<string, string | null>(
      names.map((name, i) => [name.toLowerCase(), searchedDomains[i]])
    );

    // Pass 2: AI classification for types + domain fallback for unresolved
    const classified = await classifyBatch(names);

    const results = names.map((name) => {
      const key = name.toLowerCase();
      const domain = domainMap.get(key) ?? classified.get(key)?.domain ?? null;
      const c = classified.get(key);
      const is_brand = c?.is_brand ?? false;
      const is_service_provider = c?.is_service_provider ?? false;
      return {
        name,
        domain,
        is_brand: (!is_brand && !is_service_provider) ? true : is_brand,
        is_service_provider,
      };
    });

    return json({ companies: results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
