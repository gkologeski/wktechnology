import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asCountry, formatPhoneDisplay, maskPhone } from "@/lib/phone/e164";
import {
  PHONE_REVIEW_CLASSES,
  phoneEntityName,
  phoneReviewDetail,
  PHONE_REVIEW_KINDS,
  legacyMobileCandidate,
  reconcilePhoneRuns,
  type PhoneRunRow,
  phoneEntityRoute,
  type PhoneEntityRoute,
} from "@/lib/phone/phone-review";

export type PhoneRunSummary = {
  id: string;
  finishedAt: string | null;
  version: string;
  criteria: string;
  counts: Record<string, Record<string, number>>;
  applied: Record<string, number>;
  /** Correções posteriores (execuções filhas): itens da fila resolvidos por campo e tipo. */
  resolved: Record<string, Record<string, number>>;
  /** Data da correção posterior mais recente. */
  correctedAt: string | null;
  /** Pendentes reais por campo lidos do banco; nulo se a contagem falhou. */
  livePending: Record<string, number> | null;
};

export type PhoneReviewItem = {
  id: number;
  table: string;
  column: string;
  rowId: string;
  /** Nome do registro visível ao usuário (RLS); nulo quando não visível. */
  name: string | null;
  /** Ficha a abrir; nulo quando a tabela não tem ficha ou o registro não é visível. */
  route: PhoneEntityRoute | null;
  masked: string;
  classification: string;
  /** Subtipo de revisão humana (ex.: celular antigo sem o 9). */
  reviewKind: string | null;
  reason: string | null;
};

export const getPhoneSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: ws } = await supabase.rpc("default_workspace_for_user", { _user: userId });
    const workspaceId = typeof ws === "string" ? ws : null;
    if (!workspaceId) throw new Error("Workspace ativo não encontrado.");
    const [{ data: w }, { data: isAdmin }, { data: runs }] = await Promise.all([
      supabase
        .from("workspaces")
        .select("default_phone_country, phone_strict_e164")
        .eq("id", workspaceId)
        .maybeSingle(),
      supabase.rpc("is_workspace_admin_v2", { _workspace: workspaceId, _user: userId }),
      // RLS: só administradores ativos do workspace leem as execuções.
      supabase
        .from("phone_normalization_runs")
        .select(
          "id, parent_run_id, status, created_at, finished_at, normalizer_version, criteria, counts",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    const rec = reconcilePhoneRuns((runs ?? []) as PhoneRunRow[]);
    const run = rec ? (runs ?? []).find((r) => r.id === rec.base.id)! : null;
    // Pendentes REAIS por campo: itens da varredura sem gravação e não
    // resolvidos por correção posterior (mesmo filtro da fila).
    let livePending: Record<string, number> | null = null;
    if (rec) {
      livePending = {};
      const fields = Object.keys(rec.counts);
      const results = await Promise.all(
        fields.map((f) => {
          const [table, column] = f.split(".");
          return supabase
            .from("phone_normalization_items")
            .select("id", { count: "exact", head: true })
            .eq("run_id", rec.base.id)
            .eq("table_name", table)
            .eq("column_name", column)
            .is("applied_at", null)
            .is("resolved_at", null)
            .in("classification", [...PHONE_REVIEW_CLASSES]);
        }),
      );
      results.forEach((r, i) => {
        if (r.error || r.count == null) livePending = null;
        else if (livePending) livePending[fields[i]] = r.count;
      });
    }
    return {
      workspaceId,
      country: (w?.default_phone_country as string | undefined) ?? "BR",
      strict: !!w?.phone_strict_e164,
      isAdmin: !!isAdmin,
      run:
        run && rec
          ? ({
              id: run.id as string,
              finishedAt: (run.finished_at as string | null) ?? null,
              version: run.normalizer_version as string,
              criteria: run.criteria as string,
              counts: rec.counts,
              applied: rec.applied,
              resolved: rec.resolved,
              correctedAt: rec.correctedAt,
              livePending,
            } satisfies PhoneRunSummary)
          : null,
    };
  });

export const updatePhoneCountry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ country: z.string().length(2) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await (await import("@/lib/view-as-guard.server")).assertNotReadOnlyView(supabase);
    const country = asCountry(data.country);
    if (!country) throw new Error("País inválido.");
    const { data: ws } = await supabase.rpc("default_workspace_for_user", { _user: userId });
    if (typeof ws !== "string") throw new Error("Workspace ativo não encontrado.");
    // RLS: só owner/admin do workspace atualiza (ws_update_admin).
    const { data: rows, error } = await supabase
      .from("workspaces")
      .update({ default_phone_country: country })
      .eq("id", ws)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Sem permissão para alterar o país padrão.");
    return { country };
  });

