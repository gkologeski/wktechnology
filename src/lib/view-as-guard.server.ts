// Bloqueia ações com efeito externo (envio de mensagens) durante o "Ver como" só leitura.
import type { SupabaseClient } from "@supabase/supabase-js";

export const VIEW_AS_READ_ONLY_MESSAGE =
  "Você está vendo o sistema como outro usuário em modo só leitura. Volte ao seu acesso para realizar esta ação.";

export async function assertNotReadOnlyView(supabase: SupabaseClient<any>): Promise<void> {
  const { data, error } = await supabase.rpc("is_read_only_view" as never);
  if (!error && data === true) {
    const { data: auth } = await supabase.auth.getUser();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: v } = await (supabaseAdmin as any)
      .from("view_as_sessions")
      .select("id")
      .eq("target_user_id", auth?.user?.id ?? "")
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (v?.id) {
      const { logBlockedWrite } = await import("@/lib/view-as.server");
      await logBlockedWrite(v.id, { kind: "send" }).catch(() => {});
    }
    throw new Error(VIEW_AS_READ_ONLY_MESSAGE);
  }
}
