import { workCostTable } from "@/lib/access-control/work-cost-projection";
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
import { assertWorkRecord } from "@/lib/access-control/work-core.server";
// Server functions for Projects (Sprint 5 - PSA MVP).
// CRUD de projetos, tarefas, marcos, apontamento de horas e membros.
// Marco billable concluído → gera financial_entry.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const projectStatusEnum = z.enum(["planning", "active", "on_hold", "done", "cancelled"]);
const taskStatusEnum = z.enum(["todo", "doing", "review", "done"]);
const milestoneStatusEnum = z.enum(["pending", "in_progress", "done", "cancelled"]);
const memberRoleEnum = z.enum(["manager", "contributor", "viewer"]);
const roleEnum = z.enum(["provider", "client"]);

// ============= PROJECTS =============

export const listProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: projectStatusEnum.optional(),
        contractId: z.string().uuid().optional(),
        serviceId: z.string().uuid().optional(),
        search: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = workCostTable(supabase, "projects")
      .select(
        "*, contracts(id, number, title, counterparty_company_id, companies:counterparty_company_id(id, name)), services(id, name)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.contractId) q = q.eq("contract_id", data.contractId);
    if (data.serviceId) q = q.eq("service_id", data.serviceId);
    if (data.search?.trim()) q = q.ilike("name", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const listProjectIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: projectStatusEnum.optional(),
        search: z.string().optional(),
        assigneeId: z.string().uuid().nullable().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = workCostTable(supabase, "projects").select("id").order("id");
    if (data.status) q = q.eq("status", data.status);
    if (data.search?.trim()) q = q.ilike("name", `%${data.search.trim()}%`);
    if (data.assigneeId === null) q = q.is("assigned_to", null);
    else if (data.assigneeId) q = q.eq("assigned_to", data.assigneeId);
    const { data: rows, error } = await q.limit(50_001);
    if (error) throw error;
    return (rows ?? []).map((row) => row.id);
  });

export const getProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await workCostTable(supabase, "projects")
      .select(
        "*, contracts(id, number, title, currency, counterparty_company_id), services(id, name, currency)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

const createProjectInput = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  contractId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  role: roleEnum.default("provider"),
  startsAt: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  plannedHours: z.number().nonnegative().nullable().optional(),
  plannedCost: z.number().nonnegative().nullable().optional(),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createProjectInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techprojects.projects.create.own",
      "techprojects.projects.create.workspace",
    ]);

    // Se veio service, herda contract_id e role dele
    let contractId = data.contractId ?? null;
    let role: "provider" | "client" = data.role;
    if (data.serviceId) {
      const { data: svc } = await supabase
        .from("services")
        .select("contract_id, role")
        .eq("id", data.serviceId)
        .maybeSingle();
      if (svc) {
        contractId = (svc as any).contract_id ?? contractId;
        role = ((svc as any).role as "provider" | "client") ?? role;
      }
    } else if (contractId) {
      const { data: c } = await supabase
        .from("contracts")
        .select("role")
        .eq("id", contractId)
        .maybeSingle();
      if (c) role = ((c as any).role as "provider" | "client") ?? role;
    }

    const { data: row, error } = await workCostTable(supabase, "projects")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        name: data.name,
        description: data.description ?? null,
        contract_id: contractId,
        service_id: data.serviceId ?? null,
        role,
        starts_at: data.startsAt ?? null,
        due_at: data.dueAt ?? null,
        planned_hours: data.plannedHours ?? null,
        planned_cost: data.plannedCost ?? null,
        status: "planning",
      })
      .select("*")
      .single();
    if (error) throw error;

    // Creator membership is inserted atomically by work_creator_member.
    return row;
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            name: z.string().min(1).optional(),
            description: z.string().nullable().optional(),
            status: projectStatusEnum.optional(),
            starts_at: z.string().nullable().optional(),
            due_at: z.string().nullable().optional(),
            planned_hours: z.number().nonnegative().nullable().optional(),
            planned_cost: z.number().nonnegative().nullable().optional(),
            progress: z.number().min(0).max(100).optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertWorkRecord(supabase, "techprojects.projects", data.id, "update");
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techprojects.projects.update.own",
      "techprojects.projects.update.workspace",
      "techprojects.projects.update.team",
    ]);
    const { data: row, error } = await workCostTable(supabase, "projects")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertWorkRecord(supabase, "techprojects.projects", data.id, "delete");
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techprojects.projects.delete.workspace",
      "techprojects.projects.delete.own",
    ]);
    await deleteByIdGuarded(supabase, "projects", data.id);
    return { ok: true };
  });

