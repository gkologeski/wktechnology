// Server functions for the TechERP access control system.
// Read-only in Phase 1 (Fase 1). CRUD arrives in Phase 2.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PermissionRow = {
  key: string;
  module: string;
  resource: string;
  action: string;
  scope: string;
  label_pt: string;
  description: string | null;
};

export type PermissionSetRow = {
  id: string;
  owner_id: string | null;
  module: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_keys: string[];
};

export type DataScope = "own" | "team" | "workspace" | "custom";

export type JobRoleRow = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  data_scope: DataScope;
  set_ids: string[];
};

export type FieldRuleRow = {
  id: string;
  owner_id: string | null;
  role_id: string | null;
  set_id: string | null;
  resource: string;
  field: string;
  mode: "hidden" | "masked" | "readonly";
  is_system: boolean;
};

export type MemberAssignmentRow = {
  user_id: string;
  full_name: string;
  email: string;
  primary_role_id: string | null;
  role_ids: string[];
  extra_set_ids: string[];
};

export type AccessBundle = {
  permissions: PermissionRow[];
  permission_sets: PermissionSetRow[];
  job_roles: JobRoleRow[];
  field_rules: FieldRuleRow[];
  members: MemberAssignmentRow[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveActiveWorkspace(supabase: any, userId: string): Promise<string | null> {
  const m = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (m.data?.workspace_id) return m.data.workspace_id as string;
  const w = await supabase
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();
  return (w.data?.id as string) ?? null;
}

export const getAccessBundle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessBundle> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);

    // Todas as leituras de catálogo são paginadas: `permissions` e
    // `permission_set_items` já passam de 1.000 linhas e eram truncadas pelo
    // Data API, fazendo módulos inteiros (TechSales, TechService, TechProjects)
    // desaparecerem da matriz.
    const [permRows, setRows, itemRows, roleRows, roleSetRows, ruleRows, memberRows] =
      await Promise.all([
        fetchAllPages<PermissionRow>((from, to) =>
          supabase.from("permissions").select("*").order("module").order("key").range(from, to),
        ),
        fetchAllPages<Omit<PermissionSetRow, "permission_keys">>((from, to) =>
          supabase
            .from("permission_sets")
            .select("*")
            .order("module")
            .order("name")
            .range(from, to),
        ),
        fetchAllPages<{ set_id: string; permission_key: string }>((from, to) =>
          supabase
            .from("permission_set_items")
            .select("set_id, permission_key")
            .order("set_id")
            .order("permission_key")
            .range(from, to),
        ),
        fetchAllPages<Omit<JobRoleRow, "set_ids">>((from, to) =>
          supabase
            .from("job_roles")
            .select("*")
            .order("is_system", { ascending: false })
            .order("name")
            .range(from, to),
        ),
        fetchAllPages<{ role_id: string; set_id: string }>((from, to) =>
          supabase
            .from("job_role_sets")
            .select("role_id, set_id")
            .order("role_id")
            .range(from, to),
        ),
        fetchAllPages<FieldRuleRow>((from, to) =>
          supabase.from("field_permission_rules").select("*").order("id").range(from, to),
        ),
        workspaceId
          ? fetchAllPages<{ user_id: string; role: string }>((from, to) =>
              supabase
                .from("workspace_members")
                .select("user_id, role")
                .eq("workspace_id", workspaceId)
                .order("user_id")
                .range(from, to),
            )
          : Promise.resolve([] as Array<{ user_id: string; role: string }>),
      ]);


    // Group items and role_sets
    const itemsBySet = new Map<string, string[]>();
    for (const it of itemRows) {
      const arr = itemsBySet.get(it.set_id) ?? [];
      arr.push(it.permission_key);
      itemsBySet.set(it.set_id, arr);
    }

    const setsByRole = new Map<string, string[]>();
    for (const rs of roleSetRows) {
      const arr = setsByRole.get(rs.role_id) ?? [];
      arr.push(rs.set_id);
      setsByRole.set(rs.role_id, arr);
    }

    // Load member assignments (only for workspace users)
    const memberUserIds = memberRows.map((m) => m.user_id);

    let userJobRoles: Array<{ user_id: string; role_id: string; is_primary: boolean }> = [];
    let userPermissionSets: Array<{ user_id: string; set_id: string }> = [];
    let profiles: Array<{ id: string; full_name: string | null }> = [];
    const emailMap = new Map<string, string>();

    if (workspaceId && memberUserIds.length > 0) {
      const [ujrRes, upsRes, profRes] = await Promise.all([
        supabase
          .from("user_job_roles")
          .select("user_id, role_id, is_primary")
          .eq("owner_id", userId),
        supabase
          .from("user_permission_sets")
          .select("user_id, set_id")
          .eq("owner_id", userId),
        supabase.from("profiles").select("id, full_name").in("id", memberUserIds),
      ]);

      userJobRoles = (ujrRes.data ?? []) as typeof userJobRoles;
      userPermissionSets = (upsRes.data ?? []) as typeof userPermissionSets;
      profiles = (profRes.data ?? []) as typeof profiles;

      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await Promise.all(
          memberUserIds.map(async (id) => {
            try {
              const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
              if (u.user?.email) emailMap.set(id, u.user.email);
            } catch {
              /* ignore */
            }
          }),
        );
      } catch {
        /* ignore */
      }
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? ""]));
    const rolesByUser = new Map<string, { primary: string | null; all: string[] }>();
    for (const r of userJobRoles) {
      const entry = rolesByUser.get(r.user_id) ?? { primary: null, all: [] };
      entry.all.push(r.role_id);
      if (r.is_primary) entry.primary = r.role_id;
      rolesByUser.set(r.user_id, entry);
    }
    const setsByUser = new Map<string, string[]>();
    for (const s of userPermissionSets) {
      const arr = setsByUser.get(s.user_id) ?? [];
      arr.push(s.set_id);
      setsByUser.set(s.user_id, arr);
    }

    return {
      permissions: permRows,
      permission_sets: setRows.map((s) => ({
        ...s,
        permission_keys: itemsBySet.get(s.id) ?? [],
      })),
      job_roles: roleRows.map((r) => ({
        ...r,
        set_ids: setsByRole.get(r.id) ?? [],
      })),
      field_rules: ruleRows,

      members: memberUserIds.map((uid) => {
        const rby = rolesByUser.get(uid);
        return {
          user_id: uid,
          full_name: profileMap.get(uid) ?? "",
          email: emailMap.get(uid) ?? "",
          primary_role_id: rby?.primary ?? null,
          role_ids: rby?.all ?? [],
          extra_set_ids: setsByUser.get(uid) ?? [],
        };
      }),
    };
  });
