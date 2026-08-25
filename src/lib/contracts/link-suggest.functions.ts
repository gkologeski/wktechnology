// Sugestão de vínculos entre contratos: camada determinística (números citados,
// CNPJs próprios do workspace, contraparte de aditivos) + camada de IA para o resto.
// Nunca grava nada: apenas devolve propostas para revisão humana.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import {
  buildSuggestionEvidence,
  dedupeSuggestions,
  effectiveRole,
  inferRoleFromParties,
  isOwnParty,
  isValidSuggestion,
  roleMismatch,
  type ContractLinkMeta,
  type LinkConfidence,
  type LinkEvidence,
  type LinkSuggestion,
} from "@/lib/contracts/link-suggest";

export type SuggestedLinkRow = LinkSuggestion & {
  id: string | null;
  evidence: LinkEvidence;
  pending: { number: string | null; title: string; role: string; document_kind: string };
  target: { number: string | null; title: string; role: string };
};

/** Contrato cujo papel gravado contradiz os CNPJs extraídos do documento. */
export type RoleConflictRow = {
  id: string;
  number: string | null;
  title: string;
  stored_role: string;
  inferred_role: "provider" | "client";
};

export type SuggestLinksResult = {
  suggestions: SuggestedLinkRow[];
  role_conflicts: RoleConflictRow[];
  analyzed: number;
  unresolved: number;
  ai_used: boolean;
  notes: string[];
  run_id: string;
};

export type SuggestionHistoryRow = {
  id: string;
  run_id: string;
  kind: "parent" | "amendment";
  confidence: LinkConfidence;
  reason: string;
  source: "rule" | "ai";
  status: string;
  created_at: string;
  decided_at: string | null;
  decided_by_name: string;
  evidence: LinkEvidence | null;
  pending: { id: string; number: string | null; title: string; role: string };
  target: { id: string; number: string | null; title: string; role: string };
};

