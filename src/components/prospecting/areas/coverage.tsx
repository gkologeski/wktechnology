import { Badge } from "@/components/ui/badge";

export type Coverage = "ok" | "no_access" | "error" | "truncated" | "not_tracked";

const LABEL: Record<Coverage, string> = {
  ok: "Dados completos",
  no_access: "Sem permissão",
  error: "Indisponível",
  truncated: "Parcial",
  not_tracked: "Sem cobertura",
};

/** Valor exibido: nunca transforma ausência de dado em zero. */
export function coverageValue(value: number | null, coverage: Coverage) {
  if (coverage === "no_access" || coverage === "error" || value == null) return "—";
  return value.toLocaleString("pt-BR");
}

export function CoverageBadge({ coverage }: { coverage: Coverage }) {
  if (coverage === "ok") return null;
  return (
    <Badge variant={coverage === "error" ? "destructive" : "outline"} className="text-[10px]">
      {LABEL[coverage]}
    </Badge>
  );
}

export function coverageHint(origin: string, coverage: Coverage, note?: string) {
  const parts = [origin];
  if (coverage !== "ok") parts.push(LABEL[coverage]);
  if (coverage === "truncated") parts.push("limite de 5.000 registros atingido");
  if (note) parts.push(note);
  return parts.join(" · ");
}
