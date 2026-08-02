import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import {
  listDunningPolicies,
  upsertDunningPolicy,
  deleteDunningPolicy,
  listDunningRuns,
} from "@/lib/dunning.functions";
import { listChargingTemplates } from "@/lib/charging-templates.functions";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/dunning")({
  component: DunningPage,
});

type Step = {
  offset_days: number;
  channel: "email" | "whatsapp" | "task" | "escalation";
  template?: string;
  template_id?: string | null;
  subject?: string;
  body?: string;
};

const defaultSteps: Step[] = [
  {
    offset_days: 1,
    channel: "email",
    subject: "Lembrete amigável de pagamento",
    body: "Olá, sua fatura {invoice_number} vence hoje.",
  },
  {
    offset_days: 5,
    channel: "whatsapp",
    body: "Oi! A fatura {invoice_number} venceu há {days_overdue} dias. Posso ajudar?",
  },
  { offset_days: 15, channel: "escalation", body: "Escalando para cobrança especializada." },
];

function DunningPage() {
  const list = useServerFn(listDunningPolicies);
  const upsert = useServerFn(upsertDunningPolicy);
  const del = useServerFn(deleteDunningPolicy);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dunning-policies"],
    queryFn: () => list(),
  });
  const runsFn = useServerFn(listDunningRuns);
  const { data: runsData } = useQuery({
    queryKey: ["dunning-runs"],
    queryFn: () => runsFn(),
  });
  const templatesFn = useServerFn(listChargingTemplates);
  const { data: templatesData } = useQuery({
    queryKey: ["charging-templates-by-channel"],
    queryFn: () => templatesFn(),
  });
  const templates = (templatesData?.templates ?? []) as Array<{
    id: string;
    name: string;
    channel: "email" | "whatsapp";
    active: boolean;
  }>;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("Régua padrão");
  const [active, setActive] = useState(true);
  const [isDefault, setIsDefault] = useState(true);
  const [steps, setSteps] = useState<Step[]>(defaultSteps);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditingId(null);
    setName("Régua padrão");
    setActive(true);
    setIsDefault(true);
    setSteps(defaultSteps);
  }

  function loadPolicy(p: {
    id: string;
    name: string;
    active: boolean;
    is_default: boolean;
    steps: Step[];
  }) {
    setEditingId(p.id);
    setName(p.name);
    setActive(p.active);
    setIsDefault(p.is_default);
    setSteps(p.steps ?? []);
  }

  async function save() {
    setSaving(true);
    try {
      await upsert({
        data: {
          id: editingId ?? undefined,
          name,
          active,
          is_default: isDefault,
          steps,
        },
      });
      toast.success("Régua salva");
      qc.invalidateQueries({ queryKey: ["dunning-policies"] });
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirmDialog("Excluir régua?"))) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["dunning-policies"] });
      if (editingId === id) reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  return (
    <div className="space-y-4 p-6 max-w-4xl">
      <PageHeader
        title="Régua de cobrança"
        description="Sequência automática para faturas em aberto/vencidas."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Réguas existentes</CardTitle>
            <Button size="sm" variant="outline" onClick={reset}>
              <Plus className="mr-1 h-4 w-4" /> Nova
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : !data?.policies?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma régua criada.</p>
            ) : (
              <ul className="space-y-1">
                {data.policies.map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between rounded border p-2 ${editingId === p.id ? "bg-muted/50" : ""}`}
                  >
                    <button
                      className="flex-1 text-left text-sm"
                      onClick={() =>
                        loadPolicy(
                          p as unknown as {
                            id: string;
                            name: string;
                            active: boolean;
                            is_default: boolean;
                            steps: Step[];
                          },
                        )
                      }
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.is_default && (
                        <span className="ml-2 text-xs text-muted-foreground">(padrão)</span>
                      )}
                      {!p.active && (
                        <span className="ml-2 text-xs text-muted-foreground">(inativa)</span>
                      )}
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Editar régua" : "Nova régua"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Padrão do workspace</Label>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>

            <div className="space-y-2">
              <Label>Passos</Label>
              {steps.map((s, i) => (
                <div key={i} className="rounded-md border p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-20"
                      value={s.offset_days}
                      onChange={(e) => updateStep(i, { offset_days: Number(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground">dias após vencimento</span>
                    <Select
                      value={s.channel}
                      onValueChange={(v) => updateStep(i, { channel: v as Step["channel"] })}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="task">Tarefa</SelectItem>
                        <SelectItem value="escalation">Escalada</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  {(s.channel === "email" || s.channel === "whatsapp") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Template ({s.channel})
                      </Label>
                      <Select
                        value={s.template_id ?? "__inline__"}
                        onValueChange={(v) =>
                          updateStep(i, { template_id: v === "__inline__" ? null : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__inline__">Usar mensagem inline</SelectItem>
                          {templates
                            .filter((t) => t.channel === s.channel && t.active)
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Link
                        to="/settings/charging-templates"
                        className="text-xs text-primary underline"
                      >
                        Gerenciar templates
                      </Link>
                    </div>
                  )}
                  {!s.template_id && s.channel === "email" && (
                    <Input
                      placeholder="Assunto"
                      value={s.subject ?? ""}
                      onChange={(e) => updateStep(i, { subject: e.target.value })}
                    />
                  )}
                  {!s.template_id && (
                    <Input
                      placeholder="Mensagem (use {invoice_number}, {amount}, {days_overdue})"
                      value={s.body ?? ""}
                      onChange={(e) => updateStep(i, { body: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSteps((p) => [...p, { offset_days: 30, channel: "email", body: "" }])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar passo
              </Button>
            </div>

            <Button onClick={save} disabled={saving || !name || !steps.length} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar régua
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Execuções recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!runsData?.runs?.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma execução ainda. O cron processa faturas vencidas periodicamente.
            </p>
          ) : (
            <div className="divide-y">
              {runsData.runs.slice(0, 30).map((r) => {
                const inv = (
                  r as unknown as {
                    customer_invoices?: {
                      invoice_number?: string;
                      amount?: number;
                      due_date?: string;
                    };
                  }
                ).customer_invoices;
                const history = Array.isArray(r.history)
                  ? (r.history as Array<{ channel?: string; at?: string }>)
                  : [];
                return (
                  <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">
                        Fatura {inv?.invoice_number ?? "—"}
                        <span className="text-muted-foreground ml-2">
                          venc. {inv?.due_date ?? "—"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Passo atual: {r.current_step ?? 0} · {history.length} evento(s)
                      </div>
                    </div>
                    <Badge variant={r.status === "active" ? "default" : "outline"}>
                      {r.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
