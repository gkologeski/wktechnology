import { assertSalesSourcePermission } from "@/lib/access-control/sales-source-permission.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { requireSourceWorkspaceAccess } from "@/lib/workspace-source.server";
import { createFileRoute } from "@tanstack/react-router";

import {
  buildGoogleOAuthReturnUrl,
  callbackRedirectUri,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  isAllowedGoogleOAuthReturnOrigin,
  normalizeOrigin,
  verifyState,
} from "@/lib/email-oauth.server";

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlResponse(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui;background:#0b0b0c;color:#e7e7ea;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}main{max-width:480px;padding:32px;border:1px solid #2a2a2e;border-radius:12px;background:#141416}h1{margin:0 0 8px;font-size:18px}p{margin:6px 0;color:#a1a1aa;font-size:14px}a{color:#60a5fa}</style>
</head><body><main>${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function connectedResponse(opts: {
  returnTo: string;
  integration: "calendar" | "gmail";
  messageTargetOrigin?: string;
}) {
  const queryKey = opts.integration === "calendar" ? "calendar" : "gmail";
  const connectedUrl = `${opts.returnTo}${opts.returnTo.includes("?") ? "&" : "?"}${queryKey}=connected`;
  const messageTargetOrigin =
    opts.messageTargetOrigin && isAllowedGoogleOAuthReturnOrigin(opts.messageTargetOrigin)
      ? normalizeOrigin(opts.messageTargetOrigin)
      : "";
  const payload = JSON.stringify({
    type: "google-oauth-connected",
    integration: opts.integration,
    url: connectedUrl,
  });

  return htmlResponse(
    "Google conectado",
    `<h1>Google conectado com sucesso</h1><p>Você já pode voltar ao CRM.</p><p><a href="${esc(connectedUrl)}">Voltar agora</a></p><script>
(function () {
  var payload = ${payload};
  var messageTargetOrigin = ${JSON.stringify(messageTargetOrigin)};
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(payload, messageTargetOrigin || window.location.origin);
    window.close();
    setTimeout(function () { window.location.replace(payload.url); }, 800);
    return;
  }
  window.location.replace(payload.url);
})();
</script>`,
  );
}

export const Route = createFileRoute("/api/public/oauth/google-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");

        if (errorParam) {
          return htmlResponse(
            "Falha no Google",
            `<h1>Google retornou erro</h1><p>${esc(errorParam)}</p><p><a href="/settings/email">Voltar</a></p>`,
            400,
          );
        }
        if (!code || !state) {
          return htmlResponse("Parâmetros faltando", `<h1>Requisição inválida</h1>`, 400);
        }

        let parsed: {
          workspace_id?: string;
          user_id: string;
          return_to?: string;
          return_origin?: string;
          mode?: string;
        };
        try {
          parsed = verifyState(state);
        } catch (e) {
          return htmlResponse(
            "State inválido",
            `<h1>State inválido</h1><p>${esc(e instanceof Error ? e.message : "")}</p>`,
            400,
          );
        }

        const redirectUri = callbackRedirectUri(new URL(request.url).origin);
        const mode = parsed.mode === "calendar" ? "calendar" : "gmail";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const workspaceId = await requireSourceWorkspaceAccess(
            supabaseAdmin,
            parsed.user_id,
            parsed.workspace_id,
          );
          await assertSalesSourcePermission(
            supabaseAdmin,
            parsed.user_id,
            workspaceId,
            mode === "calendar" ? "system.calendars" : "techsales.email_accounts",
            ["create", "update"],
          );
          const tokens = await exchangeCodeForTokens({ code, redirectUri });
          const info = await fetchGoogleUserInfo(tokens.access_token);
          const scopes = tokens.scope ? tokens.scope.split(" ") : [];
          const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

          const savedId = await workRpc<string>(supabaseAdmin, "sales_save_google_account", {
            p_actor: parsed.user_id,
            p_ws: workspaceId,
            p_kind: mode,
            p_payload: {
              email: info.email,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token ?? null,
              expires_at: expiresAt,
              scopes,
            },
          });
          if (!savedId) throw new Error("Não foi possível concluir a conexão.");
          if (mode === "calendar") {
            const returnTo = buildGoogleOAuthReturnUrl({
              returnOrigin: parsed.return_origin,
              returnTo: parsed.return_to,
              fallbackPath: "/settings/calendars",
            });
            return connectedResponse({
              returnTo,
              integration: "calendar",
              messageTargetOrigin: parsed.return_origin,
            });
          }

          const returnTo = buildGoogleOAuthReturnUrl({
            returnOrigin: parsed.return_origin,
            returnTo: parsed.return_to,
            fallbackPath: "/settings/email",
          });
          return connectedResponse({
            returnTo,
            integration: "gmail",
            messageTargetOrigin: parsed.return_origin,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro desconhecido";
          return htmlResponse(
            "Falha ao conectar",
            `<h1>Falha ao conectar</h1><p>${esc(msg)}</p><p><a href="/settings/calendars">Voltar</a></p>`,
            500,
          );
        }
      },
    },
  },
});
