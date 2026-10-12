/**
 * Protótipo navegável da nova Prospecção (aprovação visual).
 * Estado local e dados demonstrativos — nenhuma leitura ou escrita real.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, FlaskConical, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard, PageHeader, SectionHeader } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";
import { AREAS, DEMO_FLOW, DEMO_NEXT_ACTIONS, DEMO_OVERVIEW, type DemoArea } from "./data";
import { Panel, demo } from "./shared";
import { Audiences, Campaigns, Results } from "./areas";

function Overview() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {DEMO_OVERVIEW.map((m, i) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            hint={m.hint}
            tone={i === 4 ? "negative" : i === 2 ? "positive" : "neutral"}
          />
        ))}
      </div>
      <Panel>
        <SectionHeader
          title="Fluxo de uma campanha"
          description="Do público à reunião, sempre com a conversa ligada à pessoa, empresa e negócio."
        />
        <ol className="mt-4 grid gap-3 md:grid-cols-5">
          {DEMO_FLOW.map((f, i) => (
            <li
              key={f.step}
              className="rounded-md border border-product-divider bg-product-canvas p-3"
            >
              <span className="text-xs font-medium text-primary">Etapa {i + 1}</span>
              <p className="mt-1 text-sm font-semibold">{f.step}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">{f.note}</p>
            </li>
          ))}
        </ol>
      </Panel>
      <MyWork compact />
    </div>
  );
}

function MyWork({ compact = false }: { compact?: boolean }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  return (
    <Panel>
      <SectionHeader
        title={compact ? "Próximas ações" : "Minhas próximas ações"}
        description="Ordenadas por prazo. Respostas recebidas sobem para o topo."
        action={
          !compact && (
            <Button size="sm" onClick={() => demo("Iniciar fila")}>
              <Play className="mr-1 h-4 w-4" aria-hidden /> Iniciar fila
            </Button>
          )
        }
      />
      <ul className="mt-3 divide-y divide-product-divider">
        {DEMO_NEXT_ACTIONS.map((a) => {
          const isDone = done.has(a.person);
          return (
            <li key={a.person} className="flex flex-wrap items-center gap-3 py-3">
              <button
                type="button"
                aria-label={isDone ? `Reabrir ${a.person}` : `Concluir ${a.person}`}
                onClick={() =>
                  setDone((s) => {
                    const n = new Set(s);
                    if (n.has(a.person)) n.delete(a.person);
                    else n.add(a.person);
                    return n;
                  })
                }
                className="rounded-full text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <div className={cn("min-w-48 flex-1", isDone && "opacity-50 line-through")}>
                <p className="text-sm font-medium">{a.person}</p>
                <p className="text-xs text-muted-foreground">
                  {a.company} · {a.service}
                </p>
              </div>
              <Badge variant="outline">{a.channel}</Badge>
              <Badge variant="secondary">{a.state}</Badge>
              <span className="w-28 text-xs text-muted-foreground">{a.due}</span>
              <span className="w-16 text-xs">{a.owner}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function ProspectingPrototype() {
  const [area, setArea] = useState<DemoArea>("visao-geral");
  return (
    <div className="space-y-4">
      <div
        role="note"
        className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
      >
        <FlaskConical className="h-4 w-4 text-primary" aria-hidden />
        Protótipo para aprovação: dados de exemplo, nenhuma mensagem é enviada e nada é gravado.
        <Link to="/prospecting" className="ml-auto text-primary underline-offset-2 hover:underline">
          Voltar à Prospecção atual
        </Link>
      </div>
      <PageHeader
        eyebrow="TechSales"
        title="Prospecção"
        description="Central operacional: o que fazer agora, campanhas, públicos e resultados."
        tabs={
          <nav aria-label="Áreas da Prospecção" className="flex gap-1 overflow-x-auto">
            {AREAS.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.hint}
                onClick={() => setArea(a.id)}
                aria-current={area === a.id ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  area === a.id
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {a.label}
              </button>
            ))}
          </nav>
        }
      />
      {area === "visao-geral" && <Overview />}
      {area === "meu-trabalho" && <MyWork />}
      {area === "campanhas" && <Campaigns />}
      {area === "publicos" && <Audiences />}
      {area === "resultados" && <Results />}
    </div>
  );
}
