import { createFileRoute } from "@tanstack/react-router";

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
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui;background:#0b0b0c;color:#e7e7ea;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}main{max-width:480px;padding:32px;border:1px solid #2a2a2e;border-radius:12px;background:#141416}h1{margin:0 0 8px;font-size:18px}p{margin:6px 0;color:#a1a1aa;font-size:14px}a{color:#60a5fa}</style>
</head><body><main>${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/oauth/contaazul-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const errorParam = url.searchParams.get("error");
        const { verifyContaAzulState } = await import("@/lib/integrations/contaazul-state.server");
        const state = verifyContaAzulState(url.searchParams.get("state"));

        if (errorParam) {
          return htmlResponse(
            "Falha no Conta Azul",
            `<h1>O Conta Azul retornou um erro</h1><p>${esc(errorParam)}</p><p><a href="/integrations/contaazul">Voltar</a></p>`,
            400,
          );
        }
        if (!state) {
          return htmlResponse(
            "Sessão inválida",
            `<h1>Sessão de autorização inválida ou expirada</h1><p>Inicie a conexão novamente.</p><p><a href="/integrations/contaazul">Voltar</a></p>`,
            400,
          );
        }
        if (!code) {
          return htmlResponse(
            "Código ausente",
            `<h1>Autorização sem código</h1><p><a href="/integrations/contaazul">Voltar</a></p>`,
            400,
          );
        }

        try {
          const [
            { exchangeCodeForTokens, normalizeContaAzulReturnOrigin, saveTokens },
            { supabaseAdmin },
          ] = await Promise.all([
            import("@/lib/integrations/contaazul-api.server"),
            import("@/integrations/supabase/client.server"),
          ]);
          const origin = normalizeContaAzulReturnOrigin(state.origin);
          const tokens = await exchangeCodeForTokens({ code, origin });
          await saveTokens(supabaseAdmin, {
            workspaceId: state.workspaceId,
            tokens,
            config: {
              connected_by: state.userId,
              connected_at: new Date().toISOString(),
              oauth_version: "v2",
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return htmlResponse(
            "Falha ao conectar",
            `<h1>Não foi possível concluir a conexão</h1><p>${esc(message)}</p><p><a href="/integrations/contaazul">Voltar</a></p>`,
            500,
          );
        }

        const { normalizeContaAzulReturnOrigin } =
          await import("@/lib/integrations/contaazul-api.server");
        const returnOrigin = normalizeContaAzulReturnOrigin(state.origin);
        const returnUrl = `${returnOrigin}/integrations/contaazul?contaazul=connected`;
        return htmlResponse(
          "Conta Azul conectado",
          `<h1>Conta Azul conectado com sucesso</h1><p>Você já pode importar os dados no TechFinance.</p><p><a href="${esc(returnUrl)}">Voltar agora</a></p><script>
(function(){
  var url=${JSON.stringify(returnUrl)};
  if(window.opener&&!window.opener.closed){
    window.opener.postMessage({type:"contaazul-oauth-connected",url:url},${JSON.stringify(returnOrigin)});
    window.close();
    setTimeout(function(){window.location.replace(url);},800);
    return;
  }
  window.location.replace(url);
})();
</script>`,
        );
      },
    },
  },
});
