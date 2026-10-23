// Server functions para configurações de pagamentos e NFS-e por workspace (Release 15).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readWorkspaceSettings, writeWorkspaceSettings } from "@/lib/workspace-settings.server";

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
  .handler(async ({ context }) => ({
    payments: PaymentsSettingsZ.parse(
      await readWorkspaceSettings(context.supabase, context.userId, "payments"),
    ),
  }));

export const getNfseSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    nfse: NfseSettingsZ.parse(
      await readWorkspaceSettings(context.supabase, context.userId, "nfse"),
    ),
  }));

export const savePaymentsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PaymentsSettingsZ.parse(d))
  .handler(async ({ data, context }) => {
    await writeWorkspaceSettings(context.supabase, context.userId, "payments", data);
    return { ok: true };
  });

export const saveNfseSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => NfseSettingsZ.parse(d))
  .handler(async ({ data, context }) => {
    await writeWorkspaceSettings(context.supabase, context.userId, "nfse", data);
    return { ok: true };
  });
