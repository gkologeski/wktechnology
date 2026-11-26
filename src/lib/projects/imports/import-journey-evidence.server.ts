import { workRpc } from "@/lib/access-control/work-core.server";
import { authorizeImportJourney, type JourneyContext } from "./import-journey-access.server";
import type { ImportProvider, JourneyEvidencePage, JourneyRecordDetail } from "./import-journey";

type EvidenceRow = { id: string; received_at: string; payload_hash: string };
type HistoryRow = {
  id: string;
  created_at: string;
  actor_id: string;
  note: string;
  assignee_id: string | null;
};
type RawEvidence = { versions: EvidenceRow[]; history: HistoryRow[]; nextCursor: string | null };
export type JourneyEvidenceInput = { id: string; kind: "versions" | "history"; cursor?: string };

/** Names are optional under profile RLS; query failures are not fabricated as absent profiles. */
export async function formatImportHistory(
  ctx: JourneyContext,
  rows: HistoryRow[],
): Promise<JourneyRecordDetail["history"]> {
  const ids = [
    ...new Set(
      rows.flatMap((row) => [row.actor_id, ...(row.assignee_id ? [row.assignee_id] : [])]),
    ),
  ];
  const names = new Map<string, string | null>();
  for (let index = 0; index < ids.length; index += 100) {
    const result = await ctx.client
      .from("profiles")
      .select("id,full_name")
      .in("id", ids.slice(index, index + 100));
    if (result.error) throw new Error("Não foi possível consultar os responsáveis pelo histórico.");
    for (const person of result.data ?? []) names.set(person.id, person.full_name);
  }
  const name = (id: string) => names.get(id) || `Identidade histórica (${id})`;
  return rows.map((row) => ({
    at: row.created_at,
    actor: name(row.actor_id),
    note: row.assignee_id
      ? `Responsável pela conferência: ${name(row.assignee_id)}. ${row.note}`
      : row.note,
  }));
}

export async function listJourneyEvidence(
  ctx: JourneyContext,
  input: JourneyEvidenceInput,
): Promise<JourneyEvidencePage> {
  const record = await ctx.client
    .from("project_import_records" as never)
    .select("provider")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", input.id)
    .maybeSingle();
  if (record.error || !record.data) throw new Error("Registro indisponível ou sem permissão.");
  const provider = (record.data as unknown as { provider: ImportProvider }).provider;
  const authorized = await authorizeImportJourney(ctx.client, ctx.userId, provider, false);
  if (authorized.workspaceId !== ctx.workspaceId)
    throw new Error("O workspace ativo foi alterado.");
  const page = await workRpc<RawEvidence>(ctx.client, "project_import_evidence_page", {
    p_workspace: ctx.workspaceId,
    p_record: input.id,
    p_kind: input.kind,
    p_cursor: input.cursor ?? null,
  });
  return {
    versions: page.versions.map((version) => ({
      id: version.id,
      at: version.received_at,
      hash: version.payload_hash,
    })),
    history: await formatImportHistory(ctx, page.history),
    nextCursor: page.nextCursor,
  };
}

export async function resolveImportSourceName(
  ctx: JourneyContext,
  input: { provider: ImportProvider; sourceId: string },
): Promise<string> {
  const result = await ctx.client
    .from("project_import_records" as never)
    .select("label")
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", input.provider)
    .eq("source_id", input.sourceId)
    .in("entity_type", ["workspace", "organization"])
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error("Não foi possível consultar a organização de origem.");
  return (result.data as unknown as { label?: string } | null)?.label || input.sourceId;
}
