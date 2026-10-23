import type { SupabaseClient } from "@supabase/supabase-js";
type HrRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function createHrOnboardingPlan(
  client: SupabaseClient,
  args: {
    person_id: string;
    kind: "onboarding" | "offboarding";
    template_id?: string | null;
    status?: string;
    started_at?: string | null;
    target_completion_date?: string | null;
    notes?: string | null;
    automatic?: boolean;
  },
): Promise<{ id: string; existed: boolean; task_count: number }> {
  const { data, error } = await (client.rpc as unknown as HrRpc).call(
    client,
    "hr_create_onboarding_plan",
    {
      _person: args.person_id,
      _kind: args.kind,
      _template: args.template_id ?? null,
      _status: args.status ?? "in_progress",
      _started: args.started_at ?? null,
      _target: args.target_completion_date ?? null,
      _notes: args.notes ?? null,
      _automatic: args.automatic ?? false,
    },
  );
  if (error) throw new Error(error.message);
  const result = data as { id?: unknown; existed?: unknown; task_count?: unknown } | null;
  if (
    !result ||
    typeof result.id !== "string" ||
    typeof result.existed !== "boolean" ||
    typeof result.task_count !== "number"
  )
    throw new Error("Não foi possível confirmar a criação do plano.");
  return result as { id: string; existed: boolean; task_count: number };
}
