// ACEITE-MINUTA Entrega 2: minuta de contrato e revisão jurídica.
// Leituras pelo cliente do usuário (RLS); escritas só pelas RPCs com checagem.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";

export const getContractDraftApprovers = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_draft_approvers", "manage")])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: prof, error: pe } = await sb
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (pe) throw new Error(pe.message);
    const ws = prof?.active_workspace_id as string | null;
    if (!ws) return { members: [], selected: [] as string[] };
    const [{ data: sel, error: se }, { data: mem, error: me }] = await Promise.all([
      sb.from("contract_draft_approvers").select("user_id").eq("workspace_id", ws),
      sb
        .from("workspace_members")
        .select("user_id, role, status")
        .eq("workspace_id", ws)
        .neq("status", "inactive")
        .limit(500),
    ]);
    if (se) throw new Error(se.message);
    if (me) throw new Error(me.message);
    const ids = (mem ?? []).map((m: { user_id: string }) => m.user_id);
    const { data: names } = ids.length
      ? await sb.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] };
    const nameOf = new Map(
      (names ?? []).map((n: { id: string; full_name: string | null }) => [n.id, n.full_name]),
    );
    return {
      members: (mem ?? [])
        .map((m: { user_id: string; role: string }) => ({
          id: m.user_id,
          name: (nameOf.get(m.user_id) as string | null) ?? "Sem nome",
          role: m.role,
        }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR")),
      selected: (sel ?? []).map((s: { user_id: string }) => s.user_id) as string[],
    };
  });

export const setContractDraftApprovers = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_draft_approvers", "manage")])
  .inputValidator((i) => z.object({ userIds: z.array(z.string().uuid()).max(20) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: n, error } = await (context.supabase as any).rpc("contract_draft_set_approvers", {
      p_users: data.userIds,
    });
    if (error) throw new Error(error.message);
    return { count: n as number };
  });

export const getContractDraft = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_drafts", "view")])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { getActiveWorkspaceId } = await import("@/lib/access-control/enforce.server");
    const workspaceId = await getActiveWorkspaceId(context.supabase, context.userId);
    const { data: draft, error } = await sb
      .from("contract_drafts")
      .select(
        "id, workspace_id, deal_id, proposal_id, template_id, title, body_html, status, missing_template, decided_by, decided_at, decision_note, revision, created_at, updated_at, sent_at, sent_to, client_decided_at, client_name, client_note, prepared_terms",
      )
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!draft) return null;
    const [{ data: events }, { data: canReview }, { data: deal }, versionsResult] =
      await Promise.all([
        sb
          .from("contract_draft_events")
          .select("id, actor_id, kind, detail, created_at")
          .eq("draft_id", draft.id)
          .order("created_at", { ascending: false })
          .limit(50),
        sb.rpc("contract_draft_is_approver", { p_ws: draft.workspace_id, p_user: context.userId }),
        draft.deal_id
          ? sb.from("deals").select("id, name").eq("id", draft.deal_id).maybeSingle()
          : Promise.resolve({ data: null }),
        sb
          .from("contract_draft_versions")
          .select("revision,captured_at")
          .eq("workspace_id", draft.workspace_id)
          .eq("draft_id", draft.id)
          .order("revision", { ascending: false })
          .limit(50),
      ]);
    if (versionsResult.error) throw new Error(versionsResult.error.message);
    const actorIds = [
      ...new Set(
        (events ?? []).map((e: { actor_id: string | null }) => e.actor_id).filter(Boolean),
      ),
    ];
    const { data: actors } = actorIds.length
      ? await sb.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] };
    let templates: Array<{ id: string; name: string; is_default: boolean }> = [];
    if (canReview === true) {
      const { data: t } = await sb.rpc("contract_draft_templates", { p_draft: draft.id });
      templates = t ?? [];
    }
    const actorName = new Map(
      (actors ?? []).map((a: { id: string; full_name: string | null }) => [a.id, a.full_name]),
    );
    return {
      draft,
      versions: versionsResult.data ?? [],
      deal: (deal as { id: string; name: string | null } | null) ?? null,
      canReview: canReview === true,
      templates,
      events: (events ?? []).map((e: { actor_id: string | null }) => ({
        ...e,
        actor_name: e.actor_id
          ? ((actorName.get(e.actor_id) as string | null) ?? "Usuário")
          : "Sistema",
      })),
    };
  });

