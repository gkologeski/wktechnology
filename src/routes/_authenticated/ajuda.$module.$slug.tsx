import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, FileQuestion, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, Skeletons, SectionHeader } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HelpMarkdown } from "@/components/help/help-markdown";
import { getHelpArticle, submitHelpFeedback } from "@/lib/help/help.functions";
import { HELP_MODULE_LABELS, isHelpModuleKey } from "@/lib/help/help-access";
import { extractToc } from "@/lib/help/help-toc";

export const Route = createFileRoute("/_authenticated/ajuda/$module/$slug")({
  head: () => ({
    meta: [
      { title: "Artigo de ajuda — TechERP" },
      { name: "description", content: "Passo a passo de uso do TechERP." },
      { property: "og:title", content: "Artigo de ajuda — TechERP" },
      { property: "og:description", content: "Passo a passo de uso do TechERP." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpArticlePage,
});

function HelpArticlePage() {
  const { module, slug } = Route.useParams();
  const fn = useServerFn(getHelpArticle);
  const feedbackFn = useServerFn(submitHelpFeedback);
  const q = useQuery({
    queryKey: ["help-article", module, slug],
    queryFn: () => fn({ data: { module, slug } }),
  });
  const [useful, setUseful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: (articleId: string) =>
      feedbackFn({ data: { articleId, useful: useful ?? true, comment: comment || null } }),
    onSuccess: () => {
      setSent(true);
      toast.success("Obrigado pela avaliação!");
    },
    onError: () => toast.error("Não foi possível registrar sua avaliação."),
  });

  const moduleName = isHelpModuleKey(module) ? HELP_MODULE_LABELS[module].name : "módulo";
  const back = (
    <Button asChild variant="outline" size="sm">
      <Link to="/ajuda/$module" params={{ module }}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao {moduleName}
      </Link>
    </Button>
  );

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        <Skeletons.Card lines={8} />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div role="alert" className="mx-auto max-w-5xl space-y-2 p-6">
        <p className="font-medium">Não foi possível carregar o artigo.</p>
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }
  const article = q.data?.article;
  if (!article) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={FileQuestion}
          title="Artigo indisponível"
          description="O artigo não existe, não foi publicado ou não está liberado para o seu acesso."
          action={back}
        />
      </div>
    );
  }
  const toc = extractToc(article.body_md);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1fr_220px]">
      <article className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {back}
          <p className="text-xs text-muted-foreground">
            Versão {article.version} · Atualizado em{" "}
            {new Date(article.updated_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{article.title}</h1>
          {article.summary && <p className="text-muted-foreground">{article.summary}</p>}
        </header>
        <HelpMarkdown body={article.body_md} />

        <section
          aria-labelledby="feedback-title"
          className="space-y-3 rounded-lg border border-border bg-card p-4"
        >
          <h2 id="feedback-title" className="text-sm font-semibold">
            Este artigo foi útil?
          </h2>
          {sent ? (
            <p role="status" className="text-sm text-muted-foreground">
              Avaliação registrada. Obrigado!
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={useful === true ? "default" : "outline"}
                  size="sm"
                  aria-pressed={useful === true}
                  onClick={() => setUseful(true)}
                >
                  <ThumbsUp className="mr-1 h-4 w-4" /> Sim
                </Button>
                <Button
                  type="button"
                  variant={useful === false ? "default" : "outline"}
                  size="sm"
                  aria-pressed={useful === false}
                  onClick={() => setUseful(false)}
                >
                  <ThumbsDown className="mr-1 h-4 w-4" /> Não
                </Button>
              </div>
              {useful !== null && (
                <div className="space-y-2">
                  <label htmlFor="help-comment" className="text-sm">
                    Comentário (opcional)
                  </label>
                  <Textarea
                    id="help-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={2000}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    disabled={send.isPending}
                    onClick={() => send.mutate(article.id)}
                  >
                    {send.isPending ? "Enviando…" : "Enviar avaliação"}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {(q.data?.related ?? []).length > 0 && (
          <section className="space-y-2">
            <SectionHeader title="Artigos relacionados" />
            <ul className="space-y-1 text-sm">
              {(q.data?.related ?? []).map((r) => (
                <li key={r.id}>
                  <Link
                    to="/ajuda/$module/$slug"
                    params={{ module, slug: r.slug }}
                    className="text-primary hover:underline"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      {toc.length > 0 && (
        <nav aria-label="Índice do artigo" className="hidden lg:block">
          <div className="sticky top-4 space-y-1 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nesta página
            </p>
            {toc.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className={`block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground ${h.level === 3 ? "pl-5" : ""}`}
              >
                {h.text}
              </a>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
