// Página de gerenciamento de scorecards de entrevista (ATS).
// Lote 4 do rollout UX/UI — segue Design Foundation TechHire.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader, EmptyState, MetaPill, Skeletons } from "@/components/techhire/ui";
import {
  listScorecards,
  saveScorecard,
  deleteScorecard,
  type Criterion,
} from "@/lib/ats/scorecards.functions";

export const Route = createFileRoute("/_authenticated/(ats)/scorecards")({
  component: ScorecardsPage,
});

type SC = Awaited<ReturnType<typeof listScorecards>>[number];

const DEFAULT_CRITERIA: Criterion[] = [
  { key: "technical", label: "Habilidade técnica", weight: 2 },
  { key: "communication", label: "Comunicação", weight: 1 },
  { key: "culture_fit", label: "Fit cultural", weight: 1.5 },
  { key: "experience", label: "Experiência relevante", weight: 1.5 },
];

function ScorecardsPage() {
  const list = useServerFn(listScorecards);
  const save = useServerFn(saveScorecard);
  const del = useServerFn(deleteScorecard);

  const [rows, setRows] = useState<SC[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SC | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    criteria: DEFAULT_CRITERIA,
  });

  const refresh = async () => {
    try {
      const r = await list({ data: {} });
      setRows(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", criteria: DEFAULT_CRITERIA });
    setOpen(true);
  };

  const openEdit = (sc: SC) => {
    setEditing(sc);
    setForm({
      name: sc.name as string,
      description: (sc.description as string) ?? "",
      criteria: (sc.criteria as Criterion[]) ?? DEFAULT_CRITERIA,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || form.criteria.length === 0) {
      toast.error("Informe nome e ao menos um critério");
      return;
    }
    try {
      await save({
        data: {
          id: editing?.id as string | undefined,
          name: form.name.trim(),
          description: form.description || null,
          is_active: true,
          criteria: form.criteria,
        },
      });
      setOpen(false);
      refresh();
      toast.success("Scorecard salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog("Excluir scorecard?"))) return;
    await del({ data: { id } });
    refresh();
  };

  const setCriterion = (i: number, patch: Partial<Criterion>) =>
    setForm((f) => ({
      ...f,
      criteria: f.criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));
  const addCriterion = () =>
    setForm((f) => ({
      ...f,
      criteria: [
        ...f.criteria,
        { key: `c${f.criteria.length + 1}`, label: "Novo critério", weight: 1 },
      ],
    }));
  const removeCriterion = (i: number) =>
    setForm((f) => ({ ...f, criteria: f.criteria.filter((_, idx) => idx !== i) }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Configurações · ATS"
        title="Scorecards de entrevista"
        description="Templates de avaliação aplicados durante entrevistas de candidatos."
        descriptionLive
        primaryAction={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo scorecard
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeletons.Card key={i} lines={3} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum scorecard criado"
          description="Crie templates de avaliação reutilizáveis para padronizar entrevistas e reduzir vieses."
          action={
            <Button onClick={openNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo scorecard
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((sc) => {
            const criteria = (sc.criteria as Criterion[]) ?? [];
            return (
              <article
                key={sc.id as string}
                className="group flex flex-col rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-xs transition hover:border-border-default hover:bg-surface-2"
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {sc.name as string}
                    </h3>
                    {sc.description ? (
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                        {sc.description as string}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEdit(sc)}
                      aria-label={`Editar scorecard ${sc.name as string}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(sc.id as string)}
                      aria-label={`Excluir scorecard ${sc.name as string}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </header>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-text-tertiary">
                  <span>
                    {criteria.length} critério{criteria.length === 1 ? "" : "s"}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    Peso total{" "}
                    {criteria.reduce((acc, c) => acc + (Number(c.weight) || 0), 0).toFixed(1)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {criteria.map((c) => (
                    <MetaPill key={c.key}>
                      {c.label} · ×{c.weight}
                    </MetaPill>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Novo"} scorecard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sc-name">Nome</Label>
              <Input
                id="sc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Entrevista técnica — Engenharia"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-desc">Descrição</Label>
              <Textarea
                id="sc-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Quando usar este scorecard"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Critérios (escala 0–5)</Label>
                <Button size="sm" variant="outline" onClick={addCriterion}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Critério
                </Button>
              </div>
              <div className="space-y-2">
                {form.criteria.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_2fr_90px_36px] gap-2 items-center">
                    <Input
                      placeholder="chave"
                      aria-label={`Chave do critério ${i + 1}`}
                      value={c.key}
                      onChange={(e) => setCriterion(i, { key: e.target.value })}
                    />
                    <Input
                      placeholder="rótulo"
                      aria-label={`Rótulo do critério ${i + 1}`}
                      value={c.label}
                      onChange={(e) => setCriterion(i, { label: e.target.value })}
                    />
                    <Input
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      aria-label={`Peso do critério ${i + 1}`}
                      value={c.weight}
                      onChange={(e) => setCriterion(i, { weight: Number(e.target.value) || 1 })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeCriterion(i)}
                      className="h-9 w-9"
                      aria-label={`Remover critério ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
