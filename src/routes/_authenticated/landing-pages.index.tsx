import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  listLandingPages,
  saveLandingPage,
  deleteLandingPage,
} from "@/lib/landing-pages.functions";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ExternalLink, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/landing-pages/")({
  component: LandingPagesPage,
});

type LP = {
  id: string;
  slug: string;
  title: string;
  status: string;
  views_count?: number | null;
  conversions_count?: number | null;
  updated_at?: string | null;
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} d`;
  const mo = Math.floor(d / 30);
  return `há ${mo} mes${mo > 1 ? "es" : ""}`;
}

function StatusPill({ status }: { status: string }) {
  const published = status === "published";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest ${
        published ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${published ? "bg-primary" : "bg-muted-foreground"}`}
      />
      {published ? "Publicada" : "Rascunho"}
    </span>
  );
}

function LandingPagesPage() {
  const fetchList = useServerFn(listLandingPages);
  const save = useServerFn(saveLandingPage);
  const del = useServerFn(deleteLandingPage);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await del({ data: { id: pendingDelete.id } });
      toast.success("Excluída");
      setPendingDelete(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  }

  const pages = (data?.pages ?? []) as LP[];
  const [featured, ...rest] = pages;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header editorial */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-border pb-6 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-serif italic text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Landing pages
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Crie páginas de captura e acompanhe conversões.
            </p>
          </div>
          <Button onClick={createNew} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Nova landing page
          </Button>
        </header>

        {isLoading ? (
          <LoadingSkeleton />
        ) : pages.length === 0 ? (
          <EmptyState onCreate={createNew} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Featured */}
            <FeaturedCard
              page={featured}
              onDelete={() => setPendingDelete({ id: featured.id, title: featured.title })}
            />

            {/* Rest */}
            {rest.map((p) => (
              <SecondaryCard
                key={p.id}
                page={p}
                onDelete={() => setPendingDelete({ id: p.id, title: p.title })}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir landing page?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A landing page
              {pendingDelete ? ` "${pendingDelete.title}"` : ""} será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FeaturedCard({ page, onDelete }: { page: LP; onDelete: () => void }) {
  const views = page.views_count ?? 0;
  const convs = page.conversions_count ?? 0;
  const rate = views > 0 ? ((convs / views) * 100).toFixed(1) : "0.0";
  const published = page.status === "published";

  return (
    <article className="md:col-span-2 group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-lg">
      <div className="aspect-video md:aspect-auto md:h-72 bg-muted relative">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
          <LayoutTemplate className="w-24 h-24" />
        </div>
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20 backdrop-blur-sm">
            Destaque
          </span>
        </div>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-card-foreground leading-tight truncate">
              {page.title}
            </h2>
            <p className="text-sm text-muted-foreground font-mono mt-1 truncate">/lp/{page.slug}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Status
            </div>
            <StatusPill status={page.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
          <div>
            <div className="text-xs text-muted-foreground">Views</div>
            <div className="text-2xl font-bold tabular-nums">{views.toLocaleString("pt-BR")}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Conversões</div>
            <div className="text-2xl font-bold tabular-nums">
              {convs.toLocaleString("pt-BR")}{" "}
              <span className="text-sm font-normal text-muted-foreground">({rate}%)</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">Atualizada {timeAgo(page.updated_at)}</div>
          <div className="flex gap-2">
            {published && (
              <Button asChild size="sm" variant="outline">
                <a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Ver pública
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="secondary">
              <Link to="/landing-pages/$id" params={{ id: page.id }}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Editar
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function SecondaryCard({ page, onDelete }: { page: LP; onDelete: () => void }) {
  const views = page.views_count ?? 0;
  const convs = page.conversions_count ?? 0;
  const rate = views > 0 ? `${((convs / views) * 100).toFixed(1)}%` : "0%";

  return (
    <article className="flex flex-col rounded-xl border border-border bg-card transition-all hover:shadow-md">
      <div className="aspect-video bg-muted/50 relative">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/15">
          <LayoutTemplate className="w-12 h-12" />
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <StatusPill status={page.status} />
          </div>
          <h3 className="text-lg font-bold text-card-foreground line-clamp-2">
            <Link
              to="/landing-pages/$id"
              params={{ id: page.id }}
              className="hover:underline underline-offset-2"
            >
              {page.title}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground mt-1 font-mono truncate">/lp/{page.slug}</p>
        </div>

        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-2">
          <div className="flex gap-4">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Views</div>
              <div className="text-sm font-bold tabular-nums">{views.toLocaleString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">Conv.</div>
              <div className="text-sm font-bold tabular-nums">{rate}</div>
            </div>
          </div>
          <div className="flex gap-1">
            {page.status === "published" && (
              <Button asChild size="sm" variant="ghost" aria-label="Ver pública">
                <a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="ghost" aria-label="Editar">
              <Link to="/landing-pages/$id" params={{ id: page.id }}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              aria-label="Excluir"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <LayoutTemplate className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">Nenhuma landing page ainda</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Crie sua primeira página de captura para começar a converter visitantes em leads.
      </p>
      <Button onClick={onCreate} className="mt-6">
        <Plus className="h-4 w-4 mr-2" />
        Nova landing page
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 h-[480px] rounded-xl border border-border bg-card animate-pulse" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[300px] rounded-xl border border-border bg-card animate-pulse" />
      ))}
    </div>
  );
}
