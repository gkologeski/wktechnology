// Assistente de análise (somente leitura) do painel do TechProjects.
// Responde com os números do próprio painel, nas permissões do usuário, e cita fonte/período/geração.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/techhire/ui";
import { askProjectsAssistant } from "@/lib/projects/assistant.functions";
import type { DashFilters } from "@/lib/projects/dashboard-views.shared";
import { PROJECTS_ASSISTANT_MAX_QUESTION_CHARS } from "@/lib/limits";

const EXAMPLES = [
  "Onde há horas aguardando revisão?",
  "Quem está com sobrecarga de alocação?",
  "Quais projetos estão com prazo vencido?",
];

export function AssistantSheet({ filters }: { filters: DashFilters }) {
  const ask = useServerFn(askProjectsAssistant);
  const [question, setQuestion] = useState("");
  const m = useMutation({
    mutationFn: (q: string) =>
      ask({
        data: {
          question: q,
          filters: Object.fromEntries(
            Object.entries(filters).filter(([k, v]) => k !== "compare" && v !== undefined && v !== ""),
          ) as DashFilters,
        },
      }),
  });
  const submit = (q: string) => {
    const t = q.trim();
    if (t.length < 3 || m.isPending) return;
    setQuestion(t);
    m.mutate(t);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <MessageSquareText className="mr-2 h-4 w-4" aria-hidden />
          Perguntar
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Assistente de análise</SheetTitle>
          <SheetDescription>
            Somente leitura: usa os números deste painel com as suas permissões, no período {filters.from} a{" "}
            {filters.to}. Não aprova, não aponta e não altera nada.
          </SheetDescription>
        </SheetHeader>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(question);
          }}
        >
          <Label htmlFor="assistant-q">Sua pergunta</Label>
          <Textarea
            id="assistant-q"
            rows={3}
            maxLength={PROJECTS_ASSISTANT_MAX_QUESTION_CHARS}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex.: Onde há pendências de horas neste mês?"
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((x) => (
              <Button key={x} type="button" size="sm" variant="ghost" onClick={() => submit(x)} disabled={m.isPending}>
                {x}
              </Button>
            ))}
          </div>
          <Button type="submit" disabled={m.isPending || question.trim().length < 3}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Perguntar
          </Button>
        </form>

        <div aria-live="polite" className="grid gap-3">
          {m.isPending && <p className="text-sm text-muted-foreground">Consultando o painel…</p>}
          {m.isError && (
            <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              {(m.error as Error).message || "Não foi possível consultar o assistente."} Os números do painel continuam disponíveis
              nos cartões.
            </p>
          )}
          {m.data && (
            <article className="grid gap-3 rounded-md border border-border p-3">
              {m.data.noData && (
                <EmptyState compact title="Sem base para responder" description="Nenhuma consulta trouxe dados para esta pergunta." />
              )}
              <p className="whitespace-pre-wrap text-sm">{m.data.answer}</p>
              {m.data.citations.length > 0 && (
                <div className="grid gap-1">
                  <p className="text-xs font-medium text-muted-foreground">Fontes</p>
                  <ul className="grid gap-1 text-sm">
                    {m.data.citations.map((c) => (
                      <li key={c.href + c.label}>
                        <a href={c.href} className="text-primary hover:underline">
                          {c.label}
                        </a>{" "}
                        <span className="text-xs text-muted-foreground">
                          · {c.source}
                          {c.generated_at ? ` · gerado ${new Date(c.generated_at).toLocaleString("pt-BR")}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Método: {m.data.method} Período {m.data.period} ({filters.tz}). Consultas: {m.data.tools.length}.
              </p>
            </article>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