export const getContractDraftTemplateBody = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_drafts", "approve")])
  .inputValidator((i) =>
    z.object({ draftId: z.string().uuid(), templateId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: body, error } = await (context.supabase as any).rpc(
      "contract_draft_template_body",
      {
        p_draft: data.draftId,
        p_template: data.templateId,
      },
    );
    if (error) throw new Error(error.message);
    return { body: (body as string) ?? "" };
  });

export const reviewContractDraft = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_drafts", "approve")])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        revision: z.number().int().min(1),
        decision: z.enum(["save", "approve", "reject"]),
        templateId: z.string().uuid().nullable(),
        body: z.string().max(500_000).nullable(),
        note: z.string().max(2000).nullable(),
        preparedTerms: z
          .object({
            number: z.string().max(100).optional(),
            starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            ends_at: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .nullable(),
          })
          .nullable()
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as any).rpc(
      "contract_draft_review_prepared",
      {
        p_draft: data.id,
        p_revision: data.revision,
        p_decision: data.decision,
        p_template: data.templateId,
        p_body: data.body,
        p_note: data.note,
        p_terms: data.preparedTerms ?? null,
      },
    );
    if (error) throw new Error(error.message);
    return res as { id: string; revision: number; status: string };
  });

// ACEITE-MINUTA Entrega 3: link de aceite e marcação de envio (aprovador listado).
export const issueContractDraftLink = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_drafts", "approve")])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: token, error } = await (context.supabase as any).rpc(
      "contract_draft_issue_link",
      { p_draft: data.id },
    );
    if (error) throw new Error(error.message);
    return { token: token as string };
  });

export const markContractDraftSent = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_drafts", "approve")])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        to: z.string().max(500).nullable(),
        channel: z.enum(["email", "link"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as any).rpc("contract_draft_mark_sent", {
      p_draft: data.id,
      p_to: data.to,
      p_channel: data.channel,
    });
    if (error) throw new Error(error.message);
    return res as { id: string; status: string };
  });

/** Read-only preparation: the legal approver reviews the filled text before saving. */
export const prepareContractDraftText = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_drafts", "approve")])
  .inputValidator(
    z.object({
      draftId: z.string().uuid(),
      templateId: z.string().uuid(),
      body: z.string().max(500_000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    const source = await workRpc<{
      workspace_id: string;
      proposal_id: string;
      deal_id: string;
      template: Record<string, any>;
      prepared_terms?: { starts_at?: string; ends_at?: string | null; number?: string };
    }>(context.supabase, "contract_draft_merge_source", {
      p_draft: data.draftId,
      p_template: data.templateId,
    });
    const [{ buildMergeContext }, { mergeTemplateBody, templateFieldStatus }] = await Promise.all([
      import("./template-merge.server"),
      import("./template-tokens"),
    ]);
    const template = { ...source.template, body_html: data.body };
    const { ctx, contract } = await buildMergeContext(
      context.supabase,
      source.workspace_id,
      context.userId,
      { templateId: data.templateId, proposalId: source.proposal_id, dealId: source.deal_id },
      template,
    );
    const preparedTerms = {
      number: source.prepared_terms?.number ?? contract.number,
      starts_at: source.prepared_terms?.starts_at ?? contract.starts_at,
      ends_at: source.prepared_terms?.starts_at
        ? (source.prepared_terms.ends_at ?? null)
        : (contract.ends_at ?? null),
    };
    const mergedContext = { ...ctx, contract: { ...contract, ...preparedTerms } };
    return {
      body: mergeTemplateBody(data.body, mergedContext, { keepUnknown: true }),
      preparedTerms,
      missing: templateFieldStatus(data.body, mergedContext)
        .filter((f) => f.missing)
        .map((f) => f.label),
    };
  });

export const reopenContractDraft = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_drafts", "approve")])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      revision: z.number().int().min(1),
      note: z.string().trim().min(10).max(2000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ id: string; revision: number; status: string }>(
      context.supabase,
      "contract_draft_reopen",
      {
        p_draft: data.id,
        p_revision: data.revision,
        p_note: data.note,
      },
    );
  });

export const getContractDraftVersion = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_drafts", "view")])
  .inputValidator(z.object({ draftId: z.string().uuid(), revision: z.number().int().min(1) }))
  .handler(async ({ data, context }) => {
    const { getActiveWorkspaceId } = await import("@/lib/access-control/enforce.server");
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    const { data: row, error } = await (context.supabase as any)
      .from("contract_draft_versions")
      .select("body_html,revision,captured_at")
      .eq("workspace_id", ws)
      .eq("draft_id", data.draftId)
      .eq("revision", data.revision)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as { body_html: string; revision: number; captured_at: string } | null;
  });
