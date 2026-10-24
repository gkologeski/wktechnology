import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAnyPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";

type HrRecord =
  | "scorecards"
  | "interview_kits"
  | "interviewer_pools"
  | "interviewer_availability"
  | "interviews"
  | "interview_scoring"
  | "scorecard_responses"
  | "application_interviews"
  | "application_scores"
  | "application_hiring"
  | "applications"
  | "candidate_applications"
  | "pipelines"
  | "jobs"
  | "documents"
  | "benefits"
  | "allocations"
  | "goals"
  | "one_on_ones"
  | "reviews"
  | "assessments"
  | "incidents"
  | "events"
  | "person_documents"
  | "person_benefits"
  | "person_allocations"
  | "person_goals"
  | "person_one_on_ones"
  | "person_reviews"
  | "person_assessments"
  | "person_incidents"
  | "person_events"
  | "people"
  | "candidates"
  | "onboarding_plans"
  | "onboarding_tasks"
  | "onboarding_templates";
type HrAction = "view" | "create" | "update" | "delete";
type HrRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function assertHrRecordAccess(
  client: SupabaseClient,
  resource: HrRecord,
  action: HrAction,
  id: string,
): Promise<void> {
  const { data, error } = await (client.rpc as unknown as HrRpc).call(client, "hr_record_access", {
    _resource: resource,
    _action: action,
    _id: id,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Registro indisponível ou sem permissão para esta ação.");
}

export async function assertHrCreate(
  client: SupabaseClient,
  userId: string,
  resource:
    | "techpeople.people"
    | "techhire.candidates"
    | "techhire.jobs"
    | "techhire.pipelines"
    | "techpeople.onboarding_templates"
    | "techpeople.incidents",
): Promise<string> {
  const workspaceId = await getActiveWorkspaceId(client, userId);
  await assertAnyPermission(client, userId, workspaceId, [
    `${resource}.create.workspace`,
    `${resource}.create.own`,
  ]);
  return workspaceId;
}

/** Creation checks the target person; edits/deletes check the actual child row. */
export async function assertHrChildMutation(
  client: SupabaseClient,
  resource: HrRecord,
  id: string | null | undefined,
  personId: string | null | undefined,
): Promise<void> {
  if (id) return assertHrRecordAccess(client, resource, "update", id);
  if (!personId) throw new Error("Selecione uma pessoa para este registro.");
  return assertHrRecordAccess(client, `person_${resource}` as HrRecord, "create", personId);
}
