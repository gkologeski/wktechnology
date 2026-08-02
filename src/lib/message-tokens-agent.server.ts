// Contexto do remetente ({{agent.name}} / {{agent.email}}) para motores que
// rodam no servidor (workers de sequências, sourcing, etc.).
// `profiles` não guarda e-mail, então o e-mail vem do Auth quando disponível.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentContext = { name: string | null; email: string | null };

export async function loadAgentContext(
  admin: SupabaseClient,
  ownerId: string | null | undefined,
): Promise<AgentContext> {
  if (!ownerId) return { name: null, email: null };
  let name: string | null = null;
  let email: string | null = null;
  try {
    const { data } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", ownerId)
      .maybeSingle();
    name = ((data as { full_name?: string | null } | null)?.full_name ?? null) || null;
  } catch {
    // segue sem nome
  }
  try {
    const auth = (
      admin as unknown as {
        auth?: {
          admin?: {
            getUserById?: (
              id: string,
            ) => Promise<{ data?: { user?: { email?: string | null } | null } }>;
          };
        };
      }
    ).auth;
    if (auth?.admin?.getUserById) {
      const res = await auth.admin.getUserById(ownerId);
      email = res?.data?.user?.email ?? null;
    }
  } catch {
    // segue sem e-mail
  }
  return { name, email };
}
