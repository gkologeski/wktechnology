import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";

/** Lista a conciliação de clientes/fornecedores (RLS do próprio usuário). */
export const contaAzulPeopleList = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "view")])
  .inputValidator((input) =>
    z
      .object({
        tab: z.enum(["suggested", "review", "new", "linked", "decided"]),
        search: z.string().max(200).optional(),
        page: z.number().int().min(0).max(1000).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, people] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-people.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await people.assertPeopleAccess(context.supabase, workspaceId, context.userId, "view");
    // Acesso já verificado acima; a leitura usa o cliente do servidor limitada ao workspace
    // para não reavaliar a permissão linha a linha (estourava o tempo do banco).
    const statuses = data.tab === "decided" ? ["confirmed", "ignored"] : [data.tab];
    let q = supabaseAdmin
      .from("contaazul_person_links")
      .select(
        "id, name, person_kind, profile, document, email, status, match_by, score, candidates, local_company_id, local_contact_id, decided_at",
        { count: "exact" },
      )
      .eq("workspace_id", workspaceId)
      .in("status", statuses)
      .order("score", { ascending: false, nullsFirst: false })
      .order("name")
      .range(data.page * 50, data.page * 50 + 49);
    if (data.search?.trim()) q = q.ilike("name", `%${data.search.trim().replace(/[%_,]/g, " ")}%`);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const STATUSES = ["suggested", "review", "new", "linked", "confirmed", "ignored"] as const;
    const counted = await Promise.all(
      STATUSES.map((st) =>
        supabaseAdmin
          .from("contaazul_person_links")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", st),
      ),
    );
    const totals: Record<string, number> = {};
    counted.forEach((r, i) => {
      if (r.error) throw new Error(r.error.message);
      if (r.count) totals[STATUSES[i]!] = r.count;
    });
    return { rows: rows ?? [], total: count ?? 0, totals };
  });

/** Lê clientes/fornecedores do Conta Azul e recalcula sugestões (só a lista de vínculos). */
export const contaAzulPeopleRefresh = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .handler(async ({ context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, people] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-people.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await people.assertPeopleAccess(context.supabase, workspaceId, context.userId, "manage");
    // Função restrita ao servidor; recebe o usuário já autenticado pelo middleware.
    const { data: ok } = await supabaseAdmin.rpc("sales_contaazul_authorize", {
      p_user: context.userId,
      p_ws: workspaceId,
      p_entity: "connection",
    });
    if (ok !== true) {
      throw new Error("Sem permissão de gestão da integração Conta Azul.");
    }
    return {
      counts: await people.refreshPeopleLinks(supabaseAdmin, workspaceId, {
        client: context.supabase,
        userId: context.userId,
      }),
    };
  });

/** Confirma, troca, marca como nova (somente financeiro), ignora ou reabre vínculos. */
export const contaAzulPeopleDecide = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((input) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        action: z.enum(["confirm", "choose", "new", "ignore", "reopen"]),
        localId: z.string().uuid().nullable().optional(),
      })
      .refine((v) => v.action !== "choose" || (!!v.localId && v.ids.length === 1), {
        message: "Escolha um único cadastro para vincular.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [{ resolveActiveWorkspace }, { supabaseAdmin }, people] = await Promise.all([
      import("@/lib/active-workspace.server"),
      import("@/integrations/supabase/client.server"),
      import("./contaazul-people.server"),
    ]);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await people.assertPeopleAccess(context.supabase, workspaceId, context.userId, "manage");
    const changed = await people.decidePeopleLinks(supabaseAdmin, {
      workspaceId,
      userId: context.userId,
      client: context.supabase,
      ids: data.ids,
      action: data.action,
      localId: data.localId ?? null,
    });
    return { changed };
  });
