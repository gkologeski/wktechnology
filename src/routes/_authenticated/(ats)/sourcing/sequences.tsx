// Sequências de Sourcing — Onda 5 / Slice 2.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Mail, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listSequences,
  createSequence,
  updateSequence,
} from "@/lib/ats/sourcing-sequences.functions";
import { AtsPageHeader, EmptyState, Skeletons } from "@/components/ats/ui";

export const Route = createFileRoute("/_authenticated/(ats)/sourcing/sequences")({
  component: SequencesPage,
});

function SequencesPage() {
  const qc = useQueryClient();
  const fetchSeq = useServerFn(listSequences);
  const create = useServerFn(createSequence);
  const update = useServerFn(updateSequence);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["ats-sequences"],
    queryFn: () => fetchSeq(),
  });

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: { name: form.name.trim(), description: form.description.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success("Sequência criada");
      setOpen(false);
      setForm({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["ats-sequences"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (args: { id: string; enabled: boolean }) =>
      update({ data: { id: args.id, enabled: args.enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ats-sequences"] }),
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Sourcing"
        title="Sequências de outreach"
        description="Cadências automáticas para nutrir candidatos por email, WhatsApp e tarefas no LinkedIn."
        primaryAction={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Nova sequência
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova sequência</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex.: Outreach inicial — Backend Sr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => mut.mutate()} disabled={!form.name.trim() || mut.isPending}>
                  {mut.isPending ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeletons.Card />
          <Skeletons.Card />
          <Skeletons.Card />
        </div>
      ) : !data?.sequences.length ? (
        <EmptyState
          icon={Mail}
          title="Nenhuma sequência ainda"
          description="Crie sua primeira cadência multi-canal para iniciar outreach automático."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.sequences.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">{s.name}</h3>
                    {s.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                    ) : null}
                  </div>
                  <Badge variant={s.enabled ? "default" : "secondary"} className="shrink-0">
                    {s.enabled ? "Ativa" : "Pausada"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to="/sourcing/sequences/$id" params={{ id: s.id }}>
                      Abrir
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle.mutate({ id: s.id, enabled: !s.enabled })}
                    title={s.enabled ? "Pausar" : "Ativar"}
                  >
                    {s.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
