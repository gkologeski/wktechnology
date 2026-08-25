// Server functions para o sistema de planos/entitlements.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlanCodeZ = z.enum(["free", "bronze", "prata", "ouro"]);

type UsageRow = { key: string; used: number };

/** Resolve o workspace_owner_id do usuário (owner do workspace ativo). */
async function resolveWorkspaceOwner(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // 1) Se o usuário é dono de algum workspace (entities.owner_id = user_id), retorna ele mesmo.
  // No modelo atual, owner_id de entidades = user_id do dono. Para membros, descobrimos o owner
  // do workspace via workspace_members → workspaces.created_by (ou primeiro admin).
  const { data: own } = await supabaseAdmin
    .from("workspace_subscriptions")
    .select("workspace_owner_id")
    .eq("workspace_owner_id", userId)
    .maybeSingle();
  if (own) return userId;

  // Caso membro: busca workspace e seu created_by
  const { data: mem } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (mem?.workspace_id) {
    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("created_by")
      .eq("id", mem.workspace_id)
      .maybeSingle();
    if (ws?.created_by) return ws.created_by as string;
  }
  return userId; // fallback: o próprio user é o "workspace"
}

function periodMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Retorna plano + todos os entitlements + uso mensal. Usado pelo hook useEntitlements. */
export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const owner = await resolveWorkspaceOwner(context.userId);

    // Garante linha de assinatura (plano "guarda-chuva" do workspace)
    const { data: sub } = await supabaseAdmin
      .from("workspace_subscriptions")
      .select("plan_code, status, trial_ends_at, current_period_start, current_period_end")
      .eq("workspace_owner_id", owner)
      .maybeSingle();

    let planCode = (sub?.plan_code as string) ?? "free";
    if (!sub) {
      await supabaseAdmin
        .from("workspace_subscriptions")
        .insert({ workspace_owner_id: owner, plan_code: "free", status: "active" } as never);
    }

    const { data: planRow } = await supabaseAdmin
      .from("plans")
      .select("code, name, tier_rank, price_monthly, price_yearly")
      .eq("code", planCode)
      .maybeSingle();

    if (!planRow) planCode = "free";

    // Plano por módulo: workspace_modules.plan_code (cada módulo pode ter um plano
    // diferente). Se um módulo não tiver plan_code definido, herda o plano do workspace.
    // Para isso precisamos do workspace_id do owner.
    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("created_by", owner)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const workspaceId = (ws?.id as string | undefined) ?? null;

    const modulePlans: Record<string, string> = {};
    if (workspaceId) {
      const { data: wms } = await supabaseAdmin
        .from("workspace_modules")
        .select("module_id, plan_code, enabled")
        .eq("workspace_id", workspaceId);
      for (const wm of wms ?? []) {
        if (!wm.enabled) continue;
        modulePlans[wm.module_id as string] = (wm.plan_code as string | null) ?? planCode;
      }
    }
    // Garante CRM como módulo ativo herdando o plano do workspace se não houver linha
    if (!modulePlans["crm"]) modulePlans["crm"] = planCode;

    // Busca entitlements de TODOS os módulos ativos no plano correspondente.
    // plan_entitlements tem (plan_code, key, limit_int, enabled, module_id).
    const moduleIds = Object.keys(modulePlans);
    const planCodes = Array.from(new Set(Object.values(modulePlans)));
    const { data: allEnts } = await supabaseAdmin
      .from("plan_entitlements")
      .select("key, limit_int, enabled, module_id, plan_code")
      .in("plan_code", planCodes.length ? planCodes : ["free"]);

    const { data: usage } = await supabaseAdmin
      .from("usage_counters")
      .select("key, used")
      .eq("workspace_owner_id", owner)
      .eq("period_month", periodMonth());

    const entMap: Record<string, { limit: number | null; enabled: boolean; used: number }> = {};
    for (const e of allEnts ?? []) {
      const mid = (e.module_id as string | null) ?? "crm";
      // Só aplica a entitlement se o módulo está ativo E o plan_code da linha
      // bate com o plano do módulo (planos diferentes coexistem no mesmo SELECT).
      if (!moduleIds.includes(mid)) continue;
      if (e.plan_code !== modulePlans[mid]) continue;
      const key = e.key as string;
      entMap[key] = {
        limit: e.limit_int as number | null,
        enabled: e.enabled as boolean,
        used: 0,
      };
    }
    for (const u of (usage ?? []) as UsageRow[]) {
      if (entMap[u.key]) entMap[u.key].used = u.used;
      else entMap[u.key] = { limit: null, enabled: true, used: u.used };
    }

    // Contagens reais para entidades (substituem 'used' por count atual)
    const entityCounts: Array<[string, string]> = [
      ["leads", "leads.max"],
      ["contacts", "contacts.max"],
      ["companies", "companies.max"],
      ["deals", "deals.max"],
    ];
    await Promise.all(
      entityCounts.map(async ([table, key]) => {
        const { count } = await (
          supabaseAdmin as unknown as {
            from: (t: string) => {
              select: (
                c: string,
                o: { count: "exact"; head: true },
              ) => {
                eq: (
                  a: string,
                  b: string,
                ) => { is: (a: string, b: null) => Promise<{ count: number | null }> };
              };
            };
          }
        )
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("owner_id", owner)
          .is("deleted_at", null);
        if (entMap[key]) entMap[key].used = count ?? 0;
      }),
    );

    return {
      workspace_owner_id: owner,
      plan: planRow ?? {
        code: "free",
        name: "Free",
        tier_rank: 0,
        price_monthly: 0,
        price_yearly: 0,
      },
      status: sub?.status ?? "active",
      trial_ends_at: sub?.trial_ends_at ?? null,
      entitlements: entMap,
      module_plans: modulePlans,
    };
  });

