import { Link } from "@tanstack/react-router";
import { BarChart3, Radar, Wand2, type LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  SDR_VIEWS,
  viewOfSection,
  type SdrSectionId,
  type SdrViewId,
} from "./sdr-workspace-sections";

const ICONS: Record<SdrViewId, LucideIcon> = {
  operation: Radar,
  studio: Wand2,
  results: BarChart3,
};

/**
 * Navegação em dois níveis do Agente SDR: áreas (Operação, Estúdio,
 * Resultados) como links e, abaixo, as seções da área atual. Renderizar
 * dentro do `<Tabs>` da página. Puramente presentacional.
 */
export function SdrWorkspaceNav({ section }: { section: SdrSectionId }) {
  const view = viewOfSection(section);
  return (
    <div className="space-y-4">
      <nav aria-label="Áreas do Agente SDR" className="grid gap-2 sm:grid-cols-3">
        {SDR_VIEWS.map((v) => {
          const Icon = ICONS[v.id];
          const active = v.id === view.id;
          return (
            <Link
              key={v.id}
              to="/agents/sdr"
              search={{ section: active ? section : v.sections[0].id }}
              replace
              resetScroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{v.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {v.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
      {view.sections.length > 1 ? (
        <TabsList
          aria-label={`Seções de ${view.label}`}
          className="h-auto w-full justify-start overflow-x-auto"
        >
          {view.sections.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="shrink-0">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      ) : null}
    </div>
  );
}
