import { test as base, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://czrmhtzaeonzjmbgbabz.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cm1odHphZW9uemptYmdiYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM4ODcsImV4cCI6MjA5NDM4OTg4N30.NZt1xBOm8e8Bcl6LKDRsfBBCY2sg_JXtMBjx8hb7sBg";

export const EMAIL = process.env.E2E_USER_EMAIL ?? process.env.E2E_EMAIL ?? "";
export const PASSWORD = process.env.E2E_USER_PASSWORD ?? process.env.E2E_PASSWORD ?? "";
export const hasE2ECredentials = Boolean(EMAIL && PASSWORD);

/** Cria um cliente supabase admin "como usuário" para seed/cleanup. */
export function makeUserClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Faz login pela UI em /login (ou /auth) e aguarda chegada ao app autenticado. */
export async function loginViaUI(page: Page) {
  await page.goto("/login");
  // Fallback se a rota for /auth
  if (!(await page.locator('input[type="email"]').first().isVisible().catch(() => false))) {
    await page.goto("/auth");
  }
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|sign in|login/i }).first().click();
  // Aguarda redirecionar para alguma rota autenticada
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
    const { data, error } = await supa.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    if (error || !data.user) throw new Error("Falha login Supabase: " + error?.message);
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
