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
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
}

async function domainExists(domain: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    return res.status < 500;
  } catch {
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
    const list = names.map((n, i) => `${i + 1}. ${n}`).join("\n");

    const prompt = `For each company below, return its type, official domain, and a URL slug.

- "domain": the official primary domain of the company (lowercase, no www, no protocol). Use correct TLD (.com, .co, .ca, .ai, .io, .cn, .com.cn, etc.). Return null only if you truly have no idea.
- "slug": a short URL-safe ASCII slug. For Chinese names use pinyin (e.g. "李宁" -> "li-ning", "安踏" -> "an-ta"). For English names use lowercase hyphenated (e.g. "Nike" -> "nike", "Li & Fung" -> "li-fung"). Always return a value, never null.
- "is_brand": true if recognizable consumer or business-facing brand.
- "is_service_provider": true if primarily B2B (logistics, manufacturing, infrastructure). Can be both.
- At least one of is_brand or is_service_provider MUST be true. If unsure, default is_brand to true.

Return JSON: { "companies": [{ "name", "domain", "slug", "is_brand", "is_service_provider" }] }

Company names:
${list}`;

    const res = await openai({
      model: "gpt-5.5",
      instructions: "You are a business research assistant. Return only valid JSON, no markdown fences.",
      input: prompt,
      store: false,
      tools: [{ type: "web_search" }],
    });

    if (!res.ok) {
      const err = await res.text();
      return json({ error: `OpenAI error: ${err}` }, 500);
    }

    const data = await res.json();

    // Find the assistant message item (output may also contain reasoning items)
    const messageItem = (data.output ?? []).find((item: { type: string }) => item.type === "message");
    const raw = messageItem?.content?.find((c: { type: string }) => c.type === "output_text")?.text ?? "";

    if (!raw) return json({ error: "Empty response from OpenAI", debug: data }, 500);

    const companies = JSON.parse(raw).companies ?? [];

    // Validate domains in parallel — discard any that don't respond
    const validated = await Promise.all(
      companies.map(async (c: Record<string, unknown>) => {
        const domain = (c.domain as string) ?? null;
        const validDomain = domain && await domainExists(domain) ? domain : null;
        const is_brand = (c.is_brand as boolean) ?? false;
        const is_service_provider = (c.is_service_provider as boolean) ?? false;
        return {
          name: c.name,
          domain: validDomain,
          slug: (c.slug as string) ?? String(c.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          is_brand: (!is_brand && !is_service_provider) ? true : is_brand,
          is_service_provider,
        };
      })
    );

    const results = validated;

    return json({ companies: results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
