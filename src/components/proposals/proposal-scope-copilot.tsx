import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Layers, Loader2, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  GENERAL_SCOPE_FIELDS,
  SERVICE_SCOPE_TYPE_META,
  hasAnyScopeInput,
  type GeneratedScopeSection,
  type ProposalScopeBrief,
  type ProposalScopeServiceItem,
} from "@/lib/proposals/proposal-scope-forms";
import { cn } from "@/lib/utils";
import { ProposalScopeServiceCard } from "./proposal-scope-service-card";

export type GeneratedScopeOutput = {
  html: string;
  sections: GeneratedScopeSection[];
};

type Props = {
  brief: ProposalScopeBrief;
  onChange: (next: ProposalScopeBrief) => void;
  onGenerate: (brief: ProposalScopeBrief) => Promise<GeneratedScopeOutput>;
  onApplyHtml: (html: string, mode: "insert" | "replace") => void;
  onApplyVisual: (sections: GeneratedScopeSection[]) => void;
  isVisualMode: boolean;
  hasExistingText: boolean;
  defaultOpen?: boolean;
};

export function ProposalScopeCopilot({
  brief,
  onChange,
  onGenerate,
  onApplyHtml,
  onApplyVisual,
  isVisualMode,
  hasExistingText,
  defaultOpen = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [showGeneral, setShowGeneral] = useState(true);
  const [activeServiceId, setActiveServiceId] = useState<string>(() => brief.services[0]?.id ?? "");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedScopeOutput | null>(null);
  const { can } = usePermissions();
  const canUseAi = ["own", "team", "workspace"].some(
    (s) => can(`techsales.proposals.create.${s}`) || can(`techsales.proposals.update.${s}`),
  );

  const currentService: ProposalScopeServiceItem | undefined =
    brief.services.find((s) => s.id === activeServiceId) ?? brief.services[0];

  const canGenerate = canUseAi && hasAnyScopeInput(brief) && !generating;

  function updateGeneral(key: string, value: string) {
    onChange({ ...brief, general: { ...brief.general, [key]: value } });
  }

  function updateService(id: string, patch: Partial<ProposalScopeServiceItem>) {
    onChange({
      ...brief,
      services: brief.services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }

  function updateServiceAnswer(id: string, key: string, value: string) {
    onChange({
      ...brief,
      services: brief.services.map((s) =>
        s.id === id ? { ...s, answers: { ...s.answers, [key]: value } } : s,
      ),
    });
  }

  function addService() {
    const nextIndex = brief.services.length + 1;
    const nextId = `svc-custom-${Date.now()}-${nextIndex}`;
    const nextSvc: ProposalScopeServiceItem = {
      id: nextId,
      name: `Serviço adicional ${nextIndex}`,
      billing: "",
      serviceType: "suporte",
      modality: "monthly",
      answers: {},
      freeNotes: "",
    };
    onChange({ ...brief, services: [...brief.services, nextSvc] });
    setActiveServiceId(nextId);
  }

  function removeService(id: string) {
    if (brief.services.length <= 1) return;
    const remaining = brief.services.filter((s) => s.id !== id);
    onChange({ ...brief, services: remaining });
    if (activeServiceId === id) {
      setActiveServiceId(remaining[0]?.id ?? "");
    }
  }

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const out = await onGenerate(brief);
      setGenerated(out);
    } catch (e) {
      setError((e as Error).message || "Não foi possível gerar o escopo com IA.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section
      aria-label="Assistente de escopo técnico por serviço"
      className="rounded-lg border border-border bg-card text-card-foreground"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Assistente de escopo por serviço (IA)</span>
              <Badge variant="secondary" className="text-[11px] font-normal">
                {brief.services.length} {brief.services.length === 1 ? "serviço" : "serviços"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Responda aos campos específicos de cada serviço (ou escreva com suas palavras) e gere
              um escopo técnico completo.
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border p-3.5">
          {/* Parte 1: Dados gerais do escopo */}
          <div className="rounded-md border border-border bg-muted/20">
            <button
              type="button"
              aria-expanded={showGeneral}
              onClick={() => setShowGeneral((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>1. Dados gerais da proposta (comuns a todos os serviços)</span>
              {showGeneral ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
            {showGeneral && (
              <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
                {GENERAL_SCOPE_FIELDS.map((field) => {
                  const inputId = `scope-gen-${field.key}`;
                  const val = brief.general[field.key] ?? "";
                  return (
                    <div
                      key={field.key}
                      className={cn("space-y-1", field.multiline && "sm:col-span-2")}
                    >
                      <Label htmlFor={inputId} className="text-xs">
                        {field.label}
                      </Label>
                      {field.multiline ? (
                        <Textarea
                          id={inputId}
                          rows={2}
                          value={val}
                          placeholder={field.placeholder}
                          onChange={(e) => updateGeneral(field.key, e.target.value)}
                          className="text-xs"
                        />
                      ) : (
                        <Input
                          id={inputId}
                          value={val}
                          placeholder={field.placeholder}
                          onChange={(e) => updateGeneral(field.key, e.target.value)}
                          className="h-8 text-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Parte 2: Serviços específicos */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">
                2. Detalhes específicos por serviço e modalidade
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addService}
                disabled={brief.services.length >= 20}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Adicionar serviço
              </Button>
            </div>

            <div
              role="tablist"
              aria-label="Serviços configurados na proposta"
              className="flex flex-wrap gap-1.5"
            >
              {brief.services.map((svc, idx) => {
                const isSelected = currentService?.id === svc.id;
                const filledCount =
                  Object.values(svc.answers).filter((v) => v.trim().length > 0).length +
                  (svc.freeNotes.trim() ? 1 : 0);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveServiceId(svc.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <span className="max-w-[180px] truncate">
                      {svc.name.trim() || `Serviço ${idx + 1}`}
                    </span>
                    <span className="text-[10px] opacity-80">
                      ({SERVICE_SCOPE_TYPE_META[svc.serviceType].label})
                    </span>
                    {filledCount > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        {filledCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {currentService && (
              <ProposalScopeServiceCard
                service={currentService}
                canRemove={brief.services.length > 1}
                onPatch={(patch) => updateService(currentService.id, patch)}
                onAnswer={(key, value) => updateServiceAnswer(currentService.id, key, value)}
                onRemove={() => removeService(currentService.id)}
              />
            )}
          </div>

          {/* Ação de geração */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              {!canUseAi
                ? "Sem permissão para criar ou editar propostas."
                : hasAnyScopeInput(brief)
                  ? "A IA organiza suas respostas em escopo técnico sem inventar preços ou SLAs."
                  : "Preencha ao menos um campo ou nota livre para habilitar a geração."}
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleGenerate()}
              disabled={!canGenerate}
              aria-busy={generating}
              className="gap-1.5"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {generating
                ? "Gerando escopo técnico..."
                : generated
                  ? "Regenerar escopo com IA"
                  : "Gerar escopo técnico com IA"}
            </Button>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          )}

          {/* Pré-visualização do escopo gerado */}
          {generated && (
            <div className="space-y-2.5 rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  Prévia do escopo gerado pela IA (revise antes de aplicar)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {isVisualMode ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onApplyVisual(generated.sections)}
                      className="h-7 gap-1.5 text-xs"
                    >
                      <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                      Aplicar no modelo visual
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onApplyHtml(generated.html, "insert")}
                        className="h-7 gap-1.5 text-xs"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        {hasExistingText ? "Inserir no escopo da proposta" : "Aplicar no documento"}
                      </Button>
                      {hasExistingText && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onApplyHtml(generated.html, "replace")}
                          className="h-7 text-xs"
                        >
                          Substituir texto atual
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div
                className="prose prose-sm max-h-64 max-w-none overflow-y-auto rounded border border-border bg-background p-3 text-xs dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: generated.html }}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
