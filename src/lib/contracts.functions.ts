// Server functions for Contracts (Sprint 2 MVP).
// CRUD, número gerado, criação a partir de deal, transições de status.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";

function token() {
  return randomBytes(24).toString("hex");
}

function generateNumber() {
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
  return `C-${yearMonth}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

const roleEnum = z.enum(["provider", "client"]);
const statusEnum = z.enum([
  "draft",
  "in_review",
  "in_negotiation",
  "awaiting_signature",
  "active",
  "renewing",
  "ended",
  "terminated",
]);

// ============= LIST =============

export const listContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        role: roleEnum.optional(),
        status: statusEnum.optional(),
        companyId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.role) q = q.eq("role", data.role);
    if (data.status) q = q.eq("status", data.status);
    if (data.companyId) q = q.eq("counterparty_company_id", data.companyId);
    if (data.dealId) q = q.eq("deal_id", data.dealId);
    if (data.search && data.search.trim()) {
      const t = `%${data.search.trim()}%`;
      q = q.or(`title.ilike.${t},number.ilike.${t}`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// ============= LIST PAGINADO (grid de /contracts) =============
// Retorna apenas a página solicitada + total real, aplicando todos os filtros
// no servidor. Mantido separado de `listContracts` para não alterar o contrato
// dos demais chamadores (detalhe, pickers, fila de vínculo, negócios).

export const listContractsPaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        role: roleEnum.optional(),
        status: statusEnum.optional(),
        search: z.string().max(200).optional(),
        companyId: z.string().uuid().optional(),
        legalEntityId: z.string().uuid().optional(),
        legalEntityName: z.string().max(200).optional(),
        assignedTo: z.string().optional(),
        startsFrom: z.string().optional(),
        startsTo: z.string().optional(),
        endsFrom: z.string().optional(),
        endsTo: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("contracts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.role) q = q.eq("role", data.role);
    if (data.status) q = q.eq("status", data.status);
    if (data.companyId) q = q.eq("counterparty_company_id", data.companyId);
    if (data.assignedTo === "__none__") q = q.is("assigned_to", null);
    else if (data.assignedTo) q = q.eq("assigned_to", data.assignedTo);
    if (data.startsFrom) q = q.gte("starts_at", data.startsFrom);
    if (data.startsTo) q = q.lte("starts_at", data.startsTo);
    if (data.endsFrom) q = q.gte("ends_at", data.endsFrom);
    if (data.endsTo) q = q.lte("ends_at", data.endsTo);
    if (data.search && data.search.trim()) {
      const t = `%${data.search
        .trim()
        .replace(/[,()%]/g, " ")
        .trim()}%`;
      q = q.or(`title.ilike.${t},number.ilike.${t}`);
    }
    if (data.legalEntityId) {
      // Contratos importados podem ter apenas o nome do contratante extraído
      // do documento, sem FK — o filtro considera os dois casos.
      const name = (data.legalEntityName ?? "").replace(/[,()%]/g, " ").trim();
      q = name
        ? q.or(
            `contracting_legal_entity_id.eq.${data.legalEntityId},metadata->>contracting_name_extracted.ilike.%${name}%`,
          )
        : q.eq("contracting_legal_entity_id", data.legalEntityId);
    }

    const { data: rows, error, count } = await q;
    if (error) throw error;
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const getContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;

    // parent (contrato de venda ao qual este contrato de compra está vinculado)
    type ParentInfo = {
      id: string;
      number: string | null;
      title: string;
      status: string;
      total_value: number;
      currency: string;
      role: "provider" | "client";
    };
    let parent: ParentInfo | null = null;
    if (row.parent_contract_id) {
      const { data: p } = await supabase
        .from("contracts")
        .select("id, number, title, status, total_value, currency, role")
        .eq("id", row.parent_contract_id)
        .maybeSingle();
      if (p) parent = p as ParentInfo;
    }

    // children (contratos de compra vinculados a este contrato de prestação)
    const { data: children } = await supabase
      .from("contracts")
      .select(
        "id, number, title, status, total_value, currency, role, counterparty_company_id, starts_at, ends_at, companies:counterparty_company_id(name)",
      )
      .eq("parent_contract_id", data.id)
      .order("created_at", { ascending: true });

    // Aditivos: contrato principal deste aditivo e aditivos deste contrato.
    const AMENDMENT_COLS =
      "id, number, title, status, total_value, currency, role, starts_at, ends_at, amendment_number, amendment_effective_at, document_kind";
    type AmendmentRow = {
      id: string;
      number: string | null;
      title: string;
      status: string;
      total_value: number;
      currency: string;
      role: "provider" | "client";
      starts_at: string | null;
      ends_at: string | null;
      amendment_number: string | null;
      amendment_effective_at: string | null;
      document_kind: string;
    };
    let amendmentOf: AmendmentRow | null = null;
    const rowAny = row as unknown as { amendment_of_id?: string | null };
    if (rowAny.amendment_of_id) {
      const { data: a } = await supabase
        .from("contracts")
        .select(AMENDMENT_COLS)
        .eq("id", rowAny.amendment_of_id)
        .maybeSingle();
      if (a) amendmentOf = a as unknown as AmendmentRow;
    }
    const { data: amendments } = await supabase
      .from("contracts")
      .select(AMENDMENT_COLS)
      .eq("amendment_of_id", data.id)
      .order("amendment_effective_at", { ascending: true });

    return {
      ...row,
      parent,
      children: children ?? [],
      amendmentOf,
      amendments: (amendments ?? []) as unknown as AmendmentRow[],
    };
  });

// ============= LINKABLE (para o seletor de vínculo) =============

export const listLinkableContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        role: roleEnum,
        excludeId: z.string().uuid().optional(),
        q: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let query = supabase
      .from("contracts")
      .select(
        "id, number, title, status, total_value, currency, role, starts_at, ends_at, parent_contract_id, companies:counterparty_company_id(name), parent:contracts!parent_contract_id(id, title, number)",
      )
      .eq("role", data.role)
      // Aditivos não participam do aninhamento prestação/compra.
      .or("document_kind.eq.main,document_kind.is.null")

      .order("created_at", { ascending: false })
      .limit(data.limit ?? 20);
    if (data.excludeId) query = query.neq("id", data.excludeId);
    if (data.q && data.q.trim()) {
      const t = `%${data.q.trim()}%`;
      query = query.or(`title.ilike.${t},number.ilike.${t}`);
    }
    const { data: rows, error } = await query;
    if (error) throw error;
    // `parent` é um embed self-referente: normaliza para objeto único.
    return (rows ?? []).map((r) => {
      const parentRaw = (r as { parent?: unknown }).parent;
      const parent = (Array.isArray(parentRaw) ? parentRaw[0] : parentRaw) as
        | { id: string; title: string | null; number: string | null }
        | null
        | undefined;
      return { ...r, parent: parent ?? null };
    });
  });

// ============= CONTRATOS DE COMPRA ELEGÍVEIS AO TECHPEOPLE =============
// Apenas contratos de compra cujo CONTRATANTE é uma entidade legal (CNPJ) do
// workspace — são os contratos em que compramos mão de obra de prestadores.

export const listOwnContractingPurchaseContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        q: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { loadOwnLegalEntities, matchOwnEntity } =
      await import("@/lib/contracts/import-link.server");
    const ownEntities = await loadOwnLegalEntities(supabase, workspaceId);
    const ownIds = new Set(ownEntities.map((e) => e.id));

    let query = supabase
      .from("contracts")
      .select(
        "id, number, title, status, total_value, currency, role, contracting_legal_entity_id, metadata, companies:counterparty_company_id(name)",
      )
      .eq("role", "client")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.q && data.q.trim()) {
      const t = `%${data.q.trim()}%`;
      query = query.or(`title.ilike.${t},number.ilike.${t}`);
    }
    const { data: rows, error } = await query;
    if (error) throw error;

    return (rows ?? [])
      .map((r) => {
        const row = r as unknown as {
          id: string;
          number: string | null;
          title: string;
          status: string;
          contracting_legal_entity_id: string | null;
          metadata: Record<string, unknown> | null;
          companies?: { name: string | null } | null;
        };
        const eligible =
          (row.contracting_legal_entity_id && ownIds.has(row.contracting_legal_entity_id)) ||
          row.metadata?.["contracting_is_own_entity"] === true ||
          Boolean(
            matchOwnEntity(
              ownEntities,
              (row.metadata?.["contracting_cnpj_extracted"] as string | null) ?? null,
              (row.metadata?.["contracting_name_extracted"] as string | null) ?? null,
            ),
          );
        return eligible
          ? {
              id: row.id,
              number: row.number,
              title: row.title,
              status: row.status,
              company_name: row.companies?.name ?? null,
            }
          : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  });

// ============= LINK / UNLINK PARENT =============

/** Origem do vínculo quando ele vem de uma sugestão de IA (para auditoria). */
const aiOriginSchema = z.object({
  suggestion_id: z.string().uuid().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string().max(500).optional(),
  source: z.enum(["rule", "ai"]),
});

export const linkContractParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        childId: z.string().uuid(),
        parentId: z.string().uuid().nullable(),
        origin: aiOriginSchema.optional().nullable(),
      })
      .parse(input),
  )

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.own",
      "techcontracts.contracts.update.workspace",
    ]);

    if (data.parentId === data.childId) {
      throw new Error("Um contrato não pode ser aninhado sob si mesmo.");
    }

    // Estado anterior (para registrar de qual contrato ele foi desaninhado).
    const { data: before } = await supabase
      .from("contracts")
      .select("id, title, number, parent_contract_id, role, document_kind")
      .eq("id", data.childId)
      .maybeSingle();
    const previousParentId =
      (before as { parent_contract_id?: string | null } | null)?.parent_contract_id ?? null;

    // Regra de aninhamento: só contrato de compra sob contrato de prestação,
    // em um único nível, e nunca envolvendo aditivos.
    if (data.parentId) {
      const child = before as { role?: string | null; document_kind?: string | null } | null;
      if (child?.document_kind === "amendment") {
        throw new Error(
          "Aditivos não participam do aninhamento prestação/compra; use o vínculo de aditivo.",
        );
      }
      if (child && child.role !== "client") {
        throw new Error(
          "Apenas contratos de compra podem ser aninhados sob um contrato de prestação.",
        );
      }

      const { data: parentCheck } = await supabase
        .from("contracts")
        .select("id, role, document_kind, parent_contract_id")
        .eq("id", data.parentId)
        .maybeSingle();
      const p = parentCheck as {
        role?: string | null;
        document_kind?: string | null;
        parent_contract_id?: string | null;
      } | null;
      if (!p) throw new Error("Contrato de prestação não encontrado.");
      if (p.document_kind === "amendment") {
        throw new Error(
          "Aditivos não participam do aninhamento prestação/compra; use o vínculo de aditivo.",
        );
      }
      if (p.role !== "provider") {
        throw new Error(
          "Somente contratos de prestação podem receber contratos de compra aninhados.",
        );
      }
      if (p.parent_contract_id) {
        throw new Error(
          "O aninhamento é de um único nível: este contrato já está aninhado sob outro contrato.",
        );
      }
    }

    const { data: row, error } = await supabase
      .from("contracts")
      .update({ parent_contract_id: data.parentId })
      .eq("id", data.childId)
      .select("id, parent_contract_id")
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Você não tem permissão para alterar este vínculo.");

    // Título do contrato pai envolvido (o novo, ou o anterior no caso de desaninhar).
    const otherId = data.parentId ?? previousParentId;
    let parentLabel: string | null = null;
    if (otherId) {
      const { data: parentRow } = await supabase
        .from("contracts")
        .select("title, number")
        .eq("id", otherId)
        .maybeSingle();
      const p = parentRow as { title?: string | null; number?: string | null } | null;
      parentLabel = p?.title ?? p?.number ?? null;
    }
    const childLabel =
      (before as { title?: string | null; number?: string | null } | null)?.title ?? null;

    const eventType = data.parentId ? "parent_linked" : "parent_unlinked";
    const payload = {
      parent_contract_id: data.parentId,
      previous_parent_contract_id: previousParentId,
      child_contract_id: data.childId,
      parent_title: parentLabel,
      child_title: childLabel,
      ai_suggestion: data.origin ?? null,
    };

    // Registra nos dois contratos envolvidos para o histórico ficar visível em ambos.
    const targets = Array.from(new Set([data.childId, otherId].filter(Boolean))) as string[];
    await (supabase as any).from("contract_events").insert(
      targets.map((contractId) => ({
        workspace_id: workspaceId,
        contract_id: contractId,
        actor_id: userId,
        event_type: eventType,
        payload,
      })),
    );

    return row;
  });

type LinkEventPayload = {
  parent_contract_id?: string | null;
  previous_parent_contract_id?: string | null;
  child_contract_id?: string | null;
  parent_title?: string | null;
  child_title?: string | null;
  amendment_of_id?: string | null;
  ai_suggestion?: {
    suggestion_id?: string | null;
    confidence: "high" | "medium" | "low";
    reason?: string;
    source: "rule" | "ai";
  } | null;
};

/** Histórico de aninhamento/desaninhamento (compras e aditivos) de um contrato. */

export const listContractLinkEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contractId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase as any)
      .from("contract_events")
      .select("id, event_type, payload, actor_id, created_at")
      .eq("contract_id", data.contractId)
      .in("event_type", [
        "parent_linked",
        "parent_unlinked",
        "amendment_linked",
        "amendment_unlinked",
        "role_recalculated",
      ])

      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);

    const events = (rows ?? []) as Array<{
      id: string;
      event_type: string;
      payload: LinkEventPayload | null;
      actor_id: string | null;
      created_at: string;
    }>;

    const actorIds = Array.from(
      new Set(events.map((e) => e.actor_id).filter((v): v is string => Boolean(v))),
    );
    const nameById = new Map<string, string>();
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      for (const p of profs ?? [])
        nameById.set(p.id as string, ((p.full_name as string | null) ?? "").trim());
    }

    return events.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      created_at: e.created_at,
      actor_name: e.actor_id ? nameById.get(e.actor_id) || "" : "",
      payload: e.payload ?? {},
    }));
  });

// ============= ADITIVOS (amendments) =============
// O vínculo de aditivo é independente de `parent_contract_id`, que já é usado
// para o pareamento Prestação ↔ Compra (outsourcing).

export const searchMainContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        q: z.string().optional(),
        role: roleEnum.optional(),
        excludeId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let query = supabase
      .from("contracts")
      .select("id, number, title, status, total_value, currency, role, counterparty_company_id")
      .eq("document_kind", "main")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 20);
    if (data.role) query = query.eq("role", data.role);
    if (data.excludeId) query = query.neq("id", data.excludeId);
    if (data.q && data.q.trim()) {
      const t = `%${data.q.trim()}%`;
      query = query.or(`title.ilike.${t},number.ilike.${t}`);
    }
    const { data: rows, error } = await query;
    if (error) throw error;
    return rows ?? [];
  });

export const linkContractAmendment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        amendmentId: z.string().uuid(),
        mainContractId: z.string().uuid().nullable(),
        amendmentNumber: z.string().nullable().optional(),
        effectiveAt: z.string().nullable().optional(),
        origin: aiOriginSchema.optional().nullable(),
      })
      .parse(input),
  )

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.own",
      "techcontracts.contracts.update.workspace",
    ]);

    if (data.mainContractId === data.amendmentId) {
      throw new Error("Um contrato não pode ser aditivo de si mesmo.");
    }

    // Aditivo sempre pertence a um contrato principal do MESMO papel.
    if (data.mainContractId) {
      const [{ data: amendmentRow }, { data: mainCheck }] = await Promise.all([
        supabase.from("contracts").select("id, role").eq("id", data.amendmentId).maybeSingle(),
        supabase
          .from("contracts")
          .select("id, role, document_kind")
          .eq("id", data.mainContractId)
          .maybeSingle(),
      ]);
      const m = mainCheck as { role?: string | null; document_kind?: string | null } | null;
      const a = amendmentRow as { role?: string | null } | null;
      if (!m) throw new Error("Contrato principal não encontrado.");
      if (m.document_kind === "amendment") {
        throw new Error("Um aditivo não pode ser o contrato principal de outro aditivo.");
      }
      if (a && m.role && a.role !== m.role) {
        throw new Error("O aditivo deve ter o mesmo papel do contrato principal.");
      }
    }

    const patch = data.mainContractId
      ? {
          document_kind: "amendment",
          amendment_of_id: data.mainContractId,
          amendment_number: data.amendmentNumber ?? null,
          amendment_effective_at: data.effectiveAt ?? null,
        }
      : {
          document_kind: "main",
          amendment_of_id: null,
          amendment_number: null,
          amendment_effective_at: null,
        };

    const { data: previous } = await supabase
      .from("contracts")
      .select("id, title, amendment_of_id")
      .eq("id", data.amendmentId)
      .maybeSingle();
    const previousMainId =
      (previous as { amendment_of_id?: string | null } | null)?.amendment_of_id ?? null;

    const { data: row, error } = await supabase
      .from("contracts")
      .update(patch as never)
      .eq("id", data.amendmentId)
      .select("id, document_kind, amendment_of_id")
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Você não tem permissão para alterar este contrato.");

    const otherMainId = data.mainContractId ?? previousMainId;
    let mainLabel: string | null = null;
    if (otherMainId) {
      const { data: mainRow } = await supabase
        .from("contracts")
        .select("title, number")
        .eq("id", otherMainId)
        .maybeSingle();
      const m = mainRow as { title?: string | null; number?: string | null } | null;
      mainLabel = m?.title ?? m?.number ?? null;
    }

    const amendmentPayload = {
      amendment_of_id: data.mainContractId,
      previous_parent_contract_id: previousMainId,
      child_contract_id: data.amendmentId,
      parent_title: mainLabel,
      child_title: (previous as { title?: string | null } | null)?.title ?? null,
      ai_suggestion: data.origin ?? null,
    };

    const amendmentTargets = Array.from(
      new Set([data.amendmentId, otherMainId].filter(Boolean)),
    ) as string[];
    await (supabase as any).from("contract_events").insert(
      amendmentTargets.map((contractId) => ({
        workspace_id: workspaceId,
        contract_id: contractId,
        actor_id: userId,
        event_type: data.mainContractId ? "amendment_linked" : "amendment_unlinked",
        payload: amendmentPayload,
      })),
    );

    // Reaplica o padrão de título (prefixo [ADITIVO] entra/sai conforme o vínculo).
    try {
      const { applyContractTitles } = await import("@/lib/contracts/title.server");
      await applyContractTitles(supabase as never, workspaceId, [data.amendmentId]);
    } catch {
      // título é cosmético: não bloqueia o vínculo
    }

    return row;
  });

/** Aplica o padrão `PREFIXO CONTRATANTE X CONTRATADA` aos contratos informados. */
export const standardizeContractTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        preview: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.own",
      "techcontracts.contracts.update.workspace",
    ]);

    const { previewContractTitles, applyContractTitles } =
      await import("@/lib/contracts/title.server");
    if (data.preview) {
      const preview = await previewContractTitles(supabase as never, workspaceId, data.ids);
      return preview;
    }
    const changes = await applyContractTitles(supabase as never, workspaceId, data.ids);
    return { changes, unchanged: [], skipped: [] };
  });

const titleStatusEnum = z.enum([
  "draft",
  "in_review",
  "in_negotiation",
  "awaiting_signature",
  "active",
  "renewing",
  "ended",
  "terminated",
]);

/**
 * Prévia/aplicação do padrão de título em lote, por status (padrão: contratos ativos).
 * Sem `ids`: seleciona os contratos do workspace nos status informados.
 */
export const standardizeContractTitlesByStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        statuses: z.array(titleStatusEnum).min(1).default(["active"]),
        ids: z.array(z.string().uuid()).max(500).optional(),
        preview: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).default(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.own",
      "techcontracts.contracts.update.workspace",
    ]);

    let targetIds = data.ids ?? [];
    let scanned = targetIds.length;
    if (!data.ids?.length) {
      const { data: rows, error } = await (supabase as any)
        .from("contracts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("status", data.statuses)
        .order("created_at", { ascending: false })
        .limit(data.limit);
      if (error) throw new Error(error.message);
      targetIds = ((rows ?? []) as { id: string }[]).map((r) => r.id);
      scanned = targetIds.length;
    }
    if (!targetIds.length) return { scanned: 0, changes: [], unchanged: [], skipped: [] };

    const { previewContractTitles, applyContractTitles } =
      await import("@/lib/contracts/title.server");
    if (data.preview) {
      const preview = await previewContractTitles(supabase as never, workspaceId, targetIds);
      return { scanned, ...preview };
    }
    const changes = await applyContractTitles(supabase as never, workspaceId, targetIds);
    return { scanned, changes, unchanged: [], skipped: [] };
  });

// ============= CREATE =============

const createInput = z.object({
  role: roleEnum.default("provider"),
  title: z.string().min(1),
  counterpartyCompanyId: z.string().uuid().nullable().optional(),
  dealId: z.string().uuid().nullable().optional(),
  totalValue: z.number().nonnegative().optional(),
  currency: z.string().default("BRL"),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  autoRenew: z.boolean().optional(),
  noticeDays: z.number().int().nonnegative().optional(),
  bodyHtml: z.string().nullable().optional(),
});

export const createContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.create.own",
    ]);
    const { data: row, error } = await supabase
      .from("contracts")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        role: data.role,
        title: data.title,
        counterparty_company_id: data.counterpartyCompanyId ?? null,
        deal_id: data.dealId ?? null,
        total_value: data.totalValue ?? 0,
        currency: data.currency,
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        auto_renew: data.autoRenew ?? false,
        notice_days: data.noticeDays ?? 30,
        body_html: data.bodyHtml ?? null,
        number: generateNumber(),
        public_token: token(),
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= CREATE FROM DEAL =============
// Deal ganho → contrato provider herdando empresa e primeiros dados.

export const createContractFromDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ dealId: z.string().uuid(), title: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.create.own",
    ]);

    const { data: deal, error: dErr } = await supabase
      .from("deals")
      .select("id, name, currency, company_id, value")
      .eq("id", data.dealId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!deal) throw new Error("Negócio não encontrado");

    const { data: row, error } = await supabase
      .from("contracts")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        role: "provider",
        title: data.title ?? `Contrato — ${deal.name}`,
        counterparty_company_id: deal.company_id ?? null,
        deal_id: deal.id,
        total_value: Number(deal.value ?? 0),
        currency: deal.currency ?? "BRL",
        number: generateNumber(),
        public_token: token(),
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= UPDATE =============

const patchInput = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      title: z.string().min(1).optional(),
      document_kind: z.enum(["main", "amendment"]).optional(),
      amendment_of_id: z.string().uuid().nullable().optional(),
      amendment_number: z.string().nullable().optional(),
      amendment_effective_at: z.string().nullable().optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      role: roleEnum.optional(),

      status: statusEnum.optional(),
      counterparty_company_id: z.string().uuid().nullable().optional(),
      contracting_legal_entity_id: z.string().uuid().nullable().optional(),
      deal_id: z.string().uuid().nullable().optional(),
      total_value: z.number().nonnegative().optional(),
      currency: z.string().optional(),
      starts_at: z.string().nullable().optional(),
      ends_at: z.string().nullable().optional(),
      auto_renew: z.boolean().optional(),
      notice_days: z.number().int().nonnegative().optional(),
      body_html: z.string().nullable().optional(),
      readjustment_index: z.string().nullable().optional(),
      readjustment_period: z.string().nullable().optional(),
      signed_at: z.string().nullable().optional(),
      // Campos preenchidos via importação; editáveis também no detalhe.
      monthly_value: z.number().nonnegative().nullable().optional(),
      hours_per_month: z.number().int().nonnegative().nullable().optional(),
      payment_day: z.number().int().min(1).max(31).nullable().optional(),
      payment_method: z.string().nullable().optional(),
      late_fee_percent: z.number().nonnegative().nullable().optional(),
      late_interest_monthly_percent: z.number().nonnegative().nullable().optional(),
      expense_reimbursement_days: z.number().int().nonnegative().nullable().optional(),
      penalty_percent: z.number().nonnegative().nullable().optional(),
      cure_period_days: z.number().int().nonnegative().nullable().optional(),
      trial_period_days: z.number().int().nonnegative().nullable().optional(),
      unilateral_termination_notice_days: z.number().int().nonnegative().nullable().optional(),
      service_type: z.string().nullable().optional(),
      service_scope: z.string().nullable().optional(),
      service_location: z.string().nullable().optional(),
      governing_law: z.string().nullable().optional(),
      jurisdiction: z.string().nullable().optional(),
      confidentiality_term_months: z.number().int().nonnegative().nullable().optional(),
      signature_provider: z.string().nullable().optional(),
      signature_document_id: z.string().nullable().optional(),
      signature_operation_id: z.string().nullable().optional(),
    })
    .strict(),
});

export const updateContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => patchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.own",
      "techcontracts.contracts.update.workspace",
    ]);

    // Um aditivo precisa, obrigatoriamente, estar vinculado a um contrato principal.
    // E ao voltar para "Principal", os campos de aditivo são limpos no servidor.
    const patchAny = data.patch as {
      document_kind?: string;
      amendment_of_id?: string | null;
      amendment_number?: string | null;
      amendment_effective_at?: string | null;
    };
    if (patchAny.document_kind !== undefined || patchAny.amendment_of_id !== undefined) {
      const { data: current } = await supabase
        .from("contracts")
        .select("document_kind, amendment_of_id")
        .eq("id", data.id)
        .maybeSingle();
      const currentAny = (current ?? {}) as {
        document_kind?: string;
        amendment_of_id?: string | null;
      };
      const nextKind = patchAny.document_kind ?? currentAny.document_kind ?? "main";
      const nextMain =
        patchAny.amendment_of_id !== undefined
          ? patchAny.amendment_of_id
          : (currentAny.amendment_of_id ?? null);
      if (nextKind === "amendment" && !nextMain) {
        throw new Error("Selecione o contrato principal: um aditivo precisa estar vinculado.");
      }
      if (nextKind === "amendment" && nextMain === data.id) {
        throw new Error("Um contrato não pode ser aditivo de si mesmo.");
      }
      if (nextKind === "main") {
        patchAny.amendment_of_id = null;
        patchAny.amendment_number = null;
        patchAny.amendment_effective_at = null;
      }
    }

    const { data: row, error } = await supabase
      .from("contracts")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= DELETE =============

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.delete.workspace",
    ]);
    const { data: deleted, error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw error;
    if (!deleted || deleted.length === 0) {
      // A política de acesso do banco recusou silenciosamente (0 linhas).
      throw new Error("Você não tem permissão para excluir este registro.");
    }
    return { ok: true, deleted: deleted.length };
  });

// ============= AGRUPAMENTO (empresa / serviço do catálogo) =============
// Retorna mapas auxiliares para agrupar a lista de contratos na UI.
// Nomes de empresa vêm de `companies`; o serviço do catálogo é resolvido
// a partir de `services.metadata->>service_catalog_id`.
export const listContractGroupings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ contractIds: z.array(z.string().uuid()).max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let cq = supabase.from("contracts").select("id, counterparty_company_id").limit(500);
    if (data.contractIds && data.contractIds.length > 0) {
      cq = cq.in("id", data.contractIds);
    }
    const { data: contracts, error: cErr } = await cq;
    if (cErr) throw cErr;
    const rows = contracts ?? [];
    const contractIds = rows.map((r) => r.id);

    const companyIds = Array.from(
      new Set(rows.map((r) => r.counterparty_company_id).filter(Boolean) as string[]),
    );
    let companies: { id: string; name: string }[] = [];
    if (companyIds.length > 0) {
      const { data: comp, error } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      if (error) throw error;
      companies = (comp ?? []).map((c) => ({ id: c.id, name: c.name ?? "—" }));
    }

    type ServiceLink = {
      contractId: string;
      serviceId: string;
      serviceName: string;
      catalogId: string | null;
      catalogName: string | null;
      jobProfileId: string | null;
      jobProfileName: string | null;
      seniority: string | null;
    };
    let services: ServiceLink[] = [];
    if (contractIds.length > 0) {
      const { data: svc, error } = await supabase
        .from("services")
        .select("id, contract_id, name, metadata, job_profile_id, seniority")
        .in("contract_id", contractIds)
        .limit(2000);
      if (error) throw error;
      const raw = (svc ?? []).map((s) => {
        const meta = (s.metadata ?? {}) as Record<string, unknown>;
        const catalogId =
          typeof meta["service_catalog_id"] === "string"
            ? (meta["service_catalog_id"] as string)
            : null;
        return {
          contractId: s.contract_id as string,
          serviceId: s.id as string,
          serviceName: (s.name as string) ?? "—",
          catalogId,
          jobProfileId: (s.job_profile_id as string | null) ?? null,
          seniority: (s.seniority as string | null) ?? null,
        };
      });
      const catalogIds = Array.from(
        new Set(raw.map((r) => r.catalogId).filter(Boolean) as string[]),
      );
      const catalogNames = new Map<string, string>();
      if (catalogIds.length > 0) {
        const { data: cat, error: catErr } = await supabase
          .from("service_catalog")
          .select("id, name")
          .in("id", catalogIds);
        if (catErr) throw catErr;
        for (const c of cat ?? []) catalogNames.set(c.id, c.name ?? "—");
      }
      const profileIds = Array.from(
        new Set(raw.map((r) => r.jobProfileId).filter(Boolean) as string[]),
      );
      const profileNames = new Map<string, string>();
      if (profileIds.length > 0) {
        const { data: jp, error: jpErr } = await supabase
          .from("job_profiles")
          .select("id, name")
          .in("id", profileIds);
        if (jpErr) throw jpErr;
        for (const p of jp ?? []) profileNames.set(p.id, p.name ?? "—");
      }
      services = raw.map((r) => ({
        ...r,
        catalogName: r.catalogId ? (catalogNames.get(r.catalogId) ?? null) : null,
        jobProfileName: r.jobProfileId ? (profileNames.get(r.jobProfileId) ?? null) : null,
      }));
    }

    const companyByContract = rows
      .filter((r) => r.counterparty_company_id)
      .map((r) => ({ contractId: r.id, companyId: r.counterparty_company_id as string }));

    return { companies, companyByContract, services };
  });
