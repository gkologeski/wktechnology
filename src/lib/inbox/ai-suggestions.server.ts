// Sugestões da IA dentro da conversa (só leitura até uma pessoa aplicar).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { detectCompanyLeft } from "@/lib/prospecting/sdr/third-party";

type Admin = SupabaseClient<Database>;

/** Empresas do workspace com o mesmo nome (sem acento/caixa). */
export async function matchCompanies(db: Admin, workspaceId: string, name: string) {
  const { data } = await db
    .from("companies")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .ilike("name", name.replace(/[%_\\]/g, "\\$&"))
    .limit(5);
  return (data ?? []) as { id: string; name: string }[];
}

/** Cria (idempotente por mensagem) a sugestão "saiu da empresa". Nunca altera cadastro. */
export async function suggestCompanyLeft(
  admin: Admin,
  p: { workspaceId: string; conversationId: string; messageId: string; body: string | null },
): Promise<"created" | "skipped"> {
  const body = p.body ?? "";
  let hit: { newCompany: string | null } | null = detectCompanyLeft(body);
  if (!hit && body.trim().length < 3) return "skipped";
  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("contact_id, lead_id")
    .eq("id", p.conversationId)
    .eq("workspace_id", p.workspaceId)
    .maybeSingle();
  const entity = conv?.contact_id ? "contact" : conv?.lead_id ? "lead" : null;
  const targetId = (conv?.contact_id ?? conv?.lead_id) as string | null;
  if (!entity || !targetId) return "skipped";
  const { data: row } = await admin
    .from(entity === "contact" ? "contacts" : "leads")
    .select("company_id, company_name")
    .eq("id", targetId)
    .eq("workspace_id", p.workspaceId)
    .maybeSingle();
  const oldId = (row?.company_id as string | null) ?? null;
  let oldName = (row?.company_name as string | null) ?? null;
  if (oldId) {
    const { data: co } = await admin.from("companies").select("name").eq("id", oldId).maybeSingle();
    oldName = (co?.name as string | null) ?? oldName;
  }
  // Regras não reconheceram: complemento pela IA (prompt), só se há empresa no cadastro.
  if (!hit) {
    if (!oldName) return "skipped";
    hit = await classifyWithAI(p.workspaceId, oldName, body);
    if (!hit) return "skipped";
  }
  const matches = hit.newCompany ? await matchCompanies(admin, p.workspaceId, hit.newCompany) : [];
  const { error } = await admin.from("inbox_ai_suggestions").upsert(
    {
      workspace_id: p.workspaceId,
      conversation_id: p.conversationId,
      message_id: p.messageId,
      kind: "company_left",
      target_entity: entity,
      target_id: targetId,
      old_company_id: oldId,
      old_company_name: oldName,
      new_company_name: hit.newCompany,
      matched_company_ids: matches.map((m) => m.id),
    },
    { onConflict: "message_id,kind", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
  return "created";
}

async function classifyWithAI(workspaceId: string, companyName: string, message: string) {
  try {
    const { aiChatFetch } = await import("@/lib/ai/provider-resolver.server");
    const { buildCompanyLeftPrompt, parseCompanyLeftAnswer, COMPANY_LEFT_SCHEMA } = await import(
      "./company-left-ai"
    );
    const res = await aiChatFetch(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          reasoning_effort: "low",
          messages: buildCompanyLeftPrompt(companyName, message),
          response_format: {
            type: "json_schema",
            json_schema: { name: "company_left", strict: true, schema: COMPANY_LEFT_SCHEMA },
          },
        }),
      },
      { workspaceId, feature: "inbox_sugestao_empresa", triggerSource: "automatic" },
    );
    const text = await res.text();
    if (!res.ok) {
      console.error("[inbox-ai-suggestion] IA", res.status);
      return null;
    }
    const r = parseCompanyLeftAnswer(text);
    return r ? { newCompany: r.newCompany } : null;
  } catch (e) {
    console.error("[inbox-ai-suggestion] IA", (e as Error).message);
    return null;
  }
}
