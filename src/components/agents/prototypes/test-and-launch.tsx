import { useState } from "react";
import { toast } from "sonner";
import { Check, Send, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useDemo } from "./state";
import { runFlow, type TraceEntry } from "@/lib/agents/flow/runtime";
import { sandboxTools } from "@/lib/agents/flow/sandbox-tools";
import { DEMO_CATALOG, DEMO_SLOTS, flowIssues, validateStep, STEPS } from "./model";
import { Agenda } from "./agent-configuration";

export function TestChat({ compact = false }: { compact?: boolean }) {
  const { agent } = useDemo();
  const [message, setMessage] = useState(""),
    [messages, setMessages] = useState([
      { role: "agent", text: `Olá! Sou ${agent.persona}. Como posso ajudar?` },
    ]);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [origin, setOrigin] = useState<"Receptivo" | "Prospecção">("Receptivo");
  const send = async () => {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    setMessages((all) => [...all, { role: "user", text }]);
    const result = await runFlow(
      { nodes: structuredClone(agent.nodes), edges: agent.edges },
      {
        message: text,
        contact: { nome: "Cliente demo", empresa: "Empresa demo" },
        origin,
        vars: {},
      },
      sandboxTools({
        persona: agent.persona,
        sources: agent.sources,
        catalog: DEMO_CATALOG,
        slotsByHost: DEMO_SLOTS,
        contact: { nome: "Cliente demo" },
      }),
    );
    setTrace(result.trace);
    setMessages((all) => [
      ...all,
      ...(result.replies.length ? result.replies : [`(sem resposta · ${result.status})`]).map(
        (r) => ({ role: "agent", text: r }),
      ),
    ]);
  };
  return (
    <div className="ap-chat">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
        <span className="text-xs font-medium">
          {agent.persona} · {agent.tone}
        </span>
        <span className="flex items-center gap-2">
          <select
            aria-label="Origem simulada"
            className="rounded-md border border-input bg-background px-1 py-0.5 text-[10px]"
            value={origin}
            onChange={(e) => setOrigin(e.target.value as "Receptivo" | "Prospecção")}
          >
            <option>Receptivo</option>
            <option>Prospecção</option>
          </select>
          <span className="ap-caption">Sandbox · mesmo executor</span>
        </span>
      </div>
      <div className="ap-chat-log" aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] text-xs leading-relaxed ${m.role === "user" ? "ml-auto rounded-md bg-accent px-4 py-3 text-accent-foreground" : "mr-auto"}`}
          >
            {m.role === "agent" && (
              <span className="mb-1 block text-[10px] font-semibold text-primary">
                {agent.persona}
              </span>
            )}
            {m.text}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 border-t border-border-subtle p-4">
        <Textarea
          rows={compact ? 2 : 3}
          aria-label="Mensagem de teste"
          value={message}
          placeholder="Escreva uma mensagem…"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button
          size="icon"
          aria-label="Enviar teste local"
          disabled={!message.trim()}
          onClick={() => void send()}
        >
          <Send />
        </Button>
      </div>
      <p className="px-4 pb-3 text-[10px] text-muted-foreground">
        Texto apenas · anexos indisponíveis · ferramentas simuladas, nada enviado ou gravado
      </p>
      {trace.length > 0 && (
        <details className="border-t border-border-subtle px-4 py-2 text-[11px]" open>
          <summary className="cursor-pointer font-medium">
            Trace da execução ({trace.length} blocos)
          </summary>
          <ol className="mt-2 space-y-1">
            {trace.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-24 shrink-0 truncate text-muted-foreground">
                  {agent.nodes.find((n) => n.id === s.nodeId)?.title ?? s.type}
                </span>
                <span className="text-primary">{s.port ?? "—"}</span>
                <span className="min-w-0 truncate text-muted-foreground">{s.detail}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

export function Launch() {
  const { agent } = useDemo();
  const [checked, setChecked] = useState(false);
  return (
    <div className="space-y-6">
      <div>
        <ShieldCheck className="mb-3 text-primary" size={26} />
        <h3 className="text-xl font-semibold">Conferência de lançamento</h3>
        <p className="mt-2 text-sm text-muted-foreground">{agent.name} · rascunho v4</p>
      </div>
      {STEPS.slice(0, 6).map((name, i) => {
        const problem = validateStep(agent, i);
        return (
          <div
            key={name}
            className="flex items-start gap-3 border-b border-border-subtle pb-3 text-sm"
          >
            {problem ? (
              <span className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-destructive" />
            ) : (
              <Check size={16} className="mt-0.5 shrink-0 text-success" />
            )}
            <span>
              {name}
              {problem && <span className="block text-xs text-destructive">{problem}</span>}
            </span>
          </div>
        );
      })}
      {flowIssues(agent).filter((i) => i.level === "aviso").length > 0 && (
        <p className="text-xs text-muted-foreground">
          {flowIssues(agent).filter((i) => i.level === "aviso").length} avisos no fluxo (saídas sem
          conexão ou blocos inalcançáveis).
        </p>
      )}
      <div className="flex items-center justify-between">
        <Label htmlFor="demo-active">Agente ativo</Label>
        <Switch id="demo-active" disabled />
      </div>
      <p className="text-xs text-muted-foreground">
        Ativação indisponível no protótipo. Homologação restrita ao piloto existente.
      </p>
      <Button
        variant="outline"
        onClick={() => {
          setChecked(true);
          toast.success("Conferência local concluída");
        }}
      >
        <RefreshCw />
        {checked ? "Conferência atualizada" : "Conferir novamente"}
      </Button>
      <div className="rounded-md bg-product-panel-muted p-4 text-xs">
        Canal do exemplo: {agent.channel}
        <br />
        <span className="mt-2 block text-muted-foreground">
          Conectar, desconectar e publicar não estão disponíveis.
        </span>
      </div>
    </div>
  );
}
