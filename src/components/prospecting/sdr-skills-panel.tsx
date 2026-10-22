// Habilidades e ferramentas por agente: liga/desliga, prontidão real,
// anfitrião/agenda do agendamento direto, teste simulado e registro.
import { useSdrPlaybooks } from "@/hooks/use-default-sdr-agent";
import {
  agentOptionLabel,
  pickDefaultAgent,
  sortDefaultFirst,
  DEFAULT_MEETING_TITLE,
} from "@/lib/prospecting/sdr/default-agent";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import {
  getSdrToolCatalog,
  saveSdrToolConfig,
  testSdrTool,
} from "@/lib/prospecting/sdr-tools.functions";
import type { getCatalog } from "@/lib/prospecting/sdr/tools/admin.server";
import type { ToolConfig } from "@/lib/prospecting/sdr/tools/catalog";
import { windowsError } from "@/lib/prospecting/sdr/tools/scheduling";

type Catalog = Awaited<ReturnType<typeof getCatalog>>;
const DAYS = [
  ["mon", "Seg"],
  ["tue", "Ter"],
  ["wed", "Qua"],
  ["thu", "Qui"],
  ["fri", "Sex"],
  ["sat", "Sáb"],
  ["sun", "Dom"],
] as const;
const STATUS_PT: Record<string, string> = {
  ok: "Executada",
  error: "Erro",
  denied: "Negada",
  pending: "Pendente",
};

