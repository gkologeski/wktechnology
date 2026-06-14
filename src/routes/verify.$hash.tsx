import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { verifyEsignHash } from "@/lib/proposals.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/verify/$hash")({
  head: () => ({
    meta: [
      { title: "Verificação de documento" },
      { name: "description", content: "Verifique a autenticidade de um documento assinado." },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { hash } = Route.useParams();
  const verify = useServerFn(verifyEsignHash);
  const { data, isLoading } = useQuery({
    queryKey: ["verify", hash],
    queryFn: () => verify({ data: { hash } }),
  });

  return (
    <div className="mx-auto max-w-xl p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {data?.found ? (
              <ShieldCheck className="h-5 w-5 text-primary" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            )}
            Verificação de documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Verificando…</p>}
          {!isLoading && !data?.found && (
            <p className="text-sm text-destructive">
              Hash não encontrado. Documento inválido ou não selado.
            </p>
          )}
          {data?.found && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Documento:</span> {data.title}
              </div>
              <div>
                <span className="font-medium">Status:</span> <Badge>{data.status}</Badge>
              </div>
              <div>
                <span className="font-medium">Selado em:</span>{" "}
                {data.sealed_at ? formatDateTime(data.sealed_at) : "—"}
              </div>
              <div>
                <span className="font-medium">Assinaturas:</span> {data.signed_count} /{" "}
                {data.signers_count}
              </div>
              <div className="break-all rounded bg-muted p-2 font-mono text-xs">{hash}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
