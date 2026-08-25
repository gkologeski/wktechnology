import { getPublicAppUrl } from "@/lib/app-url";
// Indicações (Referrals) — Onda 5 / Slice 5.3.
// Abas: Indicações · Programas (com portal público) · Ranking.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Gift, Plus, Copy, Trophy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  listReferrals,
  submitReferral,
  updateReferral,
  listReferralPrograms,
  upsertReferralProgram,
  updateReferralProgramPortal,
} from "@/lib/ats/referrals.functions";
import { getReferralsLeaderboard } from "@/lib/ats/referrals-leaderboard.functions";
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
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  const [tab, setTab] = useState("inbox");

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Sourcing"
        title="Indicações"
        description="Programa de referrals — portal público, ranking de indicadores e fluxo interno."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inbox">Indicações</TabsTrigger>
          <TabsTrigger value="programs">Programas</TabsTrigger>
          <TabsTrigger value="leaderboard">Ranking</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-4">
          <ReferralsInbox />
        </TabsContent>
        <TabsContent value="programs" className="mt-4">
          <ReferralsPrograms />
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-4">
          <ReferralsLeaderboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------- Inbox ---------------------- */
function ReferralsInbox() {
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
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Select value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
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
                  value={form.candidate_linkedin}
                  onChange={(e) => setForm({ ...form, candidate_linkedin: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Relacionamento</Label>
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
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
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
                    <Badge variant="outline" className="text-xs">
                      {r.status}
                    </Badge>
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
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={r.bonus_status}
                  onValueChange={(v) => upd.mutate({ id: r.id, patch: { bonus_status: v } })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BONUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        Bônus: {s}
                      </SelectItem>
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

/* ---------------------- Programas ---------------------- */
function ReferralsPrograms() {
  const qc = useQueryClient();
  const fetcher = useServerFn(listReferralPrograms);
  const upsert = useServerFn(upsertReferralProgram);
  const updPortal = useServerFn(updateReferralProgramPortal);

  const { data, isLoading } = useQuery({
    queryKey: ["ats-referral-programs"],
    queryFn: () => fetcher(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    default_bonus_cents: 0,
    currency: "BRL",
    terms_url: "",
  });

  const createMut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          name: form.name.trim(),
          enabled: true,
          default_bonus_cents: Number(form.default_bonus_cents) || 0,
          currency: form.currency,
          terms_url: form.terms_url.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Programa criado");
      setOpen(false);
      setForm({ name: "", default_bonus_cents: 0, currency: "BRL", terms_url: "" });
      qc.invalidateQueries({ queryKey: ["ats-referral-programs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const portalMut = useMutation({
    mutationFn: (args: { id: string; patch: Record<string, unknown> }) =>
      updPortal({ data: { id: args.id, ...args.patch } as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ats-referral-programs"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function copyLink(slug: string) {
    const url = `${getPublicAppUrl()}/refer/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Novo programa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo programa</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Bônus (centavos)</Label>
                  <Input
                    type="number"
                    value={form.default_bonus_cents}
                    onChange={(e) =>
                      setForm({ ...form, default_bonus_cents: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Moeda</Label>
                  <Input
                    value={form.currency}
                    maxLength={3}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>URL dos termos</Label>
                <Input
                  value={form.terms_url}
                  onChange={(e) => setForm({ ...form, terms_url: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!form.name.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? "Salvando..." : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeletons.Card />
      ) : !data?.programs.length ? (
        <EmptyState
          icon={Gift}
          title="Nenhum programa"
          description="Crie um programa para começar a receber indicações."
        />
      ) : (
        <div className="space-y-3">
          {data.programs.map((p) => {
            const prog = p as {
              id: string;
              name: string;
              enabled: boolean;
              public_slug: string | null;
              landing_headline: string | null;
              landing_body: string | null;
              enable_public_form: boolean | null;
              default_bonus_cents: number;
              currency: string;
            };
            return (
              <Card key={prog.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{prog.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Bônus padrão:{" "}
                        {(prog.default_bonus_cents / 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: prog.currency,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={prog.enabled ? "default" : "outline"} className="text-[10px]">
                        {prog.enabled ? "ativo" : "inativo"}
                      </Badge>
                      {prog.public_slug && prog.enable_public_form && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyLink(prog.public_slug!)}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Copiar link
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <a href={`/refer/${prog.public_slug}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-md border border-border-subtle bg-muted/30 p-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Slug público</Label>
                      <Input
                        placeholder="ex: tech-2025"
                        defaultValue={prog.public_slug ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim().toLowerCase();
                          if ((prog.public_slug ?? "") !== v) {
                            portalMut.mutate({ id: prog.id, patch: { public_slug: v || null } });
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border-subtle bg-background p-2">
                      <Label htmlFor={`pub-${prog.id}`} className="text-xs">
                        Portal público ativo
                      </Label>
                      <Switch
                        id={`pub-${prog.id}`}
                        checked={!!prog.enable_public_form}
                        onCheckedChange={(v) =>
                          portalMut.mutate({ id: prog.id, patch: { enable_public_form: v } })
                        }
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Título da landing</Label>
                      <Input
                        defaultValue={prog.landing_headline ?? ""}
                        onBlur={(e) => {
                          if ((prog.landing_headline ?? "") !== e.target.value) {
                            portalMut.mutate({
                              id: prog.id,
                              patch: { landing_headline: e.target.value || null },
                            });
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Texto da landing</Label>
                      <Textarea
                        rows={3}
                        defaultValue={prog.landing_body ?? ""}
                        onBlur={(e) => {
                          if ((prog.landing_body ?? "") !== e.target.value) {
                            portalMut.mutate({
                              id: prog.id,
                              patch: { landing_body: e.target.value || null },
                            });
                          }
                        }}
                      />
                    </div>
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

/* ---------------------- Leaderboard ---------------------- */
function ReferralsLeaderboard() {
  const fetcher = useServerFn(getReferralsLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["ats-referrals-leaderboard"],
    queryFn: () => fetcher({ data: { limit: 20 } }),
  });

  if (isLoading) return <Skeletons.Card />;
  if (!data?.leaderboard.length) {
    return (
      <EmptyState
        icon={Trophy}
        title="Sem dados ainda"
        description="O ranking aparece após as primeiras indicações."
      />
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.leaderboard.map((r, idx) => (
            <div key={r.key} className="flex items-center gap-3 p-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  {r.total} indicações · {r.hired} contratados
                </p>
              </div>
              {idx === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
