/** Áreas Campanhas, Públicos e Resultados do protótipo (dados demonstrativos). */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";
import { Panel, demo } from "./shared";
import { DEMO_AUDIENCES, DEMO_CAMPAIGNS, DEMO_FLOW, DEMO_RESULTS, DEMO_SERVICES } from "./data";

export function Campaigns() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState(DEMO_SERVICES[0]);
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel className="min-w-0">
        <SectionHeader
          title="Campanhas"
          description="A campanha controla público, abordagem e limites. O agente controla a conversa."
          action={
            <Button size="sm" onClick={() => setStep(0)}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Nova campanha
            </Button>
          }
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                {[
                  "Campanha",
                  "Agente",
                  "Público",
                  "Situação",
                  "Respostas",
                  "Qualif.",
                  "Reuniões",
                ].map((h) => (
                  <th key={h} className="py-2 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-product-divider">
              {DEMO_CAMPAIGNS.map((c) => (
                <tr key={c.name}>
                  <td className="py-2 pr-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.service}</p>
                  </td>
                  <td className="pr-3">{c.agent}</td>
                  <td className="pr-3">{c.audience}</td>
                  <td className="pr-3">
                    <Badge variant={c.state === "Em andamento" ? "default" : "secondary"}>
                      {c.state}
                    </Badge>
                  </td>
                  <td className="pr-3">{c.answered}</td>
                  <td className="pr-3">{c.qualified}</td>
                  <td>{c.meetings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel className="min-w-0">
        <SectionHeader
          title="Montar campanha"
          description={`Etapa ${step + 1} de ${DEMO_FLOW.length}`}
        />
        <ol className="mt-3 space-y-2">
          {DEMO_FLOW.map((f, i) => (
            <li key={f.step}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === step
                    ? "border-primary bg-primary/10"
                    : "border-product-divider hover:bg-product-canvas",
                )}
              >
                <span className="font-medium">
                  {i + 1}. {f.step}
                </span>
                {i === step && <p className="mt-1 text-xs text-muted-foreground">{f.note}</p>}
              </button>
            </li>
          ))}
        </ol>
        {step === 0 && (
          <div className="mt-4 space-y-2">
            <label htmlFor="proto-service" className="text-xs font-medium">
              Serviço (catálogo)
            </label>
            <select
              id="proto-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {DEMO_SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        {step === 1 && (
          <div className="mt-4 rounded-md border border-product-divider p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Bot className="h-4 w-4" aria-hidden /> SDR Ana
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configurado em Agentes. Aqui você só seleciona e acompanha.
            </p>
            <Button asChild variant="link" size="sm" className="px-0">
              <Link to="/agents/sdr">Abrir configuração do agente</Link>
            </Button>
          </div>
        )}
        <div className="mt-4 flex justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Voltar
          </Button>
          {step < DEMO_FLOW.length - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Próxima etapa
            </Button>
          ) : (
            <Button size="sm" onClick={() => demo("Salvar como rascunho")}>
              Salvar rascunho
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}

export function Audiences() {
  const [q, setQ] = useState("");
  const list = DEMO_AUDIENCES.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel>
      <SectionHeader
        title="Públicos"
        description="Base interna, importações, busca Apollo e listas salvas no mesmo lugar."
        action={
          <Button size="sm" variant="outline" onClick={() => demo("Importar planilha")}>
            Importar
          </Button>
        }
      />
      <div className="relative mt-3 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar público…"
          aria-label="Buscar público"
          className="h-9 pl-8"
        />
      </div>
      {list.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Nenhum público encontrado"
          description="Tente outro termo ou importe uma lista."
        />
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <article key={a.name} className="rounded-md border border-product-divider p-3">
              <p className="text-sm font-medium">{a.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {a.origin} · atualizado {a.updated}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-semibold">{a.size.toLocaleString("pt-BR")}</span>
                <Button size="sm" variant="outline" onClick={() => demo("Usar em campanha")}>
                  Usar em campanha
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function Results() {
  return (
    <Panel>
      <SectionHeader
        title="Resultados por serviço"
        description="Números demonstrativos. Na versão real, cada indicador mostra a cobertura dos dados."
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              {[
                "Serviço",
                "Enviados",
                "Respostas",
                "Qualificados",
                "Reuniões",
                "Principal perda",
              ].map((h) => (
                <th key={h} className="py-2 pr-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-product-divider">
            {DEMO_RESULTS.map((r) => (
              <tr key={r.dim}>
                <td className="py-2 pr-3 font-medium">{r.dim}</td>
                <td className="pr-3">{r.sent}</td>
                <td className="pr-3">{r.answered}</td>
                <td className="pr-3">{r.qualified}</td>
                <td className="pr-3">{r.meetings}</td>
                <td>{r.lost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