// ============= TASKS =============

export const listTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        // Carregamento aos poucos por coluna do quadro (opcional; sem informar, comportamento anterior).
        status: taskStatusEnum.optional(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("project_tasks")
      .select("*")
      .eq("project_id", data.projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (data.status) q = q.eq("status", data.status);
    if (data.limit) {
      const offset = data.offset ?? 0;
      q = q.range(offset, offset + data.limit - 1);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().nullable().optional(),
        milestoneId: z.string().uuid().nullable().optional(),
        assigneeId: z.string().uuid().nullable().optional(),
        dueAt: z.string().nullable().optional(),
        estimatedHours: z.number().nonnegative().nullable().optional(),
        status: taskStatusEnum.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techprojects.tasks.create.own",
      "techprojects.tasks.create.team",
      "techprojects.tasks.create.workspace",
    ]);
    const { data: row, error } = await supabase
      .from("project_tasks")
      .insert({
        workspace_id: workspaceId,
        project_id: data.projectId,
        title: data.title,
        description: data.description ?? null,
        milestone_id: data.milestoneId ?? null,
        assignee_id: data.assigneeId === undefined ? userId : data.assigneeId,
        due_at: data.dueAt ?? null,
        estimated_hours: data.estimatedHours ?? null,
        status: data.status ?? "todo",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            title: z.string().min(1).optional(),
            description: z.string().nullable().optional(),
            status: taskStatusEnum.optional(),
            milestone_id: z.string().uuid().nullable().optional(),
            assignee_id: z.string().uuid().nullable().optional(),
            due_at: z.string().nullable().optional(),
            estimated_hours: z.number().nonnegative().nullable().optional(),
            sort_order: z.number().int().optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertWorkRecord(supabase, "techprojects.tasks", data.id, "update");
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techprojects.tasks.update.own",
      "techprojects.tasks.update.team",
      "techprojects.tasks.update.workspace",
      "techprojects.tasks.update.team",
    ]);
    const { data: row, error } = await supabase
      .from("project_tasks")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await assertWorkRecord(supabase, "techprojects.tasks", data.id, "delete");
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techprojects.tasks.delete.workspace",
      "techprojects.tasks.delete.own",
      "techprojects.tasks.delete.team",
    ]);
    await deleteByIdGuarded(supabase, "project_tasks", data.id);
    return { ok: true };
  });

// Cross-project listing (Sprint C — desacoplamento /projects/tasks).
export const listAllProjectTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: taskStatusEnum.optional(),
        projectId: z.string().uuid().optional(),
        assigneeId: z.string().uuid().optional(),
        mineOnly: z.boolean().optional(),
        search: z.string().optional(),
        // Paginação: offset/limit. Sem informar, mantém o comportamento anterior (500).
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const offset = data.offset ?? 0;
    const limit = data.limit ?? 500;
    let q = supabase
      .from("project_tasks")
      .select("*, projects(id, name, status)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (data.status) q = q.eq("status", data.status);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.assigneeId) q = q.eq("assignee_id", data.assigneeId);
    if (data.mineOnly) q = q.eq("assignee_id", userId);
    if (data.search?.trim()) q = q.ilike("title", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const listAllProjectTaskIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: taskStatusEnum.optional(),
        projectId: z.string().uuid().optional(),
        assigneeId: z.string().uuid().optional(),
        mineOnly: z.boolean().optional(),
        search: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("project_tasks").select("id").order("id");
    if (data.status) q = q.eq("status", data.status);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.assigneeId) q = q.eq("assignee_id", data.assigneeId);
    if (data.mineOnly) q = q.eq("assignee_id", userId);
    if (data.search?.trim()) q = q.ilike("title", `%${data.search.trim()}%`);
    const { data: rows, error } = await q.limit(50_001);
    if (error) throw error;
    return (rows ?? []).map((row) => row.id);
  });

// ============= MILESTONES =============

export const listMilestones = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.milestones", "view")])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", data.projectId)
      .order("sort_order", { ascending: true })
      .order("due_at", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const createMilestone = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.milestones", "create")])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        dueAt: z.string().nullable().optional(),
        billable: z.boolean().default(false),
        billAmount: z.number().nonnegative().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("project_milestones")
      .insert({
        workspace_id: workspaceId,
        project_id: data.projectId,
        name: data.name,
        description: data.description ?? null,
        due_at: data.dueAt ?? null,
        billable: data.billable,
        bill_amount: data.billAmount ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateMilestone = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.milestones", "update")])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            name: z.string().min(1).optional(),
            description: z.string().nullable().optional(),
            due_at: z.string().nullable().optional(),
            status: milestoneStatusEnum.optional(),
            billable: z.boolean().optional(),
            bill_amount: z.number().nonnegative().nullable().optional(),
            sort_order: z.number().int().optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("project_milestones")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteMilestone = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.milestones", "delete")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_milestones", data.id);
    return { ok: true };
  });

