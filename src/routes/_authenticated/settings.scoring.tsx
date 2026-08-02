// Página /settings/scoring — gerenciador de regras de Lead Scoring + log de aplicações.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
import { Plus, Trash2, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import {
  listScoringRules,
  saveScoringRule,
  deleteScoringRule,
  listRecentScoreEvents,
  runScoringTickNow,
} from "@/lib/scoring.functions";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type FieldOpt = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "boolean";
  options?: { value: string; label: string }[];
};

const ENTITY_TO_CATALOG = {
  lead: "leads",
  contact: "contacts",
  company: "companies",
} as const;

function useEntityFieldOptions(entity: "lead" | "contact" | "company"): FieldOpt[] {
  const fetchCatalog = useServerFn(getEntityFieldCatalog);
  const { data } = useQuery({
    queryKey: ["scoring-entity-fields", entity],
    queryFn: () => fetchCatalog({ data: { entity: ENTITY_TO_CATALOG[entity] } }),
    staleTime: 5 * 60_000,
  });
  if (data?.fields?.length) {
    return data.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      options: f.options,
    }));
  }
  return [];
}

export const Route = createFileRoute("/_authenticated/settings/scoring")({
  beforeLoad: () => {
    throw redirect({ to: "/prospecting", search: { tab: "scoring" as const } });
  },
  component: ScoringPage,
});

type RuleEntity = "lead" | "contact" | "company";
type Op =
  | "eq"
  | "neq"
  | "in"
  | "contains"
  | "gt"
  | "lt"
  | "changed_to"
  | "is_empty"
  | "is_not_empty";

type Draft = {
  id?: string;
  name: string;
  entity: RuleEntity;
  enabled: boolean;
  points: number;
  condition: { field: string; op: Op; value?: unknown };
};

const EMPTY: Draft = {
  name: "",
  entity: "lead",
  enabled: true,
  points: 10,
  condition: { field: "source", op: "eq", value: "site" },
};

const ENTITY_LABEL: Record<RuleEntity, string> = {
  lead: "Lead",
  contact: "Contato",
  company: "Empresa",
};

const OP_LABEL: Record<Op, string> = {
  eq: "= igual a",
  neq: "≠ diferente de",
  in: "está em (lista)",
  contains: "contém",
  gt: "> maior que",
  lt: "< menor que",
  changed_to: "mudou para",
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
  changed_to: true,
  is_empty: false,
  is_not_empty: false,
};

