// Aceite do cliente: opcional por projeto e registrado manualmente com evidência pelo aprovador.
// Não há portal nem envio de e-mail: o sistema não afirma que o cliente validou sozinho.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { SectionHeader, EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listClientAcceptances,
  recordClientAcceptance,
  setClientAcceptanceRequired,
  voidClientAcceptance,
} from "@/lib/projects/time-governance.functions";
import { formatSeconds } from "@/lib/projects/time-entry.shared";

const br = (iso: string) => iso.split("-").reverse().join("/");
const STATUS = { accepted: "Aceito", contested: "Contestado", voided: "Anulado" } as Record<
  string,
  string
>;

export function ProjectAcceptanceCard({
  projectId,
  from,
  to,
}: {
  projectId: string;
  from: string;
  to: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listClientAcceptances);
  const recordFn = useServerFn(recordClientAcceptance);
  const voidFn = useServerFn(voidClientAcceptance);
  const toggleFn = useServerFn(setClientAcceptanceRequired);

  const [status, setStatus] = useState<"accepted" | "contested">("accepted");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [evidence, setEvidence] = useState("");
  const [reference, setReference] = useState("");

  const q = useQuery({
    queryKey: ["project-acceptances", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["project-acceptances", projectId] });
    void qc.invalidateQueries({ queryKey: ["close-preview"] });
  };

  const toggle = useMutation({
    mutationFn: (required: boolean) => toggleFn({ data: { projectId, required } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const record = useMutation({
    mutationFn: () =>
      recordFn({
        data: { projectId, from, to, status, clientName, clientEmail, evidence, reference },
      }),
    onSuccess: (r) => {
      toast.success(
        `Aceite registrado: ${r.entries} apontamento(s), ${formatSeconds(r.total_seconds)}`,
      );
      setEvidence("");
      setReference("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const voidMut = useMutation({
    mutationFn: (v: { id: string; reason: string }) => voidFn({ data: v }),
    onSuccess: () => {
      toast.success("Aceite anulado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const required = q.data?.required ?? false;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <SectionHeader
        title="Aceite do cliente"
        description="Opcional. Quando ligado, o fechamento exige aceite registrado das horas aprovadas. O registro é manual, com evidência (ata, e-mail, assinatura) — o sistema não envia nada ao cliente."
      />
      <div className="flex items-center gap-2">
        <Switch
          id="acc-required"
          checked={required}
          disabled={q.isLoading || toggle.isPending}
          onCheckedChange={(v) => toggle.mutate(v)}
        />
        <Label htmlFor="acc-required">Exigir aceite do cliente neste projeto</Label>
      </div>

      {q.isLoading ? (
        <RowSkeleton />
      ) : q.isError ? (
        <EmptyState title="Não foi possível carregar" description={(q.error as Error).message} />
      ) : (
        <ul className="divide-y rounded-md border">
          {(q.data?.acceptances ?? []).length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Nenhum aceite registrado.</li>
          )}
          {(q.data?.acceptances ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {br(a.period_from)}–{br(a.period_to)} · {a.client_name}{" "}
                  <Badge variant={a.status === "accepted" ? "default" : "outline"}>
                    {STATUS[a.status] ?? a.status}
                  </Badge>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.entry_count} apontamento(s) · {formatSeconds(a.total_seconds)} · evidência:{" "}
                  {a.evidence}
                  {a.void_reason ? ` · anulado: ${a.void_reason}` : ""}
                </p>
              </div>
              {a.status !== "voided" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={voidMut.isPending}
                  onClick={() =>
                    void confirmDialog({
                      title: "Anular este aceite?",
                      description:
                        "As horas voltam a ficar sem aceite. Competência fechada precisa ser reaberta antes.",
                      confirmLabel: "Anular",
                      variant: "destructive",
                    }).then(
                      (ok) =>
                        ok && voidMut.mutate({ id: a.id, reason: "Anulado na ficha do projeto" }),
                    )
                  }
                >
                  Anular
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {required && (
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <p className="text-sm sm:col-span-2">
            Registrar aceite das horas aprovadas de {br(from)} a {br(to)}
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="acc-status">Resultado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger id="acc-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accepted">Aceito</SelectItem>
                <SelectItem value="contested">Contestado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="acc-name">Quem aceitou (cliente)</Label>
            <Input
              id="acc-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="acc-email">E-mail do cliente (opcional)</Label>
            <Input
              id="acc-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="acc-ref">Referência da evidência (opcional)</Label>
            <Input
              id="acc-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Nº da ata, assunto do e-mail…"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="acc-evidence">Evidência</Label>
            <Textarea
              id="acc-evidence"
              rows={2}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Descreva como o cliente aceitou"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              disabled={
                clientName.trim().length < 2 || evidence.trim().length < 10 || record.isPending
              }
              onClick={() => record.mutate()}
            >
              {record.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar aceite
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