/**
 * Conclui um marco: se billable, gera financial_entry vinculado.
 * Idempotente — se já concluído com entry, retorna o existente.
 */
export const completeMilestone = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.milestones", "update")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<
      import("@/integrations/supabase/types").Database["public"]["Tables"]["project_milestones"]["Row"]
    >(context.supabase, "project_milestone_complete_checked", { p_id: data.id });
  });

// ============= TIME ENTRIES =============

export const listTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("project_time_entries")
      .select("*, project_tasks(id, title), projects(id, name)")
      .order("entry_date", { ascending: false })
      .limit(500);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.from) q = q.gte("entry_date", data.from);
    if (data.to) q = q.lte("entry_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const logTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        taskId: z.string().uuid().nullable().optional(),
        date: z.string(),
        hours: z.number().positive(),
        description: z.string().nullable().optional(),
        billable: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("project_time_entries")
      .insert({
        workspace_id: workspaceId,
        project_id: data.projectId,
        task_id: data.taskId ?? null,
        user_id: userId,
        entry_date: data.date,
        hours: data.hours,
        description: data.description ?? null,
        billable: data.billable,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_time_entries", data.id);
    return { ok: true };
  });

// ============= MEMBERS =============

export const listMembers = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.members", "view")])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await workCostTable(supabase, "project_members")
      .select("*, profiles:user_id(id, full_name, email, avatar_url)")
      .eq("project_id", data.projectId);
    if (error) throw error;
    return rows ?? [];
  });

export const addMember = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.members", "manage")])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
        roleInProject: memberRoleEnum.default("contributor"),
        costRateHour: z.number().nonnegative().nullable().optional(),
        billRateHour: z.number().nonnegative().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await workCostTable(supabase, "project_members")
      .insert({
        workspace_id: workspaceId,
        project_id: data.projectId,
        user_id: data.userId,
        role_in_project: data.roleInProject,
        cost_rate_hour: data.costRateHour ?? null,
        bill_rate_hour: data.billRateHour ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.members", "manage")])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            role_in_project: memberRoleEnum.optional(),
            cost_rate_hour: z.number().nonnegative().nullable().optional(),
            bill_rate_hour: z.number().nonnegative().nullable().optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: target } = await workCostTable(supabase, "project_members")
      .select("workspace_id, project_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!target) throw new Error("Membro não encontrado.");
    const { data: row, error } = await workCostTable(supabase, "project_members")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.members", "manage")])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "project_members", data.id);
    return { ok: true };
  });

// ============= FINANCIALS OVERVIEW =============
// Custo realizado (Σ hours × cost_rate) + Receita billável (Σ hours × bill_rate + marcos billáveis).

export const getProjectFinancials = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.profitability", "view")])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { computeProjectFinancials } = await import("@/lib/projects/financials");
    const { supabase } = context;
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    await workRpc(supabase, "work_area_authorize", {
      r: "techprojects.projects",
      a: "view",
      i: data.projectId,
    });
    await workRpc(supabase, "work_area_authorize", {
      r: "techprojects.members",
      a: "view",
      i: null,
    });
    const results = await Promise.all([
      supabase
        .from("project_time_entries")
        .select("user_id, hours, billable")
        .eq("project_id", data.projectId),
      workCostTable(supabase, "project_members")
        .select("user_id, cost_rate_hour, bill_rate_hour")
        .eq("project_id", data.projectId),
      supabase
        .from("project_milestones")
        .select("bill_amount, billable, status")
        .eq("project_id", data.projectId),
    ]);

    for (const result of results) if (result.error) throw new Error(result.error.message);
    const [entries, members, milestones] = results.map((r) => r.data);

    return computeProjectFinancials(
      (entries ?? []) as any,
      (members ?? []) as any,
      (milestones ?? []) as any,
    );
  });

/** Normalized time aliases and row scope; never infer access from manager role. */
export const getTimeActionCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ can_create: boolean; rows: Array<{ id: string; can_delete: boolean }> }>(
      context.supabase,
      "project_time_capabilities",
      { p_ids: data.ids },
    );
  });
