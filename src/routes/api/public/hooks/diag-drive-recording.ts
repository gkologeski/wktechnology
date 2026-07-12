// Temporary diagnostic route — remove after Phase 1 restoration.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EPHEMERAL_TOKEN = "a71fd0e9c3b74a02a3f6d7c1e5b8c942";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function refresh(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const j = (await res.json()) as { access_token?: string; error?: string };
  if (!j.access_token) throw new Error(`refresh failed: ${JSON.stringify(j)}`);
  return j.access_token;
}

export const Route = createFileRoute("/api/public/hooks/diag-drive-recording")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("t") !== EPHEMERAL_TOKEN) {
          return new Response("Unauthorized", { status: 401 });
        }
        const accountEmail = url.searchParams.get("email") ?? "guilherme@wktechnology.com.br";
        const q = url.searchParams.get("q") ?? "MOBICONN";
        const after = url.searchParams.get("after") ?? "2026-07-06T00:00:00Z";
        const before = url.searchParams.get("before") ?? "2026-07-09T00:00:00Z";

        const { data: acct } = await supabaseAdmin
          .from("calendar_accounts")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select("id,email,refresh_token" as any)
          .eq("email", accountEmail)
          .maybeSingle();
        if (!acct) return Response.json({ ok: false, error: "account not found" }, { status: 404 });
        const token = await refresh(
          (acct as unknown as { refresh_token: string }).refresh_token,
        );

        const query = `name contains '${q.replace(/'/g, "\\'")}' and (mimeType='video/mp4' or mimeType contains 'video/') and createdTime > '${after}' and createdTime < '${before}' and trashed = false`;
        const params = new URLSearchParams({
          q: query,
          fields:
            "files(id,name,mimeType,webViewLink,createdTime,owners(emailAddress))",
          pageSize: "25",
          orderBy: "createdTime desc",
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
          corpora: "allDrives",
        });
        const r = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await r.text();
        return new Response(body, {
          status: r.status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
