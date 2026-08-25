import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, resolveWorkspaceId } from "../supabase";
import { ensureLeadRelationsSafe } from "@/lib/leads/lead-relations";
import { checkLeadDuplicate } from "@/lib/leads/lead-duplicate-check";

export default defineTool({
  name: "create_lead",
  title: "Criar lead",
  description:
    "Cria um novo lead no CRM em nome do usuário autenticado, respeitando as permissões do workspace.",
  inputSchema: {
    first_name: z.string().trim().min(1).describe("Nome do lead."),
    last_name: z.string().trim().optional().describe("Sobrenome do lead."),
    email: z.string().trim().email().optional().describe("E-mail do lead."),
    phone: z.string().trim().optional().describe("Telefone do lead."),
    company_name: z.string().trim().optional().describe("Nome da empresa informada pelo lead."),
    source: z.string().trim().optional().describe("Origem do lead (ex.: indicação, site, evento)."),
    notes: z.string().trim().optional().describe("Observações iniciais sobre o lead."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const userId = ctx.getUserId()!;
    const supabase = supabaseForUser(ctx);
    const workspaceId = await resolveWorkspaceId(supabase, userId);
    const { data, error } = await supabase
      .from("leads")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        assigned_user_id: userId,
        first_name: input.first_name,
        last_name: input.last_name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company_name: input.company_name ?? null,
        source: input.source ?? null,
        notes: input.notes ?? null,
      })
      .select("id,first_name,last_name,email,phone,company_name,status,created_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    // Garante empresa e contato vinculados ao lead
    await ensureLeadRelationsSafe(supabase, data.id);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { lead: data },
    };
  },
});
