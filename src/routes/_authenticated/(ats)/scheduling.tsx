// Onda 6 — Scheduling avançado.
// Configuração de pools de entrevistadores (round-robin / load-balanced),
// disponibilidade semanal e ferramenta para encontrar slots em comum.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  Plus,
  Trash2,
  Users2,
  Clock3,
  Search,
  X,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import {
  AtsPageHeader,
  AtsSectionHeader,
  EmptyState,
  FormSection,
  MetricCard,
} from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import {
  addPoolMember,
  assignFromPool,
  deletePool,
  deleteAvailability,
  findCommonSlots,
  listAvailability,
  listPools,
  listOpenSchedulingSlaBreaches,
  removePoolMember,
  upsertAvailability,
  upsertPool,
  type Pool,
  type SlaBreach,
} from "@/lib/ats/scheduling.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/(ats)/scheduling")({
  component: SchedulingPage,
});

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function fmtMin(m: number) {
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

function parseTime(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

function SchedulingPage() {
  const qc = useQueryClient();
  const members = useWorkspaceMembers();
  const fetchPools = useServerFn(listPools);
  const fetchAvail = useServerFn(listAvailability);

  const poolsQ = useQuery({ queryKey: ["ats-pools"], queryFn: () => fetchPools() });
  const availQ = useQuery({
    queryKey: ["ats-availability"],
    queryFn: () => fetchAvail({ data: {} }),
  });

  const invalidatePools = () => qc.invalidateQueries({ queryKey: ["ats-pools"] });
  const invalidateAvail = () => qc.invalidateQueries({ queryKey: ["ats-availability"] });

  const upsertPoolFn = useServerFn(upsertPool);
  const deletePoolFn = useServerFn(deletePool);
  const addMemberFn = useServerFn(addPoolMember);
  const removeMemberFn = useServerFn(removePoolMember);
  const upsertAvailFn = useServerFn(upsertAvailability);
  const deleteAvailFn = useServerFn(deleteAvailability);
  const assignFn = useServerFn(assignFromPool);
  const findSlotsFn = useServerFn(findCommonSlots);

  // --- new pool form ---
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolStrategy, setNewPoolStrategy] = useState<"round_robin" | "load_balanced">(
    "round_robin",
  );

  const createPool = useMutation({
    mutationFn: async () => {
      if (!newPoolName.trim()) throw new Error("Informe um nome");
      return upsertPoolFn({
        data: {
          name: newPoolName.trim(),
          rotation_strategy: newPoolStrategy,
          load_window_days: 14,
        },
      });
    },
    onSuccess: () => {
      setNewPoolName("");
      toast.success("Pool criada");
      invalidatePools();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePool = useMutation({
    mutationFn: (id: string) => deletePoolFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Pool removida");
      invalidatePools();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Scheduling"
        title="Scheduling avançado"
        description="Pools de entrevistadores com rotação automática, disponibilidade semanal e cálculo de horários em comum para painéis."
      />

      <SlaMonitorSection />

      {/* ----- Pools ----- */}
      <section className="space-y-3">
        <AtsSectionHeader
          title="Pools de entrevistadores"
          description="Distribua entrevistas automaticamente por round-robin ou balanceamento de carga."
        />
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] items-end">
              <div className="space-y-1.5">
                <Label htmlFor="pool-name">Nome da pool</Label>
                <Input
                  id="pool-name"
                  placeholder="Ex.: Engenharia Sr."
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Estratégia</Label>
                <Select
                  value={newPoolStrategy}
                  onValueChange={(v) => setNewPoolStrategy(v as "round_robin" | "load_balanced")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round-robin</SelectItem>
                    <SelectItem value="load_balanced">Balanceada (por carga)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createPool.mutate()} disabled={createPool.isPending}>
                <Plus className="mr-1.5 h-4 w-4" />
                Criar pool
              </Button>
            </div>

            {poolsQ.isLoading ? (
              <p className="text-sm text-text-tertiary">Carregando…</p>
            ) : (poolsQ.data ?? []).length === 0 ? (
              <EmptyState
                icon={Users2}
                title="Nenhuma pool criada"
                description="Crie sua primeira pool acima para começar a distribuir entrevistas."
                compact
              />
            ) : (
              <div className="space-y-3">
                {(poolsQ.data ?? []).map((p) => (
                  <PoolCard
                    key={p.id}
                    pool={p}
                    members={members}
                    onAddMember={(interviewer_id) =>
                      addMemberFn({
                        data: { pool_id: p.id, interviewer_id, weight: 1 },
                      }).then(() => invalidatePools())
                    }
                    onRemoveMember={(id) =>
                      removeMemberFn({ data: { id } }).then(() => invalidatePools())
                    }
                    onDelete={() => removePool.mutate(p.id)}
                    onAssign={() =>
                      assignFn({ data: { pool_id: p.id } }).then((r) => {
                        toast.success(
                          `Próximo entrevistador: ${members.nameFor(r.interviewer_id)}`,
                        );
                        invalidatePools();
                      })
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ----- Availability ----- */}
      <section className="space-y-3">
        <AtsSectionHeader
          title="Disponibilidade semanal"
          description="Defina janelas recorrentes por entrevistador (usadas para calcular slots em comum)."
        />
        <AvailabilityEditor
          rows={availQ.data ?? []}
          members={members}
          onCreate={(payload) =>
            upsertAvailFn({ data: payload }).then(() => {
              toast.success("Janela adicionada");
              invalidateAvail();
            })
          }
          onDelete={(id) =>
            deleteAvailFn({ data: { id } }).then(() => {
              toast.success("Janela removida");
              invalidateAvail();
            })
          }
        />
      </section>

      {/* ----- Find common slots ----- */}
      <section className="space-y-3">
        <AtsSectionHeader
          title="Encontrar slots em comum"
          description="Calcule horários onde todos os entrevistadores selecionados estão disponíveis."
        />
        <CommonSlotsFinder members={members} onFind={(payload) => findSlotsFn({ data: payload })} />
      </section>
    </div>
  );
}

// ====== Pool card ===========================================================

function PoolCard({
  pool,
  members,
  onAddMember,
  onRemoveMember,
  onDelete,
  onAssign,
}: {
  pool: Pool;
  members: ReturnType<typeof useWorkspaceMembers>;
  onAddMember: (interviewerId: string) => Promise<unknown>;
  onRemoveMember: (id: string) => Promise<unknown>;
  onDelete: () => void;
  onAssign: () => void;
}) {
  const [picked, setPicked] = useState<string>("");
  const memberIds = new Set(pool.members.map((m) => m.interviewer_id));
  const available = (members.data ?? []).filter((m) => !memberIds.has(m.user_id));

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">{pool.name}</h3>
            <Badge variant="outline" className="text-[10px]">
              {pool.rotation_strategy === "round_robin" ? "Round-robin" : "Balanceada"}
            </Badge>
            <span className="text-[11px] text-text-tertiary">
              {pool.members.length} {pool.members.length === 1 ? "membro" : "membros"}
            </span>
          </div>
          {pool.description ? (
            <p className="text-xs text-text-secondary mt-1">{pool.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAssign}>
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
            Atribuir próximo
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pool.members.length === 0 ? (
          <span className="text-xs text-text-tertiary">Sem membros</span>
        ) : (
          pool.members.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-0.5 text-xs"
            >
              {members.nameFor(m.interviewer_id)}
              <button
                type="button"
                onClick={() => onRemoveMember(m.id)}
                className="text-text-tertiary hover:text-destructive"
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Select value={picked} onValueChange={setPicked}>
          <SelectTrigger className="h-9 w-[260px]">
            <SelectValue placeholder="Adicionar membro…" />
          </SelectTrigger>
          <SelectContent>
            {available.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-text-tertiary">Nenhum disponível</div>
            ) : (
              available.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name ?? m.user_id.slice(0, 8)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={!picked}
          onClick={() => {
            if (!picked) return;
            void onAddMember(picked).then(() => setPicked(""));
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ====== Availability editor =================================================

function AvailabilityEditor({
  rows,
  members,
  onCreate,
  onDelete,
}: {
  rows: {
    id: string;
    interviewer_id: string;
    weekday: number;
    start_minute: number;
    end_minute: number;
    timezone: string;
  }[];
  members: ReturnType<typeof useWorkspaceMembers>;
  onCreate: (p: {
    interviewer_id: string;
    weekday: number;
    start_minute: number;
    end_minute: number;
    timezone: string;
  }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [interviewer, setInterviewer] = useState<string>("");
  const [weekday, setWeekday] = useState<number>(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [tz] = useState("America/Sao_Paulo");

  const grouped = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = m.get(r.interviewer_id) ?? [];
      arr.push(r);
      m.set(r.interviewer_id, arr);
    }
    return Array.from(m.entries());
  }, [rows]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <FormSection title="Nova janela" description="Recorrente toda semana.">
          <div className="grid gap-3 md:grid-cols-[1fr_120px_120px_120px_auto] items-end">
            <div className="space-y-1.5">
              <Label>Entrevistador</Label>
              <Select value={interviewer} onValueChange={setInterviewer}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher…" />
                </SelectTrigger>
                <SelectContent>
                  {(members.data ?? []).map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name ?? m.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dia</Label>
              <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="09:00" />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="18:00" />
            </div>
            <Button
              onClick={() => {
                const s = parseTime(start);
                const e = parseTime(end);
                if (!interviewer) return toast.error("Escolha um entrevistador");
                if (s == null || e == null) return toast.error("Horário inválido");
                if (e <= s) return toast.error("Fim deve ser após início");
                void onCreate({
                  interviewer_id: interviewer,
                  weekday,
                  start_minute: s,
                  end_minute: e,
                  timezone: tz,
                });
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar
            </Button>
          </div>
        </FormSection>

        {grouped.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title="Sem janelas cadastradas"
            description="Adicione faixas semanais por entrevistador acima."
            compact
          />
        ) : (
          <div className="space-y-3">
            {grouped.map(([id, list]) => (
              <div key={id} className="rounded-lg border border-border-subtle bg-surface-1 p-3">
                <div className="text-sm font-medium text-text-primary mb-2">
                  {members.nameFor(id)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((w) => (
                    <span
                      key={w.id}
                      className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-0.5 text-xs"
                    >
                      {WEEKDAYS[w.weekday]} · {fmtMin(w.start_minute)}–{fmtMin(w.end_minute)}
                      <button
                        type="button"
                        aria-label="Remover"
                        onClick={() => void onDelete(w.id)}
                        className="text-text-tertiary hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ====== Common slots finder =================================================

function CommonSlotsFinder({
  members,
  onFind,
}: {
  members: ReturnType<typeof useWorkspaceMembers>;
  onFind: (p: {
    interviewer_ids: string[];
    from: string;
    to: string;
    duration_min: number;
    step_min: number;
  }) => Promise<{ slots: string[] }>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [picker, setPicker] = useState("");
  const [duration, setDuration] = useState(45);
  const [stepMin, setStepMin] = useState(30);
  const today = new Date();
  const inAWeek = new Date(Date.now() + 7 * 86400_000);
  const [from, setFrom] = useState(today.toISOString().slice(0, 10));
  const [to, setTo] = useState(inAWeek.toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const available = (members.data ?? []).filter((m) => !selected.includes(m.user_id));

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Entrevistadores do painel</Label>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {selected.length === 0 ? (
                <span className="text-xs text-text-tertiary">Nenhum selecionado</span>
              ) : (
                selected.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-0.5 text-xs"
                  >
                    {members.nameFor(id)}
                    <button
                      type="button"
                      onClick={() => setSelected((s) => s.filter((x) => x !== id))}
                      className="text-text-tertiary hover:text-destructive"
                      aria-label="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Select value={picker} onValueChange={setPicker}>
                <SelectTrigger>
                  <SelectValue placeholder="Adicionar…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name ?? m.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!picker}
                onClick={() => {
                  setSelected((s) => [...s, picker]);
                  setPicker("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (min)</Label>
              <Input
                type="number"
                min={15}
                max={240}
                value={duration}
                onChange={(e) => setDuration(Math.max(15, Number(e.target.value) || 45))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Passo (min)</Label>
              <Input
                type="number"
                min={15}
                max={120}
                value={stepMin}
                onChange={(e) => setStepMin(Math.max(15, Number(e.target.value) || 30))}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            disabled={loading || selected.length === 0}
            onClick={async () => {
              setLoading(true);
              try {
                const r = await onFind({
                  interviewer_ids: selected,
                  from: new Date(from + "T00:00:00").toISOString(),
                  to: new Date(to + "T23:59:59").toISOString(),
                  duration_min: duration,
                  step_min: stepMin,
                });
                setSlots(r.slots);
                if (r.slots.length === 0) toast.info("Nenhum slot em comum encontrado");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              } finally {
                setLoading(false);
              }
            }}
          >
            <Search className="mr-1.5 h-4 w-4" />
            {loading ? "Calculando…" : "Encontrar slots"}
          </Button>
        </div>

        {slots !== null ? (
          slots.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhum slot em comum"
              description="Tente ampliar a janela de datas ou reduzir a duração."
              compact
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {slots.map((s) => (
                <span key={s} className="rounded bg-surface-sunken px-2 py-1 text-xs tabular-nums">
                  {new Date(s).toLocaleString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ))}
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

// ====== SLA monitor =========================================================

function SlaMonitorSection() {
  const fetchBreaches = useServerFn(listOpenSchedulingSlaBreaches);
  const [threshold, setThreshold] = useState(48);
  const q = useQuery<SlaBreach[]>({
    queryKey: ["ats-sla-breaches", threshold],
    queryFn: () => fetchBreaches({ data: { threshold_hours: threshold } }),
  });

  const breaches = q.data ?? [];
  const critical = breaches.filter((b) => b.hours_stuck >= threshold * 2).length;

  return (
    <section className="space-y-3">
      <AtsSectionHeader
        title="SLA de agendamento"
        description="Candidaturas em estágios de entrevista sem horário marcado além do limite."
      />
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Pendentes (acima do SLA)"
          value={breaches.length}
          icon={AlertTriangle}
          tone={breaches.length > 0 ? "warning" : "positive"}
          loading={q.isLoading}
        />
        <MetricCard
          label="Críticas (>2× SLA)"
          value={critical}
          icon={AlertTriangle}
          tone={critical > 0 ? "negative" : "neutral"}
          loading={q.isLoading}
        />
        <MetricCard
          label="Limite atual"
          value={`${threshold}h`}
          hint={
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={720}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 48))}
                className="h-7 w-20"
              />
              <span className="text-xs text-text-tertiary">horas</span>
            </div>
          }
          icon={Clock3}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="p-4 text-sm text-text-tertiary">Carregando…</div>
          ) : breaches.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Tudo em dia"
              description="Nenhuma candidatura ultrapassou o SLA de agendamento."
              compact
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {breaches.map((b) => (
                <li
                  key={b.application_id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {b.candidate_name ?? "Candidato"}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {b.stage_value}
                      </Badge>
                    </div>
                    <div className="text-xs text-text-tertiary truncate">
                      {b.job_title ?? "Vaga"} · parado há{" "}
                      <span className="font-medium text-text-secondary">
                        {b.hours_stuck.toFixed(1)}h
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/candidates/$id"
                    params={{ id: b.candidate_id }}
                    className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2.5 py-1 text-xs hover:bg-surface-sunken"
                  >
                    Abrir
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
