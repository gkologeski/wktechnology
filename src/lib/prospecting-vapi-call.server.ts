import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesArea, assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import { isValidE164 } from "@/lib/phone/e164";

// Discagem Vapi (server-only). Fica fora de prospecting-campaigns.functions.ts
// porque é usada também pelo cron de discagem: exportada de um arquivo
// .functions.ts, ela entraria no pacote do navegador junto com as checagens
// de permissão do servidor.
const VAPI_BASE = "https://api.vapi.ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sbAdmin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function renderTemplate(tpl: string, ctx: { lead: { name: string; company: string } }): string {
  return tpl
    .replaceAll("{{lead.name}}", ctx.lead.name)
    .replaceAll("{{lead.company}}", ctx.lead.company);
}

export async function startVapiCall(opts: {
  workspaceId: string;
  caller?: SupabaseClient;
  actorId?: string;
  leadId: string;
  scriptId: string;
  campaignId?: string | null;
  variantId?: string | null;
  attemptNumber?: number;
  attemptId?: string | null;
  /** Ligação de teste: usa o WhatsApp de apoio desta campanha sem entrar na fila. */
  followupCampaignId?: string | null;
}): Promise<{ ok: boolean; call_id?: string; error?: string }> {
  const sb = opts.caller ?? (await sbAdmin());
  const diagnostics = await sbAdmin();
  const authorize = async () => {
    if (opts.campaignId) {
      const { data: source } = await sb
        .from("prospecting_campaigns")
        .select("workspace_id,status")
        .eq("id", opts.campaignId)
        .eq("workspace_id", opts.workspaceId)
        .maybeSingle();
      if (!source || source.status !== "running")
        throw new Error("Campanha indisponível para ligação.");
    }
    if (opts.caller) {
      await assertSalesArea(opts.caller, "techsales.prospecting_voice", "create");
      await assertSalesRecord(opts.caller, "leads", opts.leadId, "view");
      await assertSalesRecord(opts.caller, "prospecting_scripts", opts.scriptId, "view");
    } else {
      if (!opts.campaignId) throw new Error("Chamada sem responsável de execução autorizado.");
      await assertSalesWorker(sb, "prospecting_campaigns", opts.campaignId, [
        { table: "leads", id: opts.leadId },
        { table: "prospecting_scripts", id: opts.scriptId },
        { resource: "techsales.prospecting_voice", action: "create" },
      ]);
    }
  };
  try {
    await authorize();
  } catch {
    return { ok: false, error: "Chamada bloqueada: origem ou permissão atual indisponível." };
  }
  const persistDiag = async (patch: Record<string, unknown>) => {
    if (!opts.attemptId) return;
    await diagnostics.from("prospecting_call_attempts").update(patch).eq("id", opts.attemptId);
  };

  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    await persistDiag({ vapi_response: { error: "VAPI_API_KEY ausente" } });
    return { ok: false, error: "VAPI_API_KEY ausente" };
  }

  const { data: lead } = await sb
    .from("leads")
    .select("id, first_name, last_name, company_name, phone")
    .eq("id", opts.leadId)
    .single();
  if (!lead?.phone) {
    await persistDiag({ vapi_response: { error: "Lead sem telefone", lead_id: opts.leadId } });
    return { ok: false, error: "Lead sem telefone" };
  }
  // O provedor de voz exige E.164; número fora do padrão não é discado.
  if (!isValidE164(lead.phone)) {
    await persistDiag({
      vapi_response: { error: "Telefone fora do padrão E.164", lead_id: opts.leadId },
    });
    return {
      ok: false,
      error: "Telefone do lead fora do padrão (+código do país). Corrija antes de ligar.",
    };
  }

  const { data: script } = await sb
    .from("prospecting_scripts")
    .select("*")
    .eq("id", opts.scriptId)
    .single();
  if (!script) {
    await persistDiag({
      vapi_response: { error: "Script não encontrado", script_id: opts.scriptId },
    });
    return { ok: false, error: "Script não encontrado" };
  }

  const { data: cfg } = await sb
    .from("voice_agent_settings")
    .select("*")
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();
  const phoneNumberId = cfg?.vapi_phone_number_id as string | undefined;
  if (!phoneNumberId) {
    await persistDiag({ vapi_response: { error: "Vapi phone number não configurado" } });
    return { ok: false, error: "Vapi phone number não configurado" };
  }

  const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
  const ctx = { lead: { name: leadName, company: lead.company_name ?? "" } };
  const renderedFirst = renderTemplate(script.first_message ?? "", ctx);
  const renderedPrompt = renderTemplate(script.system_prompt ?? "", ctx);
  const voiceId =
    (script.voice_id as string | null) ?? (cfg?.default_voice_id as string | undefined);

  const assistant: Record<string, unknown> = {
    name: "Prospecting Agent",
    model: {
      provider: "openai",
      model: (cfg?.llm_model as string) ?? "gpt-4o-mini",
      messages: [{ role: "system", content: renderedPrompt }],
    },
    firstMessage: renderedFirst,
    firstMessageMode: "assistant-speaks-first",
    maxDurationSeconds: (cfg?.max_duration_seconds as number) ?? 600,
    // Force Portuguese (Brazil) transcription so the model understands pt-BR audio.
    transcriber: { provider: "deepgram", model: "nova-2", language: "pt-BR" },
  };
  if (voiceId) {
    // Use ElevenLabs multilingual model with pt language so the voice speaks Portuguese
    // properly instead of a Spanish accent trying to read pt-BR text.
    assistant.voice = {
      provider: "11labs",
      voiceId,
      model: "eleven_multilingual_v2",
      language: "pt",
    };
  }

  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
  const { publicAppOrigin } = await import("@/lib/runtime-config.server");
  const baseUrl = publicAppOrigin();

  // Body actually sent to Vapi (includes the real secret).
  const outgoingAssistant: Record<string, unknown> = { ...assistant };
  if (webhookSecret) {
    outgoingAssistant.server = { url: `${baseUrl}/api/public/hooks/vapi`, secret: webhookSecret };
  }
  const outgoingBody = {
    phoneNumberId,
    assistant: outgoingAssistant,
    customer: { number: lead.phone },
    metadata: {
      leadId: opts.leadId,
      scriptId: opts.scriptId,
      campaignId: opts.campaignId ?? null,
      variantId: opts.variantId ?? null,
      workspaceId: opts.workspaceId,
    },
  };

  // Persisted snapshot (redacted secret) — safe to render in the UI.
  const redactedAssistant: Record<string, unknown> = { ...assistant };
  if (webhookSecret) {
    redactedAssistant.server = { url: `${baseUrl}/api/public/hooks/vapi`, secret: "[REDACTED]" };
  }
  const requestSnapshot = { ...outgoingBody, assistant: redactedAssistant };

  await persistDiag({ vapi_request: requestSnapshot });

  let res: Response;
  try {
    await authorize();
  } catch {
    return { ok: false, error: "Chamada bloqueada após mudança de origem ou permissão." };
  }
  try {
    res = await fetch(`${VAPI_BASE}/call`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(outgoingBody),
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : "network error";
    await persistDiag({ vapi_response: { error: `fetch failed: ${err}` } });
    return { ok: false, error: err };
  }

  const rawText = await res.text();
  let parsed: unknown = rawText;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    /* keep raw text */
  }

  if (!res.ok) {
    await persistDiag({ vapi_response: { status: res.status, body: parsed } });
    return {
      ok: false,
      error: `Vapi ${res.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
    };
  }
  const json = (parsed && typeof parsed === "object" ? parsed : {}) as { id?: string };

  await persistDiag({ vapi_response: { status: res.status, body: parsed } });

  // Only insert a fresh attempt row on the dialLeadNow path (no pre-existing attempt).
  if (!opts.attemptId) {
    await diagnostics.from("prospecting_call_attempts").insert({
      workspace_id: opts.workspaceId,
      owner_id: opts.actorId ?? opts.workspaceId,
      campaign_id: opts.campaignId ?? null,
      followup_campaign_id: opts.followupCampaignId ?? null,
      variant_id: opts.variantId ?? null,
      script_id: opts.scriptId,
      lead_id: opts.leadId,
      vapi_call_id: json.id ?? null,
      status: "ringing",
      attempt_number: opts.attemptNumber ?? 1,
      started_at: new Date().toISOString(),
      vapi_request: requestSnapshot,
      vapi_response: { status: res.status, body: parsed },
    });
  }

  return { ok: true, call_id: json.id };
}
