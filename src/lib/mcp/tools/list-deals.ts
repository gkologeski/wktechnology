import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, resolveWorkspaceId } from "../supabase";

export default defineTool({
  name: "list_deals",
  title: "Listar negócios",
  description:
    "Lista os negócios (pipeline de vendas) do workspace do usuário, com filtro opcional por estágio ou empresa.",
  inputSchema: {
    stage: z
      .string()
      .trim()
      .optional()
      .describe("Filtrar por estágio do negócio (ex.: qualification)."),
    company_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filtrar pelos negócios de uma empresa específica."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Número máximo de negócios retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ stage, company_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const workspaceId = await resolveWorkspaceId(supabase, ctx.getUserId()!);
    let q = supabase
      .from("deals")
      .select(
        "id,name,value,currency,stage,expected_close_date,company_id,primary_contact_id,updated_at",
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (stage) q = q.eq("stage", stage as never);
    if (company_id) q = q.eq("company_id", company_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { deals: data ?? [] },
    };
  },
});
