// AI Recruitment Notetaker — gera resumo, pontos fortes, preocupações,
// follow-ups e recomendação a partir da transcrição/anotações de entrevista.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const REC_LABEL: Record<string, { label: string; tone: string }> = {
  strong_hire: { label: "Forte contratação", tone: "bg-emerald-600" },
  hire: { label: "Contratar", tone: "bg-emerald-500" },
  neutral: { label: "Neutro", tone: "bg-slate-500" },
  no_hire: { label: "Não contratar", tone: "bg-orange-500" },
  strong_no_hire: { label: "Forte rejeição", tone: "bg-red-600" },
};

function NotetakerPage() {
  const listFn = useServerFn(listRecentInterviews);
  const getFn = useServerFn(getInterviewWithNotes);
  const genFn = useServerFn(generateInterviewNotes);

  const [rows, setRows] = useState<ItvRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState<Notes | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    listFn()
      .then((r) => setRows(r as ItvRow[]))
      .catch((e: Error) => toast.error(e.message));
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

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Notetaker IA</h1>
          <p className="text-sm text-muted-foreground">
            Cole a transcrição/anotações da entrevista e a IA gera resumo, pontos fortes,
            preocupações, follow-ups e recomendação.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entrevista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma entrevista recente" />
            </SelectTrigger>
            <SelectContent>
              {rows.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.scheduled_at
                    ? new Date(r.scheduled_at).toLocaleString("pt-BR")
                    : "Sem data"}{" "}
                  · {r.kind} · {r.status}
                  {r.ai_generated_at ? " · IA ✓" : ""}
                </SelectItem>
              ))}
              {rows.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhuma entrevista encontrada.
                </div>
              )}
            </SelectContent>
          </Select>

          {selectedId && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Transcrição / anotações</label>
                <Textarea
                  rows={10}
                  placeholder="Cole aqui a transcrição da reunião ou suas anotações detalhadas..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  disabled={loading || generating}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {transcript.length.toLocaleString("pt-BR")} caracteres
                  </span>
                  <Button onClick={handleGenerate} disabled={generating || loading}>
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
            </>
          )}
        </CardContent>
      </Card>

      {notes?.ai_generated_at && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Análise da IA
            </CardTitle>
            <div className="flex items-center gap-2">
              {notes.ai_recommendation && (
                <Badge className={REC_LABEL[notes.ai_recommendation]?.tone}>
                  {REC_LABEL[notes.ai_recommendation]?.label ?? notes.ai_recommendation}
                </Badge>
              )}
              {typeof notes.ai_score === "number" && (
                <Badge variant="outline">Score: {notes.ai_score}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <section>
              <h3 className="mb-1 font-medium">Resumo</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{notes.ai_summary}</p>
            </section>
            {(notes.ai_strengths ?? []).length > 0 && (
              <section>
                <h3 className="mb-1 font-medium text-emerald-600">Pontos fortes</h3>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {notes.ai_strengths!.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </section>
            )}
            {(notes.ai_concerns ?? []).length > 0 && (
              <section>
                <h3 className="mb-1 font-medium text-orange-600">Preocupações</h3>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {notes.ai_concerns!.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </section>
            )}
            {(notes.ai_followups ?? []).length > 0 && (
              <section>
                <h3 className="mb-1 font-medium">Follow-ups sugeridos</h3>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {notes.ai_followups!.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </section>
            )}
            <p className="text-xs text-muted-foreground">
              Gerado em {new Date(notes.ai_generated_at).toLocaleString("pt-BR")} · modelo{" "}
              {notes.ai_model}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
