// Seção de ICP (Perfil de Cliente Ideal) dentro da aba de Scoring.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Play } from "lucide-react";
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
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listIcpCriteria,
  saveIcpCriterion,
  deleteIcpCriterion,
  runIcpScanNow,
} from "@/lib/scoring/icp.functions";

type Op = "eq" | "neq" | "in" | "contains" | "gt" | "lt" | "is_empty" | "is_not_empty";

const OP_LABEL: Record<Op, string> = {
  eq: "= igual a",
  neq: "≠ diferente de",
  in: "está em (lista)",
  contains: "contém",
  gt: "> maior que",
  lt: "< menor que",
  is_empty: "está vazio",
  is_not_empty: "não está vazio",
};

const NEEDS_VALUE: Record<Op, boolean> = {
  eq: true,
  neq: true,
  in: true,
  contains: true,
  gt: true,
  lt: true,
  is_empty: false,
  is_not_empty: false,
};

type Draft = {
  id?: string;
  name: string;
  entity: "lead" | "company";
  field: string;
  op: Op;
  value: string;
  points: number;
  enabled: boolean;
};

const EMPTY: Draft = {
  name: "",
  entity: "company",
  field: "industry",
  op: "eq",
  value: "",
  points: 10,
  enabled: true,
};

export function IcpCriteriaSection() {
  const listFn = useServerFn(listIcpCriteria);
  const saveFn = useServerFn(saveIcpCriterion);
  const delFn = useServerFn(deleteIcpCriterion);
  const scanFn = useServerFn(runIcpScanNow);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [running, setRunning] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["icp-criteria"],
    queryFn: () => listFn(),
  });
  const rows = data ?? [];
  const maxPoints = rows
    .filter((r) => r.enabled && Number(r.points) > 0)
    .reduce((s, r) => s + Number(r.points), 0);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error("Dê um nome para o critério");
    if (!draft.field.trim()) return toast.error("Informe o campo");
    try {
      await saveFn({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name,
          entity: draft.entity,
          field: draft.field,
          op: draft.op,
          value: NEEDS_VALUE[draft.op] ? draft.value : undefined,
          points: draft.points,
          enabled: draft.enabled,
        },
      });
      toast.success("Critério salvo");
      setDraft(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const remove = async (id: string) => {
    if (!(await confirmDialog("Excluir este critério de ICP?"))) return;
    try {
      await delFn({ data: { id } });
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  const recalc = async () => {
    setRunning(true);
    try {
      const r = await scanFn();
      toast.success(`ICP recalculado: ${r.updated} de ${r.scanned} leads atualizados`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao recalcular");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">ICP — Perfil de Cliente Ideal</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Critérios de aderência que somam pontos ao score do lead. Máximo configurado:{" "}
            <span className="font-medium text-foreground">{maxPoints}</span> pontos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={recalc} disabled={running}>
            <Play className="w-4 h-4 mr-1" aria-hidden="true" />
            {running ? "Recalculando..." : "Recalcular ICP"}
          </Button>
          <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
            <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Novo critério
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-10 rounded-md bg-muted animate-pulse" />
            <div className="h-10 rounded-md bg-muted animate-pulse" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 p-4 text-sm">
            <p className="font-medium">Não foi possível carregar os critérios.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm font-medium">Nenhum critério de ICP definido</p>
            <p className="text-xs text-muted-foreground mt-1">
              Defina setor, porte ou receita esperados para pontuar a aderência dos leads.
            </p>
            <Button size="sm" className="mt-3" onClick={() => setDraft({ ...EMPTY })}>
              <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Criar primeiro critério
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{r.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.entity === "company" ? "Empresa" : "Lead"}
                    </Badge>
                    {r.enabled ? null : (
                      <Badge variant="secondary" className="text-[10px]">
                        inativo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {r.field} {OP_LABEL[r.op as Op] ?? r.op}{" "}
                    {NEEDS_VALUE[r.op as Op] ? String(r.value ?? "") : ""}
                  </p>
                </div>
                <Badge variant={Number(r.points) >= 0 ? "default" : "destructive"}>
                  {Number(r.points) > 0 ? `+${r.points}` : r.points} pts
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      id: r.id as string,
                      name: r.name as string,
                      entity: r.entity as "lead" | "company",
                      field: r.field as string,
                      op: r.op as Op,
                      value: r.value == null ? "" : String(r.value),
                      points: Number(r.points),
                      enabled: !!r.enabled,
                    })
                  }
                >
                  Editar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Excluir critério ${r.name}`}
                  onClick={() => remove(r.id as string)}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {draft ? (
          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="icp-name">
                  Nome
                </Label>
                <Input
                  id="icp-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ex.: Setor de software"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="icp-entity">
                  Entidade
                </Label>
                <Select
                  value={draft.entity}
                  onValueChange={(v) => setDraft({ ...draft, entity: v as "lead" | "company" })}
                >
                  <SelectTrigger id="icp-entity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Empresa</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="icp-field">
                  Campo
                </Label>
                <Input
                  id="icp-field"
                  value={draft.field}
                  onChange={(e) => setDraft({ ...draft, field: e.target.value })}
                  placeholder="industry, annualrevenue, numberofemployees..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="icp-op">
                  Operador
                </Label>
                <Select value={draft.op} onValueChange={(v) => setDraft({ ...draft, op: v as Op })}>
                  <SelectTrigger id="icp-op">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OP_LABEL) as Op[]).map((op) => (
                      <SelectItem key={op} value={op}>
                        {OP_LABEL[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {NEEDS_VALUE[draft.op] ? (
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="icp-value">
                    Valor
                  </Label>
                  <Input
                    id="icp-value"
                    value={draft.value}
                    onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                    placeholder="Separe por vírgula para listas"
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="icp-points">
                  Pontos
                </Label>
                <Input
                  id="icp-points"
                  type="number"
                  value={draft.points}
                  onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3">
                <Label className="text-xs" htmlFor="icp-enabled">
                  Ativo
                </Label>
                <Switch
                  id="icp-enabled"
                  checked={draft.enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={save}>
                Salvar
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
