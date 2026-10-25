import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Sugestões da IA na conversa (leitura pela RLS do usuário).
export const listConversationSuggestions = createServerFn({ method: "POST" })
  .middleware([
    requireSalesPermission(
      ["techsales.inbox.email", "techsales.inbox.whatsapp", "techsales.inbox.chat"],
      "view",
    ),
  ])
  .inputValidator((i) => z.object({ conversationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("inbox_ai_suggestions")
      .select(
        "id, message_id, kind, target_entity, target_id, old_company_id, old_company_name, new_company_name, matched_company_ids, status, applied_company_id, resolved_by, resolved_at, created_at",
      )
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).flatMap((r) => r.matched_company_ids ?? []))];
    const { data: cos } = ids.length
      ? await context.supabase.from("companies").select("id, name").in("id", ids)
      : { data: [] };
    const names = new Map((cos ?? []).map((c) => [c.id as string, c.name as string]));
    // Permissão: o usuário só pode aplicar se consegue editar o registro (RLS de UPDATE).
    return (rows ?? []).map((r) => ({
      ...r,
      matches: (r.matched_company_ids ?? [])
        .filter((id: string) => names.has(id))
        .map((id: string) => ({ id, name: names.get(id)! })),
    }));
  });

// Aplica ou ignora uma sugestão. A troca usa o cliente do usuário (RLS de edição).
export const resolveSuggestion = createServerFn({ method: "POST" })
  .middleware([
    requireSalesPermission(
      ["techsales.inbox.email", "techsales.inbox.whatsapp", "techsales.inbox.chat"],
      "manage",
    ),
  ])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["dismiss", "unlink", "link_existing", "create_and_link"]),
        companyId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sg, error } = await supabase
      .from("inbox_ai_suggestions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sg) throw new Error("Sugestão não encontrada ou sem acesso.");
    if (sg.status !== "pending") throw new Error("Esta sugestão já foi resolvida.");
    const table = sg.target_entity === "lead" ? "leads" : "contacts";
    let newCompanyId: string | null = null;
    let newCompanyName: string | null = null;

    if (data.action !== "dismiss") {
      if (data.action === "link_existing") {
        if (!data.companyId || !(sg.matched_company_ids ?? []).includes(data.companyId))
          throw new Error("Escolha uma das empresas sugeridas.");
        const { data: co } = await supabase
          .from("companies")
          .select("id, name")
          .eq("id", data.companyId)
          .eq("workspace_id", sg.workspace_id)
          .maybeSingle();
        if (!co) throw new Error("Empresa não encontrada.");
        newCompanyId = co.id;
        newCompanyName = co.name;
      } else if (data.action === "create_and_link") {
        if (!sg.new_company_name) throw new Error("A conversa não informou a nova empresa.");
        const { data: co, error: cErr } = await supabase
          .from("companies")
          .insert({
            name: sg.new_company_name,
            workspace_id: sg.workspace_id,
            owner_id: userId,
          } as never)
          .select("id, name")
          .single();
        if (cErr) throw new Error(`Não foi possível criar a empresa: ${cErr.message}`);
        newCompanyId = co.id;
        newCompanyName = co.name;
      }
      const { data: upd, error: uErr } = await supabase
        .from(table)
        .update({ company_id: newCompanyId, company_name: newCompanyName } as never)
        .eq("id", sg.target_id)
        .eq("workspace_id", sg.workspace_id)
        .select("id");
      if (uErr) throw new Error(uErr.message);
      if (!upd?.length) throw new Error("Você não tem permissão para editar este cadastro.");
      await supabase.from("activities").insert({
        workspace_id: sg.workspace_id,
        owner_id: userId,
        type: "note",
        completed: true,
        subject: "Empresa alterada a partir de sugestão da IA",
        body: newCompanyName
          ? `Empresa alterada de ${sg.old_company_name ?? "(sem empresa)"} para ${newCompanyName}, a partir de sugestão da IA na conversa de WhatsApp.`
          : `Desassociado de ${sg.old_company_name ?? "(sem empresa)"}, a partir de sugestão da IA na conversa de WhatsApp.`,
        [sg.target_entity === "lead" ? "related_lead_id" : "related_contact_id"]: sg.target_id,
        related_company_id: newCompanyId,
      } as never);
    }
    // Compare-and-set: só resolve se ainda estiver pendente (escrita do servidor).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: done } = await supabaseAdmin
      .from("inbox_ai_suggestions")
      .update({
        status: data.action === "dismiss" ? "dismissed" : "applied",
        applied_company_id: newCompanyId,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", sg.id)
      .eq("status", "pending")
      .select("id");
    if (!done?.length) throw new Error("Esta sugestão já foi resolvida.");
    return { ok: true };
  });

// Link curto para o material anexado pela Lia (o arquivo continua privado).
export const getMessageMaterialLink = createServerFn({ method: "POST" })
  .middleware([
    requireSalesPermission(
      ["techsales.inbox.email", "techsales.inbox.whatsapp", "techsales.inbox.chat"],
      "view",
    ),
  ])
  .inputValidator((i) => z.object({ messageId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Acesso: o usuário precisa enxergar a mensagem pela RLS.
    const { data: msg } = await context.supabase
      .from("whatsapp_messages")
      .select("id, workspace_id")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: full } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("raw")
      .eq("id", msg.id)
      .maybeSingle();
    const materialId = (full?.raw as { material_id?: string } | null)?.material_id;
    if (!materialId) return { url: null };
    const { data: mat } = await supabaseAdmin
      .from("sdr_materials")
      .select("kind, url, storage_path, workspace_id")
      .eq("id", materialId)
      .eq("workspace_id", msg.workspace_id as string)
      .maybeSingle();
    if (!mat) return { url: null };
    if (mat.storage_path) {
      if (!mat.storage_path.startsWith(`${msg.workspace_id}/`) || mat.storage_path.includes(".."))
        return { url: null };
      const { data: signed } = await supabaseAdmin.storage
        .from("sdr-materials")
        .createSignedUrl(mat.storage_path, 300);
      return { url: signed?.signedUrl ?? null };
    }
    return { url: (mat.url as string | null) ?? null };
  });
