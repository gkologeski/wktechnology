import { History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SubstatusBadge } from "@/components/pipelines/substatus-badge";
import { useSubstatusHistory } from "@/lib/pipelines/substatus-history";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** Histórico compacto das alterações de substatus de um Lead ou Negócio. */
export function SubstatusHistory({
  entity,
  entityId,
  className,
}: {
  entity: "leads" | "deals";
  entityId?: string | null;
  className?: string;
}) {
  const q = useSubstatusHistory(entity, entityId);

  return (
    <section className={cn("space-y-2", className)} aria-label="Histórico de substatus">
      <h3 className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <History className="h-3 w-3" aria-hidden />
        Histórico de substatus
      </h3>

      {q.isLoading && (
        <div className="space-y-1.5" aria-hidden>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {q.error && (
        <p className="text-xs text-destructive" role="alert">
          Não foi possível carregar o histórico. Recarregue a página para tentar novamente.
        </p>
      )}

      {!q.isLoading && !q.error && (q.data?.length ?? 0) === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma alteração de substatus registrada.</p>
      )}

      {!q.isLoading && !q.error && (q.data?.length ?? 0) > 0 && (
        <ul className="space-y-1.5">
          {q.data?.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-1.5 text-xs">
              {entry.from_name ? (
                <>
                  <span className="text-muted-foreground">De</span>
                  <SubstatusBadge
                    substatus={{ name: entry.from_name, color: entry.from_color }}
                  />
                  <span className="text-muted-foreground">para</span>
                </>
              ) : (
                <span className="text-muted-foreground">Definido como</span>
              )}
              {entry.to_name ? (
                <SubstatusBadge substatus={{ name: entry.to_name, color: entry.to_color }} />
              ) : (
                <span className="text-muted-foreground italic">sem substatus</span>
              )}
              <span className="text-muted-foreground">
                — {entry.changed_by_name ?? "Usuário do sistema"} ·{" "}
                {dateFormatter.format(new Date(entry.changed_at))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