export const suggestContractLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ role: z.enum(["provider", "client", "amendment", "all"]).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<SuggestLinksResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techcontracts.contracts.update.own",
      "techcontracts.contracts.update.workspace",
    ]);

    const { computePendingLinks } = await import("@/lib/contracts/pending-link");
    const { loadOwnLegalEntities, resolveReferencedContract } =
      await import("@/lib/contracts/import-link.server");
    const { toContractLinkMeta, counterpartyKey, requestAiLinkSuggestions } =
      await import("@/lib/contracts/link-suggest.server");

    const { data: rows, error } = await supabase
      .from("contracts")
      .select(
        "id, role, number, title, status, starts_at, ends_at, parent_contract_id, document_kind, amendment_of_id, metadata, companies:counterparty_company_id(name)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const all = (rows ?? []) as unknown as Parameters<typeof computePendingLinks>[0];
    const pendingRows = computePendingLinks(all, { role: data.role ?? "all" });
    const metaById = new Map<string, ContractLinkMeta>();
    for (const r of rows ?? []) {
      const m = toContractLinkMeta(r as Record<string, unknown>);
      metaById.set(m.id, m);
    }

    const own = await loadOwnLegalEntities(supabase, workspaceId);
    const notes: string[] = [];
    if (own.length === 0) {
      notes.push(
        "Nenhuma empresa (CNPJ) cadastrada no workspace: a IA não pode confirmar quem é a nossa parte.",
      );
    }

    const pendingIds = new Set(pendingRows.map((p) => p.id));
    const allMetas = Array.from(metaById.values());
    const mains = allMetas.filter((c) => c.document_kind !== "amendment");
    // O papel usado na análise é o inferido pelos CNPJs próprios (fallback: o gravado).
    const roleOf = (c: ContractLinkMeta) => effectiveRole(c, own);
    const providers = mains.filter((c) => roleOf(c) === "provider");
    const clients = mains.filter((c) => roleOf(c) === "client");

    const parentedClientIds = new Set(
      (rows ?? [])
        .map((r) => (r as Record<string, unknown>)["parent_contract_id"] as string | null)
        .filter((v): v is string => Boolean(v)),
    );

    const ruleSuggestions: LinkSuggestion[] = [];
    const referencedByPending = new Map<string, string>();

    for (const p of pendingRows) {
      const pending = metaById.get(p.id);
      if (!pending) continue;
      const pendingRole = roleOf(pending);

      // 1) Aditivo → contrato principal do mesmo papel e mesma contraparte.
      if (pending.document_kind === "amendment") {
        const key = counterpartyKey(pending);
        if (!key) continue;
        const matches = mains.filter(
          (c) => roleOf(c) === pendingRole && counterpartyKey(c) === key && c.id !== pending.id,
        );
        if (matches.length === 1) {
          ruleSuggestions.push({
            pending_id: pending.id,
            target_id: matches[0].id,
            kind: "amendment",
            confidence: "high",
            reason: `Aditivo da mesma contraparte do contrato ${matches[0].number ?? matches[0].title}.`,
            source: "rule",
          });
        }
        continue;
      }

      // 2) Compra → prestação pelo número citado no documento.
      if (pendingRole === "client") {
        const hit = resolveReferencedContract(
          p.referenced_numbers,
          providers.map((c) => ({ id: c.id, number: c.number, selfNumber: c.self_number })),
        );
        if (hit && hit.id !== pending.id) {
          const isOurs = isOwnParty(own, pending.contracting_cnpj, pending.contracting_name);
          referencedByPending.set(pending.id, hit.matchedNumber);
          ruleSuggestions.push({
            pending_id: pending.id,
            target_id: hit.id,
            kind: "parent",
            confidence: isOurs || own.length === 0 ? "high" : "medium",
            reason: `Documento cita o contrato ${hit.matchedNumber}${
              isOurs ? " e a CONTRATANTE é uma empresa do workspace" : ""
            }.`,
            source: "rule",
          });
        }
        continue;
      }

      // 3) Prestação → compra que cita o número deste contrato.
      const child = clients.find((c) => {
        if (c.id === pending.id || parentedClientIds.has(c.id)) return false;
        const refs = (() => {
          const source = all.find((r) => r.id === c.id);
          const list = source?.metadata?.["referenced_contract_numbers"];
          return Array.isArray(list) ? (list as string[]) : [];
        })();
        if (!refs.length) return false;
        const hit = resolveReferencedContract(refs, [
          { id: pending.id, number: pending.number, selfNumber: pending.self_number },
        ]);
        return Boolean(hit);
      });
      if (child) {
        ruleSuggestions.push({
          pending_id: pending.id,
          target_id: child.id,
          kind: "parent",
          confidence: "high",
          reason: `O contrato de compra ${child.number ?? child.title} cita o número deste contrato.`,
          source: "rule",
        });
      }
    }

    const resolvedByRule = new Set(ruleSuggestions.map((s) => s.pending_id));
    const remaining = pendingRows.filter((p) => !resolvedByRule.has(p.id));

    let aiSuggestions: LinkSuggestion[] = [];
    let aiUsed = false;

    if (remaining.length > 0) {
      const describe = (c: ContractLinkMeta) => ({
        id: c.id,
        numero: c.number,
        titulo: c.title,
        papel: roleOf(c),
        papel_gravado: c.role,
        papel_divergente_do_documento: roleMismatch(c, own),

        tipo_documento: c.document_kind,
        contratante: c.contracting_name,
        contratante_cnpj: c.contracting_cnpj,
        contratada_ou_contraparte: c.counterparty_name ?? c.company_name,
        contraparte_cnpj: c.counterparty_cnpj,
        vigencia: { inicio: c.starts_at, fim: c.ends_at },
        nossa_parte_e_contratante: isOwnParty(own, c.contracting_cnpj, c.contracting_name),
        nossa_parte_e_contratada: isOwnParty(own, c.counterparty_cnpj, c.counterparty_name),
      });

      const pendingPayload = remaining
        .map((p) => metaById.get(p.id))
        .filter((c): c is ContractLinkMeta => Boolean(c))
        .map((c) => ({
          ...describe(c),
          motivo_pendencia: pendingRows.find((p) => p.id === c.id)?.reason ?? null,
        }));

      const candidatePayload = allMetas
        .filter((c) => !pendingIds.has(c.id) || c.document_kind !== "amendment")
        .slice(0, 250)
        .map(describe);

      const prompt = [
        `Empresas (CNPJs) do nosso workspace: ${
          own.length
            ? own.map((e) => `${e.name}${e.cnpjDigits ? ` (${e.cnpjDigits})` : ""}`).join("; ")
            : "não informadas"
        }`,
        "",
        "CONTRATOS PENDENTES DE VÍNCULO:",
        JSON.stringify(pendingPayload),
        "",
        "CONTRATOS CANDIDATOS:",
        JSON.stringify(candidatePayload),
      ].join("\n");

      const items = await requestAiLinkSuggestions(prompt);
      aiUsed = true;
      aiSuggestions = items
        .filter((s) => remaining.some((p) => p.id === s.pending_id))
        .filter((s) =>
          isValidSuggestion(s, metaById.get(s.pending_id), metaById.get(s.target_id), own),
        )

        .map((s) => ({
          pending_id: s.pending_id,
          target_id: s.target_id,
          kind: s.kind,
          confidence: s.confidence as LinkConfidence,
          reason: s.reason,
          source: "ai" as const,
        }));
    }

    const merged = dedupeSuggestions([...ruleSuggestions, ...aiSuggestions]).filter((s) =>
      isValidSuggestion(s, metaById.get(s.pending_id), metaById.get(s.target_id), own),
    );

    const runId = crypto.randomUUID();

    const suggestions: SuggestedLinkRow[] = merged.map((s) => {
      const pending = metaById.get(s.pending_id) as ContractLinkMeta;
      const target = metaById.get(s.target_id) as ContractLinkMeta;
      const evidence = buildSuggestionEvidence(
        pending,
        target,
        own,
        referencedByPending.get(s.pending_id) ?? null,
      );
      // Papel gravado divergente dos CNPJs extraídos: a proposta continua visível,
      // mas com confiança rebaixada e aviso para revisão humana.
      const confidence: LinkConfidence = evidence.role_conflict ? "low" : s.confidence;
      const reason = evidence.role_conflict
        ? `${s.reason} Atenção: o papel gravado divergiu dos CNPJs extraídos — revise o contrato antes de aplicar.`
        : s.reason;
      return {
        ...s,
        confidence,
        reason,
        id: null,
        evidence,
        pending: {
          number: pending.number,
          title: pending.title,
          role: pending.role,
          document_kind: pending.document_kind,
        },
        target: { number: target.number, title: target.title, role: target.role },
      };
    });

    // Diagnóstico: contratos cujo papel gravado contradiz os CNPJs extraídos.
    const roleConflicts: RoleConflictRow[] = allMetas
      .filter((c) => roleMismatch(c, own))
      .slice(0, 50)
      .map((c) => ({
        id: c.id,
        number: c.number,
        title: c.title,
        stored_role: c.role,
        inferred_role: inferRoleFromParties(c, own) as "provider" | "client",
      }));
    if (roleConflicts.length > 0) {
      notes.push(
        `${roleConflicts.length} contrato(s) com papel gravado divergente dos CNPJs extraídos. Revise o papel antes de aplicar os vínculos.`,
      );
    }

    // Histórico: propostas anteriores ainda não decididas passam a "reavaliadas".
    if (suggestions.length > 0) {
      const table = (supabase as any).from("contract_link_ai_suggestions");
      await table
        .update({ status: "superseded" })
        .eq("workspace_id", workspaceId)
        .eq("status", "proposed")
        .in(
          "pending_contract_id",
          suggestions.map((s) => s.pending_id),
        );

      const { data: inserted, error: insertError } = await (supabase as any)
        .from("contract_link_ai_suggestions")
        .insert(
          suggestions.map((s) => ({
            workspace_id: workspaceId,
            run_id: runId,
            pending_contract_id: s.pending_id,
            target_contract_id: s.target_id,
            kind: s.kind,
            confidence: s.confidence,
            reason: s.reason,
            source: s.source,
            evidence: s.evidence,
            status: "proposed",
            created_by: userId,
          })),
        )
        .select("id, pending_contract_id");
      if (!insertError) {
        const idByPending = new Map<string, string>(
          ((inserted ?? []) as Array<{ id: string; pending_contract_id: string }>).map((r) => [
            r.pending_contract_id,
            r.id,
          ]),
        );
        for (const s of suggestions) s.id = idByPending.get(s.pending_id) ?? null;
      }
    }

    return {
      suggestions,
      role_conflicts: roleConflicts,

      analyzed: pendingRows.length,
      unresolved: pendingRows.length - suggestions.length,
      ai_used: aiUsed,
      notes,
      run_id: runId,
    };
  });

