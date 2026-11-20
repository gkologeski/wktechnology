import { readFileSync } from "node:fs";
import type postgres from "postgres";
import { loadNotificationBusinessFunction } from "./notification-business-events";

/** Physical columns only; canonical permissions, RLS and all P9 SQL run verbatim. */
export async function setupNotificationProjectEvents(db: postgres.Sql) {
  await db.unsafe(`
    ALTER TABLE public.projects ADD COLUMN name text,ADD COLUMN starts_at date,ADD COLUMN due_at date,
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now(),
      ADD COLUMN planned_cost numeric,ADD COLUMN service_id uuid,ADD COLUMN contract_id uuid,ADD COLUMN role text,
      ADD COLUMN description text,ADD COLUMN progress numeric,ADD COLUMN planned_hours numeric,ADD COLUMN metadata jsonb,
      ADD COLUMN company_id uuid,ADD COLUMN deal_id uuid,ADD COLUMN delivery_group_key text,ADD COLUMN source_line_item_id uuid,
      ADD COLUMN client_contact_id uuid,ADD COLUMN origin text,ADD COLUMN delivery_template_version_id uuid,
      ADD COLUMN delivery_template_applied_at timestamptz,ADD COLUMN delivery_template_applied_by uuid,
      ADD COLUMN client_acceptance_required boolean;
    ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'planning';
    ALTER TABLE public.project_tasks ADD COLUMN title text,ADD COLUMN start_at date,ADD COLUMN due_at date,
      ADD COLUMN list_id uuid,ADD COLUMN custom_status_id uuid,
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now();
    ALTER TABLE public.project_tasks ALTER COLUMN status SET DEFAULT 'todo';
    ALTER TABLE public.project_milestones ADD COLUMN name text,ADD COLUMN due_at date,ADD COLUMN completed_at timestamptz,
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now();
    ALTER TABLE public.project_milestones ALTER COLUMN status SET DEFAULT 'pending';
    CREATE TABLE public.project_lists(id uuid PRIMARY KEY,workspace_id uuid,project_id uuid);
    CREATE TABLE public.project_task_statuses(id uuid PRIMARY KEY,workspace_id uuid,list_id uuid,
      name text,category text NOT NULL DEFAULT 'todo');
  `);
  await loadNotificationBusinessFunction(
    db,
    "drizzle/migrations/0218_order3_completion_prepare.sql",
    "work_cost_projection",
  );
  const projectionAcl = readFileSync(
    "drizzle/migrations/0218_order3_completion_prepare.sql",
    "utf8",
  )
    .split("\n")
    .find((line) => line.startsWith("REVOKE ALL ON FUNCTION public.work_cost_projection("));
  const projectColumns = readFileSync(
    "drizzle/migrations/0219_order3_completion_activate.sql",
    "utf8",
  )
    .split("\n")
    .find((line) => line.startsWith("REVOKE SELECT ON public.projects FROM authenticated;"));
  if (!projectionAcl || !projectColumns) throw Error("Missing canonical project cost boundary");
  await db.unsafe(projectionAcl);
  await db.unsafe(projectColumns);
  for (const [file, name] of [
    ["drizzle/migrations/0142_crm_cargo_porte_derivation.sql", "crm_is_derivation_backfill"],
    ["drizzle/migrations/0169_techprojects_cycle1_reconciliation.sql", "project_is_link_backfill"],
    ["drizzle/migrations/0169_techprojects_cycle1_reconciliation.sql", "enqueue_workflow_event"],
  ])
    await loadNotificationBusinessFunction(db, file, name);
  await db.unsafe(
    "REVOKE ALL ON FUNCTION public.enqueue_workflow_event() FROM PUBLIC,anon,authenticated",
  );
  await db.unsafe(readFileSync("drizzle/migrations/0398_notification_projects.sql", "utf8"));
}