export const listPhoneReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        runId: z.string().uuid(),
        classification: z.enum(PHONE_REVIEW_CLASSES).optional(),
        kind: z.enum(PHONE_REVIEW_KINDS).optional(),
        page: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const pageSize = 50;
    const q = context.supabase
      .from("phone_normalization_items")
      .select(
        "id, table_name, column_name, row_id, original_value, classification, reason, review_kind",
        { count: "exact" },
      )
      .eq("run_id", data.runId)
      .is("applied_at", null)
      .is("resolved_at", null)
      .in("classification", data.classification ? [data.classification] : [...PHONE_REVIEW_CLASSES])
      .order("id")
      .range(data.page * pageSize, data.page * pageSize + pageSize - 1);
    const { data: rows, error, count } = await (data.kind ? q.eq("review_kind", data.kind) : q);
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    // Nomes dos registros da página, lidos com o cliente do usuário (RLS):
    // quem não pode ver o registro recebe o item sem nome.
    const idsOf = (t: string) => [
      ...new Set(list.filter((r) => r.table_name === t).map((r) => r.row_id as string)),
    ];
    type NameRow = { id: string } & Parameters<typeof phoneEntityName>[0];
    const sb = context.supabase;
    const fetchers: Record<string, (ids: string[]) => PromiseLike<{ data: NameRow[] | null }>> = {
      contacts: (ids) =>
        sb.from("contacts").select("id, first_name, last_name, email").in("id", ids),
      leads: (ids) => sb.from("leads").select("id, first_name, last_name, email").in("id", ids),
      companies: (ids) => sb.from("companies").select("id, name").in("id", ids),
      people: (ids) => sb.from("people").select("id, full_name, email").in("id", ids),
      ats_candidates: (ids) =>
        sb.from("ats_candidates").select("id, full_name, email").in("id", ids),
      profiles: (ids) => sb.from("profiles").select("id, full_name").in("id", ids),
    };
    const names = new Map<string, string>();
    await Promise.all(
      Object.entries(fetchers).map(async ([table, fetch]) => {
        const ids = idsOf(table);
        if (!ids.length) return;
        const { data: found } = await fetch(ids);
        for (const r of found ?? []) {
          const n = phoneEntityName(r);
          if (n) names.set(`${table}:${r.id}`, n);
        }
      }),
    );

    return {
      total: count ?? 0,
      pageSize,
      items: list.map((r): PhoneReviewItem => {
        const table = r.table_name as string;
        const rowId = r.row_id as string;
        const name = names.get(`${table}:${rowId}`) ?? null;
        return {
          id: r.id as number,
          table,
          column: r.column_name as string,
          rowId,
          name,
          route: name ? phoneEntityRoute(table) : null,
          masked: maskPhone(r.original_value as string | null),
          classification: r.classification as string,
          reviewKind: (r.review_kind as string | null) ?? null,
          // Motivo específico calculado na hora pela mesma regra (candidato mascarado).
          reason:
            phoneReviewDetail(r.original_value as string | null) ??
            ((r.reason as string | null) || null),
        };
      }),
    };
  });

/**
 * Um item da fila com os valores completos para quem revisa (RLS: só
 * administrador ativo do workspace lê itens). A sugestão é calculada aqui,
 * nunca recebida do navegador.
 */
export const getPhoneReviewItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ itemId: z.number().int().positive() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: it, error } = await context.supabase
      .from("phone_normalization_items")
      .select("id, original_value, review_kind, applied_at, resolved_at")
      .eq("id", data.itemId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar o item.");
    if (!it) throw new Error("Item não encontrado ou sem permissão.");
    const original = (it.original_value as string | null) ?? "";
    const candidate =
      it.review_kind === "legacy_mobile_no9" ? legacyMobileCandidate(original) : null;
    return {
      id: it.id as number,
      original,
      candidate,
      candidateDisplay: candidate ? formatPhoneDisplay(candidate) : null,
      resolved: !!(it.applied_at || it.resolved_at),
    };
  });

/**
 * Resolve um item da fila por decisão humana: confirmar a sugestão, manter o
 * valor ou apagar. O banco (`phone_review_resolve`) confere administrador
 * ativo, "Ver como", valor ainda igual ao original e a sugestão contra o
 * número gravado; guarda backup e quem decidiu.
 */
export const resolvePhoneReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        itemId: z.number().int().positive(),
        action: z.enum(["confirm", "keep", "clear"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await (await import("@/lib/view-as-guard.server")).assertNotReadOnlyView(sb);
    let value: string | null = null;
    if (data.action === "confirm") {
      const { data: it } = await sb
        .from("phone_normalization_items")
        .select("original_value, review_kind")
        .eq("id", data.itemId)
        .maybeSingle();
      if (!it) throw new Error("Item não encontrado ou sem permissão.");
      value =
        it.review_kind === "legacy_mobile_no9"
          ? legacyMobileCandidate((it.original_value as string | null) ?? "")
          : null;
      if (!value) throw new Error("Este item não tem sugestão para confirmar.");
    }
    const { data: res, error } = await sb.rpc("phone_review_resolve", {
      _item: data.itemId,
      _action: data.action,
      _new_value: value ?? undefined,
    });
    if (error) {
      // Duplicidade de lead: não ecoa o número na mensagem.
      if (error.code === "23505")
        throw new Error("Outro lead já usa este telefone. Revise na ficha do registro.");
      throw new Error(error.message || "Não foi possível salvar a revisão.");
    }
    return res as { action: string; resolution: string; run_id: string };
  });
