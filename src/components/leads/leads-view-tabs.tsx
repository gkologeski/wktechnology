import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VIEWS, type ViewId } from "@/lib/leads/constants";

export function LeadsViewTabs({
  activeView,
  setActiveView,
  activeSavedId,
  setActiveSavedId,
  savedViews,
  applySavedView,
  deleteSavedView,
  saveCurrentView,
}: {
  activeView: ViewId;
  setActiveView: (v: ViewId) => void;
  activeSavedId: string | null;
  setActiveSavedId: (id: string | null) => void;
  savedViews: {
    data?: { id: string; name: string; filters: unknown }[];
    create: { isPending: boolean };
  };
  applySavedView: (sv: { id: string; filters: unknown }) => void;
  deleteSavedView: (id: string) => void;
  saveCurrentView: () => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b px-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => {
            setActiveView(v.id);
            setActiveSavedId(null);
          }}
          className={cn(
            "relative px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
            activeView === v.id && !activeSavedId
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
          {activeView === v.id && !activeSavedId && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
          )}
        </button>
      ))}
      {(savedViews.data ?? []).map((sv) => {
        const isActive = activeSavedId === sv.id;
        return (
          <div
            key={sv.id}
            className={cn(
              "group relative flex items-center gap-1 px-3 py-2 text-sm font-medium whitespace-nowrap",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <button type="button" onClick={() => applySavedView(sv)}>
              {sv.name}
            </button>
            <button
              type="button"
              onClick={() => deleteSavedView(sv.id)}
              className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-muted"
              aria-label="Excluir visualização"
            >
              <X className="h-3 w-3" />
            </button>
            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        className="ml-2 text-muted-foreground"
        onClick={saveCurrentView}
        disabled={savedViews.create.isPending}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        {savedViews.create.isPending ? "Salvando…" : "Adicionar visualização"}
      </Button>
    </div>
  );
}
