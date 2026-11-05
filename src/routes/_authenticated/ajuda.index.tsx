import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Clock, Rocket, Search } from "lucide-react";
import { EmptyState, PageHeader, Skeletons, SectionHeader } from "@/components/techhire/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getHelpHome, searchHelp } from "@/lib/help/help.functions";
import {
  HELP_ARTICLE_TYPE_LABELS,
  HELP_MODULE_LABELS,
  isHelpModuleKey,
} from "@/lib/help/help-access";
import { splitHighlight } from "@/lib/help/help-toc";

export const Route = createFileRoute("/_authenticated/ajuda/")({
  head: () => ({
    meta: [
      { title: "Ajuda e Treinamento — TechERP" },
      {
        name: "description",
        content: "Material de treinamento e guias de uso de cada módulo do TechERP.",
      },
      { property: "og:title", content: "Ajuda e Treinamento — TechERP" },
      {
        property: "og:description",
        content: "Guias de uso e treinamento de cada módulo do TechERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpHome,
});

function moduleName(key: string) {
  return isHelpModuleKey(key) ? HELP_MODULE_LABELS[key].name : key;
}

function HelpHome() {
  const homeFn = useServerFn(getHelpHome);
  const searchFn = useServerFn(searchHelp);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const home = useQuery({ queryKey: ["help-home"], queryFn: () => homeFn() });
  const search = useQuery({
    queryKey: ["help-search", submitted],
    queryFn: () => searchFn({ data: { q: submitted } }),
    enabled: submitted.length >= 2,
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Central de ajuda"
        title="Ajuda e Treinamento"
        description="Aprenda a operar cada módulo do TechERP. Você vê apenas o material dos módulos que pode acessar."
      />

      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(term.trim());
        }}
      >
        <label htmlFor="help-search" className="sr-only">
          Pesquisar na Ajuda
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="help-search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Pesquise por tela, ação ou dúvida (ex.: importar contatos)"
            className="pl-9"
            maxLength={200}
          />
        </div>
        <Button type="submit" disabled={term.trim().length < 2}>
          Pesquisar
        </Button>
      </form>

      {submitted.length >= 2 && (
        <section aria-live="polite" className="space-y-3">
          <SectionHeader title={`Resultados para “${submitted}”`} />
          {search.isLoading ? (
            <div className="space-y-2">
              <Skeletons.Row />
              <Skeletons.Row />
              <Skeletons.Row />
            </div>
          ) : search.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível pesquisar. Tente novamente em instantes.
            </p>
          ) : (search.data ?? []).length === 0 ? (
            <EmptyState
              compact
              icon={Search}
              title="Nenhum artigo encontrado"
              description="Tente outras palavras ou navegue pelos módulos abaixo."
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {(search.data ?? []).map((hit) => (
                <li key={hit.id}>
                  <Link
                    to="/ajuda/$module/$slug"
                    params={{ module: hit.module_key, slug: hit.slug }}
                    className="block p-4 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="text-xs text-muted-foreground">
                      {moduleName(hit.module_key)} ·{" "}
                      {HELP_ARTICLE_TYPE_LABELS[
                        hit.article_type as keyof typeof HELP_ARTICLE_TYPE_LABELS
                      ] ?? hit.article_type}
                    </p>
                    <p className="font-medium">{hit.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {splitHighlight(hit.snippet).map((p, i) =>
                        p.hit ? (
                          <mark key={i} className="rounded bg-primary/15 px-0.5 text-foreground">
                            {p.text}
                          </mark>
                        ) : (
                          <span key={i}>{p.text}</span>
                        ),
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {home.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeletons.Card />
          <Skeletons.Card />
          <Skeletons.Card />
        </div>
      ) : home.isError ? (
        <div role="alert" className="space-y-2 rounded-lg border border-border p-6">
          <p className="font-medium">Não foi possível carregar a Ajuda.</p>
          <Button variant="outline" onClick={() => void home.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <SectionHeader title="Módulos" description="Somente os módulos liberados para você." />
            {(home.data?.modules ?? []).length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Nenhum módulo disponível"
                description="Seu acesso não libera nenhum módulo no momento. Fale com o administrador do workspace."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(home.data?.modules ?? []).map((m) => {
                  const count = (home.data?.counts as Record<string, number> | undefined)?.[m] ?? 0;
                  const quick = home.data?.quickstarts.find((q) => q.module_key === m);
                  return (
                    <div
                      key={m}
                      className="flex flex-col rounded-lg border border-border bg-card p-4"
                    >
                      <Link
                        to="/ajuda/$module"
                        params={{ module: m }}
                        className="font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {HELP_MODULE_LABELS[m].name}
                      </Link>
                      <p className="mt-1 flex-1 text-sm text-muted-foreground">
                        {HELP_MODULE_LABELS[m].description}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{count === 0 ? "Material em preparação" : `${count} artigo(s)`}</span>
                        {quick && (
                          <Link
                            to="/ajuda/$module/$slug"
                            params={{ module: m, slug: quick.slug }}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Rocket className="h-3 w-3" /> Primeiros 15 minutos
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader title="Atualizados recentemente" />
            {(home.data?.recent ?? []).length === 0 ? (
              <EmptyState
                compact
                icon={Clock}
                title="Ainda não há artigos publicados"
                description="O conteúdo de cada módulo será publicado aos poucos."
              />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {(home.data?.recent ?? []).map((a) => (
                  <li key={a.id}>
                    <Link
                      to="/ajuda/$module/$slug"
                      params={{ module: a.module_key, slug: a.slug }}
                      className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/50"
                    >
                      <span className="font-medium">{a.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {moduleName(a.module_key)} ·{" "}
                        {new Date(a.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
