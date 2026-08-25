// Talent Pools — Onda 5 / Slice 2.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Users2, Sparkles, Lock } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listPools, createPool } from "@/lib/ats/talent-crm.functions";
import { AtsPageHeader, EmptyState, Skeletons } from "@/components/ats/ui";

export const Route = createFileRoute("/_authenticated/(ats)/sourcing/pools")({
  component: TalentPoolsPage,
});

function TalentPoolsPage() {
  const qc = useQueryClient();
  const fetchPools = useServerFn(listPools);
  const create = useServerFn(createPool);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "static" as "static" | "smart",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ats-pools"],
    queryFn: () => fetchPools(),
  });

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          type: form.type,
        },
      }),
    onSuccess: () => {
      toast.success("Pool criado");
      setOpen(false);
      setForm({ name: "", description: "", type: "static" });
      qc.invalidateQueries({ queryKey: ["ats-pools"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Sourcing"
        title="Talent Pools"
        description="Agrupe candidatos por interesse, stack ou status de relacionamento."
        primaryAction={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Novo pool
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Talent Pool</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex.: Engenheiros Sênior — Backend"
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
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v as "static" | "smart" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="static">Estático — adicionar manualmente</SelectItem>
                      <SelectItem value="smart">Smart — atualiza por filtros (em breve)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => mut.mutate()} disabled={!form.name.trim() || mut.isPending}>
                  {mut.isPending ? "Criando..." : "Criar pool"}
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
      ) : isError ? (
        <EmptyState
          icon={Users2}
          title="Não foi possível carregar"
          description="Tente novamente em instantes."
        />
      ) : !data?.pools.length ? (
        <EmptyState
          icon={Users2}
          title="Nenhum pool ainda"
          description="Crie seu primeiro talent pool para começar a organizar candidatos."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.pools.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {p.system_key ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : p.type === "smart" ? (
                      <Sparkles className="h-4 w-4 text-primary" />
                    ) : (
                      <Users2 className="h-4 w-4 text-muted-foreground" />
                    )}
                    <h3 className="text-sm font-semibold">{p.name}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">{p.member_count} candidatos</span>
                </div>
                {p.description ? (
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
