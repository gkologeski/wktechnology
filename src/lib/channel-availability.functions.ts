import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { twilioEnvReady, type ChannelAvailability } from "@/lib/channel-availability";

// Indica quais canais de envio da timeline estão configurados para o usuário/workspace.
export const getChannelAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChannelAvailability> => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [wa, mail, cal, health] = await Promise.all([
      supabase.from("wa_phone_numbers").select("id").eq("workspace_id", ws).limit(1),
      supabase.from("email_accounts").select("status"),
      supabaseAdmin.from("calendar_accounts").select("id").eq("workspace_id", ws).limit(1),
      supabase
        .from("channel_health_checks")
        .select("ready, reason, transient")
        .eq("channel", "call")
        .maybeSingle(),
    ]);

    const envReady = twilioEnvReady({
      accountSid: process.env.TWILIO_ACCOUNT_SID?.trim(),
      apiKeySid: process.env.TWILIO_API_KEY_SID?.trim(),
      apiKeySecret: process.env.TWILIO_API_KEY_SECRET?.trim(),
      twimlAppSid: process.env.TWILIO_TWIML_APP_SID?.trim(),
    });
    // Sem teste gravado ou falha transitória = liberado; recusa confirmada = bloqueado.
    const h = health.data;
    const probeBlocks = !!h && !h.ready && !h.transient;
    const callReady = envReady && !probeBlocks;
    const callReason = !envReady
      ? "Telefonia não configurada"
      : (h?.reason ?? "Telefonia com credenciais inválidas");

    // Em caso de erro de consulta, libera o canal (o envio mantém seu próprio aviso).
    return {
      whatsapp: wa.error
        ? { ready: true }
        : { ready: (wa.data ?? []).length > 0, reason: "WhatsApp não configurado" },
      email: mail.error
        ? { ready: true }
        : {
            ready: (mail.data ?? []).some((a) => a.status === "connected"),
            reason: "E-mail não configurado",
          },
      call: { ready: callReady, reason: callReason },
      meeting: cal.error
        ? { ready: true }
        : { ready: (cal.data ?? []).length > 0, reason: "Agenda não conectada" },
    };
  });
