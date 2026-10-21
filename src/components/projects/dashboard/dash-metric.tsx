// Cartão de indicador explicável: valor + definição/base + acesso à lista com os mesmos filtros.
import type { ComponentType, ReactNode } from "react";
import { Info, List } from "lucide-react";
import { MetricCard, type MetricTone } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MetricDef } from "@/lib/projects/dashboard-views.shared";

export function DashMetric({
  def,
  value,
  hint,
  icon,
  tone,
  delta,
  periodLabel,
  generatedAt,
  missing,
  onOpen,
}: {
  def: MetricDef;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: MetricTone;
  delta?: { value: string; direction?: "up" | "down" | "flat" };
  /** Ex.: "01/10/2026 a 31/10/2026 · America/Sao_Paulo" ou "Situação atual". */
  periodLabel: string;
  generatedAt: string;
  /** Dado faltante/limitação conhecida, mostrado na explicação. */
  missing?: string;
  onOpen?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <MetricCard
        label={def.title}
        value={value}
        hint={hint}
        icon={icon}
        tone={tone}
        delta={delta}
      />
      <div className="flex items-center justify-between gap-2 px-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-1.5 text-xs text-text-secondary"
              aria-label={`Como é calculado: ${def.title}`}
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
              Como é calculado
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm" align="start">
            <p className="font-medium text-text-primary">{def.title}</p>
            <p className="mt-1 text-text-secondary">{def.definition}</p>
            <dl className="mt-3 space-y-1 text-xs">
              <div>
                <dt className="inline text-text-tertiary">Fonte: </dt>
                <dd className="inline text-text-secondary">{def.source}</dd>
              </div>
              <div>
                <dt className="inline text-text-tertiary">Período: </dt>
                <dd className="inline text-text-secondary">{periodLabel}</dd>
              </div>
              <div>
                <dt className="inline text-text-tertiary">Gerado em: </dt>
                <dd className="inline text-text-secondary">
                  {new Date(generatedAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
              {missing ? (
                <div>
                  <dt className="inline text-text-tertiary">Limitação: </dt>
                  <dd className="inline text-text-secondary">{missing}</dd>
                </div>
              ) : null}
            </dl>
          </PopoverContent>
        </Popover>
        {onOpen ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 text-xs"
            onClick={onOpen}
            aria-label={`Ver lista: ${def.title}`}
          >
            <List className="h-3.5 w-3.5" aria-hidden />
            Ver lista
          </Button>
        ) : null}
      </div>
    </div>
  );
}
