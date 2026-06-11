// Server function admin-only que dispara reschedule_lovable_cron sem expor o CRON_SECRET ao cliente.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const rescheduleLovableCron = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Autoriza: somente super-admins (platform_admins) podem disparar.
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (adminErr) throw new Error(adminErr.message);
    if (!admin) throw new Error("Acesso restrito a super-admins.");

    // 2) Lê o CRON_SECRET no servidor (nunca exposto ao cliente).
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 16) {
      throw new Error("CRON_SECRET não configurado no ambiente do servidor.");
    }

    // 3) Executa o reschedule via RPC SECURITY DEFINER.
    const { data, error } = await supabaseAdmin.rpc(
      "reschedule_lovable_cron" as never,
      { p_secret: secret } as never,
    );
    if (error) throw new Error(error.message);

    return { ok: true, result: data };
  });
