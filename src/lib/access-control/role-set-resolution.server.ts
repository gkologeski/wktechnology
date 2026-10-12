// Carrega vínculos cargo→pacote resolvidos no workspace (substituição + escopo),
// com a mesma regra do banco. Substituições são lidas pelo cliente privilegiado
// só depois de o workspace ter sido resolvido para o chamador (resolvedor canônico),
// porque a policy de leitura é restrita a admins e regras de campo valem para todos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./fetch-all";
import {
  resolveRoleSets,
  type RoleSetLink,
  type SetReplacement,
  type SetScopeMeta,
} from "./role-set-resolution";

export async function loadResolvedRoleSets(
  supabase: SupabaseClient,
  workspaceId: string,
  roleIds?: string[],
): Promise<Map<string, string[]>> {
  if (roleIds && roleIds.length === 0) return new Map();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const links = await fetchAllPages<RoleSetLink>((from, to) => {
    let q = supabase.from("job_role_sets").select("role_id, set_id");
    if (roleIds) q = q.in("role_id", roleIds);
    return q.order("role_id").order("set_id").range(from, to);
  });

  let repQ = supabaseAdmin
    .from("job_role_set_replacements")
    .select("role_id, set_id, replacement_set_id")
    .eq("workspace_id", workspaceId);
  if (roleIds) repQ = repQ.in("role_id", roleIds);
  const reps = await repQ;
  if (reps.error) throw new Error(`Falha ao ler substituições de pacote: ${reps.error.message}`);
  const replacements = (reps.data ?? []) as SetReplacement[];

  const ids = [
    ...new Set([...links.map((l) => l.set_id), ...replacements.map((r) => r.replacement_set_id)]),
  ];
  const sets = new Map<string, SetScopeMeta>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from("permission_sets")
      .select("id, workspace_id, module")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`Falha ao ler escopo dos pacotes: ${error.message}`);
    for (const s of (data ?? []) as SetScopeMeta[]) sets.set(s.id, s);
  }
  return resolveRoleSets(links, replacements, sets, workspaceId);
}
