// UI: salvar a ação atual como modelo reutilizável e aplicar modelos salvos.
// Compacto — exibido no topo do painel de configuração do passo.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  listWorkflowActionTemplates,
  saveWorkflowActionTemplate,
  deleteWorkflowActionTemplate,
  incrementWorkflowActionTemplateUsage,
  type WorkflowActionTemplateRow,
} from "@/lib/workflow-action-templates.functions";
import { ACTION_LABELS, type WorkflowAction, type WorkflowEntity } from "@/lib/workflows/types";

interface Props {
  action: WorkflowAction;
  entity: WorkflowEntity;
  onApply: (next: WorkflowAction) => void;
}

/**
 * Extrai a "table_name" da ação quando aplicável (create_record/update_record/delete_record).
 * Para outras ações, usamos apenas action_type como chave de compatibilidade.
 */
function getActionTable(a: WorkflowAction): string | null {
  const t = a.type;
  if (t === "create_record" || t === "update_record" || t === "delete_record") {
    return (a as { table?: string }).table ?? null;
  }
  return null;
}

/**
 * Ao aplicar um modelo, preservamos identificadores runtime da ação atual
 * (id, ligações posicionais) — só substituímos a configuração.
 */
function mergeTemplateIntoAction(
  current: WorkflowAction,
  templateAction: Record<string, unknown>,
): WorkflowAction {
  // Preserva `id` quando existir na ação atual (usado no canvas para tracking).
  const currentId = (current as { id?: string }).id;
  const next = { ...(templateAction as object) } as WorkflowAction;
  if (currentId && typeof next === "object") {
    (next as { id?: string }).id = currentId;
  }
  return next;
}

export function ActionTemplatesBar({ action, entity, onApply }: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  const actionType = action.type;
  const tableName = getActionTable(action);

  const list = useServerFn(listWorkflowActionTemplates);
  const { data, isLoading } = useQuery({
    queryKey: ["wf-action-templates", actionType, tableName ?? "-"],
    queryFn: () =>
      list({
        data: {
          action_type: actionType,
          ...(tableName ? { table_name: tableName } : {}),
        },
      }),
    staleTime: 30_000,
  });

  const items: WorkflowActionTemplateRow[] = data?.items ?? [];

  const qc = useQueryClient();
  const bumpUsage = useServerFn(incrementWorkflowActionTemplateUsage);
  const removeFn = useServerFn(deleteWorkflowActionTemplate);
  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wf-action-templates"] });
      toast.success("Modelo excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = (t: WorkflowActionTemplateRow) => {
    try {
      onApply(mergeTemplateIntoAction(action, t.action_json as Record<string, unknown>));
      void bumpUsage({ data: { id: t.id } }).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ["wf-action-templates"] });
      setApplyOpen(false);
      toast.success(`Modelo "${t.name}" aplicado`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
      <Bookmark className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="text-xs font-medium text-muted-foreground">Modelos</span>

      <Popover open={applyOpen} onOpenChange={setApplyOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
            Aplicar modelo
            <ChevronDown className="ml-1 h-3 w-3" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <div className="max-h-80 overflow-auto">
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Carregando modelos…
              </div>
            )}
            {!isLoading && items.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                Nenhum modelo salvo para <b>{ACTION_LABELS[actionType] ?? actionType}</b>
                {tableName ? <> em <b>{tableName}</b></> : null}. Configure a
                ação e clique em "Salvar como modelo".
              </div>
            )}
            {items.map((t) => (
              <div
                key={t.id}
                className="group flex items-start gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-muted/50"
              >
                <button
                  type="button"
                  onClick={() => apply(t)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{t.name}</span>
                    {t.visibility === "shared" && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        Compartilhado
                      </Badge>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Usado {t.usage_count}×
                  </p>
                </button>
                <button
                  type="button"
                  aria-label={`Excluir modelo ${t.name}`}
                  onClick={() => {
                    if (confirm(`Excluir o modelo "${t.name}"?`)) {
                      removeMut.mutate(t.id);
                    }
                  }}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={() => setSaveOpen(true)}
      >
        <BookmarkPlus className="mr-1 h-3.5 w-3.5" aria-hidden />
        Salvar como modelo
      </Button>

      <SaveTemplateDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        action={action}
        entity={entity}
      />
    </div>
  );
}

function SaveTemplateDialog({
  open,
  onOpenChange,
  action,
  entity,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: WorkflowAction;
  entity: WorkflowEntity;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"personal" | "shared">("personal");

  const qc = useQueryClient();
  const saveFn = useServerFn(saveWorkflowActionTemplate);
  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          name: name.trim(),
          description: description.trim() || null,
          action_type: action.type,
          entity,
          table_name: getActionTable(action),
          action_json: action as unknown as Record<string, unknown>,
          visibility,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wf-action-templates"] });
      toast.success("Modelo salvo");
      onOpenChange(false);
      setName("");
      setDescription("");
      setVisibility("personal");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como modelo</DialogTitle>
          <DialogDescription>
            O modelo guarda todos os valores, variáveis e mapeamentos desta ação
            para reutilizar em outros workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Criar contrato — FI/Sabrina"
              maxLength={120}
            />
          </div>
          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Quando usar este modelo, campos importantes, etc."
            />
          </div>
          <div>
            <Label className="text-xs">Visibilidade</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as "personal" | "shared")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Pessoal (só você)</SelectItem>
                <SelectItem value="shared">Compartilhado (todo o workspace)</SelectItem>
              </SelectContent>
            </Select>
            {visibility === "shared" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Modelos compartilhados exigem permissão de administrador do workspace.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!name.trim() || saveMut.isPending}
          >
            {saveMut.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
            Salvar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