// ============= HISTÓRICO DAS SUGESTÕES =============

/** Sugestões registradas: todas do workspace ou apenas as de um contrato. */
export const listContractLinkSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contractId: z.string().uuid().optional(),
        status: z.enum(["proposed", "applied", "dismissed", "superseded"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<SuggestionHistoryRow[]> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    let query = (supabase as any)
      .from("contract_link_ai_suggestions")
      .select(
        "id, run_id, kind, confidence, reason, source, status, evidence, created_at, decided_at, decided_by, pending_contract_id, target_contract_id",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.status) query = query.eq("status", data.status);
    if (data.contractId) {
      query = query.or(
        `pending_contract_id.eq.${data.contractId},target_contract_id.eq.${data.contractId}`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const items = (rows ?? []) as Array<Record<string, any>>;
    const contractIds = Array.from(
      new Set(items.flatMap((r) => [r["pending_contract_id"], r["target_contract_id"]])),
    ).filter(Boolean) as string[];
    const actorIds = Array.from(
      new Set(items.map((r) => r["decided_by"]).filter((v): v is string => Boolean(v))),
    );

    const contractById = new Map<
      string,
      { id: string; number: string | null; title: string; role: string }
    >();
    if (contractIds.length) {
      const { data: cs } = await supabase
        .from("contracts")
        .select("id, number, title, role")
        .in("id", contractIds);
      for (const c of cs ?? [])
        contractById.set(c.id as string, {
          id: c.id as string,
          number: (c.number as string | null) ?? null,
          title: (c.title as string) ?? "",
          role: (c.role as string) ?? "provider",
        });
    }

    const nameById = new Map<string, string>();
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      for (const p of profs ?? [])
        nameById.set(p.id as string, ((p.full_name as string | null) ?? "").trim());
    }

    const fallback = (id: string) => ({ id, number: null, title: "Contrato", role: "provider" });

    return items.map((r) => ({
      id: r["id"] as string,
      run_id: r["run_id"] as string,
      kind: r["kind"] as "parent" | "amendment",
      confidence: r["confidence"] as LinkConfidence,
      reason: (r["reason"] as string) ?? "",
      source: r["source"] as "rule" | "ai",
      status: r["status"] as string,
      created_at: r["created_at"] as string,
      decided_at: (r["decided_at"] as string | null) ?? null,
      decided_by_name: r["decided_by"] ? nameById.get(r["decided_by"] as string) || "" : "",
      evidence: (r["evidence"] as LinkEvidence | null) ?? null,
      pending:
        contractById.get(r["pending_contract_id"] as string) ??
        fallback(r["pending_contract_id"] as string),
      target:
        contractById.get(r["target_contract_id"] as string) ??
        fallback(r["target_contract_id"] as string),
    }));
  });

/** Marca uma sugestão como aplicada ou ignorada pelo usuário. */
export const decideContractLinkSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["applied", "dismissed"]),
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

    const { error } = await (supabase as any)
      .from("contract_link_ai_suggestions")
      .update({ status: data.status, decided_by: userId, decided_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
