import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StageSubstatus } from "@/lib/pipelines/substatuses";

/** Exibição compacta do substatus (badge com cor da configuração). */
export function SubstatusBadge({
  substatus,
  className,
}: {
  substatus: Pick<StageSubstatus, "name" | "color"> | null | undefined;
  className?: string;
}) {
  if (!substatus) return null;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 rounded-full px-2 py-0 text-[10px] font-medium", className)}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", substatus.color ? undefined : "bg-primary")}
        style={substatus.color ? { backgroundColor: substatus.color } : undefined}
      />
      <span className="truncate max-w-[140px]">{substatus.name}</span>
    </Badge>
  );
}
