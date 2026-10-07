import { Link } from "@tanstack/react-router";
import { ArrowUpRight, GitBranch, ListChecks, PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/techhire/ui";
export function PrototypeComparison() {
  return (
    <section className="mx-auto max-w-6xl py-4">
      <PageHeader
        title="Três formas de construir agentes"
        description="Escolha a experiência que combina com a sua operação."
      />
      <div className="mt-10 grid gap-8 xl:grid-cols-3">
        {[
          {
            id: 1,
            name: "Estúdio",
            note: "Canvas primeiro",
            description:
              "Uma bancada profissional: blocos à esquerda, fluxo ao centro e configuração contextual.",
            Icon: GitBranch,
            to: "/agents/prototype/1" as const,
          },
          {
            id: 2,
            name: "Assistente de criação",
            note: "Uma etapa por vez",
            description:
              "Construção guiada com formulário central, trilha de etapas e prévia do agente.",
            Icon: ListChecks,
            to: "/agents/prototype/2" as const,
          },
          {
            id: 3,
            name: "Central de operação",
            note: "Contexto primeiro",
            description:
              "Agentes, configuração, atividade e conversa reunidos em uma visão master-detail.",
            Icon: PanelsTopLeft,
            to: "/agents/prototype/3" as const,
          },
        ].map((d) => (
          <article
            key={d.id}
            className="overflow-hidden rounded-md bg-product-panel shadow-xs ring-1 ring-border-subtle"
          >
            <div className="flex h-52 gap-2 bg-product-canvas p-5" aria-hidden>
              {d.id === 1 ? (
                <>
                  <div className="w-8 bg-product-toolbar" />
                  <div className="flex flex-1 items-center justify-around gap-2">
                    <span className="h-8 w-12 rounded-md bg-primary/20" />
                    <span className="h-12 w-14 rounded-md bg-primary" />
                    <span className="h-8 w-12 rounded-md bg-product-panel" />
                  </div>
                  <div className="w-12 bg-product-panel" />
                </>
              ) : d.id === 2 ? (
                <>
                  <div className="w-10 space-y-3 bg-product-toolbar p-2">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="h-2 bg-primary/30" />
                    ))}
                  </div>
                  <div className="flex-1 space-y-4 bg-product-panel p-4">
                    <div className="h-3 w-3/4 bg-foreground/30" />
                    <div className="h-8 bg-product-panel-muted" />
                    <div className="h-12 bg-product-panel-muted" />
                    <div className="ml-auto h-5 w-12 bg-primary" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 space-y-3 bg-product-toolbar p-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-6 rounded-md bg-product-panel" />
                    ))}
                  </div>
                  <div className="flex-1 space-y-4 bg-product-panel p-3">
                    <div className="h-4 w-3/4 bg-foreground/20" />
                    <div className="flex gap-2">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="h-10 flex-1 bg-primary/20" />
                      ))}
                    </div>
                    <div className="h-12 bg-product-panel-muted" />
                  </div>
                  <div className="w-10 bg-product-panel-muted" />
                </>
              )}
            </div>
            <div className="p-6">
              <p className="text-[10px] uppercase text-muted-foreground">
                0{d.id} · {d.note}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{d.name}</h2>
              <p className="mt-3 min-h-16 text-sm leading-relaxed text-muted-foreground">
                {d.description}
              </p>
              <Button asChild variant="outline" className="mt-5 w-full justify-between">
                <Link to={d.to}>
                  Explorar modelo
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Protótipos • dados de demonstração · sem alteração em agentes ou canais reais
      </p>
    </section>
  );
}
