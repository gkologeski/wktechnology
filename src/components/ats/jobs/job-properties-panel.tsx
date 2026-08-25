import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AtsSectionHeader } from "@/components/ats/ui";
import { PipelineSelectNotice } from "@/components/ats/pipeline-select-notice";
import { DealPicker } from "@/components/ats/deal-picker";
import { OwnerField } from "@/components/entity/owner-field";
import { AssigneeField } from "@/components/entity/assignee-field";
import { listAtsPipelines } from "@/lib/ats/pipelines.functions";
import { ATS_JOB_STATUSES } from "@/lib/ats/stages";
import {
  EMPLOYMENT_LABEL,
  REMOTE_LABEL,
  SENIORITY_LABEL,
} from "@/components/ats/jobs/job-labels";
import type { Job } from "@/components/ats/jobs/job-detail.types";

export type JobPatch = {
  title?: string;
  description?: string | null;
  requirements?: string | null;
  seniority?: string | null;
  employment_type?: string | null;
  location?: string | null;
  remote_mode?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  status?: string;
  pipeline_id?: string | null;
  deal_id?: string | null;
};

export function JobPropertiesPanel({
  job,
  save,
  onSaved,
  applicationCount,
}: {
  job: Job;
  save: (patch: JobPatch) => Promise<unknown>;
  onSaved: () => void;
  applicationCount: number;
}) {
  const j = job as unknown as {
    title: string;
    seniority: string | null;
    remote_mode: string | null;
    employment_type: string | null;
    location: string | null;
    description: string | null;
    requirements: string | null;
    status: string;
    salary_min: number | null;
    salary_max: number | null;
    pipeline_id: string | null;
    deal_id: string | null;
  };
  const [form, setForm] = useState({
    title: j.title,
    seniority: j.seniority ?? "",
    employment_type: j.employment_type ?? "",
    remote_mode: j.remote_mode ?? "",
    location: j.location ?? "",
    description: j.description ?? "",
    requirements: j.requirements ?? "",
    status: j.status,
    salary_min: j.salary_min?.toString() ?? "",
    salary_max: j.salary_max?.toString() ?? "",
    pipeline_id: j.pipeline_id ?? "",
    deal_id: j.deal_id ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState<
    Array<{ id: string; name: string; is_default: boolean }>
  >([]);
  const [pipelinesError, setPipelinesError] = useState<string | null>(null);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  const [confirmPipeline, setConfirmPipeline] = useState<string | null>(null);
  const listPipelinesFn = useServerFn(listAtsPipelines);

  const loadPipelines = useCallback(async () => {
    setPipelinesLoading(true);
    setPipelinesError(null);
    try {
      const rs = await listPipelinesFn();
      setPipelines(
        (rs as Array<{ id: string; name: string; is_default: boolean }>).map((p) => ({
          id: p.id,
          name: p.name,
          is_default: p.is_default,
        })),
      );
    } catch (e) {
      setPipelinesError(e instanceof Error ? e.message : "Falha ao carregar pipelines");
    } finally {
      setPipelinesLoading(false);
    }
  }, [listPipelinesFn]);

  useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);

  // Garante que o pipeline atual da vaga sempre apareça no seletor,
  // mesmo que ainda não esteja na lista carregada.
  const pipelineOptions = useMemo(() => {
    const current = j.pipeline_id;
    if (!current || pipelines.some((p) => p.id === current)) return pipelines;
    return [{ id: current, name: "Pipeline atual da vaga", is_default: false }, ...pipelines];
  }, [pipelines, j.pipeline_id]);

  useEffect(() => {
    setForm({
      title: j.title,
      seniority: j.seniority ?? "",
      employment_type: j.employment_type ?? "",
      remote_mode: j.remote_mode ?? "",
      location: j.location ?? "",
      description: j.description ?? "",
      requirements: j.requirements ?? "",
      status: j.status,
      salary_min: j.salary_min?.toString() ?? "",
      salary_max: j.salary_max?.toString() ?? "",
      pipeline_id: j.pipeline_id ?? "",
      deal_id: j.deal_id ?? null,
    });
  }, [
    j.title,
    j.seniority,
    j.employment_type,
    j.remote_mode,
    j.location,
    j.description,
    j.requirements,
    j.status,
    j.salary_min,
    j.salary_max,
    j.pipeline_id,
    j.deal_id,
  ]);

  const dirty =
    form.title !== j.title ||
    (form.seniority || null) !== j.seniority ||
    (form.employment_type || null) !== j.employment_type ||
    (form.remote_mode || null) !== j.remote_mode ||
    (form.location || null) !== (j.location ?? null) ||
    (form.description || null) !== (j.description ?? null) ||
    (form.requirements || null) !== (j.requirements ?? null) ||
    form.status !== j.status ||
    (form.salary_min ? Number(form.salary_min) : null) !== j.salary_min ||
    (form.salary_max ? Number(form.salary_max) : null) !== j.salary_max ||
    (form.pipeline_id || null) !== (j.pipeline_id ?? null) ||
    (form.deal_id ?? null) !== (j.deal_id ?? null);

  const persist = async () => {
    setSaving(true);
    try {
      await save({
        title: form.title,
        description: form.description || null,
        requirements: form.requirements || null,
        seniority: form.seniority || null,
        employment_type: form.employment_type || null,
        location: form.location || null,
        remote_mode: form.remote_mode || null,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
        status: form.status,
        pipeline_id: form.pipeline_id || null,
        deal_id: form.deal_id,
      });
      toast.success("Vaga atualizada");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
      setConfirmPipeline(null);
    }
  };

  const onSubmit = async () => {
    const pipelineChanged = (form.pipeline_id || null) !== (j.pipeline_id ?? null);
    if (pipelineChanged && applicationCount > 0) {
      setConfirmPipeline(form.pipeline_id || null);
      return;
    }
    await persist();
  };

  const jobRow = job as unknown as {
    id: string;
    owner_id: string | null;
    assigned_to: string | null;
  };
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4 space-y-3">
      <AtsSectionHeader title="Propriedades" />
      <div className="space-y-3 pb-3 border-b border-border-subtle">
        <OwnerField
          table="ats_jobs"
          rowId={jobRow.id}
          ownerId={jobRow.owner_id}
          onChanged={onSaved}
        />
        <AssigneeField
          table="ats_jobs"
          rowId={jobRow.id}
          assignedTo={jobRow.assigned_to}
          onChanged={() => onSaved()}
        />
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <Label htmlFor="prop-title" className="text-xs text-text-tertiary">
            Título
          </Label>
          <Input
            id="prop-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="prop-status" className="text-xs text-text-tertiary">
            Status
          </Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger id="prop-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATS_JOB_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="prop-pipeline" className="text-xs text-text-tertiary">
            Pipeline
          </Label>
          <Select
            value={form.pipeline_id}
            onValueChange={(v) => setForm({ ...form, pipeline_id: v })}
            disabled={pipelineOptions.length === 0}
          >
            <SelectTrigger id="prop-pipeline">
              <SelectValue
                placeholder={pipelinesLoading ? "Carregando pipelines..." : "Selecionar pipeline"}
              />
            </SelectTrigger>
            <SelectContent>
              {pipelineOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.is_default ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!pipelinesLoading && (pipelinesError || pipelines.length === 0) ? (
            <PipelineSelectNotice error={pipelinesError} onRetry={() => void loadPipelines()} />
          ) : (
            <p className="mt-1 text-[11px] text-text-tertiary">
              Define as etapas pelas quais as candidaturas desta vaga vão passar.
            </p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-text-tertiary">Negócio</Label>
            {form.deal_id ? (
              <Link
                to="/deals/$id"
                params={{ id: form.deal_id }}
                className="inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary"
              >
                Abrir <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            ) : null}
          </div>
          <DealPicker
            value={form.deal_id}
            onChange={(id) => setForm({ ...form, deal_id: id })}
            placeholder="Vincular negócio…"
          />
          <p className="mt-1 text-[11px] text-text-tertiary">
            Associa esta vaga a um negócio do CRM.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="prop-sen" className="text-xs text-text-tertiary">
              Senioridade
            </Label>
            <Select
              value={form.seniority}
              onValueChange={(v) => setForm({ ...form, seniority: v })}
            >
              <SelectTrigger id="prop-sen">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SENIORITY_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="prop-rem" className="text-xs text-text-tertiary">
              Modalidade
            </Label>
            <Select
              value={form.remote_mode}
              onValueChange={(v) => setForm({ ...form, remote_mode: v })}
            >
              <SelectTrigger id="prop-rem">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REMOTE_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="prop-emp" className="text-xs text-text-tertiary">
            Vínculo
          </Label>
          <Select
            value={form.employment_type}
            onValueChange={(v) => setForm({ ...form, employment_type: v })}
          >
            <SelectTrigger id="prop-emp">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EMPLOYMENT_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="prop-loc" className="text-xs text-text-tertiary">
            Localização
          </Label>
          <Input
            id="prop-loc"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="prop-min" className="text-xs text-text-tertiary">
              Salário mín
            </Label>
            <Input
              id="prop-min"
              type="number"
              value={form.salary_min}
              onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="prop-max" className="text-xs text-text-tertiary">
              Salário máx
            </Label>
            <Input
              id="prop-max"
              type="number"
              value={form.salary_max}
              onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="prop-desc" className="text-xs text-text-tertiary">
            Descrição
          </Label>
          <Textarea
            id="prop-desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="prop-req" className="text-xs text-text-tertiary">
            Requisitos
          </Label>
          <Textarea
            id="prop-req"
            rows={3}
            value={form.requirements}
            onChange={(e) => setForm({ ...form, requirements: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={onSubmit} disabled={!dirty || saving}>
          <Save className="h-3.5 w-3.5 mr-1.5" aria-hidden />
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      <AlertDialog
        open={confirmPipeline !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmPipeline(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar pipeline desta vaga?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta vaga tem {applicationCount}{" "}
              {applicationCount === 1 ? "candidatura" : "candidaturas"} em andamento. As etapas
              atuais dos candidatos podem não existir no novo pipeline e precisarão ser reajustadas
              manualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={persist} disabled={saving}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
