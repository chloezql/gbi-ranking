// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
const APIFY_ACTOR_ID = Deno.env.get("APIFY_ACTOR_ID") ?? "tri_angle~similarweb-scraper";
const APIFY_LOGO_ACTOR_ID = Deno.env.get("APIFY_LOGO_ACTOR_ID") ?? "8Gic54XXaFVLfPzgj";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      .select("domain")
      .eq("id", submissionId)
      .single();

    if (fetchErr || !submission) return json({ error: "Submission not found" }, 404);

    // Webhooks must be passed as a base64-encoded query param, not in the body
    const webhooks = btoa(JSON.stringify([{
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
      requestUrl: WEBHOOK_URL,
    }]));

    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}&webhooks=${webhooks}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domains: [submission.domain],
        }),
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
