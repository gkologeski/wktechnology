import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Lock } from "lucide-react";
import { EmptyState, PageHeader, SectionHeader, Skeletons } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { getHelpModule } from "@/lib/help/help.functions";
import {
  HELP_ARTICLE_TYPES,
  HELP_ARTICLE_TYPE_LABELS,
  HELP_MODULE_LABELS,
  isHelpModuleKey,
} from "@/lib/help/help-access";

export const Route = createFileRoute("/_authenticated/ajuda/$module/")({
  head: ({ params }) => {
    const name = isHelpModuleKey(params.module) ? HELP_MODULE_LABELS[params.module].name : "Módulo";
    return {
      meta: [
        { title: `Ajuda — ${name} | TechERP` },
        { name: "description", content: `Treinamento e guias de uso do ${name} no TechERP.` },
        { property: "og:title", content: `Ajuda — ${name} | TechERP` },
        { property: "og:description", content: `Guias de uso do ${name}.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: HelpModulePage,
});

function HelpModulePage() {
  const { module } = Route.useParams();
  const fn = useServerFn(getHelpModule);
  const q = useQuery({
    queryKey: ["help-module", module],
    queryFn: () => fn({ data: { module } }),
  });
  const label = isHelpModuleKey(module) ? HELP_MODULE_LABELS[module] : null;

  const back = (
    <Button asChild variant="outline" size="sm">
      <Link to="/ajuda">
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar à Ajuda
      </Link>
    </Button>
  );

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3">
        <Skeletons.Card />
        <Skeletons.Card />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div role="alert" className="mx-auto max-w-6xl space-y-2 p-6">
        <p className="font-medium">Não foi possível carregar este módulo.</p>
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }
  if (!label || !q.data?.allowed) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Lock}
          title="Material indisponível"
          description="Este módulo não existe ou não está liberado para o seu acesso."
          action={back}
        />
      </div>
    );
  }

  const articles = q.data.articles;
  const overview = articles.find((a) => a.article_type === "overview");

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Sumário do módulo" className="hidden lg:block">
        <div className="sticky top-4 space-y-1 text-sm">
          {HELP_ARTICLE_TYPES.filter((t) => articles.some((a) => a.article_type === t)).map((t) => (
            <a
              key={t}
              href={`#tipo-${t}`}
              className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {HELP_ARTICLE_TYPE_LABELS[t]}
            </a>
          ))}
        </div>
      </nav>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Ajuda e Treinamento"
          title={label.name}
          description={overview?.summary || label.description}
          secondaryActions={back}
        />
        {articles.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Material em preparação"
            description="Os artigos deste módulo ainda não foram publicados."
          />
        ) : (
          HELP_ARTICLE_TYPES.filter((t) => articles.some((a) => a.article_type === t)).map((t) => (
            <section key={t} id={`tipo-${t}`} className="scroll-mt-20 space-y-2">
              <SectionHeader title={HELP_ARTICLE_TYPE_LABELS[t]} />
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {articles
                  .filter((a) => a.article_type === t)
                  .map((a) => (
                    <li key={a.id}>
                      <Link
                        to="/ajuda/$module/$slug"
                        params={{ module, slug: a.slug }}
                        className="block p-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="font-medium">{a.title}</span>
                        {!a.is_published && (
                          <span className="ml-2 text-xs text-muted-foreground">(rascunho)</span>
                        )}
                        {a.summary && (
                          <span className="block text-sm text-muted-foreground">{a.summary}</span>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
