import { defineTool } from "@lovable.dev/mcp-js";
import { orSafeLike } from "@/lib/postgrest-search";
import { z } from "zod";
import { supabaseForUser, unauthenticated, resolveWorkspaceId } from "../supabase";

export default defineTool({
  name: "search_companies",
  title: "Buscar empresas",
  description:
    "Busca empresas do CRM por nome, domínio ou CNPJ no workspace do usuário autenticado.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Termo de busca (nome, domínio ou CNPJ)."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Número máximo de empresas retornadas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const workspaceId = await resolveWorkspaceId(supabase, ctx.getUserId()!);
    const { data, error } = await supabase
      .from("companies")
      .select("id,name,domain,cnpj,industry,city,state,phone,website,score,updated_at")
      .eq("workspace_id", workspaceId)
      .eq("audience", "sales")
      .is("deleted_at", null)
      .or(
        `name.ilike.${orSafeLike(query)},domain.ilike.${orSafeLike(query)},cnpj.ilike.${orSafeLike(query)}`,
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { companies: data ?? [] },
    };
  },
});
