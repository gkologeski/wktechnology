// TEMPORARY diagnostic route (Fase A). DELETE after use.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/diag-drive-recording")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret");
        if (secret !== process.env.CRON_SECRET) {
          return new Response("forbidden", { status: 403 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Load organizer's calendar account.
        const { data: acct } = await supabaseAdmin
          .from("calendar_accounts")
          .select("id, email, access_token, refresh_token, expires_at")
          .eq("email", "guilherme@wktechnology.com.br")
          .maybeSingle();

        if (!acct) return new Response("no calendar account", { status: 404 });

        // Refresh token if expiring/expired.
        let token = acct.access_token as string | null;
        const expMs = acct.expires_at ? new Date(acct.expires_at).getTime() : 0;
        if (!token || Date.now() >= expMs - 30_000) {
          const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
          if (!clientId || !clientSecret || !acct.refresh_token) {
            return Response.json({ error: "missing oauth creds or refresh_token" }, { status: 500 });
          }
          const r = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: acct.refresh_token as string,
              grant_type: "refresh_token",
            }).toString(),
          });
          if (!r.ok) {
            return Response.json({ error: `refresh failed ${r.status}`, body: await r.text() }, { status: 500 });
          }
          const j = (await r.json()) as { access_token: string; expires_in: number };
          token = j.access_token;
          await supabaseAdmin
            .from("calendar_accounts")
            .update({
              access_token: j.access_token,
              expires_at: new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString(),
            })
            .eq("id", acct.id);
        }

        const DRIVE = "https://www.googleapis.com/drive/v3";
        const runQuery = async (label: string, q: string) => {
          const params = new URLSearchParams({
            q,
            fields:
              "files(id,name,mimeType,size,createdTime,modifiedTime,owners(emailAddress,displayName),webViewLink,driveId,parents)",
            includeItemsFromAllDrives: "true",
            supportsAllDrives: "true",
            corpora: "allDrives",
            orderBy: "createdTime desc",
            pageSize: "50",
          });
          const res = await fetch(`${DRIVE}/files?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            return { label, q, error: `${res.status}: ${(await res.text()).slice(0, 300)}` };
          }
          const j = (await res.json()) as { files?: unknown[] };
          return { label, q, count: j.files?.length ?? 0, files: j.files ?? [] };
        };

        // Wide diagnostic windows around 2026-07-07 for meet "guh-vibx-qrp".
        const dayStart = "2026-07-07T00:00:00Z";
        const dayEnd = "2026-07-08T12:00:00Z";
        const videoMime = "(mimeType='video/mp4' or mimeType contains 'video/')";

        const results = await Promise.all([
          runQuery(
            "meet-code strict",
            `name contains 'guh-vibx-qrp' and trashed=false`,
          ),
          runQuery(
            "meet-code fragments",
            `(name contains 'guh' or name contains 'vibx' or name contains 'qrp') and ${videoMime} and createdTime > '${dayStart}' and createdTime < '${dayEnd}' and trashed=false`,
          ),
          runQuery(
            "title fragments",
            `(name contains 'LUMINA' or name contains 'NORA' or name contains 'WK Technology') and ${videoMime} and createdTime > '${dayStart}' and createdTime < '${dayEnd}' and trashed=false`,
          ),
          runQuery(
            "any video on 2026-07-07",
            `${videoMime} and createdTime > '${dayStart}' and createdTime < '${dayEnd}' and trashed=false`,
          ),
          runQuery(
            "sharedWithMe videos 07/07",
            `${videoMime} and sharedWithMe=true and createdTime > '${dayStart}' and createdTime < '${dayEnd}' and trashed=false`,
          ),
          runQuery(
            "Meet Recordings folder listing",
            `name='Meet Recordings' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          ),
          runQuery(
            "all guh-vibx-qrp anywhere",
            `fullText contains 'guh-vibx-qrp' and trashed=false`,
          ),
        ]);

        return Response.json({ organizer: acct.email, results }, { status: 200 });
      },
    },
  },
});
