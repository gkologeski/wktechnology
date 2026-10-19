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
  const hit = detectCompanyLeft(p.body ?? "");
  if (!hit) return "skipped";
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
