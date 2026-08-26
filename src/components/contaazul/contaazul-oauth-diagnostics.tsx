import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { contaAzulOAuthDiagnostics } from "@/lib/integrations/contaazul.functions";

type OAuthDiagnostic = {
  stage: string;
  status: "pending" | "error";
  code: string | null;
  message: string;
  occurredAt: string;
};

type DiagnosticsData = {
  configured: boolean;
  oauthVersion: string;
  authorizationUrl: string;
  tokenUrl: string;
  callback: string;
  scopes: string[];
  returnOrigin: string;
  clientIdMasked: string | null;
  checks: Record<string, boolean>;
  lastDiagnostic: OAuthDiagnostic | null;
};

const STAGE_LABELS: Record<string, string> = {
  configuracao_local: "Configuração local",
  autorizacao_provedor: "Autorização no Conta Azul",
  callback: "Callback",
  troca_token: "Troca de token",
  renovacao: "Renovação do token",
};

function copyValue(value: string, label: string) {
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copiado.`),
    () => toast.error("Não foi possível copiar."),
  );
}

function DiagnosticValue({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex min-w-0 items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 text-xs text-foreground">
          {value}
        </code>
        {copyable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => copyValue(value, label)}
            aria-label={`Copiar ${label}`}
          >
            <Copy className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StatusNotice({ diagnostic }: { diagnostic: OAuthDiagnostic | null }) {
  if (!diagnostic) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        Nenhuma falha OAuth registrada neste workspace.
      </div>
    );
  }

  const isError = diagnostic.status === "error";
  return (
    <div className={`rounded-md border p-4 ${isError ? "border-destructive/40" : "border-border"}`}>
      <div className="flex items-start gap-3">
        {isError ? (
          <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
        )}
        <div className="space-y-1 text-sm">
          <p className="font-medium">
            {isError ? "Último erro" : "Autorização aguardando retorno"} —{" "}
            {STAGE_LABELS[diagnostic.stage] ?? diagnostic.stage}
          </p>
          <p className="text-muted-foreground">{diagnostic.message}</p>
          <p className="text-xs text-muted-foreground">
            {diagnostic.code ? `Código: ${diagnostic.code} · ` : ""}
            {new Date(diagnostic.occurredAt).toLocaleString("pt-BR")}
          </p>
          {diagnostic.stage === "autorizacao_provedor" ? (
            <p className="text-xs text-muted-foreground">
              Se a tela do Conta Azul disser que não foi possível autorizar, confira o cliente, o
              callback cadastrado e os escopos do aplicativo.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ContaAzulOAuthDiagnostics() {
  const [open, setOpen] = useState(false);
  const diagnostics = useServerFn(contaAzulOAuthDiagnostics);
  const query = useQuery({
    queryKey: ["contaazul", "oauth-diagnostics"],
    queryFn: () =>
      diagnostics({ data: { origin: window.location.origin } }) as Promise<DiagnosticsData>,
    enabled: open,
    staleTime: 30_000,
  });

  const data = query.data;
  const failedChecks = data ? Object.values(data.checks).some((value) => !value) : false;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Diagnóstico OAuth
              </CardTitle>
              <CardDescription>
                Confira os valores efetivos usados na autenticação sem exibir credenciais.
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" aria-expanded={open}>
                {open ? "Ocultar" : "Ver diagnóstico"}
                <ChevronDown
                  className={`ml-2 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-5 border-t pt-5">
            {query.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : query.isError ? (
              <div
                role="alert"
                className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 p-3 text-sm"
              >
                <span>Não foi possível carregar o diagnóstico.</span>
                <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : data ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={data.configured ? "secondary" : "destructive"}>
                    {data.configured ? "Credenciais configuradas" : "Credenciais ausentes"}
                  </Badge>
                  <Badge variant="outline">OAuth {data.oauthVersion}</Badge>
                  <Badge variant={failedChecks ? "destructive" : "outline"}>
                    {failedChecks ? "Verificações com alerta" : "Verificações aprovadas"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void query.refetch()}
                    disabled={query.isFetching}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
                    />
                    Atualizar
                  </Button>
                </div>

                <StatusNotice diagnostic={data.lastDiagnostic} />

                <div className="grid gap-4 lg:grid-cols-2">
                  <DiagnosticValue
                    label="URL de autorização (sanitizada)"
                    value={data.authorizationUrl}
                    copyable
                  />
                  <DiagnosticValue label="Endpoint de token" value={data.tokenUrl} copyable />
                  <DiagnosticValue label="Callback exato" value={data.callback} copyable />
                  <DiagnosticValue label="Origem de retorno" value={data.returnOrigin} copyable />
                  <DiagnosticValue label="Escopos" value={data.scopes.join(" ")} copyable />
                  <DiagnosticValue
                    label="Cliente (mascarado)"
                    value={data.clientIdMasked ?? "Não configurado"}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
