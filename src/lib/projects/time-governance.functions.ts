// TechProjects Ciclo 3 — governança: política de horas, aprovadores/delegação, aceite manual do
// cliente, fechamento/reabertura de competência, modelos por serviço e horas sem horário do Jibble.
// Autorização revalidada no banco (funções `project_time_*`, `project_period_*`, `project_delivery_template_*`).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { cleanDbError } from "@/lib/projects/time-entry.shared";
import type { TemplateDefinition } from "@/lib/projects/delivery-template.shared";
import type {
  ApproverRow,
  ClosePreview,
  JibbleHourPreview,
  TimePolicy,
} from "@/lib/projects/time-workflow.types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const uuid = z.string().uuid();

// ============= política =============

export const getTimePolicy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await context.supabase.rpc("project_time_policy_get", { p_ws: ws });
    if (error) throw new Error(cleanDbError(error.message));
    const { data: history } = await context.supabase
      .from("project_time_policies")
      .select("version, created_at, created_by, note")
      .eq("workspace_id", ws)
      .order("version", { ascending: false })
      .limit(20);
    return { policy: data as unknown as TimePolicy, history: history ?? [] };
  });

export const saveTimePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        rules: z.record(z.string(), z.union([z.boolean(), z.number()])),
        note: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_time_policy_save", {
      p_ws: ws,
      p_rules: data.rules,
      p_note: (data.note ?? null) as never,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as TimePolicy;
  });

// ============= aprovadores e gestores do projeto =============

export const listProjectApprovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("project_time_approvers")
      .select(
        "id, project_id, role, user_id, subject_user_id, delegate_of, valid_from, valid_to, reason, revoked_at",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(cleanDbError(error.message));
    const ids = Array.from(
      new Set((rows ?? []).flatMap((r) => [r.user_id, r.subject_user_id]).filter(Boolean)),
    ) as string[];
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      for (const p of profiles ?? []) names[p.id] = (p.full_name as string | null) || "Sem nome";
    }
    return { approvers: (rows ?? []) as ApproverRow[], names };
  });

export const setProjectApprover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: uuid,
        userId: uuid,
        role: z.enum(["approver", "operational_manager"]),
        subjectUserId: uuid.nullable().optional(),
        validFrom: isoDate.nullable().optional(),
        validTo: isoDate.nullable().optional(),
        reason: z.string().trim().max(500).optional(),
        delegateOf: uuid.nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("project_time_approver_set", {
      p_project: data.projectId,
      p_user: data.userId,
      p_role: data.role,
      p_subject: (data.subjectUserId ?? null) as never,
      p_from: (data.validFrom ?? null) as never,
      p_to: (data.validTo ?? null) as never,
      p_reason: (data.reason ?? null) as never,
      p_delegate_of: (data.delegateOf ?? null) as never,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return { id: id as unknown as string };
  });

export const revokeProjectApprover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: uuid, reason: z.string().trim().min(3).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("project_time_approver_revoke", {
      p_id: data.id,
      p_reason: data.reason,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return { ok: true };
  });

// ============= aceite manual do cliente =============

export const listClientAcceptances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const [acc, proj] = await Promise.all([
      context.supabase
        .from("project_client_acceptances")
        .select(
          "id, period_from, period_to, status, client_name, client_email, evidence, evidence_reference, entry_count, total_seconds, recorded_at, void_reason",
        )
        .eq("project_id", data.projectId)
        .order("recorded_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("projects")
        .select("client_acceptance_required")
        .eq("id", data.projectId)
        .maybeSingle(),
    ]);
    if (acc.error) throw new Error(cleanDbError(acc.error.message));
    return { required: !!proj.data?.client_acceptance_required, acceptances: acc.data ?? [] };
  });

/** Liga/desliga o aceite do cliente no projeto (edição do projeto, sob RLS do usuário). */
export const setClientAcceptanceRequired = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: uuid, required: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("projects")
      .update({ client_acceptance_required: data.required })
      .eq("id", data.projectId)
      .select("id");
    if (error) throw new Error(cleanDbError(error.message));
    if (!rows?.length) throw new Error("Sem permissão para alterar este projeto.");
    return { ok: true };
  });

export const recordClientAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: uuid,
        from: isoDate,
        to: isoDate,
        status: z.enum(["accepted", "contested"]),
        clientName: z.string().trim().min(2).max(200),
        clientEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
        evidence: z.string().trim().min(10).max(2000),
        reference: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("project_client_acceptance_record", {
      p_project: data.projectId,
      p_from: data.from,
      p_to: data.to,
      p_status: data.status,
      p_client_name: data.clientName,
      p_client_email: (data.clientEmail || null) as never,
      p_contact: null as never,
      p_evidence: data.evidence,
      p_reference: (data.reference || null) as never,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as { acceptance_id: string; entries: number; total_seconds: number };
  });

