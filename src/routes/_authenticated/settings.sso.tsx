import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/sso")({
  component: SsoPage,
});

function SsoPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> SSO — SAML / OIDC
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecte o login do seu workspace ao seu provedor de identidade corporativo (Okta, Azure AD
          / Entra ID, Google Workspace).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SAML 2.0</CardTitle>
          <CardDescription>
            Para configurar SAML, peça ao seu administrador Lovable que acione a configuração de SSO
            no Lovable Cloud — você receberá a <strong>ACS URL</strong> e o{" "}
            <strong>Entity ID</strong> deste workspace para colar no IdP, e em seguida o
            <strong> metadata URL</strong> do IdP é registrado aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">JIT provisioning</Badge>
            <Badge variant="outline">Mapping por grupo</Badge>
            <Badge variant="outline">Force-SSO opcional</Badge>
          </div>
          <p className="text-sm">
            Solicite no chat:{" "}
            <em>"Configurar SAML SSO para os domínios x.com, y.com com metadata https://…"</em>. O
            assistente usa a ferramenta nativa do Lovable Cloud para registrar o IdP e mostrar os
            endpoints SP.
          </p>
          <Button variant="outline" asChild>
            <a href="https://docs.lovable.dev/features/security" target="_blank" rel="noreferrer">
              Documentação <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OIDC</CardTitle>
          <CardDescription>
            OIDC pode ser configurado via Google sign-in nativo. Para outros IdPs OIDC genéricos,
            use SAML.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