export function ScoringPage() {
  const listFn = useServerFn(listScoringRules);
  const saveFn = useServerFn(saveScoringRule);
  const delFn = useServerFn(deleteScoringRule);
  const logsFn = useServerFn(listRecentScoreEvents);
  const tickFn = useServerFn(runScoringTickNow);

  const [rules, setRules] = useState<Awaited<ReturnType<typeof listScoringRules>>>([]);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listRecentScoreEvents>>>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([listFn(), logsFn()]);
      setRules(r);
      setEvents(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const totalPoints = useMemo(
    () => events.reduce((s, e) => s + Number((e as { points: number }).points ?? 0), 0),
    [events],
  );

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name) return toast.error("Dê um nome para a regra");
    if (!draft.condition.field) return toast.error("Informe o campo da condição");
    try {
      const payload: Draft = {
        ...draft,
        condition: NEEDS_VALUE[draft.condition.op]
          ? draft.condition
          : { field: draft.condition.field, op: draft.condition.op },
      };
      await saveFn({ data: payload });
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

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const r = await tickFn();
      toast.success(
        `Tick concluído: ${r.applied} aplicações em ${r.scanned} registros (${r.skipped} já pontuados)`,
      );
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Lead Scoring</h2>
          <p className="text-sm text-muted-foreground">
            Regras que somam pontos automaticamente quando uma condição é atendida. O executor roda
            a cada minuto via cron.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunNow} disabled={running}>
            <Play className="h-4 w-4 mr-1" /> {running ? "Processando…" : "Executar agora"}
          </Button>
          <Button onClick={() => setDraft({ ...EMPTY })}>
            <Plus className="h-4 w-4 mr-1" /> Nova regra
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!loading && rules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma regra ainda.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {rules.map((r) => {
          const cond = (r.condition as { field?: string; op?: Op; value?: unknown }) ?? {};
          return (
            <Card key={r.id as string}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {r.name as string}
                    <Badge variant="secondary">{ENTITY_LABEL[r.entity as RuleEntity]}</Badge>
                    <Badge>{r.points as number} pts</Badge>
                    {!r.enabled && <Badge variant="destructive">pausada</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    <code className="bg-muted px-1.5 py-0.5 rounded">{cond.field}</code>{" "}
                    {OP_LABEL[(cond.op as Op) ?? "eq"]}{" "}
                    {NEEDS_VALUE[(cond.op as Op) ?? "eq"] && (
                      <code className="bg-muted px-1.5 py-0.5 rounded">
                        {JSON.stringify(cond.value ?? "")}
                      </code>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDraft({
                        id: r.id as string,
                        name: r.name as string,
                        entity: r.entity as RuleEntity,
                        enabled: r.enabled as boolean,
                        points: r.points as number,
                        condition: {
                          field: (cond.field as string) ?? "",
                          op: (cond.op as Op) ?? "eq",
                          value: cond.value,
                        },
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
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimas aplicações ({events.length}) — {totalPoints} pts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma pontuação aplicada ainda.</p>
          )}
          <div className="space-y-2">
            {events.map((e) => (
              <div
                key={e.id as string}
                className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{String(e.entity)}</Badge>
                  <span>{(e.reason as string | null) ?? "—"}</span>
                  <code className="text-xs text-muted-foreground">
                    {String(e.entity_id).slice(0, 8)}
                  </code>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>{e.points as number} pts</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.created_at as string).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{draft?.id ? "Editar regra" : "Nova regra de scoring"}</SheetTitle>
          </SheetHeader>
          {draft && (
            <div className="space-y-5 py-4">
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Ex: Lead veio do site"
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
                    onValueChange={(v) => setDraft({ ...draft, entity: v as RuleEntity })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ENTITY_LABEL) as RuleEntity[]).map((e) => (
                        <SelectItem key={e} value={e}>
                          {ENTITY_LABEL[e]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pontos</Label>
                  <Input
                    type="number"
                    min={-1000}
                    max={1000}
                    value={draft.points}
                    onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <ConditionSection draft={draft} setDraft={setDraft} />

              <p className="text-xs text-muted-foreground">
                Cada combinação regra + registro só pontua uma vez (idempotente).
              </p>
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

function ConditionSection({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const fields = useEntityFieldOptions(draft.entity);
  const selected = fields.find((f) => f.name === draft.condition.field);
  const options = selected?.options;
  const type = selected?.type;
  const needsValue = NEEDS_VALUE[draft.condition.op];

  return (
    <section className="rounded-md border p-3 space-y-3">
      <h3 className="text-sm font-semibold">Condição</h3>
      <div className="grid grid-cols-[1fr_180px] gap-2">
        <div>
          <Label>Campo</Label>
          <Select
            value={draft.condition.field}
            onValueChange={(v) =>
              setDraft({
                ...draft,
                // Reset value when switching field to avoid stale types
                condition: { ...draft.condition, field: v, value: "" },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar propriedade" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {fields.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Carregando campos…</div>
              ) : (
                fields.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Operador</Label>
          <Select
            value={draft.condition.op}
            onValueChange={(v) =>
              setDraft({ ...draft, condition: { ...draft.condition, op: v as Op } })
            }
          >
            <SelectTrigger>
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
      </div>
      {needsValue && (
        <div>
          <Label>Valor</Label>
          {options && options.length > 0 ? (
            <Select
              value={String(draft.condition.value ?? "")}
              onValueChange={(v) =>
                setDraft({ ...draft, condition: { ...draft.condition, value: v } })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar valor" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={type === "number" ? "number" : type === "date" ? "date" : "text"}
              value={String(draft.condition.value ?? "")}
              onChange={(e) => {
                const raw = e.target.value;
                const coerced: string | number =
                  type === "number" && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
                setDraft({
                  ...draft,
                  condition: { ...draft.condition, value: coerced },
                });
              }}
              placeholder="valor"
            />
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Para "está em (lista)" use valores separados por vírgula.
          </p>
        </div>
      )}
    </section>
  );
}
