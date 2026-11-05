import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getHelpArticle, getHelpForRoute } from "@/lib/help/help.functions";
import { HelpMarkdown } from "@/components/help/help-markdown";
import { isHelpModuleKey } from "@/lib/help/help-access";

/** Botão "?" do cabeçalho: abre o artigo cujo route_pattern casa com a tela atual. */
export function HelpButton() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const routeFn = useServerFn(getHelpForRoute);
  const articleFn = useServerFn(getHelpArticle);

  const match = useQuery({
    queryKey: ["help-route", path],
    queryFn: () => routeFn({ data: { path } }),
    enabled: open,
    staleTime: 60_000,
  });
  const raw = match.data?.article ?? null;
  // Só abre artigos de módulos conhecidos; o servidor já filtrou por acesso.
  const found = raw && isHelpModuleKey(raw.module_key) ? raw : null;
  const body = useQuery({
    queryKey: ["help-article", found?.module_key, found?.slug],
    queryFn: () => articleFn({ data: { module: found!.module_key, slug: found!.slug } }),
    enabled: open && !!found,
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Ajuda desta tela"
        title="Ajuda desta tela"
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="h-4 w-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{found?.title ?? "Ajuda desta tela"}</SheetTitle>
            <SheetDescription>
              {found?.summary ?? "Material de treinamento da tela atual."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4" aria-live="polite">
            {match.isLoading || (found && body.isLoading) ? (
              <p role="status" className="text-sm text-muted-foreground">
                Carregando…
              </p>
            ) : match.isError || body.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar a ajuda desta tela.
              </p>
            ) : !found ? (
              <div className="space-y-3">
                <p className="text-sm">Sem material para esta tela.</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/ajuda" onClick={() => setOpen(false)}>
                    Abrir a Ajuda e Treinamento
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link
                    to="/ajuda/$module/$slug"
                    params={{ module: found.module_key, slug: found.slug }}
                    onClick={() => setOpen(false)}
                  >
                    <ExternalLink className="mr-1 h-4 w-4" /> Abrir artigo completo
                  </Link>
                </Button>
                {body.data?.article && <HelpMarkdown body={body.data.article.body_md} />}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
