// Diagnóstico e reprocessamento em lote do papel (Prestação/Compra) dos contratos.
// O papel passa a ser derivado das empresas do workspace (CNPJ, com fallback por nome),
// e não do campo `role` gravado pela IA na importação.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { inferRoleFromParties, type ContractLinkMeta } from "@/lib/contracts/link-suggest";
import { buildContractTitle } from "@/lib/contracts/title";

const UPDATE_PERMISSIONS = [
  "techcontracts.contracts.update.own",
  "techcontracts.contracts.update.team",
  "techcontracts.contracts.update.workspace",
];

export type ContractRoleConflict = {
  id: string;
  number: string | null;
  title: string;
  stored_role: "provider" | "client";
  inferred_role: "provider" | "client";
  contracting_name: string | null;
  counterparty_name: string | null;
  /** Evidência que decidiu o papel: CNPJ do workspace ou nome normalizado. */
  matched_by: "cnpj" | "name";
  suggested_title: string | null;
};

export type ContractRolesDiagnosis = {
  total: number;
  coherent: number;
  unknown: number;
  own_entities: number;
  own_entities_with_cnpj: number;
  conflicts: ContractRoleConflict[];
};

type Row = {
  id: string;
  role: "provider" | "client";
  number: string | null;
  title: string | null;
  document_kind: string | null;
  service_type: string | null;
  starts_at: string | null;
  ends_at: string | null;
  metadata: Record<string, unknown> | null;
};

const SELECT_COLS =
  "id, role, number, title, document_kind, service_type, starts_at, ends_at, metadata";

function toMeta(r: Row): ContractLinkMeta {
  const meta = r.metadata ?? {};
  return {
    id: r.id,
    role: r.role ?? "provider",
    document_kind: r.document_kind ?? "main",
    number: r.number,
    self_number: (meta["self_contract_number"] as string | null) ?? null,
    title: r.title ?? "",
    company_name: null,
    contracting_name: (meta["contracting_name_extracted"] as string | null) ?? null,
    contracting_cnpj: (meta["contracting_cnpj_extracted"] as string | null) ?? null,
    counterparty_name: (meta["counterparty_name_extracted"] as string | null) ?? null,
    counterparty_cnpj: (meta["counterparty_cnpj_extracted"] as string | null) ?? null,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
  };
}

function digits(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "");
}

export const diagnoseContractRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContractRolesDiagnosis> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, UPDATE_PERMISSIONS);

    const { loadOwnLegalEntities } = await import("@/lib/contracts/import-link.server");
    const own = await loadOwnLegalEntities(supabase, workspaceId);
    const ownCnpjs = new Set(own.map((e) => e.cnpjDigits).filter((d) => d.length === 14));

    const { data, error } = await supabase
      .from("contracts")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as Row[];
    const conflicts: ContractRoleConflict[] = [];
    let coherent = 0;
    let unknown = 0;

    for (const r of rows) {
      const meta = toMeta(r);
      const inferred = inferRoleFromParties(meta, own);
      if (!inferred) {
        unknown += 1;
        continue;
      }
      if (inferred === meta.role) {
        coherent += 1;
        continue;
      }
      const matchedByCnpj =
        ownCnpjs.has(digits(meta.contracting_cnpj)) || ownCnpjs.has(digits(meta.counterparty_cnpj));
      const ownName =
        inferred === "provider" ? (meta.counterparty_name ?? null) : (meta.contracting_name ?? null);
      conflicts.push({
        id: r.id,
        number: r.number,
        title: r.title ?? "",
        stored_role: meta.role,
        inferred_role: inferred,
        contracting_name: meta.contracting_name,
        counterparty_name: meta.counterparty_name,
        matched_by: matchedByCnpj ? "cnpj" : "name",
        suggested_title: buildContractTitle({
          role: inferred,
          serviceType: r.service_type,
          documentKind: r.document_kind,
          contractingName: meta.contracting_name,
          counterpartyName: meta.counterparty_name,
          ownName,
          startsAt: r.starts_at,
        }),
      });
    }

    return {
      total: rows.length,
      coherent,
      unknown,
      own_entities: own.length,
      own_entities_with_cnpj: ownCnpjs.size,
      conflicts,
    };
  });

export type RecalcContractRolesResult = { updated: number; skipped: number; retitled: number };

export const recalcContractRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        retitle: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<RecalcContractRolesResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, UPDATE_PERMISSIONS);

    const { loadOwnLegalEntities } = await import("@/lib/contracts/import-link.server");
    const own = await loadOwnLegalEntities(supabase, workspaceId);

    const { data: rows, error } = await supabase
      .from("contracts")
      .select(SELECT_COLS)
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    let updated = 0;
    let skipped = 0;
    let retitled = 0;

    for (const raw of (rows ?? []) as unknown as Row[]) {
      const meta = toMeta(raw);
      const inferred = inferRoleFromParties(meta, own);
      // Só corrige o que segue divergente no momento da execução.
      if (!inferred || inferred === meta.role) {
        skipped += 1;
        continue;
      }

      const ownName =
        inferred === "provider" ? (meta.counterparty_name ?? null) : (meta.contracting_name ?? null);
      const newTitle = data.retitle
        ? buildContractTitle({
            role: inferred,
            serviceType: raw.service_type,
            documentKind: raw.document_kind,
            contractingName: meta.contracting_name,
            counterpartyName: meta.counterparty_name,
            ownName,
            startsAt: raw.starts_at,
          })
        : null;

      const nextMetadata: Record<string, unknown> = {
        ...(raw.metadata ?? {}),
        role_source: "inferred",
        role_extracted: meta.role,
        role_recalculated_at: new Date().toISOString(),
      };

      const patch: Record<string, unknown> = { role: inferred, metadata: nextMetadata };
      if (newTitle) patch.title = newTitle;

      const { error: upErr } = await supabase
        .from("contracts")
        .update(patch as never)
        .eq("id", raw.id);
      if (upErr) throw new Error(upErr.message);

      updated += 1;
      if (newTitle) retitled += 1;

      await (supabase as any).from("contract_events").insert({
        workspace_id: workspaceId,
        contract_id: raw.id,
        actor_id: userId,
        event_type: "role_recalculated",
        payload: {
          from: meta.role,
          to: inferred,
          title_before: raw.title ?? null,
          title_after: newTitle,
          evidence: {
            contracting_name: meta.contracting_name,
            contracting_cnpj: meta.contracting_cnpj,
            counterparty_name: meta.counterparty_name,
            counterparty_cnpj: meta.counterparty_cnpj,
          },
          source: "role-recalc",
        },
      });
    }

    return { updated, skipped, retitled };
  });
