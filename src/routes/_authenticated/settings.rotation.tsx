// Página /settings/rotation — gerenciador de regras de Distribuição (rotação).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, Trash2, Pencil, Copy } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listRotationRules,
  saveRotationRule,
  deleteRotationRule,
  listWorkspaceMembers,
} from "@/lib/rotation.functions";
import {
  ROT_ENTITY_LABELS,
  STRATEGY_LABELS,
  type RotationAssignee,
  type RotationEntity,
  type RotationStrategy,
} from "@/lib/rotation/types";

export const Route = createFileRoute("/_authenticated/settings/rotation")({
  component: RotationPage,
});

type Draft = {
  id?: string;
  name: string;
  entity: RotationEntity;
  enabled: boolean;
  strategy: RotationStrategy;
  assignees: RotationAssignee[];
};

const EMPTY: Draft = {
  name: "",
  entity: "leads",
  enabled: true,
  strategy: "round_robin",
  assignees: [],
};

function RotationPage() {
  const listFn = useServerFn(listRotationRules);
  const saveFn = useServerFn(saveRotationRule);
  const delFn = useServerFn(deleteRotationRule);
  const membersFn = useServerFn(listWorkspaceMembers);

  const [rules, setRules] = useState<Awaited<ReturnType<typeof listRotationRules>>>([]);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof listWorkspaceMembers>>>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([listFn(), membersFn()]);
      setRules(r);
      setMembers(m);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.user_id, x.full_name));
    return m;
  }, [members]);

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name) return toast.error("Dê um nome para a regra");
    if (draft.assignees.length === 0) return toast.error("Adicione ao menos um responsável");
    try {
      await saveFn({ data: { ...draft, filters: [] } });
      toast.success("Regra salva");
      setDraft(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog("Excluir esta regra?"))) return;
    await delFn({ data: { id } });
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Distribuição</h2>
          <p className="text-sm text-muted-foreground">
            Defina regras de rotação para distribuir Leads e Negócios entre o seu time. Use no
            Workflow como ação "Distribuir via regra".
          </p>
        </div>
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="h-4 w-4 mr-1" /> Nova regra
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!loading && rules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma regra ainda. Crie a primeira para começar a distribuir registros.
          </CardContent>
        </Card>
      )}

      {rules.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                {r.name}
                <Badge variant="secondary">{ROT_ENTITY_LABELS[r.entity as RotationEntity]}</Badge>
                <Badge variant="outline">{STRATEGY_LABELS[r.strategy as RotationStrategy]}</Badge>
                {!r.enabled && <Badge variant="destructive">pausada</Badge>}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {(r.assignees as unknown as RotationAssignee[] | null)?.length ?? 0} responsável(is)
                · último:{" "}
                {r.last_assigned_user_id
                  ? (nameById.get(r.last_assigned_user_id as string) ?? r.last_assigned_user_id)
                  : "—"}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{r.id}</code>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(r.id as string);
                    toast.success("ID copiado");
                  }}
                >
                  <Copy className="h-3 w-3" /> copiar para usar no Workflow
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setDraft({
                    id: r.id as string,
                    name: r.name as string,
                    entity: r.entity as RotationEntity,
                    enabled: r.enabled as boolean,
                    strategy: r.strategy as RotationStrategy,
                    assignees: (r.assignees as unknown as RotationAssignee[]) ?? [],
                  })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id as string)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      ))}

      <Sheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{draft?.id ? "Editar regra" : "Nova regra de distribuição"}</SheetTitle>
          </SheetHeader>
          {draft && (
            <div className="space-y-5 py-4">
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Ex: Leads do site — comercial"
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch
                    checked={draft.enabled}
                    onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                  />
                  <span className="text-sm">{draft.enabled ? "Ativa" : "Pausada"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Entidade</Label>
                  <Select
                    value={draft.entity}
                    onValueChange={(v) => setDraft({ ...draft, entity: v as RotationEntity })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROT_ENTITY_LABELS) as RotationEntity[]).map((e) => (
                        <SelectItem key={e} value={e}>
                          {ROT_ENTITY_LABELS[e]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estratégia</Label>
                  <Select
                    value={draft.strategy}
                    onValueChange={(v) => setDraft({ ...draft, strategy: v as RotationStrategy })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STRATEGY_LABELS) as RotationStrategy[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STRATEGY_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <section className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Responsáveis</h3>
                  <Select
                    onValueChange={(uid) => {
                      if (draft.assignees.some((a) => a.user_id === uid)) return;
                      setDraft({
                        ...draft,
                        assignees: [...draft.assignees, { user_id: uid, weight: 1 }],
                      });
                    }}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="+ Adicionar membro" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name}
                          {m.is_owner ? " (admin)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {draft.assignees.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Adicione pelo menos um membro do time.
                  </p>
                )}
                {draft.assignees.map((a, i) => (
                  <div
                    key={a.user_id}
                    className="grid grid-cols-[1fr_120px_auto] gap-2 items-center"
                  >
                    <span className="text-sm">
                      {nameById.get(a.user_id) ?? a.user_id.slice(0, 8)}
                    </span>
                    {draft.strategy === "weighted" ? (
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={a.weight}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            assignees: draft.assignees.map((x, idx) =>
                              idx === i
                                ? { ...x, weight: Math.max(1, Number(e.target.value) || 1) }
                                : x,
                            ),
                          })
                        }
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">peso ignorado</span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          assignees: draft.assignees.filter((_, idx) => idx !== i),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </section>
            </div>
          )}
          <SheetFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