export function SdrSkillsPanel({
  playbooks,
}: {
  playbooks: { id: string; name: string; enabled: boolean }[];
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const { defaultPlaybookId } = useSdrPlaybooks();
  const playbookId =
    picked && playbooks.some((p) => p.id === picked)
      ? picked
      : pickDefaultAgent(playbooks, defaultPlaybookId);
  if (!playbooks.length)
    return <EmptyState title="Nenhum agente ainda" description="Crie um agente na aba Playbook." />;
  return (
    <div className="space-y-4">
      <div className="flex w-full max-w-md flex-col gap-1.5">
        <Label htmlFor="sdr-skills-agent">Agente</Label>
        <Select value={playbookId ?? undefined} onValueChange={setPicked}>
          <SelectTrigger id="sdr-skills-agent">
            <SelectValue placeholder="Escolha o agente" />
          </SelectTrigger>
          <SelectContent>
            {sortDefaultFirst(playbooks, defaultPlaybookId).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {agentOptionLabel(p, defaultPlaybookId)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {playbookId && <SkillsForm key={playbookId} playbookId={playbookId} />}
    </div>
  );
}

function defaultSchedule(c: Catalog): NonNullable<ToolConfig["scheduling"]> | null {
  const b = c.legacyBookingPage as null | {
    calendar_account_id: string | null;
    owner_id: string;
    duration_minutes: number;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    timezone: string;
    min_notice_hours: number;
    max_advance_days: number;
    availability: Record<string, { start: string; end: string }[]>;
  };
  if (!b?.calendar_account_id) return null;
  return {
    host_user_id: b.owner_id,
    calendar_account_id: b.calendar_account_id,
    duration_minutes: b.duration_minutes,
    timezone: b.timezone,
    working_hours: b.availability as never,
    buffer_before_minutes: b.buffer_before_minutes,
    buffer_after_minutes: b.buffer_after_minutes,
    min_notice_hours: b.min_notice_hours,
    horizon_days: Math.min(90, b.max_advance_days),
    holidays: [],
    video: "google_meet",
    meeting_title: DEFAULT_MEETING_TITLE,
    after_rejection: "offer_new",
  };
}

function SkillsForm({ playbookId }: { playbookId: string }) {
  const fetchCat = useServerFn(getSdrToolCatalog);
  const save = useServerFn(saveSdrToolConfig);
  const test = useServerFn(testSdrTool);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["sdr-tools", playbookId],
    queryFn: async () => JSON.parse((await fetchCat({ data: { playbookId } })).json) as Catalog,
  });
  const [cfg, setCfg] = useState<ToolConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [testTool, setTestTool] = useState<string>("calendar.availability");
  const [testArgs, setTestArgs] = useState(
    '{"date":null,"time":null,"timezone":null,"part_of_day":null,"rejected_previous":false}',
  );
  const [testOut, setTestOut] = useState<string>("");
  const [sbState, setSbState] = useState<unknown>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (q.data && !cfg)
      setCfg(
        q.data.draft ?? {
          enabled_tools: [],
          scheduling: defaultSchedule(q.data),
          allowed_tags: [],
          automations: { ai_question_silence_handoff: { enabled: false, minutes: 30 } },
        },
      );
  }, [q.data, cfg]);

  const bySkill = useMemo(() => {
    const m = new Map<string, Catalog["tools"]>();
    for (const t of q.data?.tools ?? []) m.set(t.skill, [...(m.get(t.skill) ?? []), t]);
    return m;
  }, [q.data]);

  if (q.isLoading || (q.data && !cfg))
    return (
      <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando ferramentas…
      </div>
    );
  if (q.error || !q.data || !cfg)
    return (
      <EmptyState
        title="Não foi possível carregar as ferramentas"
        description={(q.error as Error)?.message ?? ""}
        action={<Button onClick={() => q.refetch()}>Tentar novamente</Button>}
      />
    );
  const c = q.data;
  const s = cfg.scheduling;
  const toggle = (id: string, on: boolean) =>
    setCfg({
      ...cfg,
      enabled_tools: on
        ? [...new Set([...cfg.enabled_tools, id])]
        : cfg.enabled_tools.filter((t) => t !== id),
    });
  const setS = (patch: Partial<NonNullable<ToolConfig["scheduling"]>>) =>
    s && setCfg({ ...cfg, scheduling: { ...s, ...patch } });

  async function onSave() {
    setSaving(true);
    try {
      const r = await save({ data: { playbookId, config: cfg } });
      toast.success(
        r.created
          ? "Rascunho criado com as ferramentas. Publique na aba Persona e teste."
          : "Rascunho atualizado.",
      );
      await qc.invalidateQueries({ queryKey: ["sdr-tools", playbookId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function onTest() {
    setTesting(true);
    try {
      let args: unknown;
      try {
        args = JSON.parse(testArgs.replace(/"sandbox-msg-1"/g, '"sandbox-msg-1"'));
      } catch {
        toast.error("Argumentos não são JSON válido.");
        return;
      }
      const r = await test({ data: { playbookId, tool: testTool, args, sandbox_state: sbState } });
      setSbState(r.sandbox_state);
      setTestOut(JSON.stringify(JSON.parse(r.output), null, 2));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Em produção vale a versão publicada {c.publishedVersion ? `(v${c.publishedVersion})` : ""}
        {c.publishedHasTools ? " com ferramentas." : ", que ainda não tem ferramentas ligadas."} As
        mudanças daqui vão para o rascunho.
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="Agendamento direto"
          description="A Lia consulta a agenda do anfitrião e marca na conversa. Nenhum link de autoagendamento é enviado."
        />
        {!s ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Nenhum anfitrião definido.</p>
            <Button
              variant="outline"
              disabled={!c.calendars.length}
              onClick={() =>
                setCfg({
                  ...cfg,
                  scheduling: {
                    host_user_id: c.calendars[0]!.owner_id,
                    calendar_account_id: c.calendars[0]!.id,
                    duration_minutes: 30,
                    timezone: "America/Sao_Paulo",
                    working_hours: Object.fromEntries(
                      ["mon", "tue", "wed", "thu", "fri"].map((d) => [
                        d,
                        [
                          { start: "09:00", end: "12:00" },
                          { start: "13:00", end: "17:00" },
                        ],
                      ]),
                    ),
                    buffer_before_minutes: 0,
                    buffer_after_minutes: 0,
                    min_notice_hours: 2,
                    horizon_days: 21,
                    holidays: [],
                    video: "google_meet",
                    meeting_title: DEFAULT_MEETING_TITLE,
                    after_rejection: "offer_new",
                  },
                })
              }
            >
              Definir anfitrião
            </Button>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-1.5 md:col-span-2">
              <Label htmlFor="sk-host">Anfitrião e agenda</Label>
              <Select
                value={s.calendar_account_id}
                onValueChange={(v) => {
                  const a = c.calendars.find((x) => x.id === v);
                  if (a) setS({ calendar_account_id: a.id, host_user_id: a.owner_id });
                }}
              >
                <SelectTrigger id="sk-host" className="min-w-0 [&>span]:truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {c.calendars.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.owner_name} · {a.email} ({a.provider === "google" ? "Google" : a.provider}
                      {a.status === "error" ? ", com erro" : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p
                className={`text-xs ${c.calendarReadiness.ok ? "text-muted-foreground" : "text-destructive"}`}
                role="status"
              >
                {c.calendarReadiness.ok
                  ? "Agenda pronta (consulta livre/ocupado real)."
                  : `Não pronta: ${c.calendarReadiness.reason ?? ""}`}{" "}
                {cfg.scheduling?.calendar_account_id !== c.draft?.scheduling?.calendar_account_id
                  ? "Salve para revalidar."
                  : ""}
              </p>
            </div>
            <Num
              id="sk-dur"
              label="Duração (min)"
              v={s.duration_minutes}
              on={(n) => setS({ duration_minutes: n })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="sk-tz">Fuso horário</Label>
              <Input
                id="sk-tz"
                value={s.timezone}
                onChange={(e) => setS({ timezone: e.target.value })}
              />
            </div>
            <Num
              id="sk-bb"
              label="Intervalo antes (min)"
              v={s.buffer_before_minutes}
              on={(n) => setS({ buffer_before_minutes: n })}
            />
            <Num
              id="sk-ba"
              label="Intervalo depois (min)"
              v={s.buffer_after_minutes}
              on={(n) => setS({ buffer_after_minutes: n })}
            />
            <Num
              id="sk-mn"
              label="Antecedência mínima (h)"
              v={s.min_notice_hours}
              on={(n) => setS({ min_notice_hours: n })}
            />
            <Num
              id="sk-hz"
              label="Horizonte (dias)"
              v={s.horizon_days}
              on={(n) => setS({ horizon_days: n })}
            />
            <div className="min-w-0 space-y-1.5 md:col-span-2">
              <Label htmlFor="sk-rej">Quando o cliente recusar as opções</Label>
              <Select
                value={s.after_rejection ?? "offer_new"}
                onValueChange={(v) =>
                  setS({ after_rejection: v as "offer_new" | "ask_preference" })
                }
              >
                <SelectTrigger id="sk-rej" className="min-w-0 [&>span]:truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offer_new">Consultar e oferecer até 3 novos horários</SelectItem>
                  <SelectItem value="ask_preference">
                    Registrar a recusa sem novos horários
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-2 md:col-span-2">
              <legend className="text-sm font-medium">Expediente</legend>
              <p className="text-xs text-muted-foreground">
                Até dois períodos por dia (ex.: 09:00–12:00 e 13:00–17:00). Deixe o segundo vazio se
                houver só um.
              </p>
              {DAYS.map(([k, label]) => {
                const ws = s.working_hours[k] ?? [];
                const on = ws.length > 0;
                const err = windowsError(ws);
                const setWin = (i: number, field: "start" | "end", value: string) => {
                  const next = [...ws];
                  next[i] = { ...(next[i] ?? { start: "", end: "" }), [field]: value };
                  const clean = next.filter((x, j) => j === 0 || x.start || x.end);
                  setS({ working_hours: { ...s.working_hours, [k]: clean } });
                };
                const win = (i: number, n: string) => (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">De</span>
                    <Input
                      aria-label={`Início do ${n} período de ${label}`}
                      className="w-24"
                      placeholder="--:--"
                      value={ws[i]?.start ?? ""}
                      onChange={(e) => setWin(i, "start", e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input
                      aria-label={`Fim do ${n} período de ${label}`}
                      className="w-24"
                      placeholder="--:--"
                      value={ws[i]?.end ?? ""}
                      onChange={(e) => setWin(i, "end", e.target.value)}
                    />
                  </div>
                );
                return (
                  <div key={k} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`sk-d-${k}`}
                          checked={on}
                          onCheckedChange={(v) =>
                            setS({
                              working_hours: {
                                ...s.working_hours,
                                [k]: v
                                  ? [
                                      { start: "09:00", end: "12:00" },
                                      { start: "13:00", end: "17:00" },
                                    ]
                                  : [],
                              },
                            })
                          }
                          aria-label={`Atende ${label}`}
                        />
                        <Label htmlFor={`sk-d-${k}`} className="w-10">
                          {label}
                        </Label>
                      </div>
                      {on && (
                        <>
                          {win(0, "primeiro")}
                          {win(1, "segundo")}
                        </>
                      )}
                    </div>
                    {on && err && (
                      <p role="alert" className="text-xs text-destructive">
                        {err}
                      </p>
                    )}
                  </div>
                );
              })}
            </fieldset>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="sk-hol">
                Feriados e datas sem atendimento (AAAA-MM-DD, separados por vírgula)
              </Label>
              <Input
                id="sk-hol"
                value={s.holidays.join(", ")}
                onChange={(e) =>
                  setS({
                    holidays: e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </div>
        )}
      </section>

      {[...bySkill.entries()].map(([skill, tools]) => (
        <section key={skill} className="space-y-2">
          <SectionHeader
            title={
              (c.skills as Record<string, { name: string; description: string }>)[skill]?.name ??
              skill
            }
            description={
              (c.skills as Record<string, { name: string; description: string }>)[skill]
                ?.description
            }
          />
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tools.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start gap-3 p-3">
                <Switch
                  id={`tool-${t.id}`}
                  checked={cfg.enabled_tools.includes(t.id)}
                  disabled={!t.available}
                  onCheckedChange={(on) => toggle(t.id, on)}
                  aria-label={`Ligar ${t.name}`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor={`tool-${t.id}`} className="font-medium">
                    {t.name} <code className="ml-1 text-xs text-muted-foreground">{t.id}</code>
                  </Label>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">
                      {t.effect === "write" ? "Com efeito" : "Somente leitura"}
                    </Badge>
                    {t.confirmation && (
                      <Badge variant="outline">Exige confirmação do cliente</Badge>
                    )}
                    <Badge variant={t.readiness.ready ? "secondary" : "destructive"}>
                      {t.readiness.ready ? "Pronta" : `Não pronta: ${t.readiness.reason}`}
                    </Badge>
                    {t.published && <Badge variant="secondary">Ativa na versão publicada</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="space-y-2">
        <SectionHeader
          title="Automações"
          description="Regras automáticas desta versão. Ficam desligadas até você ligar e publicar."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            id="sk-auto-ai"
            checked={!!cfg.automations?.ai_question_silence_handoff.enabled}
            onCheckedChange={(v) =>
              setCfg({
                ...cfg,
                automations: {
                  ai_question_silence_handoff: {
                    minutes: cfg.automations?.ai_question_silence_handoff.minutes ?? 30,
                    enabled: v,
                  },
                },
              })
            }
          />
          <Label htmlFor="sk-auto-ai" className="font-normal">
            Passar para uma pessoa quando o cliente perguntar se fala com uma IA e parar de
            responder
          </Label>
          <Input
            aria-label="Minutos de silêncio antes de passar para uma pessoa"
            type="number"
            min={5}
            max={1440}
            className="w-24"
            disabled={!cfg.automations?.ai_question_silence_handoff.enabled}
            value={cfg.automations?.ai_question_silence_handoff.minutes ?? 30}
            onChange={(e) =>
              setCfg({
                ...cfg,
                automations: {
                  ai_question_silence_handoff: {
                    enabled: !!cfg.automations?.ai_question_silence_handoff.enabled,
                    minutes: Math.max(5, Math.min(1440, Number(e.target.value) || 30)),
                  },
                },
              })
            }
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      </section>

      <section className="space-y-2">
        <SectionHeader
          title="Etiquetas permitidas"
          description="Únicas etiquetas que a ferramenta de etiquetas pode usar."
        />
        <Input
          aria-label="Etiquetas permitidas"
          value={cfg.allowed_tags.join(", ")}
          onChange={(e) =>
            setCfg({
              ...cfg,
              allowed_tags: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
          placeholder="ex.: interessado, sem perfil"
        />
      </section>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar no rascunho
        </Button>
      </div>

      <section className="space-y-2">
        <SectionHeader
          title="Testar ferramenta (simulado)"
          description="Usa o rascunho salvo, agenda falsa e dados em memória. Nada é gravado nem enviado. Use sandbox-msg-1 como confirmação."
        />
        <div className="grid gap-3 md:grid-cols-[260px_1fr]">
          <Select value={testTool} onValueChange={setTestTool}>
            <SelectTrigger aria-label="Ferramenta a testar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {c.tools
                .filter((t) => t.available)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Textarea
            aria-label="Argumentos em JSON"
            rows={4}
            className="font-mono text-xs"
            value={testArgs}
            onChange={(e) => setTestArgs(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onTest} disabled={testing}>
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="mr-2 h-4 w-4" />
            )}
            Executar simulação
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSbState(null);
              setTestOut("");
            }}
          >
            Reiniciar simulação
          </Button>
        </div>
        {testOut && (
          <pre
            className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs"
            aria-live="polite"
          >
            {testOut}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        <SectionHeader
          title="Registro de execuções reais"
          description="Últimas chamadas de ferramentas em conversas de produção."
        />
        {!c.logs.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {c.logs.map((l) => (
              <li key={l.id} className="flex flex-wrap gap-2 p-2">
                <span className="font-mono text-xs">{l.tool}</span>
                <Badge variant={l.status === "ok" ? "secondary" : "outline"}>
                  {STATUS_PT[l.status] ?? l.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("pt-BR")} · {l.duration_ms ?? 0} ms
                </span>
                {l.error && <span className="text-xs text-destructive">{l.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Num({
  id,
  label,
  v,
  on,
}: {
  id: string;
  label: string;
  v: number;
  on: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={v}
        onChange={(e) => on(Number(e.target.value) || 0)}
      />
    </div>
  );
}
