import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { acceptEmploymentInvite } from "@/lib/hiring/employment.functions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export const Route = createFileRoute("/accept-employment/$token")({
  component: AcceptEmployment,
  head: () => ({
    meta: [
      { title: "Aceitar acesso de contratação — TechERP" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});
function AcceptEmployment() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const accept = useServerFn(acceptEmploymentInvite);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <main className="min-h-screen grid place-items-center bg-muted/30 p-6">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>Acesso pelo vínculo de contratação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            O acesso será limitado ao modelo revisado do cargo e, quando aplicável, aos projetos
            alocados. Outros vínculos e permissões manuais serão preservados.
          </p>
          {loading ? (
            <p>Verificando sessão…</p>
          ) : !user ? (
            <>
              <p>Entre com a conta do e-mail que recebeu o convite.</p>
              <Button asChild>
                <Link to="/login" search={{ next: `/accept-employment/${token}` }}>
                  Entrar na minha conta
                </Link>
              </Button>
              <p>
                <Link to="/accept-invite/$token" params={{ token }}>
                  Ainda não tenho conta
                </Link>
              </p>
            </>
          ) : (
            <>
              <p>Sessão: {user.email}</p>
              <Button
                disabled={busy || done}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await accept({ data: { token } });
                    setDone(true);
                    setMessage("Acesso aplicado. Entre no workspace indicado pelo convite.");
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : "Não foi possível aceitar.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {done ? "Convite aceito" : busy ? "Aplicando…" : "Aceitar acesso do vínculo"}
              </Button>
              {done && (
                <Button asChild variant="outline">
                  <Link to="/home">Abrir TechERP</Link>
                </Button>
              )}
            </>
          )}
          {message && <p role="status">{message}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