/** Compara todos os planos lado a lado (para a tabela comparativa). */
export const listPlansWithEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plans } = await supabaseAdmin
      .from("plans")
      .select("code, name, tier_rank, price_monthly, price_yearly")
      .eq("is_active", true)
      .order("tier_rank", { ascending: true });
    const { data: ents } = await supabaseAdmin
      .from("plan_entitlements")
      .select("plan_code, key, limit_int, enabled");

    const byKey: Record<
      string,
      Array<{ plan_code: string; limit_int: number | null; enabled: boolean }>
    > = {};
    for (const e of ents ?? []) {
      const k = e.key as string;
      byKey[k] = byKey[k] ?? [];
      byKey[k].push({
        plan_code: e.plan_code as string,
        limit_int: e.limit_int as number | null,
        enabled: e.enabled as boolean,
      });
    }
    return { plans: plans ?? [], entitlements: byKey };
  });

/** Plataforma-admin altera o plano de um workspace. */
export const setWorkspacePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspace_owner_id: z.string().uuid(),
        plan_code: PlanCodeZ,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admin } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!admin) throw new Error("Apenas super-admins podem alterar planos.");

    const { error } = await supabaseAdmin.from("workspace_subscriptions").upsert(
      {
        workspace_owner_id: data.workspace_owner_id,
        plan_code: data.plan_code,
        status: "active",
        current_period_start: new Date().toISOString(),
      } as never,
      { onConflict: "workspace_owner_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Auto-upgrade do próprio usuário (mock — sem cobrança real). */
export const requestSelfUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ plan_code: PlanCodeZ }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const owner = await resolveWorkspaceOwner(context.userId);
    if (owner !== context.userId) {
      throw new Error("Apenas o dono do workspace pode alterar o plano.");
    }
    const { error } = await supabaseAdmin.from("workspace_subscriptions").upsert(
      {
        workspace_owner_id: owner,
        plan_code: data.plan_code,
        status: "active",
        current_period_start: new Date().toISOString(),
      } as never,
      { onConflict: "workspace_owner_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, mock: true };
  });
