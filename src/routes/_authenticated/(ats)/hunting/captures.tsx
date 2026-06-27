// Hunting · Capturas — lista dos candidatos trazidos pela extensão LinkedIn.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtsPageHeader, EmptyState, RowSkeleton } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { listRecentCaptures } from "@/lib/ats/hunting.functions";

export const Route = createFileRoute("/_authenticated/(ats)/hunting/captures")({
  component: HuntingCapturesPage,
});

function HuntingCapturesPage() {
  const fetchCaptures = useServerFn(listRecentCaptures);
  const q = useQuery({
    queryKey: ["hunting-captures"],
    queryFn: () => fetchCaptures({ data: { limit: 100 } }),
    staleTime: 15_000,
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Hunting"
        title="Candidatos capturados"
        description="Últimos 100 perfis trazidos do LinkedIn pela extensão TechHire Hunter."
      />

      {q.isLoading ? (
        <Skeletons rows={6} />
      ) : (q.data?.captures ?? []).length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhuma captura ainda"
          description="Instale a extensão Chrome, abra um perfil no LinkedIn e clique em 'Salvar candidato'."
          action={{ label: "Instalar extensão", to: "/hunting/install" }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {(q.data?.captures ?? []).map((c) => {
                const cand = c.candidate;
                return (
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {cand?.full_name ?? "—"}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          LinkedIn
                        </Badge>
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
                    <div className="flex shrink-0 items-center gap-2">
                      {cand?.linkedin_url && (
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={cand.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            LinkedIn
                          </a>
                        </Button>
                      )}
                      <Button asChild size="sm">
                        <a href={`/candidates?focus=${c.candidate_id}`}>Ver no ATS</a>
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
