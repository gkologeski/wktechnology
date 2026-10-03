// Ações do ciclo de desligamento (Fase 4 do plano de contratação via Workflows).
// Atuam na pessoa do gatilho (Pessoas) ou na criada no fluxo, sempre restritas
// ao workspace do run. Idempotentes: reexecutar não altera o que já foi encerrado.
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AnyRow, type LogStep, renderTokens } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

const OFFBOARDING_TYPES = new Set([
  "terminate_contracts",
  "close_allocations",
  "revoke_access",
  "cancel_payable_schedules",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Contratos ainda vigentes (podem ser encerrados no desligamento). */
const OPEN_CONTRACT_STATUSES = [
  "draft",
  "in_review",
  "in_negotiation",
  "awaiting_signature",
  "active",
  "renewing",
];

function personIdFor(ctx: RunCtx, explicit?: string): string | null {
  const rendered = explicit ? String(renderTokens(explicit, ctx.after, ctx.vars) ?? "").trim() : "";
  if (UUID.test(rendered)) return rendered;
  if (ctx.entity === "people") return ctx.entityId;
  const fromVars = (ctx.vars?.contratacao as AnyRow | undefined)?.person_id;
  return typeof fromVars === "string" && UUID.test(fromVars) ? fromVars : null;
}

async function loadPerson(supabase: SupabaseClient, ctx: RunCtx, personId: string) {
  const { data, error } = await supabase
    .from("people")
    .select("id, full_name, email, profile_id, termination_date")
    .eq("id", personId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pessoa não encontrada neste workspace.");
  return data as {
    id: string;
    full_name: string;
    email: string | null;
    profile_id: string | null;
    termination_date: string | null;
  };
}

/** IDs dos contratos ligados à pessoa (metadata.person_id gravado na contratação). */
async function personContractIds(
  supabase: SupabaseClient,
  ctx: RunCtx,
  personId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .contains("metadata", { person_id: personId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

export async function handleOffboardingAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  if (!OFFBOARDING_TYPES.has(action.type)) return null;
  if (!ctx.workspaceId) throw new Error("Workspace do registro não identificado.");
  const personId = personIdFor(ctx, (action as { person_id?: string }).person_id);
  if (!personId) throw new Error("Pessoa do desligamento não identificada.");
  const person = await loadPerson(supabase, ctx, personId);
  const endDate = person.termination_date ?? new Date().toISOString().slice(0, 10);

  switch (action.type) {
    case "terminate_contracts": {
      const ids = await personContractIds(supabase, ctx, personId);
      if (ids.length === 0) {
        return { at, ok: true, action: action.type, detail: { contracts: 0 } };
      }
      const { data: open, error: oErr } = await supabase
        .from("contracts")
        .select("id, metadata")
        .in("id", ids)
        .in("status", OPEN_CONTRACT_STATUSES);
      if (oErr) throw new Error(oErr.message);
      const rows = (open ?? []) as Array<{ id: string; metadata: AnyRow | null }>;
      for (const r of rows) {
        const { error } = await supabase
          .from("contracts")
          .update({
            status: "terminated",
            ends_at: endDate,
            metadata: {
              ...(r.metadata ?? {}),
              termination: {
                date: endDate,
                origin: "workflow_offboarding",
                workflow_id: ctx.workflowId ?? null,
                distrato_document: "pendente",
              },
            },
          } as never)
          .eq("id", r.id)
          .eq("workspace_id", ctx.workspaceId);
        if (error) throw new Error(error.message);
      }
      return {
        at,
        ok: true,
        action: action.type,
        detail: {
          contracts: rows.length,
          ends_at: endDate,
          note: rows.length
            ? "Contratos encerrados; gere o documento de distrato e envie para assinatura no TechContracts."
            : "Nenhum contrato vigente.",
        },
      };
    }

    case "close_allocations": {
      const { data, error } = await supabase
        .from("people_allocations")
        .update({ status: "ended", ends_at: endDate } as never)
        .eq("workspace_id", ctx.workspaceId)
        .eq("person_id", personId)
        .in("status", ["active", "paused"])
        .select("id");
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: action.type,
        detail: { allocations: (data ?? []).length, ends_at: endDate },
      };
    }

    case "revoke_access": {
      // Só administradores do workspace podem cortar acesso por workflow.
      const { data: ownerMember } = await supabase
        .from("workspace_members")
        .select("role, status")
        .eq("workspace_id", ctx.workspaceId)
        .eq("user_id", ctx.ownerId)
        .maybeSingle();
      const om = ownerMember as { role?: string; status?: string } | null;
      if (!om || om.status === "inactive" || !["owner", "admin"].includes(om.role ?? "")) {
        throw new Error("Somente administradores do workspace podem revogar acesso por workflow.");
      }

      let userId = person.profile_id;
      // Ficha sem usuário vinculado: procura o membro do workspace pelo e-mail
      // da pessoa e grava o vínculo para as próximas execuções.
      if (!userId && person.email) {
        const { data: found } = await supabase.rpc("workspace_member_by_email" as never, {
          _workspace_id: ctx.workspaceId,
          _email: person.email,
        } as never);
        if (typeof found === "string") {
          userId = found;
          await supabase
            .from("people")
            .update({ profile_id: found } as never)
            .eq("id", person.id)
            .eq("workspace_id", ctx.workspaceId);
        }
      }
      // Convites pendentes do mesmo email deixam de valer.
      if (person.email) {
        await supabase
          .from("workspace_invites")
          .delete()
          .eq("workspace_id", ctx.workspaceId)
          .ilike("email", person.email)
          .is("accepted_at", null);
      }
      if (!userId) {
        return {
          at,
          ok: true,
          action: action.type,
          detail: { skipped: true, reason: "pessoa sem usuário vinculado na ficha" },
        };
      }
      if (userId === ctx.ownerId)
        throw new Error("O dono do workflow não pode revogar o próprio acesso.");
      const { data: member } = await supabase
        .from("workspace_members")
        .select("role, status")
        .eq("workspace_id", ctx.workspaceId)
        .eq("user_id", userId)
        .maybeSingle();
      const m = member as { role?: string; status?: string } | null;
      if (!m) {
        return {
          at,
          ok: true,
          action: action.type,
          detail: { skipped: true, reason: "não é membro" },
        };
      }
      if (m.role === "owner")
        throw new Error("O proprietário do workspace não pode ser desativado.");
      if (m.status === "inactive") {
        return {
          at,
          ok: true,
          action: action.type,
          detail: { skipped: true, reason: "já inativo" },
        };
      }
      const { error } = await supabase
        .from("workspace_members")
        .update({ status: "inactive" } as never)
        .eq("workspace_id", ctx.workspaceId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { at, ok: true, action: action.type, detail: { user_id: userId, status: "inactive" } };
    }

    case "cancel_payable_schedules": {
      const contractIds = await personContractIds(supabase, ctx, personId);
      const base = () =>
        supabase
          .from("financial_entries")
          .update({ status: "cancelled" } as never)
          .eq("workspace_id", ctx.workspaceId)
          .eq("direction", "payable")
          .in("status", ["open", "overdue"])
          .gt("due_date", endDate);
      const { data: byPerson, error: e1 } = await base()
        .contains("metadata", { person_id: personId })
        .select("id");
      if (e1) throw new Error(e1.message);
      let byContract: Array<{ id: string }> = [];
      if (contractIds.length > 0) {
        const { data, error: e2 } = await base().in("contract_id", contractIds).select("id");
        if (e2) throw new Error(e2.message);
        byContract = (data ?? []) as Array<{ id: string }>;
      }
      const total = new Set([...(byPerson ?? []), ...byContract].map((r) => r.id)).size;
      return {
        at,
        ok: true,
        action: action.type,
        detail: {
          cancelled: total,
          after: endDate,
          note: "Acerto de dias/horas trabalhados até o desligamento continua manual.",
        },
      };
    }
  }
  return null;
}
