import { Link } from "@tanstack/react-router";
import { Download, Headphones, Play, Plus, Upload } from "lucide-react";
import { Can } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";

export function LeadsTopBar({
  isLoading,
  total,
  onExportCsv,
  onStartQueue,
  canProspectingMode,
  prospectingBusy,
  onStartProspectingMode,
  onCreateLead,
  selectedCount = 0,
}: {
  isLoading: boolean;
  total: number;
  onExportCsv: () => void;
  onStartQueue: () => void;
  canProspectingMode: boolean;
  prospectingBusy: boolean;
  onStartProspectingMode: () => void;
  onCreateLead: () => void;
  /** Quantidade de leads selecionados (tabela ou quadro). */
  selectedCount?: number;
}) {
  const hasSelection = selectedCount > 0;
  const selectionSuffix = hasSelection ? ` (${selectedCount.toLocaleString("pt-BR")})` : "";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} registros`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Can
          any={[
            "system.import.export.workspace",
            "techsales.leads.create.workspace",
            "techsales.leads.create.own",
          ]}
        >
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings/import">
              <Upload className="mr-1.5 h-4 w-4" /> Importar HubSpot
            </Link>
          </Button>
        </Can>
        <Can permission="techsales.leads.export.workspace">
          <Button variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
        </Can>
        <Button
          variant="outline"
          size="sm"
          onClick={onStartQueue}
          disabled={isLoading || total === 0}
          aria-label={
            hasSelection
              ? `Iniciar fila com ${selectedCount} lead(s) selecionado(s)`
              : "Iniciar fila com todos os leads do filtro atual"
          }
          title={
            hasSelection
              ? "Percorrer apenas os leads selecionados, um a um"
              : "Percorrer todos os leads do filtro atual, um a um"
          }
        >
          <Play className="mr-1.5 h-4 w-4" /> Iniciar fila{selectionSuffix}
        </Button>
        {canProspectingMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={onStartProspectingMode}
            disabled={isLoading || total === 0 || prospectingBusy}
            aria-label={
              hasSelection
                ? `Modo Prospecção com ${selectedCount} lead(s) selecionado(s)`
                : "Modo Prospecção com os leads do filtro atual"
            }
            title={
              hasSelection
                ? "Trabalhar os leads selecionados na tela de Prospecção"
                : "Trabalhar os leads do filtro atual na tela de Prospecção (questionário, qualificação e timeline)"
            }
          >
            <Headphones className="mr-1.5 h-4 w-4" />
            {prospectingBusy ? "Preparando…" : `Modo Prospecção${selectionSuffix}`}
          </Button>
        )}


        <Can permission="techsales.leads.create.own">
          <Button size="sm" onClick={onCreateLead}>
            <Plus className="mr-1.5 h-4 w-4" /> Criar lead
          </Button>
        </Can>
      </div>
    </div>
  );
}
