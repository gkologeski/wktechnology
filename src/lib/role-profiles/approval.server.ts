// Aprovação de perfis de vaga pelo líder da equipe do negócio.
// Solicitar/decidir passam por RPCs (role_profile_request_validation /
// role_profile_leader_decide) com o cliente do usuário. O admin só entra no
// outbox de avisos (e-mail + notificação), depois de autorizar o chamador.
import { assertPermission, hasPermission } from "@/lib/access-control/enforce.server";
import { CANONICAL_APP_ORIGIN } from "@/lib/platform-domains";
import {
  approverProblem,
  dispatchDeliveries,
  type ApproverResolution,
  type Delivery,
} from "./eligibility";
import { SENIORITY_LABEL } from "./schema";
import { PERM, dealEligibility, type Ctx } from "./service.server";

function friendly(m: string): Error {
  if (m.includes("APPROVER_UNRESOLVED")) {
    const st = m.split("APPROVER_UNRESOLVED:")[1]?.trim() as ApproverResolution["status"];
    return new Error(approverProblem({ status: st }) ?? "Aprovador não definido.");
  }
  if (m.includes("STALE_REVISION"))
    return new Error("Um dos perfis foi alterado por outra pessoa. Recarregue e tente de novo.");
  if (m.includes("PERMISSION_DENIED")) return new Error("Você não tem permissão para esta ação.");
  if (m.includes("ITEM_NOT_PENDING")) return new Error("Esta solicitação já foi decidida.");
  return new Error(m);
}

async function names(ctx: Ctx, ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map<string, string | null>();
  const { data } = await ctx.supabase.from("profiles").select("id, full_name").in("id", uniq);
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}

export async function resolveApprover(ctx: Ctx, dealId: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.view);
  const { data, error } = await ctx.supabase.rpc("role_profile_resolve_leader", { _deal: dealId });
  if (error) throw friendly(error.message);
  const r = data as unknown as ApproverResolution & { owner_id?: string | null };
  const n = await names(ctx, [...(r.leader_ids ?? []), r.owner_id ?? ""]);
  return {
    status: r.status,
    problem: approverProblem(r),
    leaderId: r.leader_id ?? null,
    leaderName: r.leader_id ? (n.get(r.leader_id) ?? "Sem nome") : null,
    candidates: (r.leader_ids ?? []).map((id) => ({ id, name: n.get(id) ?? "Sem nome" })),
    ownerName: r.owner_id ? (n.get(r.owner_id) ?? "Sem nome") : null,
    groups: r.groups ?? [],
  };
}

export async function requestValidation(
  ctx: Ctx,
  input: { dealId: string; expected: Record<string, number>; key: string },
) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.update);
  const elig = await dealEligibility(ctx, input.dealId);
  if (!elig.eligible)
    throw new Error("O negócio não tem serviço de Hunting ou Outsourcing associado.");
  const { data, error } = await ctx.supabase.rpc("role_profile_request_validation", {
    _deal: input.dealId,
    _expected: input.expected,
    _key: input.key,
  });
  if (error) throw friendly(error.message);
  const r = data as { request_id: string; already: boolean };
  const deliveries = await dispatchRequest(ctx, r.request_id);
  return { requestId: r.request_id, already: r.already, deliveries };
}

