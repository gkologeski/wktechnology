import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle } from "lucide-react";

interface Props {
  resolutionDueAt?: string | null;
  resolutionBreached?: boolean | null;
  resolvedAt?: string | null;
  firstResponseDueAt?: string | null;
  firstResponseAt?: string | null;
  firstResponseBreached?: boolean | null;
  compact?: boolean;
}

/** Badge visual para SLA: verde/âmbar/vermelho conforme prazo. */
export function SlaBadge({
  resolutionDueAt, resolutionBreached, resolvedAt,
  firstResponseDueAt, firstResponseAt, firstResponseBreached,
  compact,
}: Props) {
  // Resolução tem prioridade visual; se não houver, mostra 1ª resposta.
  const now = Date.now();
  const dueRes = resolutionDueAt ? new Date(resolutionDueAt).getTime() : null;
  const dueFr = firstResponseDueAt ? new Date(firstResponseDueAt).getTime() : null;

  if (resolvedAt && firstResponseAt) return null;

  let label = "";
  let tone: "green" | "amber" | "red" = "green";

  if (!resolvedAt && dueRes != null) {
    const mins = (dueRes - now) / 60000;
    if (resolutionBreached || mins < 0) { tone = "red"; label = `Resol. ${fmt(-mins)} atraso`; }
    else if (mins < 60) { tone = "amber"; label = `Resol. ${fmt(mins)}`; }
    else { tone = "green"; label = `Resol. ${fmt(mins)}`; }
  } else if (!firstResponseAt && dueFr != null) {
    const mins = (dueFr - now) / 60000;
    if (firstResponseBreached || mins < 0) { tone = "red"; label = `1ª resp. ${fmt(-mins)} atraso`; }
    else if (mins < 15) { tone = "amber"; label = `1ª resp. ${fmt(mins)}`; }
    else { tone = "green"; label = `1ª resp. ${fmt(mins)}`; }
  } else {
    return null;
  }

  const cls = tone === "red"
    ? "bg-destructive/10 text-destructive border-destructive/30"
    : tone === "amber"
    ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";

  return (
    <Badge variant="outline" className={`gap-1 font-normal ${cls}`}>
      {tone === "red" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {compact ? (tone === "red" ? "SLA" : label.split(" ")[0]) : label}
    </Badge>
  );
}

function fmt(mins: number): string {
  const m = Math.abs(Math.round(mins));
  if (m < 60) return `${m}min`;
  if (m < 60 * 48) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}
