import { Bot, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo } from "./state";
import { STEPS } from "./model";
import { FlowCanvas } from "./flow";
import { Field } from "./wizard-navigation";
import { Choice } from "./wizard-navigation";
import { Agenda } from "./agent-configuration";
import { Knowledge } from "./agent-configuration";
import { TestChat } from "./test-and-launch";
import { Launch } from "./test-and-launch";

export function Preview() {
  const { agent } = useDemo();
  return (
    <aside className="ap-preview">
      <p className="ap-caption mb-7 uppercase">Prévia do agente</p>
      <span className="mb-4 flex size-12 items-center justify-center rounded-md bg-accent text-primary">
        <Bot size={24} />
      </span>
      <h3 className="text-lg font-semibold">{agent.name}</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {agent.purpose || "Defina a finalidade do agente"}
      </p>
      <div className="mt-8 border-t border-border-subtle pt-5">
        <p className="text-[10px] text-muted-foreground">PERSONA</p>
        <p className="mt-2 text-sm font-medium">
          {agent.persona} · {agent.tone}
        </p>
        <p className="mt-4 rounded-md bg-product-panel p-4 text-xs leading-relaxed">
          Olá! Sou {agent.persona}. Qual necessidade você gostaria de conversar?
        </p>
      </div>
      <div className="mt-6 flex gap-2 text-xs">
        <Calendar size={16} className="shrink-0 text-primary" />
        <div>
          {agent.host}
          <p className="mt-1 text-[10px] text-muted-foreground">Agenda exclusiva deste agente</p>
        </div>
      </div>
      <div className="mt-6 flex gap-2 text-xs">
        <FileText size={16} className="text-primary" />
        {agent.sources.length} fontes de conhecimento
      </div>
    </aside>
  );
}

export function WizardContent() {
  const { agent, patch, step } = useDemo();
  if (step === 3) return <FlowCanvas layout="tray" />;
  return (
    <div className="ap-form">
      <p className="mb-3 text-[10px] font-medium uppercase text-primary">
        Etapa {String(step + 1).padStart(2, "0")} · {STEPS[step]}
      </p>
      <h2 className="mb-3 text-2xl font-semibold">
        {
          [
            "Qual é a missão do seu agente?",
            "Como ele deve conversar?",
            "O que ele precisa conhecer?",
            "Desenhe a conversa",
            "Quem recebe as reuniões?",
            "Onde a conversa começa?",
            "Experimente uma conversa",
            "Revise antes de lançar",
          ][step]
        }
      </h2>
      <p className="mb-8 max-w-lg text-sm leading-relaxed text-muted-foreground">
        {
          [
            "Uma finalidade clara ajuda a manter cada agente no contexto certo.",
            "Defina uma voz natural, útil e coerente com sua equipe.",
            "Selecione fontes aprovadas para sustentar as respostas.",
            "",
            "Cada agente tem um anfitrião próprio, sem agenda global implícita.",
            "Canais abaixo são demonstrações; não alteram o piloto autorizado.",
            "Teste a persona atual em uma conversa simulada.",
            "Salvar mantém o rascunho separado de qualquer agente ativo.",
          ][step]
        }
      </p>
      <div className="max-w-xl space-y-6">
        {step === 0 && (
          <>
            <Field label="Nome do agente" value={agent.name} onChange={(name) => patch({ name })} />
            <Field
              label="Finalidade"
              value={agent.purpose}
              onChange={(purpose) => patch({ purpose })}
              multiline
            />
            <div className="grid grid-cols-3 gap-2">
              {["Vendas", "Técnico", "Receptivo"].map((t) => (
                <Button
                  key={t}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patch({
                      purpose:
                        t === "Vendas"
                          ? "Prospecção e qualificação comercial"
                          : t === "Técnico"
                            ? "Informações técnicas do projeto"
                            : "Triagem e atendimento receptivo",
                    })
                  }
                >
                  {t}
                </Button>
              ))}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <Field
              label="Nome da persona"
              value={agent.persona}
              onChange={(persona) => patch({ persona })}
            />
            <Choice
              label="Tom"
              value={agent.tone}
              options={["Consultivo", "Acolhedor", "Objetivo"]}
              onChange={(tone) => patch({ tone })}
            />
            <Field
              label="Instruções de atendimento"
              value={agent.instructions}
              onChange={(instructions) => patch({ instructions })}
              multiline
            />
          </>
        )}
        {step === 2 && <Knowledge />}
        {step === 4 && <Agenda />}
        {step === 5 && (
          <>
            <Choice
              label="Canal demonstrativo"
              value={agent.channel}
              options={[
                "WhatsApp · piloto",
                "Portal · demonstração",
                "Chat · demonstração",
                "Nenhum canal",
              ]}
              onChange={(channel) => patch({ channel })}
            />
            <div className="bg-product-panel-muted p-5 text-sm">
              <p className="font-medium">Roteamento com contexto</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Entrada atribuída a este agente. Conflitos de responsabilidade seguem para a equipe
                humana.
              </p>
            </div>
          </>
        )}
        {step === 6 && <TestChat />}
        {step === 7 && <Launch />}
      </div>
    </div>
  );
}
