import {
  Bot,
  Plus,
  ArrowUpRight,
  Calendar,
  FileText,
  MessageSquare,
  GitBranch,
  ArrowLeft,
  Save,
  Clock,
  Check,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoProvider, useDemo } from "./state";
import { STEPS, validateStep } from "./model";
import { toast } from "sonner";
import {
  PrototypeFrame,
  Topbar,
  Navigation,
  StudioTabs,
  WizardContent,
  WizardFooter,
  Preview,
  AgentLibrary,
  CustomerRecord,
  StudioArea,
  TestChat,
  AgentActions,
} from "./shared";
function Overview() {
  const { agent, agents, select, go, create, setArea } = useDemo();
  return (
    <div className="ap-operation">
      <aside className="ap-master">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xs font-semibold">
            AGENTES <span className="ml-2 text-muted-foreground">{agents.length}</span>
          </h2>
          <Button variant="ghost" size="icon" aria-label="Criar agente" onClick={create}>
            <Plus />
          </Button>
        </div>
        <div className="ap-agent-buttons">
          {agents.map((a) => (
            <div key={a.id}>
              <Button
                variant="ghost"
                className={`mb-2 h-auto w-full justify-start gap-3 px-3 py-4 text-left ${agent.id === a.id ? "bg-product-panel shadow-xs" : ""}`}
                onClick={() => select(a.id)}
              >
                <span
                  className={`shrink-0 ${agent.id === a.id ? "text-primary" : "text-muted-foreground"}`}
                >
                  <Bot />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{a.name}</span>
                  <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                    {a.archived ? "Arquivado" : "Homologação"} · v4
                  </span>
                </span>
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[10px] leading-relaxed text-muted-foreground">
          Cada agente mantém seu conhecimento, agenda e histórico.
        </p>
      </aside>
      <section className="ap-overview">
        <div className="mb-7 flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-medium text-success">● HOMOLOGAÇÃO</span>
            <h2 className="mt-2 text-2xl font-semibold">{agent.name}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{agent.purpose}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir estúdio do agente"
            title="Abrir estúdio"
            onClick={() => go("studio")}
          >
            <ArrowUpRight />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => go("studio")}>
            <GitBranch />
            Abrir fluxo
          </Button>
          <Button variant="outline" size="sm" onClick={() => go("wizard")}>
            Configurar
          </Button>
        </div>
        <div className="mt-8">
          <p className="text-[10px] uppercase text-muted-foreground">
            Demonstração · últimos 7 dias
          </p>
          <div className="ap-metric-row mt-3">
            {[
              ["Conversas", "128"],
              ["Resolução", "84%"],
              ["Latência", "2,4 s"],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-[10px] text-muted-foreground">{l}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{v}</p>
                <svg viewBox="0 0 120 25" className="mt-3 h-6 w-full" aria-hidden>
                  <path
                    d="M0 21L15 16L30 19L45 10L60 13L75 8L90 11L105 4L120 2"
                    fill="none"
                    strokeWidth="1.5"
                    className="stroke-primary"
                  />
                </svg>
              </div>
            ))}
          </div>
        </div>
        <h3 className="mb-4 mt-7 text-xs font-semibold">Configuração do agente</h3>
        <div className="space-y-4">
          {[
            [Bot, "Persona", `${agent.persona} · ${agent.tone}`],
            [Calendar, "Agenda", agent.host],
            [FileText, "Conhecimento", `${agent.sources.length} fontes aprovadas`],
            [MessageSquare, "Canal", agent.channel],
          ].map(([Icon, label, value]) => {
            const I = Icon as typeof Bot;
            return (
              <div
                key={String(label)}
                className="grid grid-cols-[20px_100px_minmax(0,1fr)] items-center gap-2 text-xs"
              >
                <I size={15} className="text-muted-foreground" />
                <span className="text-muted-foreground">{String(label)}</span>
                <span className="truncate">{String(value)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-7 border-t border-border-subtle pt-4">
          <AgentActions agent={agent} />
        </div>
      </section>
      <aside className="ap-activity">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Atividade recente</h3>
          <Clock size={15} className="text-muted-foreground" />
        </div>
        <div className="mt-6 space-y-5 text-xs">
          {[
            ["10:42", "Resposta com fonte", "Guia do projeto consultado"],
            ["10:36", "Troca de agente", "Equipe → Agente Técnico"],
            ["09:20", "Qualificação concluída", "Contexto entregue ao Closer"],
          ].map(([time, title, body]) => (
            <div key={time} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
              <span className="text-[10px] text-muted-foreground">{time}</span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <Button variant="link" className="mt-5 h-auto p-0 text-xs" onClick={() => go("record")}>
          Abrir histórico do cliente
          <ChevronRight />
        </Button>
        <div className="mt-8 border-t border-border-subtle pt-5">
          <h3 className="mb-4 text-xs font-semibold">Conversa de teste</h3>
          <TestChat compact key={agent.id} />
        </div>
      </aside>
    </div>
  );
}
function OperationLayout() {
  const { agent, view, go, save, step, setStep } = useDemo();
  return (
    <PrototypeFrame number={3} title="03 · Central de operação">
      <Navigation />
      {view === "operation" || view === "list" ? (
        <>
          <Topbar title="Central de agentes" subtitle="Operação / configuração / contexto">
            <Button variant="outline" size="sm" onClick={() => go("wizard")}>
              <Plus />
              Construir agente
            </Button>
          </Topbar>
          <Overview />
        </>
      ) : view === "wizard" ? (
        <>
          <Topbar title={`Configurar ${agent.name}`} subtitle="Construção em oito etapas">
            <Button size="sm" variant="outline" onClick={save}>
              <Save />
              Salvar
            </Button>
          </Topbar>
          <nav className="ap-uppersteps" aria-label="Etapas do wizard">
            {STEPS.map((s, i) => (
              <Button
                key={s}
                size="sm"
                variant="ghost"
                className={`shrink-0 text-[10px] ${step === i ? "bg-accent text-primary" : ""}`}
                onClick={() => {
                  const error =
                    i > step
                      ? Array.from({ length: i }, (_, n) => validateStep(agent, n)).find(Boolean)
                      : null;
                  if (error) {
                    toast.error(error);
                    return;
                  }
                  setStep(i);
                }}
              >
                <span className="text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                {s}
              </Button>
            ))}
          </nav>
          <div className="ap-wizard-horizontal">
            <WizardContent />
            <Preview />
          </div>
          <WizardFooter />
        </>
      ) : view === "studio" ? (
        <>
          <Topbar title={agent.name} subtitle="Modo foco / Construtor de fluxo">
            <Button variant="ghost" size="sm" onClick={() => go("operation")}>
              <ArrowLeft />
              <span className="hidden sm:inline">Operação</span>
            </Button>
            <Button size="sm" onClick={save}>
              <Save />
              Salvar
            </Button>
          </Topbar>
          <StudioTabs />
          <StudioArea layout="bottom" />
        </>
      ) : (
        <CustomerRecord />
      )}
    </PrototypeFrame>
  );
}
export function OperationModel() {
  return (
    <DemoProvider number={3} initial="operation">
      <OperationLayout />
    </DemoProvider>
  );
}
