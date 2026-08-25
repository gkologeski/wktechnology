// Hunting · Capturas — lista dos candidatos trazidos pela extensão LinkedIn.
// Onda 5 / Slice 5.6 — adiciona seleção em massa + enriquecimento com IA.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ExternalLink, Inbox, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AtsPageHeader, EmptyState, RowSkeleton } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@tanstack/react-router";
import { listRecentCaptures } from "@/lib/ats/hunting.functions";
import { enrichCapturesBulk } from "@/lib/ats/hunting-enrich.functions";

export const Route = createFileRoute("/_authenticated/(ats)/hunting/captures")({
  component: HuntingCapturesPage,
});

function HuntingCapturesPage() {
  const qc = useQueryClient();
  const fetchCaptures = useServerFn(listRecentCaptures);
  const enrich = useServerFn(enrichCapturesBulk);

  const q = useQuery({
    queryKey: ["hunting-captures"],
    queryFn: () => fetchCaptures({ data: { limit: 100 } }),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const captures = q.data?.captures ?? [];
  const allChecked = captures.length > 0 && selected.size === captures.length;

  const enrichMut = useMutation({
    mutationFn: (ids: string[]) => enrich({ data: { capture_ids: ids } }),
    onSuccess: (r) => {
      toast.success(`Enriquecidos: ${r.ok} · falhas: ${r.failed}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["hunting-captures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(captures.map((c) => c.id)));
  }

  function runEnrich() {
    const ids = Array.from(selected).slice(0, 20);
    if (!ids.length) return;
    enrichMut.mutate(ids);
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Hunting"
        title="Candidatos capturados"
        description="Últimos 100 perfis trazidos do LinkedIn pela extensão TechHire Hunter."
        primaryAction={
          selected.size > 0 ? (
            <Button size="sm" onClick={runEnrich} disabled={enrichMut.isPending}>
              <Sparkles className="mr-1 h-4 w-4" />
              {enrichMut.isPending
                ? "Enriquecendo..."
                : `Enriquecer com IA (${Math.min(selected.size, 20)})`}
            </Button>
          ) : undefined
        }
      />

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : captures.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhuma captura ainda"
          description="Instale a extensão Chrome, abra um perfil no LinkedIn e clique em 'Salvar candidato'."
          action={
            <Button asChild size="sm">
              <Link to="/hunting/install">Instalar extensão</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-2">
              <Checkbox
                checked={allChecked}
                onCheckedChange={toggleAll}
                aria-label="Selecionar todos"
              />
              <span className="text-xs text-muted-foreground">
                {selected.size > 0
                  ? `${selected.size} selecionados`
                  : "Selecione para enriquecer com IA"}
              </span>
            </div>
            <div className="divide-y">
              {captures.map((c) => {
                const cand = c.candidate;
                const checked = selected.has(c.id);
                return (
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(c.id)}
                        aria-label="Selecionar"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{cand?.full_name ?? "—"}</p>
                          <Badge variant="outline" className="text-xs">
                            LinkedIn
                          </Badge>
                          {Array.isArray((cand as unknown as { skills?: unknown[] })?.skills) &&
                            (cand as unknown as { skills: unknown[] }).skills.length > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-emerald-400 text-emerald-600"
                              >
                                enriquecido
                              </Badge>
                            )}
                        </div>

                        <p className="truncate text-xs text-muted-foreground">
                          {cand?.current_position ?? "—"}
                          {cand?.current_company ? ` · ${cand.current_company}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Capturado{" "}
                          {formatDistanceToNow(new Date(c.captured_at as string), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {cand?.linkedin_url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={cand.linkedin_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            LinkedIn
                          </a>
                        </Button>
                      )}
                      <Button asChild size="sm">
                        <a href={`/candidates/${c.candidate_id}`}>Ver no ATS</a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
