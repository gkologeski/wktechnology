// Wave 8 — Slice 4: Página global do Recruiter Copilot.
// Chat enxuto em "Quiet Premium" sobre o estado do workspace ATS.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/techhire/ui";
import { askGlobalCopilot } from "@/lib/ats/global-copilot.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/(ats)/copilot")({
  component: CopilotPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Quais vagas precisam de mais atenção agora?",
  "Onde está o maior gargalo do funil?",
  "Quais fontes de candidatos estão entregando mais resultado?",
  "Resuma a saúde do pipeline em 5 bullets",
  "Quantas ofertas estão em aberto e qual o status?",
];

function CopilotPage() {
  const ask = useServerFn(askGlobalCopilot);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const onAsk = async (text?: string) => {
    const question = (text ?? q).trim();
    if (!question || sending) return;
    setSending(true);
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setQ("");
    try {
      const r = await ask({ data: { question, history: messages.slice(-10) } });
      setMessages([...next, { role: "assistant", content: (r as { answer: string }).answer }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar IA");
      setMessages(next);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inteligência (IA)"
        title="Recruiter Copilot"
        description="Pergunte sobre vagas, funil, fontes, ofertas e prioridades. Respostas baseadas no estado atual do seu workspace ATS."
      />

      <section className="bg-surface-1 rounded-xl border border-border-subtle shadow-xs flex flex-col h-[calc(100vh-260px)] min-h-[480px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-text-tertiary max-w-xl">
              Comece com uma das sugestões abaixo ou faça sua própria pergunta. O copiloto usa
              apenas dados agregados dos últimos 90 dias (vagas, aplicações, candidatos, ofertas e
              entrevistas) — sem inventar números.
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap max-w-3xl",
                m.role === "user"
                  ? "bg-surface-2 text-text-primary ml-auto"
                  : "bg-surface-1 border border-border-subtle text-text-secondary",
              )}
            >
              {m.content}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Loader2 className="size-3 animate-spin" /> Pensando...
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length === 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onAsk(s)}
                disabled={sending}
                className="text-[11px] rounded-full border border-border-subtle px-2.5 py-1 text-text-secondary hover:bg-surface-2 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onAsk();
          }}
          className="border-t border-border-subtle p-3 flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pergunte sobre o estado do recrutamento..."
            disabled={sending}
            className="h-9 text-sm"
          />
          <Button size="sm" type="submit" disabled={sending || !q.trim()} className="h-9">
            <Send className="size-3.5" />
          </Button>
        </form>
      </section>
    </div>
  );
}
