import { ChevronDown, Search } from "lucide-react";
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
  ColumnsButton,
  ViewToggle,
  onExportCsv,
}: {
  search: string;
  setSearch: (v: string) => void;
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
    </div>
  );
}

