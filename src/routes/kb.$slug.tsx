import { createFileRoute, Link } from "@tanstack/react-router";
import { getKbArticlePublic } from "@/lib/kb.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen } from "lucide-react";
import { HtmlContent } from "@/components/rich-html-editor";

export const Route = createFileRoute("/kb/$slug")({
  loader: async ({ params }) => {
    try {
      const data = await getKbArticlePublic({ data: { slug: params.slug } });
      return { article: data };
    } catch {
      return { article: null };
    }
  },
  head: ({ params, loaderData }) => {
    const a = loaderData?.article as {
      title?: string;
      excerpt?: string | null;
      body?: string;
    } | null;
    const url = `https://app.wktechnology.com.br/kb/${params.slug}`;
    const title = a?.title
      ? `${a.title} — Central de Ajuda WK Technology CRM`
      : "Artigo — Central de Ajuda WK Technology CRM";
    const rawDesc = a?.excerpt || (a?.body ? a.body.slice(0, 160) : "");
    const description =
      rawDesc && rawDesc.length >= 50
        ? rawDesc
        : "Artigo da Central de Ajuda do WK Technology CRM com instruções e boas práticas para usar a plataforma de CRM.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: a?.title
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: a.title,
                description,
                articleBody: a.body ?? "",
                url,
                publisher: {
                  "@type": "Organization",
                  name: "WK Technology CRM",
                },
              }),
            },
          ]
        : undefined,
    };
  },
  component: KbArticle,
});

function KbArticle() {
  const { article: data } = Route.useLoaderData();

  if (!data)
    return (
      <div className="min-h-screen grid place-items-center text-destructive">
        Artigo não encontrado.
      </div>
    );

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <Link to="/kb" className="text-sm text-muted-foreground hover:text-foreground">
            Central de Ajuda
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/kb">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Link>
        </Button>
        <article className="prose prose-sm dark:prose-invert max-w-none">
          <h1>{data.title}</h1>
          {data.excerpt && <p className="lead text-muted-foreground">{data.excerpt}</p>}
          <HtmlContent html={data.body} className="text-foreground" />
        </article>
      </main>
    </div>
  );
}
