// Configuração de e-mails automáticos por etapa do funil ATS.
// Lote 4 do rollout UX/UI — segue Design Foundation TechHire.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TokenPills } from "@/components/ui/token-pills";
import { ATS_CANDIDATE_TOKENS } from "@/lib/message-tokens-catalog";
import { useTokenInserter } from "@/lib/token-insert";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, SectionHeader, Skeletons } from "@/components/techhire/ui";
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

  const subjectInserter = useTokenInserter<HTMLInputElement>(
    () => form.subject,
    (v) => setForm((f) => ({ ...f, subject: v })),
  );
  const bodyInserter = useTokenInserter<HTMLTextAreaElement>(
    () => form.body,
    (v) => setForm((f) => ({ ...f, body: v })),
  );

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

  const configuredCount = rows.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Configurações · ATS"
        title="E-mails automáticos por etapa"
        description={
          <>
            Quando uma candidatura entrar nesta etapa, um e-mail é enfileirado para o candidato. Use{" "}
            <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11px]">
              {"{{candidate_name}}"}
            </code>
            ,{" "}
            <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11px]">
              {"{{job_title}}"}
            </code>{" "}
            e{" "}
            <code className="rounded bg-surface-sunken px-1 py-0.5 text-[11px]">{"{{stage}}"}</code>{" "}
            como variáveis. {configuredCount} de {DEFAULT_ATS_STAGES.length} etapas configuradas.
          </>
        }
        descriptionLive
      />

      {isLoading ? (
        <Skeletons.Card lines={6} />
      ) : (
        <section className="max-w-3xl rounded-lg border border-border-subtle bg-surface-1 p-5 shadow-xs space-y-5">
          <SectionHeader
            title="Etapa"
            description="Selecione a etapa para editar o template enviado quando uma candidatura entra nela."
          />

          <div className="space-y-1.5">
            <Label htmlFor="se-stage">Etapa do funil</Label>
            <Select value={stage} onValueChange={onSelectStage}>
              <SelectTrigger id="se-stage" className="w-full md:w-72">
                <Mail className="h-4 w-4 mr-2 text-text-tertiary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_ATS_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label} {rows.some((r) => r.stage_value === s.value) ? "·  ✓" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="se-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
            <Label htmlFor="se-enabled" className="!m-0">
              Ativo — disparar nesta etapa
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="se-subject">Assunto</Label>
            <Input
              id="se-subject"
              ref={subjectInserter.ref}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <TokenPills
              className="mt-1.5"
              tokens={ATS_CANDIDATE_TOKENS}
              onInsert={subjectInserter.insert}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="se-body">Corpo do e-mail</Label>
            <Textarea
              id="se-body"
              ref={bodyInserter.ref}
              rows={10}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            <TokenPills
              className="mt-1.5"
              tokens={ATS_CANDIDATE_TOKENS}
              onInsert={bodyInserter.insert}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border-subtle">
            {current && (
              <Button
                variant="outline"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {save.isPending ? "Salvando…" : "Salvar template"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
