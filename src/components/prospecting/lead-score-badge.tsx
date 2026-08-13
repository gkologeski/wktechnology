// Selo da faixa de perfil do lead (Fora / Parcial / Dentro do ICP).
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  leadScoreBand,
  leadScoreBandLabel,
  type LeadScoreBand,
} from "@/lib/prospecting/lead-score";

const BAND_CLASS: Record<LeadScoreBand, string> = {
  out: "border-destructive/40 text-destructive",
  partial: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  ideal: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
};

export function LeadScoreBadge({
  total,
  className,
  showScore = false,
}: {
  total: number;
  className?: string;
  showScore?: boolean;
}) {
  const band = leadScoreBand(total);
  return (
    <Badge variant="outline" className={cn(BAND_CLASS[band], className)}>
      {leadScoreBandLabel(total)}
      {showScore ? ` · ${total}` : ""}
    </Badge>
  );
}
