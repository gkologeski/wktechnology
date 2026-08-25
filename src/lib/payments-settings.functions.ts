// Server functions para configurações de pagamentos e NFS-e por workspace (Release 15).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const PaymentsSettingsZ = z.object({
  gateway: z.enum(["asaas", "pagarme", "mercadopago", "manual"]).default("manual"),
  mode: z.enum(["sandbox", "live"]).default("sandbox"),
  default_method: z.enum(["pix", "boleto", "credit_card"]).default("pix"),
});

const NfseSettingsZ = z.object({
  provider: z.literal("nfe_io").default("nfe_io"),
  enabled: z.boolean().default(false),
  service_code: z.string().max(50).nullable().optional(),
  municipal_inscription: z.string().max(50).nullable().optional(),
  company_id_nfeio: z.string().max(120).nullable().optional(),
});

export const getPaymentsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data, error } = await supabaseAdmin
      .from("workspaces")
      .select("payments_settings,nfse_settings")
      .eq("id", workspaceId)
      .single();
    if (error) throw new Error(error.message);
    return {
      payments: data?.payments_settings ?? {},
      nfse: data?.nfse_settings ?? {},
    };
  });

export const savePaymentsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PaymentsSettingsZ.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin
      .from("workspaces")
      .update({ payments_settings: data })
      .eq("id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveNfseSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => NfseSettingsZ.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin
      .from("workspaces")
      .update({ nfse_settings: data })
      .eq("id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
