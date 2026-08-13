import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SURVEY_FIELD_TYPES,
  isChoiceField,
  type SurveyFieldSettings,
} from "@/lib/surveys/survey-fields";
import {
  listSurveyTemplateQuestions,
  saveSurveyTemplateQuestions,
} from "@/lib/surveys/survey-templates.functions";

type Draft = {
  id?: string;
  label: string;
  help_text: string;
  type: string;
  options: string;
  settings: SurveyFieldSettings;
  required: boolean;
};

function toDraft(row: Record<string, unknown>): Draft {
  const opts = Array.isArray(row.options) ? (row.options as unknown[]) : [];
  return {
    id: String(row.id),
    label: String(row.label ?? ""),
    help_text: (row.help_text as string | null) ?? "",
    type: String(row.type ?? "short_text"),
    options: opts
      .map((o) =>
        typeof o === "string"
          ? o
          : o && typeof o === "object" && "label" in o
            ? String((o as { label: unknown }).label)
            : "",
      )
      .filter(Boolean)
      .join("\n"),
    settings:
      row.settings && typeof row.settings === "object" ? (row.settings as SurveyFieldSettings) : {},
    required: !!row.required,
  };
}

/** Editor das perguntas de um modelo de pesquisa. */
export function SurveyQuestionsDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: { id: string; name: string } | null;
}) {
  const listFn = useServerFn(listSurveyTemplateQuestions);
  const saveFn = useServerFn(saveSurveyTemplateQuestions);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const query = useQuery({
    queryKey: ["survey-template-questions", template?.id],
    queryFn: () => listFn({ data: { survey_template_id: template!.id } }),
    enabled: open && !!template,
  });

  useEffect(() => {
    if (query.data) setDrafts((query.data as Record<string, unknown>[]).map(toDraft));
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("Modelo inválido.");
      if (drafts.some((d) => !d.label.trim()))
        throw new Error("Todas as perguntas precisam de um enunciado.");
      return saveFn({
        data: {
          survey_template_id: template.id,
          questions: drafts.map((d) => ({
            id: d.id,
            label: d.label.trim(),
            help_text: d.help_text.trim() || null,
            type: d.type,
            options: isChoiceField(d.type)
              ? d.options
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((label) => ({ label }))
              : [],
            settings: d.settings,
            required: d.required,
          })),
        },
      });
    },
    onSuccess: () => {
      toast.success("Perguntas salvas.");
      void query.refetch();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar perguntas."),
  });

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const move = (i: number, dir: -1 | 1) =>
    setDrafts((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Perguntas — {template?.name ?? "Modelo"}</DialogTitle>
          <DialogDescription>
            Monte o formulário da pesquisa com os tipos de campo padrão do mercado.
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : query.isError ? (
          <p className="text-sm text-destructive" role="alert">
            Erro ao carregar perguntas.{" "}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => void query.refetch()}
            >
              Tentar novamente
            </Button>
          </p>
        ) : (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {drafts.length === 0 && (
              <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                Nenhuma pergunta ainda. Adicione a primeira abaixo.
              </p>
            )}
            {drafts.map((d, i) => (
              <div
                key={d.id ?? `new-${i}`}
                className="space-y-2 rounded-lg border border-border/60 p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs" htmlFor={`q-label-${i}`}>
                      Pergunta {i + 1}
                    </Label>
                    <Input
                      id={`q-label-${i}`}
                      value={d.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-1 pt-6">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Mover para cima"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Mover para baixo"
                      onClick={() => move(i, 1)}
                      disabled={i === drafts.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover pergunta"
                      onClick={() => setDrafts((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={d.type} onValueChange={(v) => update(i, { type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SURVEY_FIELD_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor={`q-help-${i}`}>
                      Texto de apoio
                    </Label>
                    <Input
                      id={`q-help-${i}`}
                      value={d.help_text}
                      onChange={(e) => update(i, { help_text: e.target.value })}
                    />
                  </div>
                </div>

                {isChoiceField(d.type) && (
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor={`q-opts-${i}`}>
                      Opções (uma por linha)
                    </Label>
                    <textarea
                      id={`q-opts-${i}`}
                      rows={3}
                      value={d.options}
                      onChange={(e) => update(i, { options: e.target.value })}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                )}

                {d.type === "linear_scale" && (
                  <div className="grid gap-2 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mínimo</Label>
                      <Input
                        type="number"
                        value={d.settings.min ?? 1}
                        onChange={(e) =>
                          update(i, { settings: { ...d.settings, min: Number(e.target.value) } })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Máximo</Label>
                      <Input
                        type="number"
                        value={d.settings.max ?? 5}
                        onChange={(e) =>
                          update(i, { settings: { ...d.settings, max: Number(e.target.value) } })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rótulo mínimo</Label>
                      <Input
                        value={d.settings.min_label ?? ""}
                        onChange={(e) =>
                          update(i, { settings: { ...d.settings, min_label: e.target.value } })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rótulo máximo</Label>
                      <Input
                        value={d.settings.max_label ?? ""}
                        onChange={(e) =>
                          update(i, { settings: { ...d.settings, max_label: e.target.value } })
                        }
                      />
                    </div>
                  </div>
                )}

                {d.type === "rating" && (
                  <div className="space-y-1.5 sm:w-40">
                    <Label className="text-xs">Quantidade de estrelas</Label>
                    <Input
                      type="number"
                      min={3}
                      max={10}
                      value={d.settings.stars ?? 5}
                      onChange={(e) =>
                        update(i, { settings: { ...d.settings, stars: Number(e.target.value) } })
                      }
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    id={`q-req-${i}`}
                    checked={d.required}
                    onCheckedChange={(v) => update(i, { required: v })}
                  />
                  <Label htmlFor={`q-req-${i}`} className="text-xs font-normal">
                    Resposta obrigatória
                  </Label>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDrafts((prev) => [
                  ...prev,
                  {
                    label: "",
                    help_text: "",
                    type: "short_text",
                    options: "",
                    settings: {},
                    required: false,
                  },
                ])
              }
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Adicionar pergunta
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || query.isLoading}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Salvar perguntas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
