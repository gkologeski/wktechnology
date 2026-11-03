import { inspectSequence } from "./preflight";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { definitionSchema, SEQUENCE_RESOURCE } from "./draft";
import {
  cohortCandidates,
  enrollmentInput,
  type CohortSummary,
  type EnrollmentInput,
} from "./enrollment";
export async function prepareSequenceEnrollment(
  client: SupabaseClient,
  input: EnrollmentInput,
  serviceClient?: SupabaseClient,
): Promise<CohortSummary> {
  const data = enrollmentInput.parse(input);
  await assertSalesArea(client, SEQUENCE_RESOURCE, "assign");
  await assertSalesArea(client, SEQUENCE_RESOURCE, "view");
  const scope = await workRpc<{ workspace: string; actor: string; read_only: boolean }>(
    client,
    "sales_access_context",
    {},
  );
  if (scope.workspace !== data.workspaceId || !scope.actor || scope.read_only)
    throw new Error("Workspace indisponível.");
  const version = await client
    .from("prospecting_sequence_versions" as never)
    .select("id,workspace_id,owner_id,definition")
    .eq("id", data.versionId)
    .eq("workspace_id", scope.workspace)
    .maybeSingle();
  if (version.error || !version.data) throw new Error("Versão indisponível.");
  const { definition } = version.data as unknown as { definition: unknown };
  const parsed = definitionSchema.parse(definition);
  const issues = inspectSequence(parsed);
  if (issues.length) throw new Error(`Versão incompleta: ${issues[0].message}`);
  const { loadAudienceRows } = await import("@/lib/whatsapp/campaign-audience.server");
  const { rows, truncated } = await loadAudienceRows(
    client,
    scope.workspace,
    {
      type: "filter",
      base: parsed.audience.base,
      groups: parsed.audience.groups,
      groups_logic: parsed.audience.groupsLogic,
    },
    scope.actor,
  );
  if (truncated)
    throw new Error(
      "O público excede o limite técnico de 5.000 registros. Refine os filtros antes de inscrever; nenhum lote parcial foi gravado.",
    );
  let candidates = cohortCandidates(rows, parsed);
  const writer =
    serviceClient ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const recentDays = parsed.planning?.recent.entryWhatsappDays ?? 0;
  let recentExcluded = 0;
  if (recentDays > 0 && candidates.length) {
    const phones = [...new Set(candidates.flatMap((c) => c.phones))];
    const recent = new Set(
      phones.length
        ? await workRpc<string[]>(writer, "prospecting_sequence_recent_whatsapp_phones", {
            p_workspace: scope.workspace,
            p_phones: phones,
            p_days: recentDays,
          })
        : [],
    );
    const kept = candidates.filter((c) => !c.phones.some((p) => recent.has(p)));
    recentExcluded = candidates.length - kept.length;
    candidates = kept;
  }
  const summary = await workRpc<CohortSummary>(writer, "prospecting_sequence_cohort_prepare", {
    p_workspace: scope.workspace,
    p_actor: scope.actor,
    p_version: data.versionId,
    p_request: data.requestId,
    p_consent: data.consentEvidence,
    p_candidates: candidates,
  });
  if (!recentExcluded) return summary;
  return {
    ...summary,
    requested: summary.requested + recentExcluded,
    blocked: summary.blocked + recentExcluded,
    reasons: { ...summary.reasons, recent_whatsapp: recentExcluded },
  };
}
export async function listSequenceCohorts(
  client: SupabaseClient,
  workspaceId: string,
  versionId: string,
): Promise<CohortSummary[]> {
  await assertSalesArea(client, SEQUENCE_RESOURCE, "view");
  return workRpc(client, "prospecting_sequence_cohort_list", {
    p_workspace: workspaceId,
    p_version: versionId,
  });
}
