// Indicações (Referrals) — workspace overview.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Gift, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  listReferrals,
  submitReferral,
  updateReferral,
} from "@/lib/ats/referrals.functions";
import { AtsPageHeader, EmptyState, Skeletons } from "@/components/ats/ui";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/(ats)/sourcing/referrals")({
  component: ReferralsPage,
});

const STATUS_OPTIONS = [
  "submitted",
  "under_review",
  "accepted",
  "interviewing",
  "hired",
  "rejected",
  "paid",
  "expired",
] as const;

const BONUS_OPTIONS = ["pending", "eligible", "approved", "paid", "forfeited"] as const;

function ReferralsPage() {
  const qc = useQueryClient();
  const fetcher = useServerFn(listReferrals);
  const submit = useServerFn(submitReferral);
  const update = useServerFn(updateReferral);

  const [scope, setScope] = useState<"mine" | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    candidate_name: "",
    candidate_email: "",
    candidate_phone: "",
    candidate_linkedin: "",
    relationship: "",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ats-referrals", scope],
    queryFn: () => fetcher({ data: { scope } }),
  });

  const submitMut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          candidate_name: form.candidate_name.trim(),
          candidate_email: form.candidate_email.trim() || null,
          candidate_phone: form.candidate_phone.trim() || null,
          candidate_linkedin: form.candidate_linkedin.trim() || null,
          relationship: form.relationship.trim() || null,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Indicação enviada");
      setOpen(false);
      setForm({
        candidate_name: "",
        candidate_email: "",
        candidate_phone: "",
        candidate_linkedin: "",
        relationship: "",
        notes: "",
      });
      qc.invalidateQueries({ queryKey: ["ats-referrals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = useMutation({
    mutationFn: (args: { id: string; patch: Record<string, unknown> }) =>
      update({ data: { id: args.id, ...args.patch } as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ats-referrals"] }),
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Sourcing"
        title="Indicações"
        description="Programa de referrals — colaboradores indicam talentos e acompanham bônus."
        primaryAction={
          <div className="flex items-center gap-2">
            <Select value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="mine">Minhas</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Nova indicação
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova indicação</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Nome do candidato *</Label>
                    <Input
                      value={form.candidate_name}
                      onChange={(e) => setForm({ ...form, candidate_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.candidate_email}
                      onChange={(e) => setForm({ ...form, candidate_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input
                      value={form.candidate_phone}
                      onChange={(e) => setForm({ ...form, candidate_phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>LinkedIn</Label>
                    <Input
                      placeholder="https://linkedin.com/in/..."
                      value={form.candidate_linkedin}
                      onChange={(e) => setForm({ ...form, candidate_linkedin: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Como vocês se conhecem?</Label>
                    <Input
                      value={form.relationship}
                      onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Por que recomenda?</Label>
                    <Textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={() => submitMut.mutate()}
                    disabled={!form.candidate_name.trim() || submitMut.isPending}
                  >
                    {submitMut.isPending ? "Enviando..." : "Enviar indicação"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {isLoading ? (
        <Skeletons.Card />
      ) : !data?.referrals.length ? (
        <EmptyState
          icon={Gift}
          title="Nenhuma indicação ainda"
          description="Quando alguém indicar um candidato, aparecerá aqui."
        />
      ) : (
        <div className="space-y-3">
          {data.referrals.map((r) => (
            <Card key={r.id}>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{r.candidate_name}</p>
                    <Badge variant="outline" className="text-xs">{r.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.candidate_email ?? "—"} ·{" "}
                    {(r.job as { title?: string } | null)?.title ?? "Sem vaga"}
                  </p>
                </div>
                <Select
                  value={r.status}
                  onValueChange={(v) => upd.mutate({ id: r.id, patch: { status: v } })}
                >
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={r.bonus_status}
                  onValueChange={(v) => upd.mutate({ id: r.id, patch: { bonus_status: v } })}
                >
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BONUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>Bônus: {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
