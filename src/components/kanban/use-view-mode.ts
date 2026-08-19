// Modo de visualização (Tabela | Kanban) preservado em search param `view`.
// Usa `strict: false` para funcionar em componentes compartilhados por várias
// rotas (ex.: contas a pagar/receber).
import { useNavigate, useSearch } from "@tanstack/react-router";

import type { ListViewMode } from "@/components/kanban/view-mode-toggle";

export function useViewMode(): [ListViewMode, (v: ListViewMode) => void] {
  const search = useSearch({ strict: false }) as { view?: string };
  const navigate = useNavigate();
  const view: ListViewMode = search.view === "kanban" ? "kanban" : "table";
  const setView = (v: ListViewMode) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, view: v }),
      replace: true,
    });
  return [view, setView];
}
