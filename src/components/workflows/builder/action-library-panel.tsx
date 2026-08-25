// Painel lateral de escolha de ação do workflow builder.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import {
  ACTION_CATEGORIES,
  ACTION_LABELS,
  RECORD_ACTION_MODULES,
  type WorkflowActionType,
  type WorkflowWritableTable,
} from "@/lib/workflows/types";
import { ACTION_ICONS } from "./step-tree";

// ============================================================================
// Right-panel: Action library
// ============================================================================
export function ActionLibraryPanel({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (t: WorkflowActionType, overrides?: Record<string, unknown>) => void;
}) {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Escolher ação</h3>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {ACTION_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
            {cat.label}
          </p>
          <div className="space-y-1">
            {cat.actions.map((t) => {
              const Icon = ACTION_ICONS[t] ?? Sparkles;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onPick(t)}
                  className="w-full text-left rounded-md border bg-card px-3 py-2 hover:border-primary hover:bg-accent/30 transition flex items-center gap-3"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{ACTION_LABELS[t]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Registros por módulo → entidade → operação */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
          Registros
        </p>
        <div className="space-y-1">
          {RECORD_ACTION_MODULES.map((mod) => {
            const modOpen = expandedModule === mod.key;
            return (
              <div key={mod.key} className="rounded-md border bg-card">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedModule(modOpen ? null : mod.key);
                    setExpandedEntity(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-accent/30 transition flex items-center gap-3"
                >
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{mod.label}</span>
                  <span className="text-[10px] text-muted-foreground">{modOpen ? "−" : "+"}</span>
                </button>
                {modOpen && (
                  <div className="border-t bg-muted/20 px-2 py-1.5 space-y-1">
                    {mod.entities.map((ent) => {
                      const entKey = `${mod.key}:${ent.table}`;
                      const entOpen = expandedEntity === entKey;
                      return (
                        <div
                          key={ent.table}
                          className="rounded border border-border/60 bg-background"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedEntity(entOpen ? null : entKey)}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-accent/30 transition flex items-center gap-2"
                          >
                            <span className="text-sm flex-1">{ent.singular}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {entOpen ? "−" : "+"}
                            </span>
                          </button>
                          {entOpen && (
                            <div className="border-t border-border/60 px-2 py-2 space-y-1">
                              {ent.hint && (
                                <p className="text-[10px] text-muted-foreground px-1 pb-1">
                                  {ent.hint}
                                </p>
                              )}
                              {[
                                { op: "create_record" as const, label: `Criar ${ent.singular}` },
                                { op: "update_record" as const, label: `Editar ${ent.singular}` },
                                { op: "delete_record" as const, label: `Excluir ${ent.singular}` },
                              ].map(({ op, label }) => (
                                <button
                                  key={op}
                                  type="button"
                                  onClick={() =>
                                    onPick(op, {
                                      table: ent.table as WorkflowWritableTable,
                                    })
                                  }
                                  className="w-full text-left rounded-sm border bg-card px-2.5 py-1.5 text-xs hover:border-primary hover:bg-accent/30 transition"
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
