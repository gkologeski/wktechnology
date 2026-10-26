import { test as base, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { resolveE2EEnvironment } from "../../../scripts/e2e-environment.mjs";

export const EMAIL = process.env.E2E_USER_EMAIL ?? process.env.E2E_EMAIL ?? "";
export const PASSWORD = process.env.E2E_USER_PASSWORD ?? process.env.E2E_PASSWORD ?? "";

/**
 * Sessão já emitida injetada pelo ambiente (preview do editor). Serve como
 * alternativa ao password grant quando só existe sessão, sem senha.
 */
const INJECTED_SESSION = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON ?? "";

export const hasE2ECredentials = Boolean((EMAIL && PASSWORD) || INJECTED_SESSION);

/** Cria um cliente supabase admin "como usuário" para seed/cleanup. */
export function makeUserClient(): SupabaseClient {
  const config = resolveE2EEnvironment(process.env);
  return createClient(config.apiURL, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Autentica o cliente de teste: usa a sessão injetada pelo ambiente quando
 * existir, senão faz password grant com as credenciais de E2E.
 * Retorna a sessão para quem precisa injetá-la no browser.
 */
export async function authenticateTestClient(supa: SupabaseClient) {
  if (INJECTED_SESSION) {
    const parsed = JSON.parse(INJECTED_SESSION) as {
      access_token: string;
      refresh_token: string;
    };
    const { data, error } = await supa.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    });
    if (error || !data.session) {
      throw new Error("Falha ao restaurar sessão injetada: " + error?.message);
    }
    await assertIsolatedDatabase(supa);
    return data.session;
  }
  const { data, error } = await supa.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error || !data.session) throw new Error("Falha login Supabase: " + error?.message);
  await assertIsolatedDatabase(supa);
  return data.session;
}

async function assertIsolatedDatabase(supa: SupabaseClient) {
  const marker = await supa.from("__isolated_marker").select("label");
  if (marker.error || !marker.data?.some((r) => r.label === "techerp-isolated-harness")) {
    throw new Error("Missing isolated database marker; refusing E2E writes.");
  }
}

/**
 * Autentica via Supabase (sessão injetada ou password grant) e injeta a sessão
 * em localStorage, evitando fricção do form de login (Google button, etc).
 */
export async function loginViaUI(page: Page) {
  const supa = makeUserClient();
  const config = resolveE2EEnvironment(process.env);
  const session = await authenticateTestClient(supa);
  // Establish the explicitly configured local origin before storing the session.
  await page.goto(config.baseURL + "/login");
  if (new URL(page.url()).origin !== config.baseURL) throw new Error("Unexpected E2E redirect");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    config.storageKey,
    JSON.stringify(session),
  ] as const);
  await page.goto("/home");
  await page.waitForURL((url) => !/\/(login|auth)/.test(url.pathname), { timeout: 20_000 });
}

/** Wrapper test que já entrega `page` autenticada + cliente supabase user-scoped. */
export const test = base.extend<{
  authedPage: Page;
  supa: SupabaseClient;
  userId: string;
  workspaceId: string;
}>({
  supa: async ({}, use) => {
    const supa = makeUserClient();
    await authenticateTestClient(supa);
    await use(supa);
  },
  userId: async ({ supa }, use) => {
    const { data } = await supa.auth.getUser();
    await use(data.user!.id);
  },
  workspaceId: async ({ supa, userId }, use) => {
    const { data: profile } = await supa
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", userId)
      .maybeSingle();

    const activeWorkspaceId = (profile as { active_workspace_id?: string | null } | null)
      ?.active_workspace_id;

    if (activeWorkspaceId) {
      const { data: activeMember } = await supa
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .eq("workspace_id", activeWorkspaceId)
        .maybeSingle();

      if (activeMember?.workspace_id) {
        await use(activeMember.workspace_id as string);
        return;
      }
    }

    const { data: member, error } = await supa
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("Falha ao buscar workspace E2E: " + error.message);
    if (!member?.workspace_id) throw new Error("Usuário E2E não pertence a nenhum workspace.");

    await use(member.workspace_id as string);
  },
  authedPage: async ({ page }, use) => {
    await loginViaUI(page);
    await use(page);
  },
});

export { expect };
