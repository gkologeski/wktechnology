import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  listLandingPages,
  saveLandingPage,
  deleteLandingPage,
} from "@/lib/landing-pages.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Plus, Eye, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/landing-pages/")({
  component: LandingPagesPage,
});

function LandingPagesPage() {
  const fetchList = useServerFn(listLandingPages);
  const save = useServerFn(saveLandingPage);
  const del = useServerFn(deleteLandingPage);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["landing-pages"],
    queryFn: () => fetchList(),
  });

  async function createNew() {
    const slug = `lp-${Date.now().toString(36)}`;
    await save({
      data: {
        slug,
        title: "Nova landing page",
        blocks: [
          {
            type: "hero",
            headline: "Headline principal",
            subheadline: "Subtítulo",
            cta: "Saiba mais",
          },
        ],
        theme: {},
        seo: {},
        status: "draft",
      },
    });
    toast.success("Landing page criada");
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta landing page?")) return;
    await del({ data: { id } });
    toast.success("Excluída");
    refetch();
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Landing Pages"
        description="Crie páginas de captura sem código"
        actions={
          <Button onClick={createNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova
          </Button>
        }
      />
      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(data?.pages ?? []).map((p) => (
            <Card key={p.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-xs text-muted-foreground">/lp/{p.slug}</div>
                </div>
                <Badge variant={p.status === "published" ? "default" : "secondary"}>
                  {p.status}
                </Badge>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>
                  <Eye className="h-3 w-3 inline mr-1" />
                  {p.views_count} views
                </span>
                <span>{p.conversions_count} conversões</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/landing-pages/$id" params={{ id: p.id }}>
                    Editar
                  </Link>
                </Button>
                {p.status === "published" && (
                  <Button asChild size="sm" variant="ghost">
                    <a href={`/lp/${p.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
          {(data?.pages?.length ?? 0) === 0 && (
            <p className="text-muted-foreground col-span-full">Nenhuma landing page ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}
