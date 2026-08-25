import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, resolveWorkspaceId } from "../supabase";

export default defineTool({
  name: "search_leads",
  title: "Buscar leads",
  description:
    "Busca leads do workspace por nome, e-mail, telefone ou empresa, com filtro opcional por status.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Termo de busca (nome, e-mail, telefone ou empresa)."),
    status: z
      .string()
      .trim()
      .optional()
      .describe("Filtrar por status do lead (ex.: new, qualified)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Número máximo de leads retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const workspaceId = await resolveWorkspaceId(supabase, ctx.getUserId()!);
    let q = supabase
      .from("leads")
      .select(
        "id,first_name,last_name,email,phone,company_name,company_id,status,source,score,created_at",
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (query) {
      q = q.or(
        `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,company_name.ilike.%${query}%`,
      );
    }
    if (status) q = q.eq("status", status as never);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { leads: data ?? [] },
    };
  },
});
