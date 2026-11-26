import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { IMPORT_PROVIDERS, type ImportProvider } from "./import-journey";

export type JourneyContext = { client: SupabaseClient; workspaceId: string; userId: string };
export async function authorizeImportJourney(
  client: SupabaseClient,
  userId: string,
  provider: ImportProvider,
  write: boolean,
): Promise<JourneyContext> {
  const workspaceId = await resolveActiveWorkspace(userId);
  const allowed = await workRpc<boolean>(client, "project_import_access", {
    p_ws: workspaceId,
    p_provider: provider,
    p_action: write ? "manage" : "view",
    p_user: userId,
  });
  if (!allowed) throw new Error("Sem permissão para esta origem de importação.");
  return { client, workspaceId, userId };
}
export async function allowedImportProviders(client: SupabaseClient, userId: string) {
  const workspaceId = await resolveActiveWorkspace(userId);
  const decisions = await Promise.all(
    IMPORT_PROVIDERS.map(async (provider) => ({
      provider,
      allowed: await workRpc<boolean>(client, "project_import_access", {
        p_ws: workspaceId,
        p_provider: provider,
        p_action: "view",
        p_user: userId,
      }),
    })),
  );
  const providers = decisions.filter((x) => x.allowed).map((x) => x.provider);
  if (!providers.length) throw new Error("Sem permissão para consultar as importações.");
  return { ctx: { client, workspaceId, userId }, providers };
}
