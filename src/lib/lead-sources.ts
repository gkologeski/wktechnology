// Catálogo de fontes de lead (origem usada no cadastro e na prospecção).
// A visibilidade é decidida pela RLS: as fontes pertencem ao workspace.
import { supabase } from "@/integrations/supabase/client";
import { leadSourceLabel } from "@/lib/lead-source-labels";

export type LeadSource = {
  id: string;
  owner_id: string;
  workspace_id: string | null;
  name: string;
  /** Rótulo em pt-BR exibido na interface (quando vazio, derivado do nome). */
  label: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Evita a inferência custosa do supabase-js sobre a string de select. */
const sel = (s: string): string => s;

const COLUMNS = "id, owner_id, workspace_id, name, label, active, created_at, updated_at";

export const leadSourcesKey = (activeOnly: boolean) => ["lead-sources", activeOnly] as const;

/** Rótulo final de uma fonte: o cadastrado ou o derivado do nome cru. */
export function sourceDisplayLabel(source: Pick<LeadSource, "name" | "label">): string {
  const label = source.label?.trim();
  return label && label !== "" ? label : leadSourceLabel(source.name);
}

export async function listLeadSources(activeOnly = true): Promise<LeadSource[]> {
  let q = supabase.from("lead_sources").select(sel(COLUMNS)).order("name", { ascending: true });
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q.returns<LeadSource[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Workspace ativo do usuário (usado para não criar fontes órfãs). */
async function currentWorkspaceId(userId: string): Promise<string | null> {
  const { data } = await supabase.rpc("default_workspace_for_user", { _user: userId });
  return (data as string | null) ?? null;
}

export async function ensureLeadSource(
  ownerId: string,
  name: string,
  label?: string | null,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const workspaceId = await currentWorkspaceId(ownerId);
  const { error } = await supabase.from("lead_sources").upsert(
    {
      owner_id: ownerId,
      workspace_id: workspaceId,
      name: trimmed,
      label: label?.trim() || null,
      active: true,
    },
    { onConflict: "owner_id,name" },
  );
  // Uma fonte com o mesmo nome (outra grafia ou outro dono) já pode existir no
  // workspace — o índice único por (workspace_id, lower(name)) não é coberto
  // pelo conflict target. Nesse caso a fonte já está cadastrada: não é erro.
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function updateLeadSource(
  id: string,
  patch: { name?: string; label?: string | null; active?: boolean },
): Promise<void> {
  const values: { name?: string; label?: string | null; active?: boolean } = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("Informe o nome da fonte.");
    values.name = name;
  }
  if (patch.label !== undefined) values.label = patch.label?.trim() || null;
  if (patch.active !== undefined) values.active = patch.active;
  if (Object.keys(values).length === 0) return;
  const { error } = await supabase.from("lead_sources").update(values).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLeadSource(id: string): Promise<void> {
  const { error } = await supabase.from("lead_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Quantidade de leads por fonte (uma contagem por nome, sem trazer linhas). */
export async function countLeadsBySource(names: string[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    names.map(async (name) => {
      const { count, error } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("source", name);
      if (error) return [name, 0] as const;
      return [name, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}
