// Barra flutuante de ações em massa da tabela de Leads.
// Reúne as ações que antes viviam inline na toolbar (fila, prospecção,
// enriquecimento, edição e exclusão), respeitando RBAC — a RLS segue como
// fonte de verdade.
import { Headphones, Pencil, Play, Sparkles, Trash2 } from "lucide-react";
import { Can } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";
import { BulkActionBar } from "@/components/bulk-action-bar";

export function LeadsBulkBar({
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
}: {
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
}) {
  if (selectedCount === 0) return null;

  return (
    <BulkActionBar
      count={selectedCount}
      totalMatching={total}
      onSelectAll={onSelectAllMatching}
      isSelectingAll={isSelectingAll}
      onClear={onClearSelection}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onStartQueueFromSelection}
        title="Percorrer os leads selecionados um a um"
      >
        <Play className="mr-1.5 h-3.5 w-3.5" /> Iniciar fila
      </Button>
      {canProspectingMode && (
        <Button
          variant="outline"
          size="sm"
          disabled={prospectingBusy}
          onClick={onProspectingFromSelection}
          title="Trabalhar os leads selecionados na tela de Prospecção"
        >
          <Headphones className="mr-1.5 h-3.5 w-3.5" />
          {prospectingBusy ? "Preparando…" : "Modo Prospecção"}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onEnrichSelection}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Enriquecer
      </Button>
      <Button variant="outline" size="sm" onClick={onAddToProspectingSelection}>
        <Play className="mr-1.5 h-3.5 w-3.5" /> Adicionar à prospecção
      </Button>
      <Can any={["techsales.leads.update.own", "techsales.leads.update.workspace"]}>
        <Button variant="outline" size="sm" onClick={onBulkEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar em massa
        </Button>
      </Can>
      <Can any={["techsales.leads.delete.own", "techsales.leads.delete.workspace"]}>
        <Button variant="destructive" size="sm" onClick={onBulkDelete}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
        </Button>
      </Can>
    </BulkActionBar>
  );
}
