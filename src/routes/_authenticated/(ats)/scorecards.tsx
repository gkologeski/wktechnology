// Página de gerenciamento de scorecards de entrevista (ATS).
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
    if (!confirm("Excluir scorecard?")) return;
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
      criteria: [...f.criteria, { key: `c${f.criteria.length + 1}`, label: "Novo critério", weight: 1 }],
    }));
  const removeCriterion = (i: number) =>
    setForm((f) => ({ ...f, criteria: f.criteria.filter((_, idx) => idx !== i) }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Scorecards de entrevista</h2>
          <p className="text-sm text-muted-foreground">
            Templates de avaliação aplicados durante entrevistas de candidatos.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />Novo scorecard
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Novo"} scorecard</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Critérios (escala 0-5)</Label>
                  <Button size="sm" variant="outline" onClick={addCriterion}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Critério
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.criteria.map((c, i) => (
                    <div key={i} className="grid grid-cols-[1fr_2fr_90px_36px] gap-2 items-center">
                      <Input
                        placeholder="chave"
                        value={c.key}
                        onChange={(e) => setCriterion(i, { key: e.target.value })}
                      />
                      <Input
                        placeholder="rótulo"
                        value={c.label}
                        onChange={(e) => setCriterion(i, { label: e.target.value })}
                      />
                      <Input
                        type="number"
                        min={0.1}
                        max={10}
                        step={0.1}
                        value={c.weight}
                        onChange={(e) => setCriterion(i, { weight: Number(e.target.value) || 1 })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeCriterion(i)}
                        className="h-9 w-9"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum scorecard criado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((sc) => {
            const criteria = (sc.criteria as Criterion[]) ?? [];
            return (
              <Card key={sc.id as string}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">{sc.name as string}</CardTitle>
                    {sc.description && (
                      <p className="text-xs text-muted-foreground mt-1">{sc.description as string}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(sc)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleDelete(sc.id as string)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {criteria.map((c) => (
                      <Badge key={c.key} variant="outline" className="text-[10px]">
                        {c.label} · ×{c.weight}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
