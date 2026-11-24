import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { protectSalesClient } from "@/lib/access-control/sales-client-projection";
import { workRpc } from "@/lib/access-control/work-core.server";
import { supabaseForUser, unauthenticated } from "../supabase";

const DEAL_PROJECTION =
  "id,name,value,currency,stage,expected_close_date,company_id,primary_contact_id,updated_at";

type DealRow = {
  id: string;
  name: string | null;
  value: number | null;
  currency: string | null;
  stage: string | null;
  expected_close_date: string | null;
  company_id: string | null;
  primary_contact_id: string | null;
  updated_at: string | null;
};

const toDealJson = (deal: DealRow) => ({
  id: deal.id,
  name: deal.name ?? null,
  value: deal.value ?? null,
  currency: deal.currency ?? null,
  stage: deal.stage ?? null,
  expected_close_date: deal.expected_close_date ?? null,
  company_id: deal.company_id ?? null,
  primary_contact_id: deal.primary_contact_id ?? null,
  updated_at: deal.updated_at ?? null,
});

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
    const userId = ctx.getUserId();
    if (!userId) return unauthenticated();

    // Usa a fronteira oficial de leitura protegida (shared_fields_deals + RLS do chamador).
    const supabase = protectSalesClient(supabaseForUser(ctx));

    let workspaceId: string;
    try {
      const access = await workRpc<{ workspace?: string | null; actor?: string | null }>(
        supabase,
        "work_access_context",
        {},
      );
      if (!access?.workspace || access.actor !== userId) {
        return {
          content: [
            { type: "text", text: "Membro ativo e workspace selecionado são obrigatórios." },
          ],
          isError: true,
        };
      }
      await workRpc<boolean>(supabase, "sales_area_authorize", {
        r: "techsales.deals",
        a: "view",
        t: null,
        i: null,
      });
      workspaceId = access.workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sem permissão para consultar negócios.";
      return { content: [{ type: "text", text: message }], isError: true };
    }

    let q = supabase
      .from("deals")
      .select(DEAL_PROJECTION)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (stage) q = q.eq("stage", stage as never);
    if (company_id) q = q.eq("company_id", company_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const deals = ((data ?? []) as DealRow[]).map(toDealJson);
    return {
      content: [{ type: "text", text: JSON.stringify(deals, null, 2) }],
      structuredContent: { deals },
    };
  },
});
