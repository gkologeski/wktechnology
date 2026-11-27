import { assertAnyPermission } from "@/lib/access-control/enforce.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";
import {
  normalizeProgressValue,
  type CheckpointInput,
  type CheckpointPatchInput,
} from "./delivery-progress";

export type ProjectUpdateRow = {
  id: string;
  project_id: string;
  kind: string;
  title: string;
  summary: string | null;
  health: string | null;
  progress_value: number | null;
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
  "id, project_id, kind, title, summary, health, progress_value, expected_delivery_date, visibility, published_at, author_id, owner_id";

type Supa = Parameters<typeof assertAnyPermission>[0];

function mapUpdateRow(row: Record<string, unknown>): ProjectUpdateRow {
  return {
    id: row["id"] as string,
    project_id: row["project_id"] as string,
    kind: row["kind"] as string,
    title: row["title"] as string,
    summary: (row["summary"] as string | null) ?? null,
    health: (row["health"] as string | null) ?? null,
    progress_value: normalizeProgressValue(row["progress_value"]),
    expected_delivery_date: (row["expected_delivery_date"] as string | null) ?? null,
    visibility: row["visibility"] as string,
    published_at: row["published_at"] as string,
    author_id: (row["author_id"] as string | null) ?? null,
    owner_id: (row["owner_id"] as string | null) ?? null,
  };
}

async function loadUpdates(supabase: Supa, projectIds: string[]): Promise<ProjectUpdateRow[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("project_updates")
    .select(UPDATE_SELECT)
    .in("project_id", projectIds)
    .order("published_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapUpdateRow);
}

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

export async function runGetDealDelivery(supabase: Supa, dealId: string) {
  const { data: contracts, error: cErr } = await supabase
    .from("contracts")
    .select("id, number, title")
    .eq("deal_id", dealId);
  if (cErr) throw cErr;
  const contractIds = (contracts ?? []).map((c) => c.id);

  const { data: links, error: lErr } = await supabase
    .from("project_deal_links")
    .select("project_id")
    .eq("deal_id", dealId);
  if (lErr) throw lErr;
  const linkedIds = (links ?? []).map((l) => l.project_id);

  const filters = [`deal_id.eq.${dealId}`];
  if (contractIds.length > 0) filters.push(`contract_id.in.(${contractIds.join(",")})`);
  if (linkedIds.length > 0) filters.push(`id.in.(${linkedIds.join(",")})`);
  const { data: projects, error: pErr } = await supabase
    .from("projects")
    .select("id, name, status, progress, due_at, contract_id")
    .or(filters.join(","))
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
}

export async function runGetProjectDelivery(supabase: Supa, projectId: string) {
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, status, progress, due_at, contract_id, contracts(id, number, title)")
    .eq("id", projectId)
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
}

export async function runCreateProjectUpdate(
  supabase: Supa,
  userId: string,
  data: CheckpointInput,
): Promise<ProjectUpdateRow> {
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
      progress_value: data.progressPct ?? null,
      expected_delivery_date: data.expectedDeliveryDate || null,
      visibility: data.visibility,
      author_id: userId,
      owner_id: userId,
      assigned_to: userId,
    })
    .select(UPDATE_SELECT)
    .single();
  if (error) throw error;
  return mapUpdateRow(row as unknown as Record<string, unknown>);
}

export async function runUpdateProjectUpdate(
  supabase: Supa,
  userId: string,
  data: CheckpointPatchInput,
): Promise<ProjectUpdateRow> {
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
  if (data.title !== undefined) patch["title"] = data.title;
  if (data.summary !== undefined) patch["summary"] = data.summary ?? null;
  if (data.health !== undefined) patch["health"] = data.health ?? null;
  if (data.progressPct !== undefined) patch["progress_value"] = data.progressPct ?? null;
  if (data.expectedDeliveryDate !== undefined) {
    patch["expected_delivery_date"] = data.expectedDeliveryDate || null;
  }
  if (data.visibility !== undefined) patch["visibility"] = data.visibility;

  const { data: row, error } = await supabase
    .from("project_updates")
    .update(patch as never)
    .eq("id", data.id)
    .select(UPDATE_SELECT)
    .single();
  if (error) throw error;
  return mapUpdateRow(row as unknown as Record<string, unknown>);
}

export async function runDeleteProjectUpdate(supabase: Supa, userId: string, id: string) {
  const { data: current, error: cErr } = await supabase
    .from("project_updates")
    .select("id, workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!current) return { ok: true };

  await assertAnyPermission(supabase, userId, current.workspace_id as string, [
    "techprojects.project_updates.delete.workspace",
  ]);

  await deleteByIdGuarded(supabase, "project_updates", id);
  return { ok: true };
}
