import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Building2,
  Users,
  Target,
  UserPlus,
  Activity,
  LifeBuoy,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  startHubspotImport,
  countHubspotObjects,
  clearHubspotLocalTables,
} from "@/lib/integrations/hubspot.functions";
import { ImportTimeline } from "./import-timeline";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type Obj = "companies" | "contacts" | "deals" | "leads" | "tickets" | "activities";

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
    description: "Raiz da árvore — define o escopo de empresas/contatos/negócios/atividades.",
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
    deps: [],
    description: "Objeto Leads nativo do HubSpot (independente de empresas).",
  },
  {
    key: "tickets",
    label: "Tickets",
    icon: LifeBuoy,
    deps: [],
    description: "Tickets de suporte do HubSpot (independente de empresas).",
  },
  {
    key: "activities",
    label: "Atividades",
    icon: Activity,
    deps: ["contacts", "companies", "deals"],
    description: "Notas, calls, meetings, tasks e e-mails das entidades acima.",
  },
];

type Counts = Partial<Record<Obj, { planned: number; remote: number; local: number }>>;

type Mode = "linked" | "full";

export function HubspotImportWizard() {
  const [mode, setMode] = useState<Mode>("linked");
  const [scope, setScope] = useState<Record<Obj, boolean>>({
    companies: true,
    contacts: true,
    deals: false,
    leads: false,
    tickets: false,
    activities: false,
  });
  const [clearScope, setClearScope] = useState<Record<Obj, boolean>>({
    companies: false,
    contacts: false,
    deals: false,
    leads: false,
    tickets: false,
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
  const clearFn = useServerFn(clearHubspotLocalTables);

  useEffect(() => {
    let active = true;
    const loadActiveJob = async () => {
      const { data } = await supabase
        .from("enrichment_jobs")
        .select("id")
        .eq("provider", "hubspot")
        .eq("kind", "import")
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active || !data?.id || jobId) return;
      setJobId(data.id);
      setStage("running");
    };
    void loadActiveJob();
    return () => {
      active = false;
    };
  }, [jobId]);

  function toggle(key: Obj, value: boolean) {
    setScope((prev) => {
      const next = { ...prev, [key]: value };
      // Em modo "linked" os filhos forçam pais; em "full" cada objeto é independente.
      if (value && mode === "linked") {
        const deps = OBJECTS.find((o) => o.key === key)!.deps;
        for (const d of deps) next[d] = true;
      }
      return next;
    });
    setCountsReady(false);
    setCounts({});
  }

  function changeMode(next: Mode) {
    setMode(next);
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
        const res = await countFn({ data: { objects: [o.key], mode, maxCompanies } });
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
      const toClear = (Object.keys(clearScope) as Obj[]).filter((k) => clearScope[k]);
      if (toClear.length > 0) {
        const ok = (await confirmDialog(`Tem certeza que deseja apagar TODOS os registros locais das tabelas: ${toClear.join(", ")}? Esta ação é irreversível.`));
        if (!ok) return;
      }
      setStage("running");
      if (toClear.length > 0) {
        const res = await clearFn({
          data: Object.fromEntries(toClear.map((k) => [k, true])) as Record<Obj, boolean>,
        });
        const summary = Object.entries(res.cleared)
          .map(([k, n]) => `${k}: ${n}`)
          .join(", ");
        toast.success(`Tabelas limpas (${summary})`);
      }
      const r = await startFn({
        data: {
          mode,
          companies: scope.companies,
          contacts: scope.contacts,
          deals: scope.deals,
          leads: scope.leads,
          tickets: scope.tickets,
          activities: scope.activities,
          maxCompanies,
        },
      });
      setJobId(r.jobId);
      toast.success(
        `Importação enfileirada (${r.steps.length} etapas). Execução em segundo plano iniciada.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enfileirar importação");
      setStage("scope");
    }
  }

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
        <h2 className="font-semibold mb-1">1. Método de importação</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Escolha como os registros do HubSpot serão trazidos para o seu CRM.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => changeMode("linked")}
            className={`text-left rounded-md border p-4 transition-colors ${
              mode === "linked"
                ? "border-primary bg-primary/5"
                : "border-border bg-background hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <Building2 className="h-4 w-4" /> Vinculado (a partir de Empresas)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Importa um conjunto de Empresas e, em cascata, apenas Contatos, Negócios, Leads e
              Atividades vinculados a elas.
            </p>
          </button>
          <button
            type="button"
            onClick={() => changeMode("full")}
            className={`text-left rounded-md border p-4 transition-colors ${
              mode === "full"
                ? "border-primary bg-primary/5"
                : "border-border bg-background hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <Activity className="h-4 w-4" /> Total (todos os registros)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Importa todos os registros de cada objeto sequencialmente (empresas → contatos →
              negócios → leads → atividades). Vínculos são feitos quando possível.
            </p>
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-1">2. Escopo da importação</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {mode === "linked"
            ? "A importação começa pelas Empresas; os demais objetos são trazidos conforme o vínculo no HubSpot."
            : "Cada objeto selecionado será importado integralmente, na ordem abaixo."}
        </p>

        {mode === "linked" && (
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
        )}

        <div className="space-y-3">
          {OBJECTS.map((o) => {
            const Icon = o.icon;
            const forcedBy =
              mode === "linked"
                ? OBJECTS.filter((x) => scope[x.key] && x.deps.includes(o.key)).map((x) => x.label)
                : [];
            return (
              <div
                key={o.key}
                className="flex items-start gap-3 p-3 rounded-md border bg-background"
              >
                <Checkbox
                  id={`scope-${o.key}`}
                  checked={scope[o.key]}
                  disabled={o.required}
                  onCheckedChange={(v) => toggle(o.key, !!v)}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`scope-${o.key}`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className="h-4 w-4" /> {o.label}
                    {o.required && (
                      <Badge variant="secondary" className="text-[10px]">
                        obrigatório
                      </Badge>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mode === "full"
                      ? `Todos os ${o.label.toLowerCase()} do HubSpot. Vínculos com registros já importados são feitos quando possível.`
                      : o.description}
                  </p>
                  {forcedBy.length > 0 && scope[o.key] && !o.required && (
                    <p className="text-xs text-amber-600 mt-1">
                      Necessário para: {forcedBy.join(", ")}
                    </p>
                  )}
                  <label
                    htmlFor={`clear-${o.key}`}
                    className="mt-2 inline-flex items-center gap-2 text-xs text-destructive cursor-pointer"
                  >
                    <Checkbox
                      id={`clear-${o.key}`}
                      checked={clearScope[o.key]}
                      onCheckedChange={(v) => setClearScope((prev) => ({ ...prev, [o.key]: !!v }))}
                    />
                    Limpar tabela local de {o.label.toLowerCase()} antes de importar
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-1">3. Pré-visualização da árvore</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Ordem de execução respeitando dependências:
        </p>
        {planned.length === 0 ? (
          <p className="text-sm text-muted-foreground">Selecione ao menos um objeto.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Objeto</th>
                  <th className="text-right font-medium px-3 py-2">A importar</th>
                  <th className="text-right font-medium px-3 py-2">Local</th>
                  <th className="text-right font-medium px-3 py-2">HubSpot</th>
                </tr>
              </thead>
              <tbody>
                {planned.map((o, i) => {
                  const Icon = o.icon;
                  const c = counts[o.key];
                  const isCounting = countingKey === o.key;
                  const fmt = (n: number) => n.toLocaleString("pt-BR");
                  return (
                    <tr key={o.key} className="border-t">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {i + 1}
                          </span>
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{o.label}</p>
                            {o.deps.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Depende de:{" "}
                                {o.deps
                                  .map((d) => OBJECTS.find((x) => x.key === d)!.label)
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {isCounting ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />…
                          </span>
                        ) : c ? (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{fmt(c.planned)}</span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                {mode === "full" ? (
                                  <p className="text-xs">
                                    Todos os {o.label.toLowerCase()} do HubSpot serão importados.
                                  </p>
                                ) : o.key === "companies" ? (
                                  <p className="text-xs">
                                    Respeita o limite definido em "Máximo de empresas".
                                  </p>
                                ) : (
                                  <p className="text-xs">
                                    Apenas {o.label.toLowerCase()} vinculados às empresas dentro do
                                    limite de importação.
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {isCounting ? "…" : c ? fmt(c.local) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {isCounting ? "…" : c ? fmt(c.remote) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">A importar</span>: registros que entrarão nesta execução ·{" "}
            <span className="font-medium">Local</span>: já existentes no seu banco ·{" "}
            <span className="font-medium">HubSpot</span>: total na sua conta HubSpot.
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
