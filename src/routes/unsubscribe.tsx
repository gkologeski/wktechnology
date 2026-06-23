import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

type State = "loading" | "valid" | "already" | "invalid" | "done" | "error" | "submitting";

function UnsubscribePage() {
  const [state, setState] = useState<State>("loading");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = new URL(window.location.href).searchParams.get("token");
    if (!t) {
      setState("invalid");
      return;
    }
    setToken(t);
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.valid) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, []);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (j.success) setState("done");
      else if (j.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {state === "loading" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Validando link…</p>
            </>
          )}
          {state === "valid" && (
            <>
              <h1 className="text-xl font-semibold">Cancelar inscrição</h1>
              <p className="text-sm text-muted-foreground">
                Confirme para parar de receber e-mails deste remetente.
              </p>
              <Button onClick={confirm} className="w-full">
                Confirmar cancelamento
              </Button>
            </>
          )}
          {state === "submitting" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Processando…</p>
            </>
          )}
          {state === "done" && (
            <>
              <h1 className="text-xl font-semibold">Pronto</h1>
              <p className="text-sm text-muted-foreground">
                Você não receberá mais e-mails deste remetente.
              </p>
            </>
          )}
          {state === "already" && (
            <>
              <h1 className="text-xl font-semibold">Já cancelado</h1>
              <p className="text-sm text-muted-foreground">Este e-mail já havia sido removido.</p>
            </>
          )}
          {(state === "invalid" || state === "error") && (
            <>
              <h1 className="text-xl font-semibold">Link inválido</h1>
              <p className="text-sm text-muted-foreground">
                Não foi possível processar este link. Ele pode ter expirado.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
