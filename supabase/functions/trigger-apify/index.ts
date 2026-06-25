// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
const APIFY_ACTOR_ID = Deno.env.get("APIFY_ACTOR_ID") ?? "tri_angle~similarweb-scraper";
const APIFY_LOGO_ACTOR_ID = Deno.env.get("APIFY_LOGO_ACTOR_ID") ?? "8Gic54XXaFVLfPzgj";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/process-apify-result`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

async function enrichWithAI(
  name: string,
  categories: { id: string; slug: string; name: string }[]
): Promise<{ title: string; description: string; description_cn: string; country_code: string; category_id: string | null }> {
  const categoryList = categories.map(c => `${c.slug}: ${c.name}`).join("\n");

  const prompt = `You are a business research assistant. For the company "${name}", provide:

1. "description": A 2-3 sentence English description of what the company does, its industry, and key products/services.
2. "description_cn": Chinese translation of the description above.
3. "country_code": ISO 2-letter country code of the company's origin (e.g. "CN", "US", "FR").
4. "category_slug": The best matching category slug from this list:
${categoryList}

Return JSON: { "description", "description_cn", "country_code", "category_slug" }`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only valid JSON matching the requested schema." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);

  const data = await res.json();
  const result = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

  const matchedCategory = categories.find(c => c.slug === result.category_slug) ?? null;

  return {
    title: name,
    description: result.description ?? "",
    description_cn: result.description_cn ?? "",
    country_code: result.country_code ?? "",
    category_id: matchedCategory?.id ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const text = await req.text();
    if (!text) return json({ error: "Empty request body" }, 400);

    const { submissionId } = JSON.parse(text);
    if (!submissionId) return json({ error: "Missing submissionId" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: submission, error: fetchErr } = await supabase
      .from("company_submissions")
      .select("domain, name")
      .eq("id", submissionId)
      .single();

    if (fetchErr || !submission) return json({ error: "Submission not found" }, 404);

    // No dot = slug-only company, skip Apify and enrich with AI instead
    if (!submission.domain.includes(".")) {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, slug, name")
        .is("parent_id", null); // top-level categories only

      const enriched = await enrichWithAI(submission.name, categories ?? []);

      await supabase.from("staged_companies").insert({
        submission_id: submissionId,
        domain: submission.domain,
        title: enriched.title,
        description: enriched.description,
        description_cn: enriched.description_cn,
        country_code: enriched.country_code,
        category_id: enriched.category_id,
      });

      await supabase
        .from("company_submissions")
        .update({ apify_status: "skipped", updated_at: new Date().toISOString() })
        .eq("id", submissionId);

      return json({ skipped: true });
    }

    // Normal domain — trigger Apify
    const webhooks = btoa(JSON.stringify([{
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
      requestUrl: WEBHOOK_URL,
    }]));

    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}&webhooks=${webhooks}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: [submission.domain] }),
      }
    );

    if (!apifyRes.ok) {
      const text = await apifyRes.text();
      throw new Error(`Apify error ${apifyRes.status}: ${text}`);
    }

    const apifyData = await apifyRes.json();
    const runId: string = apifyData.data?.id;

    await supabase
      .from("company_submissions")
      .update({ apify_run_id: runId, apify_status: "running", updated_at: new Date().toISOString() })
      .eq("id", submissionId);

    // Trigger logo actor in parallel (failure is non-fatal)
    try {
      const logoWebhooks = btoa(JSON.stringify([{
        eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
        requestUrl: WEBHOOK_URL,
      }]));

      const logoRes = await fetch(
        `https://api.apify.com/v2/acts/${APIFY_LOGO_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}&webhooks=${logoWebhooks}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: [{ url: `https://${submission.domain}` }] }),
        }
      );

      if (logoRes.ok) {
        const logoData = await logoRes.json();
        const logoRunId: string = logoData.data?.id;
        if (logoRunId) {
          await supabase
            .from("company_submissions")
            .update({ apify_logo_run_id: logoRunId })
            .eq("id", submissionId);
        }
      }
    } catch {
      // Logo actor failure is non-fatal
    }

    return json({ runId });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
