import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Building2, Users, Target, UserPlus, Activity, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { startHubspotImport } from "@/lib/integrations/hubspot.functions";
import { ImportTimeline } from "./import-timeline";

type Obj = "companies" | "contacts" | "deals" | "leads" | "activities";

const OBJECTS: { key: Obj; label: string; icon: typeof Building2; deps: Obj[]; description: string }[] = [
  { key: "companies", label: "Empresas", icon: Building2, deps: [], description: "Raiz da árvore de dependências." },
  { key: "contacts", label: "Contatos", icon: Users, deps: ["companies"], description: "Vínculo automático com empresas se importadas." },
  { key: "deals", label: "Negócios", icon: Target, deps: ["companies", "contacts"], description: "Inclui vínculos deal↔contact." },
  { key: "leads", label: "Leads", icon: UserPlus, deps: [], description: "Contatos com lifecyclestage=lead no HubSpot." },
  { key: "activities", label: "Atividades", icon: Activity, deps: ["contacts", "companies", "deals"], description: "Notas, calls, meetings, tasks e e-mails." },
];

export function HubspotImportWizard() {
  const [scope, setScope] = useState<Record<Obj, boolean>>({
    companies: true,
    contacts: true,
    deals: false,
    leads: false,
    activities: false,
  });
  const [maxPerObject, setMaxPerObject] = useState(200);
  const [stage, setStage] = useState<"scope" | "running">("scope");
  const [jobId, setJobId] = useState<string | null>(null);

  const startFn = useServerFn(startHubspotImport);

  // Auto-add parent dependencies when toggling a child on
  function toggle(key: Obj, value: boolean) {
    setScope((prev) => {
      const next = { ...prev, [key]: value };
      if (value) {
        const deps = OBJECTS.find((o) => o.key === key)!.deps;
        for (const d of deps) next[d] = true;
      }
      return next;
    });
  }

  const planned = useMemo(() => {
    // Recompute order respecting dependencies
    const wanted = new Set<Obj>();
    for (const o of OBJECTS) if (scope[o.key]) wanted.add(o.key);
    return OBJECTS.filter((o) => wanted.has(o.key));
  }, [scope]);

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
          maxPerObject,
        },
      });
      setJobId(r.jobId);
      toast.success(`Importação concluída: ${r.succeeded} ok / ${r.failed} falhas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
      setStage("scope");
    }
  }

  // When start kicks off, we don't have jobId yet. Fetch latest running job once via polling.
  useEffect(() => {
    if (stage !== "running" || jobId) return;
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      // poll for the most recent running hubspot import job created in the last 30s
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
          <ImportTimeline jobId={jobId} onReset={() => { setStage("scope"); setJobId(null); }} />
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
          Selecione quais objetos do HubSpot importar. Selecionar um filho marca automaticamente os pais necessários.
        </p>
        <div className="space-y-3">
          {OBJECTS.map((o) => {
            const Icon = o.icon;
            const forcedBy = OBJECTS.filter((x) => scope[x.key] && x.deps.includes(o.key)).map((x) => x.label);
            return (
              <div key={o.key} className="flex items-start gap-3 p-3 rounded-md border bg-background">
                <Checkbox
                  id={`scope-${o.key}`}
                  checked={scope[o.key]}
                  onCheckedChange={(v) => toggle(o.key, !!v)}
                />
                <div className="flex-1">
                  <Label htmlFor={`scope-${o.key}`} className="flex items-center gap-2 cursor-pointer">
                    <Icon className="h-4 w-4" /> {o.label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">{o.description}</p>
                  {forcedBy.length > 0 && scope[o.key] && (
                    <p className="text-xs text-amber-600 mt-1">
                      Necessário para: {forcedBy.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <Label className="text-xs">Máximo de registros por objeto</Label>
            <Input
              type="number"
              min={1}
              max={2000}
              value={maxPerObject}
              onChange={(e) => setMaxPerObject(Math.max(1, Math.min(2000, Number(e.target.value) || 200)))}
            />
            <p className="text-xs text-muted-foreground mt-1">Recomendado &le; 500 por execução.</p>
          </div>
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
                    <Badge variant="outline">até {maxPerObject}</Badge>
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
      </section>

      <div className="flex justify-end gap-2">
        <Button onClick={handleStart} disabled={planned.length === 0}>
          Iniciar importação
        </Button>
      </div>
    </div>
  );
}

export const StatusIcon = ({ status }: { status: string }) => {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
};
