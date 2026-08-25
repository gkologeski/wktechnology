import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/unipile-connected")({
  // Aceita qualquer query (Unipile pode anexar parâmetros próprios)
  validateSearch: (s: Record<string, unknown>) => s,
  component: UnipileConnectedPage,
});

function UnipileConnectedPage() {
  const search = Route.useSearch() as Record<string, unknown>;
  const ok = search.connected !== "0";
  // Na API v2 o hosted auth não aceita mais notify_url/name: o connect_token
  // volta como `state` e precisa chegar na tela de settings para reconciliação.
  const state = typeof search.state === "string" ? search.state : "";
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Aguarda hidratar sessão e redireciona automaticamente para a tela de settings
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setRedirecting(true);
        const qs = new URLSearchParams({ connected: ok ? "1" : "0" });
        if (state) qs.set("state", state);
        window.location.replace(`/settings/integrations/linkedin?${qs.toString()}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ok, state]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 border rounded-lg p-8 bg-card">
        {ok ? (
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
        ) : (
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
        )}
        <h1 className="text-xl font-semibold">
          {ok ? "Conta LinkedIn conectada" : "Falha ao conectar"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ok
            ? "Sua conta foi conectada via Unipile. Redirecionando para as configurações…"
            : "Não foi possível concluir a conexão. Tente novamente."}
        </p>
        {!redirecting && (
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link to="/settings/integrations/linkedin">Ir para configurações</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/login">Fazer login</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
