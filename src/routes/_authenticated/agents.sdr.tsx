import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listPlaybooks,
  upsertPlaybook,
  deletePlaybook,
  listEnrollments,
} from "@/lib/sdr-agent.functions";

export const Route = createFileRoute("/_authenticated/agents/sdr")({
  component: SdrAgentPage,
});

type Step = { delay_hours: number; template: string };
type Playbook = {
  id?: string;
  name: string;
  channel: "whatsapp" | "call" | "email";
  enabled: boolean;
  max_messages: number;
  business_hours: { tz: string; start: string; end: string; weekdays: number[] };
  opt_out_phrases: string[];
  steps: Step[];
  qualification_prompt?: string | null;
  handoff_score: number;
};

const empty: Playbook = {
  name: "Novo playbook",
  channel: "whatsapp",
  enabled: true,
  max_messages: 5,
  business_hours: {
    tz: "America/Sao_Paulo",
    start: "09:00",
    end: "18:00",
    weekdays: [1, 2, 3, 4, 5],
  },
  opt_out_phrases: ["pare", "sair", "stop"],
  steps: [{ delay_hours: 0, template: "Olá! Posso te ajudar com…" }],
  qualification_prompt:
    "Avalie de 0 a 100 o interesse do lead em comprar nosso produto, com base nas respostas.",
  handoff_score: 70,
};

function SdrAgentPage() {
  const listFn = useServerFn(listPlaybooks);
  const saveFn = useServerFn(upsertPlaybook);
  const delFn = useServerFn(deletePlaybook);
  const enrFn = useServerFn(listEnrollments);

  const [items, setItems] = useState<Playbook[]>([]);
  const [enrollments, setEnrollments] = useState<Array<Record<string, unknown>>>([]);
  const [active, setActive] = useState<Playbook>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([listFn(), enrFn({ data: {} })]);
      setItems(a.items as unknown as Playbook[]);
      setEnrollments(b.items as Array<Record<string, unknown>>);
      if ((a.items?.length ?? 0) > 0) setActive(a.items[0] as unknown as Playbook);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await saveFn({ data: active });
      toast.success("Playbook salvo");
      setActive(r.item as unknown as Playbook);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id?: string) {
    if (!id) return;
    if (!(await confirmDialog("Excluir playbook?"))) return;
    await delFn({ data: { id } });
    toast.success("Excluído");
    setActive(empty);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agente SDR</h1>
        <Button variant="outline" onClick={() => setActive(empty)}>
          <Plus className="h-4 w-4 mr-1" /> Novo playbook
        </Button>
      </div>

      <Tabs defaultValue="playbook">
        <TabsList>
          <TabsTrigger value="playbook">Playbook</TabsTrigger>
          <TabsTrigger value="enrollments">Em atendimento</TabsTrigger>
        </TabsList>

        <TabsContent value="playbook" className="space-y-4">
          <div className="grid md:grid-cols-[260px_1fr] gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Seus playbooks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : items.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nenhum ainda.</div>
                ) : (
                  items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActive(p)}
                      className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-muted ${active.id === p.id ? "bg-muted" : ""}`}
                    >
                      {p.name}{" "}
                      {p.enabled ? (
                        <Badge variant="secondary" className="ml-1">
                          on
                        </Badge>
                      ) : null}
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Editar playbook</CardTitle>
                <div className="flex gap-2">
                  {active.id && (
                    <Button variant="ghost" size="sm" onClick={() => remove(active.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}{" "}
                    Salvar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={active.name}
                      onChange={(e) => setActive({ ...active, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Canal</Label>
                    <select
                      className="w-full border rounded h-9 px-2 bg-background"
                      value={active.channel}
                      onChange={(e) =>
                        setActive({ ...active, channel: e.target.value as Playbook["channel"] })
                      }
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="call">Ligação</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div>
                    <Label>Máx. mensagens</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={active.max_messages}
                      onChange={(e) =>
                        setActive({ ...active, max_messages: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Score p/ handoff</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={active.handoff_score}
                      onChange={(e) =>
                        setActive({ ...active, handoff_score: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Horário comercial — início</Label>
                    <Input
                      value={active.business_hours.start}
                      onChange={(e) =>
                        setActive({
                          ...active,
                          business_hours: { ...active.business_hours, start: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Horário comercial — fim</Label>
                    <Input
                      value={active.business_hours.end}
                      onChange={(e) =>
                        setActive({
                          ...active,
                          business_hours: { ...active.business_hours, end: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={active.enabled}
                    onCheckedChange={(v) => setActive({ ...active, enabled: v })}
                  />
                  <span className="text-sm">Ativo</span>
                </div>
                <div>
                  <Label>Frases de opt-out (separadas por vírgula)</Label>
                  <Input
                    value={active.opt_out_phrases.join(", ")}
                    onChange={(e) =>
                      setActive({
                        ...active,
                        opt_out_phrases: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Prompt de qualificação</Label>
                  <Textarea
                    rows={3}
                    value={active.qualification_prompt ?? ""}
                    onChange={(e) => setActive({ ...active, qualification_prompt: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Sequência de mensagens</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setActive({
                          ...active,
                          steps: [...active.steps, { delay_hours: 24, template: "" }],
                        })
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {active.steps.map((s, i) => (
                    <div key={i} className="border rounded p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Atraso (horas)</Label>
                        <Input
                          className="w-24"
                          type="number"
                          min={0}
                          value={s.delay_hours}
                          onChange={(e) => {
                            const steps = [...active.steps];
                            steps[i] = { ...s, delay_hours: Number(e.target.value) };
                            setActive({ ...active, steps });
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto"
                          onClick={() =>
                            setActive({ ...active, steps: active.steps.filter((_, j) => j !== i) })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        value={s.template}
                        onChange={(e) => {
                          const steps = [...active.steps];
                          steps[i] = { ...s, template: e.target.value };
                          setActive({ ...active, steps });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="enrollments">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Leads em atendimento</CardTitle>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nenhum lead enrolado.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left p-2">Lead</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Msgs</th>
                      <th className="text-left p-2">Score</th>
                      <th className="text-left p-2">Última ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => (
                      <tr key={String(e.id)} className="border-t">
                        <td className="p-2">
                          {String(e.lead_id ?? e.contact_id ?? "—").slice(0, 8)}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline">{String(e.status)}</Badge>
                        </td>
                        <td className="p-2">{String(e.messages_sent ?? 0)}</td>
                        <td className="p-2">
                          {e.qualification_score == null ? "—" : String(e.qualification_score)}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {e.last_action_at
                            ? new Date(String(e.last_action_at)).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
