import { formatDateTime } from "@/lib/crm";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEsignSession, submitEsignSignature, declineEsign } from "@/lib/esign.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, FileSignature, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/sign/$token")({
  component: SignPage,
});

const SIGNER_LABEL: Record<string, string> = {
  pending: "Pendente",
  viewed: "Visualizado",
  signed: "Assinado",
  declined: "Recusado",
};

function SignPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getEsignSession);
  const submit = useServerFn(submitEsignSignature);
  const decline = useServerFn(declineEsign);

  const { data, isLoading, error } = useQuery({
    queryKey: ["esign-session", token],
    queryFn: () => get({ data: { token } }),
    retry: false,
  });

  const [name, setName] = useState("");
  const [accept, setAccept] = useState(false);
  const [reason, setReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);

  const signMut = useMutation({
    mutationFn: () => submit({ data: { token, signedName: name } }),
    onSuccess: () => {
      toast.success("Documento assinado.");
      qc.invalidateQueries({ queryKey: ["esign-session", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const declineMut = useMutation({
    mutationFn: () => decline({ data: { token, reason } }),
    onSuccess: () => {
      toast.success("Você recusou este documento.");
      qc.invalidateQueries({ queryKey: ["esign-session", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading)
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>
    );
  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Link inválido</CardTitle>
          </CardHeader>
          <CardContent>Este link de assinatura é inválido, expirou ou foi cancelado.</CardContent>
        </Card>
      </div>
    );
  }

  const { doc, signer, signers, canSign } = data;
  const alreadySigned = signer.status === "signed";
  const alreadyDeclined = signer.status === "declined";

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <FileSignature className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">{doc.title}</h1>
          <Badge variant="outline" className="ml-auto">
            {doc.status}
          </Badge>
        </div>
        {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-background p-4 whitespace-pre-wrap text-sm max-h-[60vh] overflow-y-auto">
              {doc.body}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signatários</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {signers.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded border p-2 ${s.id === signer.id ? "border-primary bg-primary/5" : ""}`}
              >
                <div>
                  <div className="text-sm font-medium">
                    {s.name}{" "}
                    {s.id === signer.id && <span className="text-xs text-primary">(você)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.email} · ordem {s.sign_order}
                  </div>
                </div>
                <Badge
                  variant={
                    s.status === "signed"
                      ? "default"
                      : s.status === "declined"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {SIGNER_LABEL[s.status] ?? s.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {alreadySigned ? (
          <Card className="border-primary">
            <CardContent className="py-6 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <div>
                <div className="font-medium">Você já assinou este documento.</div>
                <div className="text-xs text-muted-foreground">
                  Assinado em {formatDateTime(signer.signed_at!)}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : alreadyDeclined ? (
          <Card className="border-destructive">
            <CardContent className="py-6 flex items-center gap-3">
              <XCircle className="h-6 w-6 text-destructive" />
              <div>
                <div className="font-medium">Você recusou este documento.</div>
                {signer.decline_reason && (
                  <div className="text-xs text-muted-foreground">{signer.decline_reason}</div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : !canSign ? (
          <Card>
            <CardContent className="py-6 text-muted-foreground text-sm">
              Aguardando assinatura dos signatários anteriores. Você será notificado quando for sua
              vez.
            </CardContent>
          </Card>
        ) : showDecline ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recusar assinatura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label>Motivo (opcional)</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDecline(false)}>
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => declineMut.mutate()}
                  disabled={declineMut.isPending}
                >
                  {declineMut.isPending ? "Enviando…" : "Confirmar recusa"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assinar eletronicamente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Digite seu nome completo *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={signer.name}
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={accept}
                  onCheckedChange={(v) => setAccept(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Li o documento acima e concordo em assiná-lo eletronicamente. Entendo que esta
                  assinatura tem validade legal e ficará registrada com meu IP e horário.
                </span>
              </label>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDecline(true)}>
                  Recusar
                </Button>
                <Button
                  onClick={() => signMut.mutate()}
                  disabled={!accept || name.length < 2 || signMut.isPending}
                >
                  {signMut.isPending ? "Assinando…" : "Assinar agora"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground pt-4">
          Assinatura eletrônica registrada com trilha de auditoria (IP, navegador e horário).
        </p>
      </div>
    </div>
  );
}
