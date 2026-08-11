// Renovação de URLs assinadas dos assets de branding (bucket de mídia).
// Server-only: usa supabaseAdmin apenas para reassinar/atualizar as URLs.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "media";
const SIGNED_TTL = 60 * 60 * 24 * 365 * 5; // 5 anos
const RENEW_WINDOW_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
const SIGN_MARKER = `/storage/v1/object/sign/${BUCKET}/`;

function decodeExpMs(token: string | null): number | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Retorna a URL renovada, ou null se não precisa (ou não é possível) renovar. */
async function renewOne(url: string): Promise<string | null> {
  if (!url || !url.includes(SIGN_MARKER)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const idx = parsed.pathname.indexOf(SIGN_MARKER);
  if (idx < 0) return null;
  const path = decodeURIComponent(parsed.pathname.slice(idx + SIGN_MARKER.length));
  if (!path) return null;

  const expMs = decodeExpMs(parsed.searchParams.get("token"));
  if (expMs !== null && expMs - Date.now() > RENEW_WINDOW_MS) return null;

  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}


function asThemeObject(value: unknown): { assets?: Record<string, string> | null } | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as { assets?: Record<string, string> | null };
  }
  return null;
}

/**
 * Renova as URLs de assets de branding de uma linha (logo/favicon + theme.assets).
 * Retorna a linha (possivelmente atualizada) e um patch com o que mudou.
 */
export async function refreshBrandingAssets<T extends object>(
  row: T | null,
): Promise<{ row: T | null; patch: Record<string, unknown> | null }> {
  if (!row) return { row, patch: null };

  const patch: Record<string, unknown> = {};
  const next = { ...row } as T;

  for (const key of ["logo_url", "favicon_url"] as const) {
    const current = (row as Record<string, unknown>)[key];
    if (typeof current === "string" && current) {
      const renewed = await renewOne(current);
      if (renewed) {
        (next as Record<string, unknown>)[key] = renewed;
        patch[key] = renewed;
      }
    }
  }

  const theme = asThemeObject((row as Record<string, unknown>).theme);
  const assets = theme?.assets;
  if (assets && typeof assets === "object") {
    const nextAssets: Record<string, string> = { ...assets };
    let changed = false;
    for (const [k, v] of Object.entries(assets)) {
      if (typeof v !== "string" || !v) continue;
      const renewed = await renewOne(v);
      if (renewed) {
        nextAssets[k] = renewed;
        changed = true;
      }
    }
    if (changed) {
      const nextTheme = { ...(theme as object), assets: nextAssets };
      (next as Record<string, unknown>).theme = nextTheme;
      patch.theme = nextTheme;
    }
  }

  return { row: next, patch: Object.keys(patch).length ? patch : null };
}
