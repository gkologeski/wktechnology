import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/signup")({
  component: SignupClosedPage,
  head: () => ({
    meta: [
      { title: "Acesso por convite — WK Technology CRM" },
      {
        name: "description",
        content:
          "O cadastro no WK Technology CRM é feito apenas por convite enviado pelo administrador do workspace.",
      },
      { property: "og:title", content: "Acesso por convite — WK Technology CRM" },
      {
        property: "og:description",
        content: "O cadastro no WK Technology CRM é feito apenas por convite.",
      },
      { property: "og:url", content: "https://ats.wktechnology.com.br/signup" },
    ],
    links: [{ rel: "canonical", href: "https://ats.wktechnology.com.br/signup" }],
  }),
});

function SignupClosedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <h1 className="sr-only">Acesso por convite ao WK Technology CRM</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acesso por convite</CardTitle>
          <CardDescription>
            Este CRM é restrito. O cadastro público está desativado — o acesso é feito apenas via
            convite enviado por um administrador do workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Já recebeu um convite? Abra o link enviado por email para concluir o acesso. Caso já
            tenha uma conta, basta entrar.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Ir para o login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
