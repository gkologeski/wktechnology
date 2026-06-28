// Wave 8 — Slice 2: Painel Copilot da Vaga (Quiet Premium)
// Rankeia pipeline com IA, gera perguntas de entrevista e drafts de outreach.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Copy, MessageSquare, ListChecks, Target } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  rankPipelineCandidates,
  suggestInterviewQuestions,
  draftOutreach,
} from "@/lib/ats/job-copilot.functions";
import { ScoreBadge } from "@/components/ats/ui";
import { cn } from "@/lib/utils";

type Rank = { candidate_id: string; score: number; reason: string };
type Question = { category: string; question: string; what_to_look_for: string };
type Outreach = { subject: string; body: string };

type Tab = "ranking" | "questions" | "outreach";

type CandidateLite = { id: string; full_name: string };

export function JobCopilotPanel({
  jobId,
  candidates,
}: {
  jobId: string;
  candidates: CandidateLite[];
}) {
  const rankFn = useServerFn(rankPipelineCandidates);
  const questionsFn = useServerFn(suggestInterviewQuestions);
  const outreachFn = useServerFn(draftOutreach);

  const [tab, setTab] = useState<Tab>("ranking");
  const [ranking, setRanking] = useState<Rank[] | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [outreach, setOutreach] = useState<Outreach | null>(null);
  const [loading, setLoading] = useState<Tab | null>(null);

  const [focus, setFocus] = useState<"mixed" | "technical" | "behavioral" | "culture">("mixed");
  const [channel, setChannel] = useState<"email" | "linkedin" | "whatsapp">("email");
  const [candidateId, setCandidateId] = useState<string>(candidates[0]?.id ?? "");

  const candName = (id: string) => candidates.find((c) => c.id === id)?.full_name ?? id;

  const doRank = async () => {
    setLoading("ranking");
    try {
      const r = await rankFn({ data: { job_id: jobId } });
      setRanking((r as { ranking: Rank[] }).ranking);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao rankear");
    } finally {
      setLoading(null);
    }
  };

  const doQuestions = async () => {
    setLoading("questions");
    try {
      const r = await questionsFn({
        data: { job_id: jobId, focus, candidate_id: candidateId || undefined },
      });
      setQuestions((r as { questions: Question[] }).questions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar perguntas");
    } finally {
      setLoading(null);
    }
  };

  const doOutreach = async () => {
    if (!candidateId) {
      toast.error("Selecione um candidato");
      return;
    }
    setLoading("outreach");
    try {
      const r = await outreachFn({ data: { job_id: jobId, candidate_id: candidateId, channel } });
      setOutreach(r as Outreach);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar mensagem");
    } finally {
      setLoading(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-1 shadow-xs">
      <header className="px-4 py-3 border-b border-border-subtle flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Sparkles className="size-4 text-text-tertiary" aria-hidden="true" />
          Copilot da vaga
        </h2>
        <nav className="flex items-center gap-1" aria-label="Abas do copilot">
          {[
            { id: "ranking" as const, label: "Ranking", icon: Target },
            { id: "questions" as const, label: "Perguntas", icon: ListChecks },
            { id: "outreach" as const, label: "Outreach", icon: MessageSquare },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "h-7 px-2 inline-flex items-center gap-1 rounded-md text-xs font-medium border transition-colors",
                  active
                    ? "border-border-strong bg-surface-2 text-text-primary"
                    : "border-transparent text-text-secondary hover:bg-surface-2",
                )}
              >
                <Icon className="size-3" aria-hidden="true" /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="p-4 space-y-3 text-sm">
        {tab === "ranking" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-text-tertiary">
                Avalia os candidatos ativos desta vaga com base na JD e nos perfis.
              </p>
              <Button size="sm" onClick={doRank} disabled={loading === "ranking"} className="h-8">
                {loading === "ranking" ? (
                  <Loader2 className="size-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="size-3 mr-1" />
                )}
                Rankear pipeline
              </Button>
            </div>
            {ranking && ranking.length === 0 && (
              <p className="text-xs text-text-tertiary">Nenhum resultado retornado.</p>
            )}
            {ranking && ranking.length > 0 && (
              <ul className="space-y-2">
                {ranking.slice(0, 10).map((r) => (
                  <li
                    key={r.candidate_id}
                    className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 flex items-start gap-3"
                  >
                    <ScoreBadge score={r.score} />
                    <div className="flex-1 min-w-0">
                      <Link
                        to="/candidates/$id"
                        params={{ id: r.candidate_id }}
                        className="text-sm font-medium text-text-primary hover:underline"
                      >
                        {candName(r.candidate_id)}
                      </Link>
                      <p className="text-xs text-text-secondary mt-0.5">{r.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "questions" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
                  Foco
                </label>
                <Select value={focus} onValueChange={(v) => setFocus(v as typeof focus)}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Misto</SelectItem>
                    <SelectItem value="technical">Técnico</SelectItem>
                    <SelectItem value="behavioral">Comportamental</SelectItem>
                    <SelectItem value="culture">Cultural</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
                  Personalizar para
                </label>
                <Select value={candidateId} onValueChange={setCandidateId}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Genérico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Genérico (sem candidato)</SelectItem>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              onClick={doQuestions}
              disabled={loading === "questions"}
              className="h-8 w-full"
            >
              {loading === "questions" ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="size-3 mr-1" />
              )}
              Gerar perguntas
            </Button>
            {questions && questions.length === 0 && (
              <p className="text-xs text-text-tertiary">Sem perguntas geradas.</p>
            )}
            {questions && questions.length > 0 && (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {questions.map((q, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium">
                      {q.category}
                    </div>
                    <p className="text-sm text-text-primary mt-1">{q.question}</p>
                    {q.what_to_look_for && (
                      <p className="text-xs text-text-secondary mt-1">
                        <span className="text-text-tertiary">O que avaliar: </span>
                        {q.what_to_look_for}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "outreach" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
                  Canal
                </label>
                <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="linkedin">LinkedIn InMail</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
                  Candidato
                </label>
                <Select value={candidateId} onValueChange={setCandidateId}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              onClick={doOutreach}
              disabled={loading === "outreach" || !candidateId}
              className="h-8 w-full"
            >
              {loading === "outreach" ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="size-3 mr-1" />
              )}
              Gerar mensagem
            </Button>
            {outreach && (
              <div className="rounded-lg border border-border-subtle bg-surface-2 p-3 space-y-2">
                {outreach.subject && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium mb-0.5">
                      Assunto
                    </div>
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-text-primary flex-1">{outreach.subject}</p>
                      <button
                        type="button"
                        onClick={() => copy(outreach.subject)}
                        className="text-text-tertiary hover:text-text-primary"
                        aria-label="Copiar assunto"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium mb-0.5 flex items-center justify-between">
                    <span>Mensagem</span>
                    <button
                      type="button"
                      onClick={() =>
                        copy(
                          outreach.subject
                            ? `${outreach.subject}\n\n${outreach.body}`
                            : outreach.body,
                        )
                      }
                      className="text-text-tertiary hover:text-text-primary inline-flex items-center gap-1"
                    >
                      <Copy className="size-3" /> copiar tudo
                    </button>
                  </div>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                    {outreach.body}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