/** Processa o outbox de uma solicitação. Reexecutável: nunca duplica entregas. */
export async function dispatchRequest(ctx: Ctx, requestId: string) {
  const { data: req } = await ctx.supabase
    .from("role_profile_approval_requests")
    .select("id, workspace_id, deal_id, requested_by, approver_id")
    .eq("id", requestId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!req) throw new Error("Solicitação não encontrada.");
  const canUpdate = await hasPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.update);
  if (!canUpdate && req.requested_by !== ctx.userId)
    throw new Error("Você não tem permissão para reenviar este aviso.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: list }, { data: items }, { data: deal }] = await Promise.all([
    supabaseAdmin
      .from("role_profile_approval_deliveries")
      .select("id, channel, recipient_id, status, attempts")
      .eq("request_id", req.id),
    supabaseAdmin
      .from("role_profile_approval_items")
      .select("profile_id, deal_role_profiles(title, quantity, seniority)")
      .eq("request_id", req.id),
    supabaseAdmin.from("deals").select("name").eq("id", req.deal_id).maybeSingle(),
  ]);
  const n = await names(ctx, [req.requested_by, req.approver_id]);
  const profiles = (items ?? []).map((i) => {
    const p = i.deal_role_profiles as unknown as {
      title: string;
      quantity: number;
      seniority: string | null;
    } | null;
    return {
      title: p?.title ?? "Perfil",
      quantity: p?.quantity ?? 1,
      seniority: p?.seniority
        ? (SENIORITY_LABEL[p.seniority as keyof typeof SENIORITY_LABEL] ?? p.seniority)
        : null,
    };
  });
  const link = `${CANONICAL_APP_ORIGIN}/deals/${req.deal_id}?approval=${req.id}`;
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();

  const result = await dispatchDeliveries((list ?? []) as Delivery[], {
    claim: async (d) => {
      const { data } = await supabaseAdmin
        .from("role_profile_approval_deliveries")
        .update({
          status: "sending",
          attempts: d.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", d.id)
        .eq("attempts", d.attempts)
        .or(`status.in.(pending,failed),and(status.eq.sending,updated_at.lt.${stale})`)
        .select("id");
      return (data ?? []).length === 1;
    },
    sendNotification: async (d) => {
      const { error } = await supabaseAdmin.from("notifications").upsert(
        {
          owner_id: d.recipient_id,
          user_id: d.recipient_id,
          workspace_id: req.workspace_id,
          type: "role_profile_approval",
          title: `Aprovar ${profiles.length} perfil(is) de vaga`,
          body: `${n.get(req.requested_by) ?? "Um colega"} pediu sua validação${deal?.name ? ` em ${deal.name}` : ""}.`,
          link: `/deals/${req.deal_id}?approval=${req.id}`,
          entity: "deal",
          entity_id: req.deal_id,
          dedupe_key: `role_profile_approval:${req.id}:${d.recipient_id}`,
        } as never,
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    },
    sendEmail: async (d) => {
      const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(d.recipient_id);
      const email = u?.user?.email;
      if (error || !email) throw new Error("Líder sem e-mail cadastrado.");
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const r = await sendTemplateEmail("role-profile-approval", email, {
        templateData: {
          approverName: n.get(req.approver_id) ?? undefined,
          requesterName: n.get(req.requested_by) ?? undefined,
          dealName: deal?.name ?? undefined,
          profiles,
          link,
        },
        // Mesma chave em toda retentativa: o provedor não entrega duas vezes.
        idempotencyKey: `role-profile-approval-${req.id}-${d.recipient_id}`,
      });
      return r.sent ? "sent" : "suppressed";
    },
    finish: async (d, r) => {
      const backoffMin = Math.min(60, 2 ** d.attempts);
      await supabaseAdmin
        .from("role_profile_approval_deliveries")
        .update({
          status: r.status,
          last_error: r.error ?? null,
          sent_at: r.status === "sent" ? new Date().toISOString() : null,
          next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", d.id);
    },
  });
  return result;
}

export async function decide(
  ctx: Ctx,
  input: { itemId: string; decision: "approve" | "request_changes"; comment?: string },
) {
  const { data, error } = await ctx.supabase.rpc("role_profile_leader_decide", {
    _item: input.itemId,
    _decision: input.decision,
    _comment: input.comment ?? "",
  });
  if (error) throw friendly(error.message);
  const r = data as { status: string; version?: number };
  if (r.status === "superseded")
    throw new Error("O perfil foi editado depois da solicitação. Peça uma nova validação.");
  return r;
}

export async function listApprovals(ctx: Ctx, dealId: string) {
  await assertPermission(ctx.supabase, ctx.userId, ctx.workspaceId, PERM.view);
  const { data: reqs, error } = await ctx.supabase
    .from("role_profile_approval_requests")
    .select(
      "id, status, requested_by, approver_id, created_at, role_profile_approval_items(id, profile_id, profile_revision, status, version, comment, decided_at), role_profile_approval_deliveries(id, channel, status, attempts, last_error, sent_at)",
    )
    .eq("deal_id", dealId)
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw friendly(error.message);
  const n = await names(
    ctx,
    (reqs ?? []).flatMap((r) => [r.requested_by, r.approver_id]),
  );
  return (reqs ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.created_at,
    requesterName: n.get(r.requested_by) ?? "Sem nome",
    approverName: n.get(r.approver_id) ?? "Sem nome",
    isApprover: r.approver_id === ctx.userId,
    items: r.role_profile_approval_items ?? [],
    deliveries: r.role_profile_approval_deliveries ?? [],
  }));
}
