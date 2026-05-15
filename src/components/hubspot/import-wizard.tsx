import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowDown,
  Building2,
  Users,
  Target,
  UserPlus,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { startHubspotImport, countHubspotObjects } from "@/lib/integrations/hubspot.functions";
import { ImportTimeline } from "./import-timeline";

type Obj = "companies" | "contacts" | "deals" | "leads" | "activities";

const OBJECTS: {
  key: Obj;
  label: string;
  icon: typeof Building2;
  deps: Obj[];
  description: string;
  required?: boolean;
}[] = [
  {
    key: "companies",
    label: "Empresas",
    icon: Building2,
    deps: [],
    description: "Raiz da árvore — define o escopo de todos os filhos.",
    required: true,
  },
  {
    key: "contacts",
    label: "Contatos",
    icon: Users,
    deps: ["companies"],
    description: "Todos os contatos vinculados às empresas importadas.",
  },
  {
    key: "deals",
    label: "Negócios",
    icon: Target,
    deps: ["companies", "contacts"],
    description: "Todos os negócios vinculados às empresas importadas.",
  },
  {
    key: "leads",
    label: "Leads",
    icon: UserPlus,
    deps: ["contacts"],
    description: "Contatos importados com lifecyclestage = lead.",
  },
  {
    key: "activities",
    label: "Atividades",
    icon: Activity,
    deps: ["contacts", "companies", "deals"],
    description: "Notas, calls, meetings, tasks e e-mails das entidades acima.",
  },
];

type Counts = Partial<Record<Obj, { planned: number; remote: number }>>;

