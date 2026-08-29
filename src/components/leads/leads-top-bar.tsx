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
}: {
  isLoading: boolean;
  total: number;
  onExportCsv: () => void;
  onStartQueue: () => void;
  canProspectingMode: boolean;
  prospectingBusy: boolean;
  onStartProspectingMode: () => void;
  onCreateLead: () => void;
}) {
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
          title="Percorrer todos os leads do filtro atual, um a um"
        >
          <Play className="mr-1.5 h-4 w-4" /> Iniciar fila
        </Button>
        {canProspectingMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={onStartProspectingMode}
            disabled={isLoading || total === 0 || prospectingBusy}
            title="Trabalhar os leads do filtro atual na tela de Prospecção (questionário, qualificação e timeline)"
          >
            <Headphones className="mr-1.5 h-4 w-4" />
            {prospectingBusy ? "Preparando…" : "Modo Prospecção"}
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
