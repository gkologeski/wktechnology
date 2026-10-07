import { useState } from "react";
import { toast } from "sonner";
import { Check, Send, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useDemo } from "./state";
import { demoReply } from "./model";
import { Agenda } from "./agent-configuration";

export function TestChat({ compact = false }: { compact?: boolean }) {
  const { agent } = useDemo();
  const [message, setMessage] = useState(""),
    [messages, setMessages] = useState([
      { role: "agent", text: `Olá! Sou ${agent.persona}. Como posso ajudar?` },
    ]);
  const send = () => {
    if (!message.trim()) return;
    setMessages((all) => [
      ...all,
      { role: "user", text: message },
      { role: "agent", text: demoReply(agent, message) },
    ]);
    setMessage("");
  };
  return (
    <div className="ap-chat">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
        <span className="text-xs font-medium">
          {agent.persona} · {agent.tone}
        </span>
        <span className="ap-caption">Simulação local</span>
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
              send();
            }
          }}
        />
        <Button
          size="icon"
          aria-label="Enviar teste local"
          disabled={!message.trim()}
          onClick={send}
        >
          <Send />
        </Button>
      </div>
      <p className="px-4 pb-3 text-[10px] text-muted-foreground">
        Texto apenas · anexos indisponíveis · sem envio real
      </p>
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
      {[
        "Identidade e persona definidas",
        "Fontes de conhecimento disponíveis",
        "Agenda e equipe selecionadas",
        "Teste local disponível",
      ].map((s) => (
        <div key={s} className="flex items-center gap-3 border-b border-border-subtle pb-3 text-sm">
          <Check size={16} className="text-success" />
          {s}
        </div>
      ))}
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
