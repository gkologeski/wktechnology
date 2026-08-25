// Server fns para listagem e troca de workspace ativo do usuário logado.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Lista os workspaces dos quais o usuário logado é membro + workspace ativo.
 *  Platform admins enxergam TODOS os workspaces (mesmo sem serem membros), para
 *  conseguirem alternar e administrar qualquer cliente. */
export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Platform admin?
    const { data: pa } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const isPlatformAdmin = !!pa;

    type WsRow = {
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      primary_color: string | null;
      status: string;
    };
    let workspaces: (WsRow & { role: "admin" | "member" })[] = [];

    if (isPlatformAdmin) {
      const { data: all, error } = await supabaseAdmin
        .from("workspaces")
        .select("id, name, slug, logo_url, primary_color, status")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      workspaces = (all ?? []).map((w) => ({ ...(w as WsRow), role: "admin" as const }));
    } else {
      const { data: members, error } = await supabaseAdmin
        .from("workspace_members")
        .select(
          "workspace_id, role, workspaces:workspace_id(id, name, slug, logo_url, primary_color, status)",
        )
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      workspaces = (members ?? [])
        .map((m) => {
          const w = (m as { workspaces: WsRow | null }).workspaces;
          if (!w) return null;
          return { ...w, role: m.role as "admin" | "member" };
        })
        .filter((x): x is WsRow & { role: "admin" | "member" } => !!x);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", context.userId)
      .maybeSingle();

    let active =
      (profile as { active_workspace_id: string | null } | null)?.active_workspace_id ?? null;
    if (active && !workspaces.some((w) => w.id === active)) active = null;
    if (!active && workspaces.length > 0) active = workspaces[0].id;

    return { workspaces, active_workspace_id: active };
  });

/** Define o workspace ativo do usuário logado. */
export const setActiveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Platform admins podem alternar para qualquer workspace.
    const { data: pa } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!pa) {
      const { data: m, error: mErr } = await supabaseAdmin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", context.userId)
        .eq("workspace_id", data.workspace_id)
        .maybeSingle();
      if (mErr) throw new Error(mErr.message);
      if (!m) throw new Error("Você não é membro desse workspace.");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: context.userId, active_workspace_id: data.workspace_id } as never, {
        onConflict: "id",
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