export function HubspotImportWizard() {
  const [scope, setScope] = useState<Record<Obj, boolean>>({
    companies: true,
    contacts: true,
    deals: false,
    leads: false,
    activities: false,
  });
  const [maxCompanies, setMaxCompanies] = useState(200);
  const [stage, setStage] = useState<"scope" | "running">("scope");
  const [jobId, setJobId] = useState<string | null>(null);

  const [counts, setCounts] = useState<Counts>({});
  const [countingKey, setCountingKey] = useState<Obj | null>(null);
  const [countsReady, setCountsReady] = useState(false);

  const startFn = useServerFn(startHubspotImport);
  const countFn = useServerFn(countHubspotObjects);

  function toggle(key: Obj, value: boolean) {
    setScope((prev) => {
      const next = { ...prev, [key]: value };
      if (value) {
        const deps = OBJECTS.find((o) => o.key === key)!.deps;
        for (const d of deps) next[d] = true;
      }
      return next;
    });
    // Qualquer mudança de escopo invalida a contagem
    setCountsReady(false);
    setCounts({});
  }

  const planned = useMemo(() => {
    const wanted = new Set<Obj>();
    for (const o of OBJECTS) if (scope[o.key]) wanted.add(o.key);
    return OBJECTS.filter((o) => wanted.has(o.key));
  }, [scope]);

  async function handleCount() {
    setCountsReady(false);
    const next: Counts = {};
    setCounts(next);
    try {
      for (const o of planned) {
        setCountingKey(o.key);
        const res = await countFn({ data: { objects: [o.key], maxCompanies } });
        const part = (res as Counts)[o.key];
        if (part) {
          next[o.key] = part;
          setCounts({ ...next });
        }
      }
      setCountsReady(true);
      toast.success("Contagem concluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao contar registros");
    } finally {
      setCountingKey(null);
    }
  }

  async function handleStart() {
    try {
      setStage("running");
      const r = await startFn({
        data: {
          companies: scope.companies,
          contacts: scope.contacts,
          deals: scope.deals,
          leads: scope.leads,
          activities: scope.activities,
          maxCompanies,
        },
      });
      setJobId(r.jobId);
      toast.success(`Importação concluída: ${r.succeeded} ok / ${r.failed} falhas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
      setStage("scope");
    }
  }

  useEffect(() => {
    if (stage !== "running" || jobId) return;
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        const { data } = await supabase
          .from("enrichment_jobs")
          .select("id")
          .eq("provider", "hubspot")
          .eq("kind", "import")
          .order("created_at", { ascending: false })
          .limit(1);
        if (data?.[0]?.id) {
          setJobId(data[0].id);
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage, jobId]);

  if (stage === "running") {
    return (
      <div className="space-y-4">
        {jobId ? (
          <ImportTimeline
            jobId={jobId}
            onReset={() => {
              setStage("scope");
              setJobId(null);
            }}
          />
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Iniciando importação…
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-1">1. Escopo da importação</h2>
        <p className="text-sm text-muted-foreground mb-4">
          A importação começa pelas Empresas; os demais objetos são trazidos conforme o vínculo no HubSpot.
        </p>

        <div className="mb-5 max-w-sm">
          <Label className="text-xs">Máximo de empresas a ser importado</Label>
          <Input
            type="number"
            min={1}
            max={2000}
            value={maxCompanies}
            onChange={(e) => {
              setMaxCompanies(Math.max(1, Math.min(2000, Number(e.target.value) || 200)));
              setCountsReady(false);
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Esse limite só se aplica a Empresas. Os filhos vinculados são importados sem limite.
          </p>
        </div>

        <div className="space-y-3">
          {OBJECTS.map((o) => {
            const Icon = o.icon;
            const forcedBy = OBJECTS.filter((x) => scope[x.key] && x.deps.includes(o.key)).map((x) => x.label);
            return (
              <div key={o.key} className="flex items-start gap-3 p-3 rounded-md border bg-background">
                <Checkbox
                  id={`scope-${o.key}`}
                  checked={scope[o.key]}
                  disabled={o.required}
                  onCheckedChange={(v) => toggle(o.key, !!v)}
                />
                <div className="flex-1">
                  <Label htmlFor={`scope-${o.key}`} className="flex items-center gap-2 cursor-pointer">
                    <Icon className="h-4 w-4" /> {o.label}
                    {o.required && (
                      <Badge variant="secondary" className="text-[10px]">
                        obrigatório
                      </Badge>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">{o.description}</p>
                  {forcedBy.length > 0 && scope[o.key] && !o.required && (
                    <p className="text-xs text-amber-600 mt-1">Necessário para: {forcedBy.join(", ")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-1">2. Pré-visualização da árvore</h2>
        <p className="text-sm text-muted-foreground mb-4">Ordem de execução respeitando dependências:</p>
        {planned.length === 0 ? (
          <p className="text-sm text-muted-foreground">Selecione ao menos um objeto.</p>
        ) : (
          <ol className="space-y-2">
            {planned.map((o, i) => {
              const Icon = o.icon;
              const c = counts[o.key];
              const isCounting = countingKey === o.key;
              return (
                <li key={o.key}>
                  <div className="flex items-center gap-3 p-3 rounded-md border bg-background">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {i + 1}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{o.label}</p>
                      {o.deps.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Depende de: {o.deps.map((d) => OBJECTS.find((x) => x.key === d)!.label).join(", ")}
                        </p>
                      )}
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="font-mono cursor-help">
                            {isCounting ? (
                              <span className="flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> contando…
                              </span>
                            ) : c ? (
                              `${c.planned.toLocaleString("pt-BR")} / ${c.remote.toLocaleString("pt-BR")}`
                            ) : (
                              "— / —"
                            )}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          {o.key === "companies" ? (
                            <p className="text-xs">
                              <strong>Total de registros contados</strong>: respeita o limite definido em "Máximo de empresas".
                              <br />
                              <strong>Total no HubSpot</strong>: total de empresas existentes na sua conta HubSpot.
                            </p>
                          ) : (
                            <p className="text-xs">
                              <strong>Total de registros contados</strong>: apenas {o.label.toLowerCase()} vinculados às empresas dentro do limite de importação.
                              <br />
                              <strong>Total no HubSpot</strong>: total de {o.label.toLowerCase()} existentes na sua conta HubSpot (sem filtro de vínculo).
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {i < planned.length - 1 && (
                    <div className="flex justify-center my-1">
                      <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Formato: <span className="font-mono">a importar / total no HubSpot</span> — quantos registros serão puxados nesta importação e o total existente no HubSpot.
          </p>
          <Button
            variant="outline"
            onClick={handleCount}
            disabled={planned.length === 0 || countingKey !== null}
          >
            {countingKey ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Contando…
              </>
            ) : (
              "Contar Registros"
            )}
          </Button>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button onClick={handleStart} disabled={planned.length === 0 || !countsReady}>
          Iniciar importação
        </Button>
      </div>
      {!countsReady && (
        <p className="text-xs text-muted-foreground text-right -mt-3">
          Execute "Contar Registros" para habilitar a importação.
        </p>
      )}
    </div>
  );
}

export const StatusIcon = ({ status }: { status: string }) => {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
};