export const voidClientAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: uuid, reason: z.string().trim().min(5).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("project_client_acceptance_void", {
      p_id: data.id,
      p_reason: data.reason,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return { ok: true };
  });

// ============= fechamento de competência =============

const closeScope = z.object({
  scope: z.enum(["project", "person"]),
  projectId: uuid.nullable().optional(),
  userId: uuid.nullable().optional(),
  from: isoDate,
  to: isoDate,
});

export const listPeriodClosings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("project_period_closings")
      .select(
        "id, scope, period_from, period_to, timezone, status, entry_count, total_seconds, excluded_import_count, closed_at, reopened_at, reopen_reason, policy_version",
      )
      .eq("project_id", data.projectId)
      .order("closed_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(cleanDbError(error.message));
    return { closings: rows ?? [] };
  });

export const previewPeriodClose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => closeScope.parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_period_close_preview", {
      p_ws: ws,
      p_scope: data.scope,
      p_project: (data.projectId ?? null) as never,
      p_user: (data.userId ?? null) as never,
      p_from: data.from,
      p_to: data.to,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as ClosePreview;
  });

export const closePeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    closeScope.extend({ timezone: z.string().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_period_close", {
      p_ws: ws,
      p_scope: data.scope,
      p_project: (data.projectId ?? null) as never,
      p_user: (data.userId ?? null) as never,
      p_from: data.from,
      p_to: data.to,
      p_tz: data.timezone,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as {
      closing_id: string;
      entries: number;
      total_seconds: number;
      excluded_import: number;
    };
  });

export const reopenPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ closingId: uuid, reason: z.string().trim().min(10).max(1000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("project_period_reopen", {
      p_closing: data.closingId,
      p_reason: data.reason,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as { reopened_entries: number };
  });

// ============= modelos de entrega por serviço =============

export const listDeliveryTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const [tpl, ver, svc, catalog] = await Promise.all([
      context.supabase
        .from("project_delivery_templates")
        .select("id, name, delivery_kind, description, active, updated_at")
        .eq("workspace_id", ws)
        .order("name"),
      context.supabase
        .from("project_delivery_template_versions")
        .select("id, template_id, version, definition, created_at")
        .eq("workspace_id", ws)
        .order("version", { ascending: false }),
      context.supabase
        .from("project_delivery_template_services")
        .select("template_id, service_catalog_id")
        .eq("workspace_id", ws),
      context.supabase
        .from("service_catalog")
        .select("id, name, category, active")
        .eq("workspace_id", ws)
        .order("name"),
    ]);
    if (tpl.error) throw new Error(cleanDbError(tpl.error.message));
    return {
      templates: tpl.data ?? [],
      versions: ver.data ?? [],
      services: svc.data ?? [],
      catalog: catalog.data ?? [],
    };
  });

export const saveDeliveryTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: uuid.nullable().optional(),
        name: z.string().trim().min(2).max(120),
        kind: z.enum(["capacity", "scope", "hunting", "package", "deliverables"]),
        description: z.string().trim().max(2000).nullable().optional(),
        active: z.boolean().default(true),
        serviceIds: z.array(uuid).max(50),
        definition: z.record(z.string(), z.unknown()),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_delivery_template_save", {
      p_ws: ws,
      p_template: (data.id ?? null) as never,
      p_name: data.name,
      p_kind: data.kind,
      p_description: (data.description ?? null) as never,
      p_active: data.active,
      p_service_ids: data.serviceIds,
      p_definition: data.definition as never,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as { template_id: string; version: number };
  });

export const getProjectTemplateSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("project_delivery_template_suggest", {
      p_project: data.projectId,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as {
      applied_version_id: string | null;
      applied_at: string | null;
      service_catalog_id: string | null;
      imported_entries: number;
      tasks: number;
      suggestion: {
        template_id: string;
        name: string;
        kind: string;
        version_id: string;
        version: number;
        definition: TemplateDefinition;
      } | null;
    };
  });

export const applyDeliveryTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ projectId: uuid, versionId: uuid, confirmImported: z.boolean().default(false) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("project_delivery_template_apply", {
      p_project: data.projectId,
      p_version: data.versionId,
      p_confirm_imported: data.confirmImported,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as { already_applied: boolean; milestones: number; tasks: number };
  });

// ============= Jibble: horas sem horário =============

export const previewJibbleHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        classification: z.string().max(40).nullable().optional(),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(10).max(200).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_jibble_hour_preview", {
      p_ws: ws,
      p_classification: (data.classification ?? null) as never,
      p_limit: data.pageSize,
      p_offset: data.page * data.pageSize,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as JibbleHourPreview;
  });

export const materializeJibbleHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        stagingIds: z.array(uuid).min(1).max(500),
        note: z.string().trim().min(5).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_jibble_hour_materialize", {
      p_ws: ws,
      p_staging_ids: data.stagingIds,
      p_note: data.note,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as { created: number; skipped: number };
  });
