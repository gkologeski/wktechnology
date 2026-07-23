import { getPublicAppUrl } from "@/lib/app-url";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { suggestKbArticles } from "@/lib/kb-suggest.functions";
import { BookOpen, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = { subject: string; description?: string | null };

export function KbSuggestions({ subject, description }: Props) {
  const fn = useServerFn(suggestKbArticles);
  const query = `${subject ?? ""} ${description ?? ""}`.trim();
  const q = useQuery({
    queryKey: ["kb-suggest", query],
    enabled: query.length > 2,
    queryFn: () => fn({ data: { query, limit: 5 } }),
    staleTime: 60_000,
  });

  if (query.length < 3) return null;
  if (q.isLoading) {
    return (
      <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/60">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Sugestões da Base de conhecimento
        </h3>
        <p className="text-sm text-muted-foreground">Buscando artigos relacionados…</p>
      </div>
    );
  }
  const items = q.data ?? [];
  if (items.length === 0) return null;

  const copyLink = async (slug: string) => {
    const url = `${getPublicAppUrl()}/kb/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/60">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
        <BookOpen className="h-4 w-4" /> Sugestões da Base de conhecimento
      </h3>
      <ul className="space-y-2">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{a.title}</div>
              {a.excerpt && (
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.excerpt}</div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                title="Copiar link"
                onClick={() => copyLink(a.slug)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Abrir artigo" asChild>
                <a href={`/kb/${a.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
