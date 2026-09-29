import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXTERNAL_PROVIDER_IDS } from "./providers";

const ProviderId = z.enum(["lovable", ...EXTERNAL_PROVIDER_IDS]);
const External = z.enum(EXTERNAL_PROVIDER_IDS);

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAiSettings } = await import("./ai-settings.server");
    return loadAiSettings(context.supabase, context.userId);
  });

export const saveAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider: External,
        apiKey: z.string().trim().max(500).optional(),
        model: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { saveCredential } = await import("./ai-settings.server");
    return saveCredential(context.supabase, context.userId, data);
  });

export const testAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ provider: ProviderId }).parse(d))
  .handler(async ({ data, context }) => {
    const { testProvider } = await import("./ai-settings.server");
    return testProvider(context.supabase, context.userId, data.provider);
  });

export const setActiveAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ provider: ProviderId }).parse(d))
  .handler(async ({ data, context }) => {
    const { setActive } = await import("./ai-settings.server");
    return setActive(context.supabase, context.userId, data.provider);
  });

export const removeAiCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ provider: External }).parse(d))
  .handler(async ({ data, context }) => {
    const { removeCredential } = await import("./ai-settings.server");
    return removeCredential(context.supabase, context.userId, data.provider);
  });
