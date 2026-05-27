import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/signup")({
  component: SignupClosedPage,
});

function SignupClosedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acesso por convite</CardTitle>
          <CardDescription>
            Este CRM é restrito. O cadastro público está desativado — o acesso é
            feito apenas via convite enviado por um administrador do workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Já recebeu um convite? Abra o link enviado por email para concluir o
            acesso. Caso já tenha uma conta, basta entrar.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Ir para o login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
