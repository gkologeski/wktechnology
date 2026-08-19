// Alternância Tabela | Kanban usada nas telas de lista.
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ListViewMode = "table" | "kanban";

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ListViewMode;
  onChange: (v: ListViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-md border" role="group" aria-label="Modo de visualização">
      <Button
        type="button"
        variant={value === "table" ? "secondary" : "ghost"}
        size="sm"
        className="rounded-r-none"
        aria-pressed={value === "table"}
        aria-label="Visualizar em tabela"
        onClick={() => onChange("table")}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={value === "kanban" ? "secondary" : "ghost"}
        size="sm"
        className="rounded-l-none"
        aria-pressed={value === "kanban"}
        aria-label="Visualizar em kanban"
        onClick={() => onChange("kanban")}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}
