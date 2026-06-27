// Helpers compartilhados pelos endpoints públicos /api/public/hunting/*
// usados pela extensão Chrome do TechHire Hunter.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function normalizeLinkedinUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return (url || "").trim().toLowerCase();
  }
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
  "Access-Control-Max-Age": "86400",
};

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

export type CapturedProfile = {
  linkedin_url: string;
  full_name?: string;
  current_position?: string;
  current_company?: string;
  location?: string;
  source?: string;
};

export async function findCandidateByLinkedinUrl(ownerId: string, linkedinUrl: string) {
  const normalized = normalizeLinkedinUrl(linkedinUrl);
  const { data } = await supabaseAdmin
    .from("ats_candidates")
    .select("id, full_name, current_position, current_company, location")
    .eq("owner_id", ownerId)
    .ilike("linkedin_url", normalized)
    .maybeSingle();
  return data ?? null;
}

export function renderTemplateString(
  template: string | null | undefined,
  profile: CapturedProfile,
): string {
  const firstName = (profile.full_name ?? "").split(/\s+/)[0] ?? "";
  const vars: Record<string, string> = {
    nome: profile.full_name ?? "",
    primeiro_nome: firstName,
    empresa_atual: profile.current_company ?? "",
    cargo_atual: profile.current_position ?? "",
    localizacao: profile.location ?? "",
  };
  return (template ?? "").replace(
    /\{\{\s*([a-z_]+)\s*\}\}/gi,
    (_m, k: string) => vars[k.toLowerCase()] ?? "",
  );
}
