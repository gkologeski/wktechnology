import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getKbArticlePublic } from "@/lib/kb.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen } from "lucide-react";

export const Route = createFileRoute("/kb/$slug")({
  component: KbArticle,
});

function KbArticle() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getKbArticlePublic);
  const { data, isLoading, error } = useQuery({
    queryKey: ["kb-article", slug],
    queryFn: () => fn({ data: { slug } }),
  });

  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (error || !data) return <div className="min-h-screen grid place-items-center text-destructive">Artigo não encontrado.</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <Link to="/kb" className="text-sm text-muted-foreground hover:text-foreground">Central de Ajuda</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Button variant="ghost" size="sm" asChild><Link to="/kb"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
        <article className="prose prose-sm dark:prose-invert max-w-none">
          <h1>{data.title}</h1>
          {data.excerpt && <p className="lead text-muted-foreground">{data.excerpt}</p>}
          <div className="whitespace-pre-wrap text-foreground">{data.body}</div>
        </article>
      </main>
    </div>
  );
}
