/**
 * Helpers server-only para a API pública do ATS (`/api/public/v1/ats/*`).
 * - Verifica a feature flag `ats.platform.public_api` por workspace.
 * - Mantém respostas e erros padronizados.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ATS_PUBLIC_API_FLAG = "ats.platform.public_api";

export async function isAtsPublicApiEnabled(ownerId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("feature_flags")
    .select("enabled, rollout_percentage")
    .eq("owner_id", ownerId)
    .eq("key", ATS_PUBLIC_API_FLAG)
    .maybeSingle();
  if (!data) return false;
  if (!data.enabled) return false;
  // rollout_percentage controla rollout gradual a usuários no useFeatureFlag;
  // para API pública (chave de workspace) tratamos como ligado se >0.
  return (data.rollout_percentage ?? 100) > 0;
}

export function flagDisabled() {
  return new Response(
    JSON.stringify({
      error: "feature_disabled",
      flag: ATS_PUBLIC_API_FLAG,
      message: "Ative a flag ats.platform.public_api para este workspace.",
    }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

export function badRequest(details: unknown) {
  return new Response(JSON.stringify({ error: "invalid_input", details }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export function notFound() {
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
