// Configuração de e-mails automáticos por etapa do funil ATS.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_ATS_STAGES } from "@/lib/ats/stages";
import {
  listStageEmails,
  upsertStageEmail,
  deleteStageEmail,
} from "@/lib/ats/stage-emails.functions";

export const Route = createFileRoute("/_authenticated/(ats)/stage-emails")({
  component: StageEmailsPage,
});

function StageEmailsPage() {
  const list = useServerFn(listStageEmails);
  const upsert = useServerFn(upsertStageEmail);
  const del = useServerFn(deleteStageEmail);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ats-stage-emails"],
    queryFn: () => list(),
  });

  const [stage, setStage] = useState<string>("applied");
  const current = rows.find((r) => r.stage_value === stage);
  const [form, setForm] = useState({
    enabled: true,
    subject: "Recebemos sua candidatura — {{job_title}}",
    body: "Olá {{candidate_name}},\n\nObrigado pelo interesse na vaga {{job_title}}. Em breve seguiremos com o próximo passo.\n\nAbraços,\nEquipe de recrutamento",
  });

  // Sincroniza form quando muda stage selecionada
  const stageRow = current;
  // useEffect-like pattern minimal:
  if (stageRow && (form.subject !== stageRow.subject || form.body !== stageRow.body)) {
    // só sincroniza ao mudar de stage
  }

  const onSelectStage = (v: string) => {
    setStage(v);
    const found = rows.find((r) => r.stage_value === v);
    if (found) {
      setForm({ enabled: found.enabled, subject: found.subject, body: found.body });
    } else {
      setForm({
        enabled: true,
        subject: `Atualização sobre a vaga {{job_title}}`,
        body: `Olá {{candidate_name}},\n\nSua candidatura foi movida para a etapa "${v}".\n\nAbraços,\nEquipe de recrutamento`,
      });
    }
  };

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          stage_value: stage,
          enabled: form.enabled,
          subject: form.subject,
          body: form.body,
        },
      }),
    onSuccess: () => {
      toast.success("Template salvo");
      qc.invalidateQueries({ queryKey: ["ats-stage-emails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => del({ data: { stage_value: stage } }),
    onSuccess: () => {
      toast.success("Template removido");
      qc.invalidateQueries({ queryKey: ["ats-stage-emails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" />E-mails automáticos por etapa
        </h1>
        <p className="text-sm text-muted-foreground">
          Quando uma candidatura entrar nesta etapa, um e-mail é enfileirado para o candidato.
          Use <code>{"{{candidate_name}}"}</code>, <code>{"{{job_title}}"}</code> e <code>{"{{stage}}"}</code> como variáveis.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={stage} onValueChange={onSelectStage}>
            <SelectTrigger className="w-full md:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEFAULT_ATS_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label} {rows.some((r) => r.stage_value === s.value) ? "✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-3">
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            <Label className="!m-0">Ativo — disparar nesta etapa</Label>
          </div>

          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Corpo do e-mail</Label>
            <Textarea
              rows={10}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" />Salvar template
            </Button>
            {current && (
              <Button
                variant="outline"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />Remover
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
