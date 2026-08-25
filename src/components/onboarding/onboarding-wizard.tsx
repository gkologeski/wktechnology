// Wizard genérico de onboarding — dirigido pela configuração do template.
// Autosave em cada avanço; passo final delega a criação da entidade ao caller.
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveOnbRun,
  completeOnbRun,
  cancelOnbRun,
  type OnbTemplateRow,
  type OnbField,
} from "@/lib/onboarding/onboarding.functions";

type Primitive = string | number | boolean | null;
type FormData = Record<string, Primitive>;

export type OnboardingWizardProps = {
  template: OnbTemplateRow;
  runId: string;
  /** Entrega os dados finais ao caller para materializar a entidade. Deve retornar o id criado. */
  onCreateEntity: (data: FormData) => Promise<string>;
  onCompleted?: (result: {
    entity_id: string;
    tasks_created: number;
    workflow_enqueued: boolean;
  }) => void;
  onCancel?: () => void;
};

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: OnbField;
  value: Primitive;
  onChange: (v: Primitive) => void;
}) {
  const id = `f_${field.name}`;
  const common = { id, "aria-label": field.label } as const;
  if (field.type === "textarea") {
    return (
      <Textarea
        {...common}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
      />
    );
  }
  if (field.type === "select") {
    return (
      <Select value={(value as string) ?? ""} onValueChange={(v) => onChange(v)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  const inputType =
    field.type === "email"
      ? "email"
      : field.type === "phone"
        ? "tel"
        : field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text";
  return (
    <Input
      {...common}
      type={inputType}
      value={(value as string | number | null) ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        if (field.type === "number") {
          onChange(v === "" ? null : Number(v));
        } else {
          onChange(v);
        }
      }}
    />
  );
}

export function OnboardingWizard({
  template,
  runId,
  onCreateEntity,
  onCompleted,
  onCancel,
}: OnboardingWizardProps) {
  const saveFn = useServerFn(saveOnbRun);
  const completeFn = useServerFn(completeOnbRun);
  const cancelFn = useServerFn(cancelOnbRun);

  const steps = template.field_config;
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<FormData>({});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const progress = ((stepIdx + 1) / steps.length) * 100;

  // Autosave debounced (600ms) do passo atual
  useEffect(() => {
    if (Object.keys(form).length === 0) return;
    const t = setTimeout(() => {
      saveFn({ data: { run_id: runId, current_step: stepIdx, form_data: form } })
        .then(() => setSavedAt(new Date()))
        .catch(() => {
          /* silencioso — visual apenas */
        });
    }, 600);
    return () => clearTimeout(t);
  }, [form, stepIdx, runId, saveFn]);

  const validate = useMemo(
    () => (s: typeof step) => {
      const errs: Record<string, string> = {};
      for (const f of s.fields) {
        if (f.required) {
          const v = form[f.name];
          if (v === undefined || v === null || v === "") {
            errs[f.name] = "Campo obrigatório";
          }
        }
        if (f.type === "email" && form[f.name]) {
          const val = String(form[f.name]);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            errs[f.name] = "E-mail inválido";
          }
        }
      }
      return errs;
    },
    [form],
  );

  const completeMut = useMutation({
    mutationFn: async () => {
      const entity_id = await onCreateEntity(form);
      return completeFn({ data: { run_id: runId, entity_id } });
    },
    onSuccess: (res) => {
      const tc = "tasks_created" in res ? (res as { tasks_created: number }).tasks_created : 0;
      const wf =
        "workflow_enqueued" in res
          ? (res as { workflow_enqueued: boolean }).workflow_enqueued
          : false;
      toast.success(
        `Registro criado${tc ? ` · ${tc} tarefa(s)` : ""}${wf ? " · workflow disparado" : ""}`,
      );
      // entity_id vem do onCreateEntity; passa-se via closure em onCompleted
      onCompleted?.({
        entity_id: (res as { entity_id?: string }).entity_id ?? "",
        tasks_created: tc,
        workflow_enqueued: wf,
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao concluir"),
  });

  const handleNext = () => {
    const errs = validate(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setErrors({});
    if (isLast) {
      completeMut.mutate();
    } else {
      setStepIdx((i) => i + 1);
    }
  };

  const handleBack = () => {
    setErrors({});
    setStepIdx((i) => Math.max(0, i - 1));
  };

  const handleCancel = async () => {
    try {
      await cancelFn({ data: { run_id: runId } });
    } catch {
      /* noop */
    }
    onCancel?.();
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{template.name}</CardTitle>
            {template.description && <CardDescription>{template.description}</CardDescription>}
          </div>
          <Badge variant="outline">
            Passo {stepIdx + 1} de {steps.length}
          </Badge>
        </div>
        <Progress value={progress} className="mt-3 h-1.5" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-base font-semibold">{step.title}</h3>
          {step.description && (
            <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
          )}
        </div>

        <div className="space-y-4">
          {step.fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={`f_${f.name}`}>
                {f.label}
                {f.required && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <FieldControl
                field={f}
                value={form[f.name] ?? null}
                onChange={(v) => setForm((prev) => ({ ...prev, [f.name]: v }))}
              />
              {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
              {errors[f.name] && <p className="text-xs text-destructive">{errors[f.name]}</p>}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {savedAt ? `Salvo às ${savedAt.toLocaleTimeString("pt-BR")}` : "Rascunho autosalvo"}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancelar
            </Button>
            {stepIdx > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            )}
            <Button size="sm" onClick={handleNext} disabled={completeMut.isPending}>
              {completeMut.isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Concluindo…
                </>
              ) : isLast ? (
                <>
                  <Check className="mr-1 h-4 w-4" /> Concluir
                </>
              ) : (
                <>
                  Próximo <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
