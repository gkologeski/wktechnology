import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Selo ✨ para registros enriquecidos nos últimos 30 dias. */
export function EnrichedBadge({ at, className }: { at?: string | null; className?: string }) {
  if (!at) return null;
  const label = `Enriquecido em ${new Date(at).toLocaleDateString("pt-BR")}`;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={label}
            tabIndex={0}
            className={cn(
              "shrink-0 cursor-default select-none rounded leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            ✨
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
