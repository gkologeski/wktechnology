// Armazenamento do motor Jibble no banco (cliente privilegiado). TODA consulta é filtrada
// por workspace + provedor + organização de origem; escrita no ERP só pelas funções
// `clockify_import_apply` (sem workflows/notificações) e `time_import_rollback`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail, type WorkspaceMember } from "../clockify/clockify-map";
import type { ErpEntry } from "./jibble-reconcile";
import type {
  ApplyResult,
  DuplicateInput,
  DuplicateRow,
  JibbleStore,
  LinkInput,
  LinkRow,
  MappingRow,
  StagingInput,
  StagingRow,
} from "./jibble-store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

const PROVIDER = "jibble";

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function createJibbleStore(db: Db, workspaceId: string, orgId: string): JibbleStore {
  const scope = { workspace_id: workspaceId, provider: PROVIDER, source_org_id: orgId };
  const base = (table: string) =>
    db
      .from(table)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("provider", PROVIDER)
      .eq("source_org_id", orgId);

  return {
    async upsertStaging(runId, rows) {
      const now = new Date().toISOString();
      for (const part of chunk(rows, 500)) {
        const { error } = await db.from("time_import_staging").upsert(
          part.map((r: StagingInput) => ({
            ...scope,
            ...r,
            status: r.status ?? "staged",
            last_run_id: runId,
            last_seen_at: now,
          })),
          { onConflict: "workspace_id,provider,source_org_id,entity_type,external_id" },
        );
        check(error);
      }
    },
    async stagingPage(entity, opts) {
      let q = base("time_import_staging").eq("entity_type", entity);
      if (opts.personId) q = q.eq("person_external_id", opts.personId);
      if (opts.statuses?.length) q = q.in("status", opts.statuses);
      const { data, error } = await q
        .order("external_id")
        .range(opts.offset, opts.offset + opts.limit - 1);
      check(error);
      return (data ?? []) as StagingRow[];
    },
    async stagingPersonIds(entity) {
      const ids = new Set<string>();
      for (let from = 0; from < 2_000_000; from += 1000) {
        const { data, error } = await db
          .from("time_import_staging")
          .select("person_external_id")
          .eq("workspace_id", workspaceId)
          .eq("provider", PROVIDER)
          .eq("source_org_id", orgId)
          .eq("entity_type", entity)
          .not("person_external_id", "is", null)
          .order("person_external_id")
          .range(from, from + 999);
        check(error);
        for (const r of data ?? []) ids.add(r.person_external_id as string);
        if (!data || data.length < 1000) break;
      }
      return [...ids];
    },
    async setStagingStatus(entity, externalIds, status, reason, detail) {
      for (const part of chunk(externalIds, 300)) {
        const { error } = await db
          .from("time_import_staging")
          .update({ status, reason_code: reason ?? null, reason_detail: detail ?? null })
          .eq("workspace_id", workspaceId)
          .eq("provider", PROVIDER)
          .eq("source_org_id", orgId)
          .eq("entity_type", entity)
          .in("external_id", part);
        check(error);
      }
    },
    async loadMappings(entity) {
      const { data, error } = await base("time_import_mappings")
        .eq("entity_type", entity)
        .limit(20_000);
      check(error);
      return (data ?? []) as MappingRow[];
    },
    async upsertMappings(rows) {
      for (const part of chunk(rows, 300)) {
        const { error } = await db.from("time_import_mappings").upsert(
          part.map((r: MappingRow) => ({ ...scope, ...r })),
          {
            onConflict: "workspace_id,provider,source_org_id,entity_type,external_id",
          },
        );
        check(error);
      }
    },
    async loadLinks(entity, externalIds) {
      const out: LinkRow[] = [];
      for (const part of chunk(externalIds, 300)) {
        const { data, error } = await base("time_import_links")
          .eq("entity_type", entity)
          .in("external_id", part);
        check(error);
        out.push(...((data ?? []) as LinkRow[]));
      }
      return out;
    },
    async insertLinks(runId, rows) {
      for (const part of chunk(rows, 300)) {
        const { error } = await db.from("time_import_links").upsert(
          part.map((r: LinkInput) => ({ ...scope, ...r, last_run_id: runId })),
          {
            onConflict: "workspace_id,provider,source_org_id,entity_type,external_id,segment",
            ignoreDuplicates: true,
          },
        );
        check(error);
      }
    },
    async linksCreatedByRun(runId) {
      const out: LinkRow[] = [];
      for (let from = 0; from < 2_000_000; from += 1000) {
        const { data, error } = await base("time_import_links")
          .eq("created_run_id", runId)
          .order("id")
          .range(from, from + 999);
        check(error);
        out.push(...((data ?? []) as LinkRow[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    async deleteLinks(ids) {
      for (const part of chunk(ids, 300)) {
        const { error } = await db
          .from("time_import_links")
          .delete()
          .eq("workspace_id", workspaceId)
          .eq("provider", PROVIDER)
          .in("id", part);
        check(error);
      }
    },
    async upsertDuplicates(rows: DuplicateInput[]) {
      for (const part of chunk(rows, 300)) {
        const { error } = await db.from("time_import_duplicates").upsert(
          part.map((r) => ({ ...scope, ...r })),
          {
            onConflict: "workspace_id,provider,source_org_id,external_id,segment,existing_entry_id",
            ignoreDuplicates: true,
          },
        );
        check(error);
      }
    },
    async loadDuplicates(externalIds) {
      const out: DuplicateRow[] = [];
      for (const part of chunk(externalIds, 300)) {
        const { data, error } = await base("time_import_duplicates").in("external_id", part);
        check(error);
        out.push(...((data ?? []) as DuplicateRow[]));
      }
      return out;
    },
    async members() {
      const { data, error } = await db
        .from("workspace_members")
        .select("user_id, status")
        .eq("workspace_id", workspaceId)
        .limit(5000);
      check(error);
      const ids = (data ?? []).map((m) => m.user_id as string);
      const names = new Map<string, string | null>();
      for (const part of chunk(ids, 300)) {
        const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", part);
        for (const p of profiles ?? [])
          names.set(p.id as string, (p.full_name as string | null) ?? null);
      }
      const emails = new Map<string, string>();
      for (const part of chunk(ids, 10)) {
        await Promise.all(
          part.map(async (id) => {
            const r = await db.auth.admin.getUserById(id).catch(() => null);
            const e = normalizeEmail(r?.data?.user?.email ?? null);
            if (e) emails.set(id, e);
          }),
        );
      }
      return (data ?? []).map<WorkspaceMember>((m) => ({
        user_id: m.user_id as string,
        status: m.status as string,
        email: emails.get(m.user_id as string) ?? null,
        name: names.get(m.user_id as string) ?? null,
      }));
    },
    async existingMembers(pairs) {
      const out = new Set<string>();
      const byProject = new Map<string, string[]>();
      for (const p of pairs)
        byProject.set(p.project_id, [...(byProject.get(p.project_id) ?? []), p.user_id]);
      for (const [projectId, users] of byProject) {
        const { data, error } = await db
          .from("project_members")
          .select("project_id, user_id")
          .eq("workspace_id", workspaceId)
          .eq("project_id", projectId)
          .in("user_id", users);
        check(error);
        for (const m of data ?? []) out.add(`${m.project_id}:${m.user_id}`);
      }
      return out;
    },
    async namedTargets(kind, labels) {
      const table = kind === "client" ? "companies" : "projects";
      const out: Array<{ id: string; name: string }> = [];
      const clean = [
        ...new Set(labels.map((l) => l.replace(/[%_\\,()*"]/g, "").trim()).filter(Boolean)),
      ];
      for (const part of chunk(clean, 40)) {
        const { data, error } = await db
          .from(table)
          .select("id, name")
          .eq("workspace_id", workspaceId)
          .or(part.map((l) => `name.ilike."${l}"`).join(","))
          .limit(400);
        check(error);
        out.push(...((data ?? []) as Array<{ id: string; name: string }>));
      }
      return out;
    },
    async erpEntries(userId, fromIso, toIso) {
      const { data, error } = await db
        .from("project_time_entries")
        .select("id, source, external_id, project_id, started_at, stopped_at")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .lt("started_at", toIso)
        .gt("stopped_at", fromIso)
        .limit(20_000);
      check(error);
      return (data ?? []) as ErpEntry[];
    },
    async applyErp(table, op, rows) {
      const out: ApplyResult = [];
      for (const part of chunk(rows, 200)) {
        const { data, error } = await db.rpc("clockify_import_apply", {
          p_workspace: workspaceId,
          p_table: table,
          p_op: op,
          p_rows: part,
        });
        check(error);
        out.push(...((data ?? []) as ApplyResult));
      }
      return out;
    },
    async rollback(ids) {
      const { data, error } = await db.rpc("time_import_rollback", {
        p_workspace: workspaceId,
        p_entries: ids.entries,
        p_members: ids.members,
        p_tasks: ids.tasks,
        p_projects: ids.projects,
      });
      check(error);
      return (data ?? {}) as Record<string, string[]>;
    },
    async saveRun(id, patch) {
      const { error } = await db
        .from("time_import_runs")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .eq("provider", PROVIDER);
      check(error);
    },
    async isCancelRequested(id) {
      const { data } = await db
        .from("time_import_runs")
        .select("status")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      return data?.status === "cancel_requested";
    },
  };
}
