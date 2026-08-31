// Server functions do acompanhamento macro de entrega.
// Vendedor acessa o projeto pela ponte: deals -> contracts.deal_id -> projects.contract_id.
// A visibilidade dos registros é garantida por RLS em public.project_updates.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

export type ProjectUpdateRow = {
  id: string;
  project_id: string;
  kind: string;
  title: string;
  summary: string | null;
  health: string | null;
  progress_pct: number | null;
  expected_delivery_date: string | null;
  visibility: string;
  published_at: string;
  author_id: string | null;
  owner_id: string | null;
};

export type DeliveryProject = {
  id: string;
  name: string;
  status: string | null;
  progress: number | null;
  due_at: string | null;
  contract: { id: string; number: string | null; title: string | null } | null;
  updates: ProjectUpdateRow[];
};

const UPDATE_SELECT =
  "id, project_id, kind, title, summary, health, progress_pct, expected_delivery_date, visibility, published_at, author_id, owner_id";

type Supa = Parameters<typeof assertAnyPermission>[0];

async function loadUpdates(supabase: Supa, projectIds: string[]) {
  if (projectIds.length === 0) return [] as ProjectUpdateRow[];
  const { data, error } = await supabase
    .from("project_updates")
    .select(UPDATE_SELECT)
    .in("project_id", projectIds)
    .order("published_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as ProjectUpdateRow[];
}

/** Projetos + timeline macro de um negócio (via contrato). */
export const getDealDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dealId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: contracts, error: cErr } = await supabase
      .from("contracts")
      .select("id, number, title")
      .eq("deal_id", data.dealId);
    if (cErr) throw cErr;
    const contractIds = (contracts ?? []).map((c) => c.id);
    if (contractIds.length === 0) return { projects: [] as DeliveryProject[] };

    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select("id, name, status, progress, due_at, contract_id")
      .in("contract_id", contractIds)
      .order("created_at", { ascending: false });
    if (pErr) throw pErr;
    if (!projects || projects.length === 0) return { projects: [] as DeliveryProject[] };

    const updates = await loadUpdates(
      supabase,
      projects.map((p) => p.id),
    );

    const result: DeliveryProject[] = projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status ?? null,
      progress: p.progress ?? null,
      due_at: p.due_at ?? null,
      contract: (contracts ?? []).find((c) => c.id === p.contract_id) ?? null,
      updates: updates.filter((u) => u.project_id === p.id),
    }));
    return { projects: result };
  });

/** Timeline macro de um projeto específico (visão somente leitura). */
export const getProjectDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, name, status, progress, due_at, contract_id, contracts(id, number, title)")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw error;
    if (!project) return { project: null as DeliveryProject | null };

    const updates = await loadUpdates(supabase, [project.id]);
    const contract =
      (
        project as unknown as {
          contracts?: { id: string; number: string | null; title: string | null } | null;
        }
      ).contracts ?? null;

    return {
      project: {
        id: project.id,
        name: project.name,
        status: project.status ?? null,
        progress: project.progress ?? null,
        due_at: project.due_at ?? null,
        contract,
        updates,
      } satisfies DeliveryProject,
    };
  });

const checkpointInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  health: z.enum(["green", "yellow", "red"]).nullable().optional(),
  progressPct: z.number().int().min(0).max(100).nullable().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
  visibility: z.enum(["internal", "commercial"]).default("commercial"),
});

async function projectWorkspace(supabase: Supa, projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from("projects")
    .select("workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.workspace_id) throw new Error("Projeto não encontrado.");
  return data.workspace_id as string;
}

export const createProjectUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkpointInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await projectWorkspace(supabase, data.projectId);
    await assertAnyPermission(supabase, userId, workspaceId, [
      "techprojects.project_updates.create.own",
    ]);

    const { data: row, error } = await supabase
      .from("project_updates")
      .insert({
        workspace_id: workspaceId,
        project_id: data.projectId,
        kind: "checkpoint",
        title: data.title,
        summary: data.summary ?? null,
        health: data.health ?? null,
        progress_pct: data.progressPct ?? null,
        expected_delivery_date: data.expectedDeliveryDate || null,
        visibility: data.visibility,
        author_id: userId,
        owner_id: userId,
        assigned_to: userId,
      })
      .select(UPDATE_SELECT)
      .single();
    if (error) throw error;
    return row as ProjectUpdateRow;
  });

export const updateProjectUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    checkpointInput
      .partial({ projectId: true, visibility: true })
      .extend({ id: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: current, error: cErr } = await supabase
      .from("project_updates")
      .select("id, workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!current) throw new Error("Acompanhamento não encontrado.");

    await assertAnyPermission(supabase, userId, current.workspace_id as string, [
      "techprojects.project_updates.update.own",
      "techprojects.project_updates.update.workspace",
    ]);

    const patch: Record<string, string | number | null> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.summary !== undefined) patch.summary = data.summary ?? null;
    if (data.health !== undefined) patch.health = data.health ?? null;
    if (data.progressPct !== undefined) patch.progress_pct = data.progressPct ?? null;
    if (data.expectedDeliveryDate !== undefined)
      patch.expected_delivery_date = data.expectedDeliveryDate || null;
    if (data.visibility !== undefined) patch.visibility = data.visibility;

    const { data: row, error } = await supabase
      .from("project_updates")
      .update(patch as never)
      .eq("id", data.id)
      .select(UPDATE_SELECT)
      .single();
    if (error) throw error;
    return row as ProjectUpdateRow;
  });

export const deleteProjectUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: current, error: cErr } = await supabase
      .from("project_updates")
      .select("id, workspace_id")
      .eq("id", data.id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!current) return { ok: true };

    await assertAnyPermission(supabase, userId, current.workspace_id as string, [
      "techprojects.project_updates.delete.workspace",
    ]);

    await deleteByIdGuarded(supabase, "project_updates", data.id);
    return { ok: true };
  });
