// AI Recruitment Notetaker — gera resumo, pontos fortes, preocupações,
// follow-ups e recomendação a partir da transcrição/anotações de entrevista.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, FileText, RefreshCw, AlertCircle, CheckCircle2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  SectionHeader,
  EmptyState,
  MetaPill,
  Skeletons,
} from "@/components/techhire/ui";
import { cn } from "@/lib/utils";
import {
  listRecentInterviews,
  getInterviewWithNotes,
  generateInterviewNotes,
} from "@/lib/ats/notetaker.functions";

export const Route = createFileRoute("/_authenticated/(ats)/notetaker")({
  head: () => ({ meta: [{ title: "Notetaker IA — ATS" }] }),
  component: NotetakerPage,
});

type ItvRow = {
  id: string;
  scheduled_at: string | null;
  kind: string;
  status: string;
  ai_generated_at: string | null;
  ai_recommendation: string | null;
  ai_score: number | null;
};

type Notes = {
  id: string;
  transcript: string | null;
  ai_summary: string | null;
  ai_strengths: string[] | null;
  ai_concerns: string[] | null;
  ai_followups: string[] | null;
  ai_recommendation: string | null;
  ai_score: number | null;
  ai_generated_at: string | null;
  ai_model: string | null;
};

const REC_MAP: Record<string, { label: string; className: string }> = {
  strong_hire: {
    label: "Forte contratação",
    className: "bg-success/10 text-success border-success/30",
  },
  hire: {
    label: "Contratar",
    className: "bg-success/10 text-success border-success/30",
  },
  neutral: { label: "Neutro", className: "" },
  no_hire: {
    label: "Não contratar",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  strong_no_hire: {
    label: "Forte rejeição",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

function NotetakerPage() {
  const listFn = useServerFn(listRecentInterviews);
  const getFn = useServerFn(getInterviewWithNotes);
  const genFn = useServerFn(generateInterviewNotes);

  const [rows, setRows] = useState<ItvRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState<Notes | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    listFn()
      .then((r) => setRows(r as ItvRow[]))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setListLoading(false));
  }, [listFn]);

  useEffect(() => {
    if (!selectedId) {
      setNotes(null);
      setTranscript("");
      return;
    }
    setLoading(true);
    getFn({ data: { interview_id: selectedId } })
      .then((n) => {
        const nn = n as Notes | null;
        setNotes(nn);
        setTranscript(nn?.transcript ?? "");
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [selectedId, getFn]);

  async function handleGenerate() {
    if (!selectedId) return;
    if (transcript.trim().length < 40) {
      toast.error("Transcrição muito curta — cole ao menos algumas frases.");
      return;
    }
    setGenerating(true);
    try {
      await genFn({ data: { interview_id: selectedId, transcript } });
      const fresh = (await getFn({ data: { interview_id: selectedId } })) as Notes | null;
      setNotes(fresh);
      toast.success("Notas geradas pela IA.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const aiCount = rows.filter((r) => r.ai_generated_at).length;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        eyebrow="Inteligência (IA)"
        title="Notetaker IA"
        description="Cole a transcrição ou anotações da entrevista e a IA gera resumo, pontos fortes, preocupações, follow-ups e recomendação."
        secondaryActions={
          listLoading ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <MetaPill>{rows.length} entrevistas recentes</MetaPill>
              <MetaPill>{aiCount} já analisadas</MetaPill>
            </div>
          )
        }
      />

      <section className="surface-1 space-y-4 rounded-lg border p-6">
        <SectionHeader title="Entrevista" description="Selecione a sessão a analisar." />

        {listLoading ? (
          <Skeletons.Row />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhuma entrevista encontrada"
            description="Agende ou registre uma entrevista para usar o Notetaker IA."
          />
        ) : (
          <div className="space-y-2">
            <Label htmlFor="itv-select">Entrevista</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger id="itv-select">
                <SelectValue placeholder="Selecione uma entrevista recente" />
              </SelectTrigger>
              <SelectContent>
                {rows.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.scheduled_at ? new Date(r.scheduled_at).toLocaleString("pt-BR") : "Sem data"}{" "}
                    · {r.kind} · {r.status}
                    {r.ai_generated_at ? " · IA ✓" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedId && (
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label htmlFor="transcript">Transcrição / anotações</Label>
              <Textarea
                id="transcript"
                rows={10}
                placeholder="Cole aqui a transcrição da reunião ou suas anotações detalhadas..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                disabled={loading || generating}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {transcript.length.toLocaleString("pt-BR")} caracteres
              </span>
              <Button
                onClick={handleGenerate}
                disabled={generating || loading || transcript.trim().length < 40}
              >
                {generating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar notas com IA
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </section>

      {loading && selectedId && <Skeletons.Card />}

      {notes?.ai_generated_at && !loading && (
        <section className="surface-1 space-y-5 rounded-lg border p-6">
          <SectionHeader
            title="Análise da IA"
            description={`Gerado em ${new Date(notes.ai_generated_at).toLocaleString("pt-BR")} · modelo ${notes.ai_model ?? "—"}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                {notes.ai_recommendation && (
                  <MetaPill className={REC_MAP[notes.ai_recommendation]?.className}>
                    {REC_MAP[notes.ai_recommendation]?.label ?? notes.ai_recommendation}
                  </MetaPill>
                )}
                {typeof notes.ai_score === "number" && <MetaPill>Score {notes.ai_score}</MetaPill>}
              </div>
            }
          />

          {notes.ai_summary && (
            <AnalysisSection icon={FileText} title="Resumo" iconTone="text-muted-foreground">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {notes.ai_summary}
              </p>
            </AnalysisSection>
          )}

          {(notes.ai_strengths ?? []).length > 0 && (
            <AnalysisSection
              icon={CheckCircle2}
              title="Pontos fortes"
              iconTone="text-[hsl(var(--status-success-fg))]"
            >
              <BulletList items={notes.ai_strengths!} />
            </AnalysisSection>
          )}

          {(notes.ai_concerns ?? []).length > 0 && (
            <AnalysisSection
              icon={AlertCircle}
              title="Preocupações"
              iconTone="text-[hsl(var(--status-warning-fg))]"
            >
              <BulletList items={notes.ai_concerns!} />
            </AnalysisSection>
          )}

          {(notes.ai_followups ?? []).length > 0 && (
            <AnalysisSection
              icon={ListChecks}
              title="Follow-ups sugeridos"
              iconTone="text-[hsl(var(--status-info-fg))]"
            >
              <BulletList items={notes.ai_followups!} />
            </AnalysisSection>
          )}
        </section>
      )}
    </div>
  );
}

function AnalysisSection({
  icon: Icon,
  title,
  iconTone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  iconTone?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconTone ?? "text-muted-foreground")} aria-hidden />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}
