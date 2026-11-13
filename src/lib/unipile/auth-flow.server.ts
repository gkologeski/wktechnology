import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unipileAuthRequest, ensurePersonalScope } from "./auth-provider.server";
import { validateLinkedinCallback } from "./auth-flow";
import { linkedinAccountAccess } from "./account-access";
import { getAppUrl } from "@/lib/app-url";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function checked(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
async function assertPersonalAccess(admin: SupabaseClient, actor: string, workspace: string) {
  const result = await admin.rpc("work_subject_context", {
    p_ws: workspace,
    p_actor: actor,
  });
  checked(result.error);
  if (linkedinAccountAccess(result.data ?? {}, actor, "manage") !== workspace)
    throw new Error("Workspace da conta divergente.");
}
export async function beginPersonalLinkedin(
  admin: SupabaseClient,
  actor: string,
  workspace: string,
) {
  await assertPersonalAccess(admin, actor, workspace);
  const existing = await admin
    .from("unipile_accounts")
    .select("unipile_account_id,account_scope_id")
    .eq("owner_id", actor)
    .eq("workspace_id", workspace)
    .eq("provider", "linkedin")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  checked(existing.error);
  const expectedAccount = existing.data?.unipile_account_id ?? null;
  // Reconnect known legacy accounts in place; permanent Scope assignment is never automatic.
  const scopeId = expectedAccount
    ? (existing.data?.account_scope_id ?? null)
    : await ensurePersonalScope(`techerp:${workspace}:${actor}`);
  await assertPersonalAccess(admin, actor, workspace);
  const state = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  const stored = await admin.rpc("unipile_connect_start", {
    p_owner: actor,
    p_workspace: workspace,
    p_scope: scopeId,
    p_expected_account: expectedAccount,
    p_state_hash: hash(state),
  });
  checked(stored.error);
  const redirect = new URL("/unipile-connected", getAppUrl());
  redirect.searchParams.set("state", state);
  const result = await unipileAuthRequest("/auth/link", {
    ...(expectedAccount ? { account_id: expectedAccount } : { providers: ["linkedin"] }),
    ...(scopeId ? { account_scope_id: scopeId } : {}),
    expires_on: expiresAt,
    redirect_uri: redirect.toString(),
  });
  if (typeof result.link !== "string")
    throw new Error("Unipile não retornou a URL de autenticação.");
  const url = new URL(result.link);
  if (url.protocol !== "https:" || url.hostname !== "auth.unipile.com")
    throw new Error("Destino de autenticação inesperado.");
  return { url: url.toString() };
}
export async function finishPersonalLinkedin(
  admin: SupabaseClient,
  actor: string,
  workspace: string,
  state: string,
  accountId: string,
) {
  await assertPersonalAccess(admin, actor, workspace);
  const stateHash = hash(state);
  const found = await admin
    .from("unipile_auth_flows")
    .select("id,state_hash,scope_id,expected_account_id,expires_at,consumed_at")
    .eq("workspace_id", workspace)
    .eq("owner_id", actor)
    .eq("state_hash", stateHash)
    .maybeSingle();
  checked(found.error);
  if (!found.data || found.data.consumed_at || Date.parse(found.data.expires_at) <= Date.now())
    throw new Error("Conexão expirada ou já utilizada.");
  const account = await unipileAuthRequest(`/accounts/${encodeURIComponent(accountId)}`);
  const verified = validateLinkedinCallback({
    expectedStateHash: found.data.state_hash,
    actualStateHash: stateHash,
    expectedScope: found.data.scope_id,
    expectedAccountId: found.data.expected_account_id ?? accountId,
    account,
    now: Date.now(),
    expiresAt: found.data.expires_at,
    consumed: !!found.data.consumed_at,
  });
  const completed = await admin.rpc("unipile_connect_complete", {
    p_flow: found.data.id,
    p_state_hash: stateHash,
    p_account_id: verified.id,
    p_scope_id: found.data.scope_id,
    p_name: verified.name,
  });
  checked(completed.error);
  return { ok: true, account_id: verified.id };
}
