// Wave 8 — Painel Copilot do Candidato (Quiet Premium)
// Apresenta um resumo IA + chat Q&A grounded no perfil do candidato.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askCandidateCopilot, summarizeCandidate } from "@/lib/ats/copilot.functions";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
type Summary = {
  headline?: string;
  strengths?: string[];
  risks?: string[];
  next_step?: string;
};

export function CandidateCopilotPanel({ candidateId }: { candidateId: string }) {
  const ask = useServerFn(askCandidateCopilot);
  const summarize = useServerFn(summarizeCandidate);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSum, setLoadingSum] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);

  const onSummarize = async () => {
    setLoadingSum(true);
    try {
      const r = await summarize({ data: { candidate_id: candidateId } });
      setSummary(r as Summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar resumo");
    } finally {
      setLoadingSum(false);
    }
  };

  const onAsk = async (text?: string) => {
    const question = (text ?? q).trim();
    if (!question || sending) return;
    setSending(true);
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setQ("");
    try {
      const r = await ask({
        data: { candidate_id: candidateId, question, history: messages.slice(-10) },
      });
      setMessages([...next, { role: "assistant", content: (r as { answer: string }).answer }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar IA");
      setMessages(next);
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    "Resumir experiência em 3 frases",
    "Principais riscos para a vaga",
    "Sugerir perguntas para a próxima entrevista",
  ];

  return (
    <section className="bg-surface-1 rounded-xl border border-border-subtle shadow-xs">
      <header className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Sparkles className="size-4 text-text-tertiary" />
          Copilot
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={onSummarize}
          disabled={loadingSum}
          className="h-7 text-xs"
        >
          {loadingSum ? <Loader2 className="size-3 animate-spin" /> : "Resumir candidato"}
        </Button>
      </header>

      <div className="p-4 space-y-3 text-sm">
        {summary && (
          <div className="rounded-lg border border-border-subtle bg-surface-2 p-3 space-y-2">
            {summary.headline && <p className="text-text-primary">{summary.headline}</p>}
            {!!summary.strengths?.length && (
              <div>
                <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mb-1">
                  Forças
                </div>
                <ul className="list-disc pl-4 text-text-secondary space-y-0.5">
                  {summary.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!summary.risks?.length && (
              <div>
                <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mb-1">
                  Riscos
                </div>
                <ul className="list-disc pl-4 text-text-secondary space-y-0.5">
                  {summary.risks.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.next_step && (
              <div className="text-text-secondary">
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mr-2">
                  Próximo passo
                </span>
                {summary.next_step}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {messages.length === 0 && !summary && (
            <p className="text-xs text-text-tertiary">
              Pergunte algo sobre o candidato — as respostas usam apenas dados do perfil, CV,
              aplicações e scorecards.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-surface-2 text-text-primary"
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
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onAsk(s)}
                disabled={sending}
                className="text-[11px] rounded-full border border-border-subtle px-2 py-1 text-text-secondary hover:bg-surface-2 disabled:opacity-50"
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
          className="flex items-center gap-2 pt-1"
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pergunte sobre o candidato..."
            disabled={sending}
            className="h-8 text-sm"
          />
          <Button size="sm" type="submit" disabled={sending || !q.trim()} className="h-8">
            <Send className="size-3.5" />
          </Button>
        </form>
      </div>
    </section>
  );
}
