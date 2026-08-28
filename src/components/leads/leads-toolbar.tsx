import { ChevronDown, Headphones, Pencil, Play, Search, Sparkles, X } from "lucide-react";
import { Can } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LeadsToolbar({
  search,
  setSearch,
  selectedCount,
  total,
  isSelectingAll,
  onSelectAllMatching,
  onStartQueueFromSelection,
  canProspectingMode,
  prospectingBusy,
  onProspectingFromSelection,
  onEnrichSelection,
  onAddToProspectingSelection,
  onBulkDelete,
  onBulkEdit,
  onClearSelection,
  ColumnsButton,
  ViewToggle,
  onExportCsv,
}: {
  search: string;
  setSearch: (v: string) => void;
  selectedCount: number;
  total: number;
  isSelectingAll: boolean;
  onSelectAllMatching: () => void;
  onStartQueueFromSelection: () => void;
  canProspectingMode: boolean;
  prospectingBusy: boolean;
  onProspectingFromSelection: () => void;
  onEnrichSelection: () => void;
  onAddToProspectingSelection: () => void;
  onBulkDelete: () => void;
  onBulkEdit: () => void;
  onClearSelection: () => void;
  ColumnsButton: React.ComponentType;
  /** Alternador Tabela/Quadro renderizado à direita da barra. */
  ViewToggle?: React.ReactNode;
  onExportCsv: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nome, email, empresa…"
          className="h-9 pl-8"
        />
      </div>

      {selectedCount > 0 ? (
        <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-2 py-1">
          <span className="text-xs font-medium text-primary">
            {selectedCount.toLocaleString("pt-BR")} selecionado(s)
          </span>
          {selectedCount < total && (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs"
              disabled={isSelectingAll}
              onClick={onSelectAllMatching}
            >
              {isSelectingAll
                ? "Selecionando…"
                : `Selecionar todos os ${total.toLocaleString("pt-BR")} registros`}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7" onClick={onStartQueueFromSelection}>
            <Play className="mr-1 h-3.5 w-3.5" /> Iniciar fila
          </Button>
          {canProspectingMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              disabled={prospectingBusy}
              onClick={onProspectingFromSelection}
              title="Trabalhar os leads selecionados na tela de Prospecção"
            >
              <Headphones className="mr-1 h-3.5 w-3.5" />
              {prospectingBusy ? "Preparando…" : "Modo Prospecção"}
            </Button>
          )}

          <Button variant="ghost" size="sm" className="h-7" onClick={onEnrichSelection}>
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Enriquecer
          </Button>
          <Button variant="ghost" size="sm" className="h-7" onClick={onAddToProspectingSelection}>
            <Play className="mr-1 h-3.5 w-3.5" /> Adicionar à prospecção
          </Button>
          <Can any={["techsales.leads.delete.own", "techsales.leads.delete.workspace"]}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-destructive hover:text-destructive"
              onClick={onBulkDelete}
            >
              Excluir
            </Button>
          </Can>
          <Button variant="ghost" size="sm" className="h-7" onClick={onBulkEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar em massa
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearSelection}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {ViewToggle}
          <ColumnsButton />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Ações <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onExportCsv}>Exportar CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
