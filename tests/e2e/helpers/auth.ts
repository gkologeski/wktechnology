import { test as base, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://czrmhtzaeonzjmbgbabz.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cm1odHphZW9uemptYmdiYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM4ODcsImV4cCI6MjA5NDM4OTg4N30.NZt1xBOm8e8Bcl6LKDRsfBBCY2sg_JXtMBjx8hb7sBg";

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
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
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
    return data.session;
  }
  const { data, error } = await supa.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error || !data.session) throw new Error("Falha login Supabase: " + error?.message);
  return data.session;
}

const STORAGE_KEY = "sb-czrmhtzaeonzjmbgbabz-auth-token";

/**
 * Autentica via Supabase (sessão injetada ou password grant) e injeta a sessão
 * em localStorage, evitando fricção do form de login (Google button, etc).
 */
export async function loginViaUI(page: Page) {
  const supa = makeUserClient();
  const session = await authenticateTestClient(supa);
  // Precisa estabelecer origin localhost/prod antes do localStorage.setItem
  await page.goto("/login");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    STORAGE_KEY,
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
