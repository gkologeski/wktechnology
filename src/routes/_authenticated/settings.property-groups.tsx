// Página /settings/property-groups — gerencia grupos de propriedades personalizadas.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/access-control/use-permissions";
import { PROPERTIES_MANAGE, PROPERTIES_PERMS } from "@/lib/access-control/admin-permission-keys";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  CUSTOM_ENTITIES,
  CUSTOM_ENTITY_LABELS,
  type CustomEntity,
} from "@/lib/custom-properties.functions";
import {
  listPropertyGroups,
  renamePropertyGroup,
  deletePropertyGroup,
  reorderPropertyGroup,
  type PropertyGroupSummary,
} from "@/lib/property-groups.functions";

export const Route = createFileRoute("/_authenticated/settings/property-groups")({
  component: PropertyGroupsPage,
});

function PropertyGroupsPage() {
  const listFn = useServerFn(listPropertyGroups);
  const renameFn = useServerFn(renamePropertyGroup);
  const delFn = useServerFn(deletePropertyGroup);
  const reorderFn = useServerFn(reorderPropertyGroup);

  const [entity, setEntity] = useState<CustomEntity>("leads");
  const [groups, setGroups] = useState<PropertyGroupSummary[]>([]);
  const [renaming, setRenaming] = useState<PropertyGroupSummary | null>(null);
  const [newName, setNewName] = useState("");

  const refresh = async () => {
    const list = await listFn({ data: { entity } });
    setGroups(list);
  };
  useEffect(() => {
    refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [entity]);

  const openRename = (g: PropertyGroupSummary) => {
    if (g.name === "Sem grupo") {
      toast.info('Atribua um nome editando as propriedades em "Propriedades".');
      return;
    }
    setRenaming(g);
    setNewName(g.name);
  };

  const handleRename = async () => {
    if (!renaming) return;
    const to = newName.trim();
    if (!to || to === renaming.name) {
      setRenaming(null);
      return;
    }
    try {
      await renameFn({ data: { entity, from: renaming.name, to } });
      toast.success("Grupo renomeado");
      setRenaming(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleDelete = async (g: PropertyGroupSummary) => {
    if (g.name === "Sem grupo") return;
    if (
      !(await confirmDialog(
        `Remover o grupo "${g.name}"? As ${g.count} propriedades continuarão existindo, sem grupo.`,
      ))
    )
      return;
    try {
      await delFn({ data: { entity, name: g.name } });
      toast.success("Grupo removido");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = groups[index];
    const swap = groups[index + dir];
    if (!target || !swap || target.name === "Sem grupo" || swap.name === "Sem grupo") return;
    // Reatribui posições base com gap 100 para evitar colisões.
    const reordered = [...groups];
    reordered[index] = swap;
    reordered[index + dir] = target;
    try {
      let base = 0;
      for (const g of reordered) {
        if (g.name === "Sem grupo") continue;
        await reorderFn({ data: { entity, name: g.name, base_position: base } });
        base += Math.max(g.count, 1) * 10;
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Grupos de propriedades</h2>
          <p className="text-sm text-muted-foreground">
            Organize as propriedades personalizadas em grupos exibidos juntos na ficha do registro.
            O grupo de cada propriedade é definido em <strong>Propriedades</strong>.
          </p>
        </div>
        <Select value={entity} onValueChange={(v) => setEntity(v as CustomEntity)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CUSTOM_ENTITIES.map((e) => (
              <SelectItem key={e} value={e}>
                {CUSTOM_ENTITY_LABELS[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{CUSTOM_ENTITY_LABELS[entity]}</CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma propriedade personalizada cadastrada para esta entidade.
            </p>
          ) : (
            <div className="text-sm">
              {groups.map((g, i) => (
                <div
                  key={g.name}
                  className="grid grid-cols-[1fr_120px_auto] gap-2 items-center py-2 border-b last:border-0"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-medium truncate">{g.name}</span>
                    {g.name === "Sem grupo" && <Badge variant="outline">não agrupadas</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {g.count} {g.count === 1 ? "propriedade" : "propriedades"}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(i, -1)}
                      disabled={
                        i === 0 || g.name === "Sem grupo" || groups[i - 1]?.name === "Sem grupo"
                      }
                      aria-label="Mover para cima"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(i, 1)}
                      disabled={
                        i === groups.length - 1 ||
                        g.name === "Sem grupo" ||
                        groups[i + 1]?.name === "Sem grupo"
                      }
                      aria-label="Mover para baixo"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Can any={PROPERTIES_MANAGE}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openRename(g)}
                        disabled={g.name === "Sem grupo"}
                        aria-label="Renomear"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Can>
                    <Can any={PROPERTIES_PERMS.delete}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(g)}
                        disabled={g.name === "Sem grupo"}
                        aria-label="Remover grupo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Can>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!renaming}
        onOpenChange={(o) => {
          if (!o) setRenaming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Novo nome</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} />
            <p className="text-[11px] text-muted-foreground">
              Todas as propriedades atualmente em "{renaming?.name}" serão movidas para o novo nome.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
