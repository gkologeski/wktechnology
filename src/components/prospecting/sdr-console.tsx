import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@tanstack/react-router";
import { leadScoreBandLabel, LEAD_SCORE_MAX } from "@/lib/prospecting/lead-score";
import { EmptyState, MetricCard, SectionHeader } from "@/components/techhire/ui";
import {
  approveSdrDraft,
  setSdrOfferApproval,
  discardSdrDraft,
  getSdrOverview,
  retrySdrMeetingSync,
  saveSdrMaterial,
  saveSdrPilotPlaybook,
  saveSdrSettings,
  setSdrOfferActive,
  takeoverSdrConversation,
  resumeSdrJob,
  resetSdrBreaker,
} from "@/lib/prospecting/sdr.functions";

const STAGE: Record<string, string> = {
  awaiting_reply: "Aguardando resposta",
  discovery: "Descoberta",
  qualified: "Qualificado",
  material_sent: "Material enviado",
  meeting_link_sent: "Link de agenda enviado",
  meeting_booked: "Reunião marcada",
  handoff: "Com humano",
  opted_out: "Recusou",
  closed: "Encerrado",
};
const MEETING: Record<string, string> = {
  none: "—",
  link_sent: "Link enviado",
  pending_sync: "Aguardando Google",
  confirmed: "Confirmada",
  sync_failed: "Falha no Google",
};

type Overview = Awaited<ReturnType<typeof getSdrOverview>>;

const DECISION: Record<string, string> = {
  pending: "Pendente",
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  nurture: "Nutrição",
  scheduled: "Agendado",
};

/** Agente SDR dentro da Prospecção (mesmo conteúdo de /agents/sdr). */
export function SdrAgentPanel() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Supervisione o SDR do WhatsApp. Playbooks e atendimentos ficam na página completa.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/agents/sdr">Abrir página completa</Link>
        </Button>
      </div>
      <Tabs defaultValue="sdr-supervision">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sdr-supervision">Supervisão</TabsTrigger>
          <TabsTrigger value="sdr-results">Resultados</TabsTrigger>
          <TabsTrigger value="sdr-catalog">Portfólio e materiais</TabsTrigger>
          <TabsTrigger value="sdr-settings">Configuração</TabsTrigger>
        </TabsList>
        <SdrConsoleTabs />
      </Tabs>
    </div>
  );
}

/** Abas extras do Agente SDR. Renderizar dentro do <Tabs> da página. */
export function SdrConsoleTabs() {
  const fetchOverview = useServerFn(getSdrOverview);
  const q = useQuery({ queryKey: ["sdr-overview"], queryFn: () => fetchOverview() });

  const body = (children: (d: Overview) => React.ReactNode) => {
    if (q.isLoading)
      return (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      );
    if (q.error || !q.data)
      return (
        <EmptyState
          title="Não foi possível carregar o SDR"
          description={(q.error as Error)?.message ?? "Tente novamente."}
          action={<Button onClick={() => q.refetch()}>Tentar novamente</Button>}
        />
      );
    return children(q.data);
  };

  return (
    <>
      <TabsContent value="sdr-settings" className="mt-4">
        {body((d) => (
          <SettingsPanel d={d} />
        ))}
      </TabsContent>
      <TabsContent value="sdr-catalog" className="mt-4">
        {body((d) => (
          <CatalogPanel d={d} />
        ))}
      </TabsContent>
      <TabsContent value="sdr-supervision" className="mt-4">
        {body((d) => (
          <SupervisionPanel d={d} />
        ))}
      </TabsContent>
      <TabsContent value="sdr-results" className="mt-4">
        {body((d) => (
          <ResultsPanel d={d} />
        ))}
      </TabsContent>
    </>
  );
}

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["sdr-overview"] });
}

function SettingsPanel({ d }: { d: Overview }) {
  const save = useServerFn(saveSdrSettings);
  const refresh = useRefresh();
  const s = d.settings;
  const [form, setForm] = useState({
    enabled: s?.enabled ?? false,
    auto_send_enabled: s?.auto_send_enabled ?? false,
    followup_daily_limit: s?.followup_daily_limit ?? s?.daily_send_limit ?? 50,
    template_daily_limit: (s?.template_daily_limit ?? null) as number | null,
    template_respect_hours: s?.template_respect_hours ?? false,
    tech_conv_turns_per_hour: s?.tech_conv_turns_per_hour ?? 40,
    tech_failure_threshold: s?.tech_failure_threshold ?? 5,
    quiet_hours_start: s?.quiet_hours_start ?? 20,
    quiet_hours_end: s?.quiet_hours_end ?? 8,
    template_interval_min_s: s?.template_interval_min_s ?? 0,
    template_interval_max_s: s?.template_interval_max_s ?? 0,
  });
  const ivError =
    form.template_interval_min_s > form.template_interval_max_s
      ? "O mínimo não pode ser maior que o máximo."
      : form.template_interval_max_s > 3600
        ? "O máximo é 3600 segundos."
        : null;
  const m = useMutation({
    mutationFn: () => save({ data: { workspaceId: d.workspaceId, ...form } }),
    onSuccess: () => (toast.success("Configuração salva"), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });
  const dis = !d.canManage || m.isPending;
  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeader
        title="Agente SDR no WhatsApp"
        description="Assume a conversa após a resposta ao template da campanha. Supervisionado: cada mensagem vira rascunho para aprovação."
      />
      {!d.canManage && (
        <p className="text-sm text-muted-foreground">Somente administradores podem alterar.</p>
      )}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <ToggleRow
          id="sdr-enabled"
          label="Ativar SDR neste workspace"
          checked={form.enabled}
          disabled={dis}
          onChange={(v) => setForm({ ...form, enabled: v })}
        />
        <ToggleRow
          id="sdr-auto"
          label="Envio automático (sem aprovação)"
          hint="Também exige playbook em modo automático. Recomendado manter desligado no piloto."
          checked={form.auto_send_enabled}
          disabled={dis}
          onChange={(v) => setForm({ ...form, auto_send_enabled: v })}
        />
      </div>

      <section aria-labelledby="sdr-pol-prosp" className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <h3 id="sdr-pol-prosp" className="text-sm font-semibold">
            1. Prospecção ativa e follow-ups
          </h3>
          <p className="text-xs text-muted-foreground">
            Cotas comerciais em janela móvel de 24 h. Contam só envios confirmados pelo WhatsApp;
            falhas e repetições não consomem.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            id="sdr-fu-limit"
            label="Retomadas (follow-ups) por 24 h"
            value={form.followup_daily_limit}
            disabled={dis}
            onChange={(v) => setForm({ ...form, followup_daily_limit: v })}
          />
          <div className="space-y-1">
            <Label htmlFor="sdr-tpl-limit">Templates de início de contato por 24 h</Label>
            <Input
              id="sdr-tpl-limit"
              type="number"
              min={0}
              placeholder="Sem cota (só o ritmo da campanha)"
              value={form.template_daily_limit ?? ""}
              disabled={dis}
              onChange={(e) =>
                setForm({
                  ...form,
                  template_daily_limit: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <NumField
            id="sdr-qs"
            label="Prospecção pausada a partir de (h)"
            value={form.quiet_hours_start}
            disabled={dis}
            onChange={(v) => setForm({ ...form, quiet_hours_start: v })}
          />
          <NumField
            id="sdr-qe"
            label="Prospecção pausada até (h)"
            value={form.quiet_hours_end}
            disabled={dis}
            onChange={(v) => setForm({ ...form, quiet_hours_end: v })}
          />
        </div>
        <ToggleRow
          id="sdr-tpl-hours"
          label="Aplicar o horário também aos templates das campanhas"
          hint="O horário sempre vale para retomadas. Iguais (ex.: 0 e 0) desligam a pausa."
          checked={form.template_respect_hours}
          disabled={dis}
          onChange={(v) => setForm({ ...form, template_respect_hours: v })}
        />
        <p className="text-xs text-muted-foreground">
          Máximo de retomadas por contato e intervalo entre elas ficam no playbook. Resposta do
          cliente, recusa, transferência para humano ou reunião cancelam retomadas pendentes.
        </p>
        <div className="space-y-2">
          <p className="text-sm font-medium">Intervalo entre disparos do template</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField
              id="sdr-iv-min"
              label="De (segundos)"
              value={form.template_interval_min_s}
              disabled={dis}
              onChange={(v) => setForm({ ...form, template_interval_min_s: v })}
            />
            <NumField
              id="sdr-iv-max"
              label="Até (segundos)"
              value={form.template_interval_max_s}
              disabled={dis}
              onChange={(v) => setForm({ ...form, template_interval_max_s: v })}
            />
          </div>
          <p
            className={`text-xs ${ivError ? "text-destructive" : "text-muted-foreground"}`}
            role={ivError ? "alert" : undefined}
          >
            {ivError ??
              "Padrão das campanhas de WhatsApp: entre um destinatário e o próximo, espera um tempo sorteado nesse intervalo (0 a 0 desliga). Sugestão: 30 a 120 s. O tempo real pode passar do sorteado em até ~1 min."}
          </p>
        </div>
      </section>

      <section aria-labelledby="sdr-pol-conv" className="space-y-2 rounded-lg border bg-card p-4">
        <h3 id="sdr-pol-conv" className="text-sm font-semibold">
          2. Atendimento em conversa (sem cota comercial)
        </h3>
        <p className="text-xs text-muted-foreground">
          Toda mensagem recebida do cliente gera um turno de resposta, sem cota diária, sem horário
          de prospecção e sem o intervalo dos templates. Continua respeitando: agente ligado, dono
          da conversa (humano assume e a IA para), recusa, lista do piloto e janela oficial de 24 h
          do WhatsApp.
        </p>
      </section>

      <section aria-labelledby="sdr-pol-tech" className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <h3 id="sdr-pol-tech" className="text-sm font-semibold">
            3. Proteção técnica
          </h3>
          <p className="text-xs text-muted-foreground">
            Controles contra loop, repetição, rajada e falhas — não são cota de vendas. Quando algo
            trava, o motivo aparece na Supervisão para retomada controlada.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            id="sdr-tech-rate"
            label="Respostas por conversa por hora (anomalia)"
            value={form.tech_conv_turns_per_hour}
            disabled={dis}
            onChange={(v) => setForm({ ...form, tech_conv_turns_per_hour: v })}
          />
          <NumField
            id="sdr-tech-fail"
            label="Falhas em 15 min que abrem o disjuntor"
            value={form.tech_failure_threshold}
            disabled={dis}
            onChange={(v) => setForm({ ...form, tech_failure_threshold: v })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Fixos: no máximo 3 tentativas por turno com espera crescente (30 s, 1 min, 2 min…); uma
          resposta por mensagem recebida; mensagens em rajada são agrupadas na mais recente; texto
          idêntico à última resposta é retido; envio incerto exige reconciliação, nunca reenvio
          automático.
        </p>
      </section>

      <div>
        <Button onClick={() => m.mutate()} disabled={dis || !!ivError}>
          {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Para ativar numa campanha, ligue “SDR” e escolha o playbook na campanha de WhatsApp.
      </p>
      <PilotReadiness d={d} />
    </div>
  );
}

function PilotReadiness({ d }: { d: Overview }) {
  const save = useServerFn(saveSdrPilotPlaybook);
  const refresh = useRefresh();
  const pilot =
    d.readiness.playbooks.find((p) => p.questionnaire_id) ?? d.readiness.playbooks[0] ?? null;
  const [threshold, setThreshold] = useState(pilot?.opportunity_min_score ?? 60);
  const [pageId, setPageId] = useState<string>(pilot?.booking_page_id ?? "");
  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          workspaceId: d.workspaceId,
          playbookId: pilot!.id,
          opportunity_min_score: threshold,
          booking_page_id: pageId || null,
        },
      }),
    onSuccess: () => (
      toast.success("Playbook do piloto atualizado (continua desativado)"),
      refresh()
    ),
    onError: (e: Error) => toast.error(e.message),
  });
  if (!pilot)
    return <EmptyState title="Sem playbook" description="Crie o playbook do piloto primeiro." />;
  const f = pilot.feasibility;
  const page = d.readiness.bookingPages.find((p) => p.id === pageId);
  return (
    <section className="space-y-3" aria-labelledby="sdr-pilot-title">
      <SectionHeader
        title="Prontidão do piloto"
        description={`${pilot.name} · ${pilot.enabled ? "ativo" : "desativado"} · modo ${pilot.mode === "auto" ? "automático" : "supervisionado"}`}
      />
      <div className="space-y-4 rounded-lg border bg-card p-4 text-sm">
        <div>
          <p className="font-medium">Qualificação (escala 0–{f.scaleMax})</p>
          <p className="text-muted-foreground">
            Questionário até {f.questionnairePossible} pts · ICP até {f.icpPossible} pts (
            {f.icpCriteria} critério(s) ativo(s)). Máximo hoje: Lead {f.leadMax} · Contato{" "}
            {f.contactMax}. Limiar atual: {f.threshold}.
          </p>
          {f.issues.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-warning" role="status">
              {f.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            id="sdr-threshold"
            label="Nota mínima para criar oportunidade"
            value={threshold}
            disabled={!d.canManage || m.isPending}
            onChange={setThreshold}
          />
          <div className="space-y-1">
            <Label htmlFor="sdr-page">Página de agenda</Label>
            <select
              id="sdr-page"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={pageId}
              disabled={!d.canManage || m.isPending}
              onChange={(e) => setPageId(e.target.value)}
            >
              <option value="">Sem agenda (encaminha para humano)</option>
              {d.readiness.bookingPages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.slug})
                </option>
              ))}
            </select>
          </div>
        </div>
        {page && (
          <ul className="space-y-1" aria-label="Checagens da agenda">
            {page.readiness.checks.map((c) => (
              <li key={c.key} className={c.ok ? "text-muted-foreground" : "text-destructive"}>
                {c.ok ? "✓" : "✗"} {c.label}
                {c.detail ? ` — ${c.detail}` : ""}
              </li>
            ))}
            <li className="text-xs text-muted-foreground">
              Checagem de configuração apenas. A reunião só é dada como confirmada quando o Google
              devolve o evento.
            </li>
          </ul>
        )}
        <Button onClick={() => m.mutate()} disabled={!d.canManage || m.isPending}>
          {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar preparação
        </Button>
      </div>
    </section>
  );
}

function ToggleRow(p: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={p.id}>{p.label}</Label>
        {p.hint && <p className="text-xs text-muted-foreground">{p.hint}</p>}
      </div>
      <Switch id={p.id} checked={p.checked} disabled={p.disabled} onCheckedChange={p.onChange} />
    </div>
  );
}

function NumField(p: {
  id: string;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={p.id}>{p.label}</Label>
      <Input
        id={p.id}
        type="number"
        value={p.value}
        disabled={p.disabled}
        onChange={(e) => p.onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function CatalogPanel({ d }: { d: Overview }) {
  const setActive = useServerFn(setSdrOfferActive);
  const saveMat = useServerFn(saveSdrMaterial);
  const setApproval = useServerFn(setSdrOfferApproval);
  const refresh = useRefresh();
  const approve = useMutation({
    mutationFn: (v: { ids: string[]; approved: boolean }) =>
      setApproval({ data: { workspaceId: d.workspaceId, ...v } }),
    onSuccess: (_r, v) => (
      toast.success(v.approved ? "Oferta aprovada para o SDR" : "Aprovação removida"),
      refresh()
    ),
    onError: (e: Error) => toast.error(e.message),
  });
  const pendingIds = d.offers
    .filter((o) => o.status === "active" && !o.approved_at)
    .map((o) => o.id);
  const [mat, setMat] = useState({ title: "", url: "", offerIds: [] as string[] });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      setActive({ data: { workspaceId: d.workspaceId, ...v } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const addMat = useMutation({
    mutationFn: () =>
      saveMat({ data: { workspaceId: d.workspaceId, ...mat, approved: true, active: true } }),
    onSuccess: () => (
      toast.success("Material salvo"),
      setMat({ title: "", url: "", offerIds: [] }),
      refresh()
    ),
    onError: (e: Error) => toast.error(e.message),
  });
  const approveMat = useMutation({
    mutationFn: (m: { id: string; title: string; url: string; offerIds: string[] }) =>
      saveMat({ data: { workspaceId: d.workspaceId, ...m, approved: true, active: true } }),
    onSuccess: () => (toast.success("Material aprovado"), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });
  const linksBy = (mid: string) =>
    d.links.filter((l) => l.material_id === mid).map((l) => l.offer_id);
  const name = (id: string) => d.offers.find((o) => o.id === id)?.name ?? "?";
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeader
          title="Portfólio que o SDR conhece"
          description="Só ofertas ativas e aprovadas entram no agente. Preços nunca são informados."
          action={
            d.canManage && pendingIds.length > 0 ? (
              <Button
                size="sm"
                disabled={approve.isPending}
                onClick={() => approve.mutate({ ids: pendingIds, approved: true })}
              >
                Aprovar {pendingIds.length} pendentes
              </Button>
            ) : undefined
          }
        />
        {d.offers.length === 0 ? (
          <EmptyState
            title="Nenhuma oferta cadastrada"
            description="Cadastre o portfólio antes de ativar o SDR."
          />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {d.offers.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{o.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{o.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    Preço: {d.readiness.priceLabels[o.id] ?? "Sob proposta"} — nunca informado ao
                    cliente pelo SDR
                  </p>
                  {o.source_url && (
                    <p className="truncate text-xs text-muted-foreground">Fonte: {o.source_url}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={o.approved_at ? "secondary" : "outline"}>
                    {o.approved_at ? "Aprovada" : "Aguardando aprovação"}
                  </Badge>
                  {d.canManage && o.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate({ ids: [o.id], approved: !o.approved_at })}
                    >
                      {o.approved_at ? "Revogar" : "Aprovar"}
                    </Button>
                  )}
                  <Switch
                    aria-label={`Ativar ${o.name}`}
                    checked={o.status === "active"}
                    disabled={!d.canManage || toggle.isPending}
                    onCheckedChange={(v) => toggle.mutate({ id: o.id, active: v })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <SectionHeader
          title="Materiais aprovados"
          description="Um material pode atender vários serviços. Só links https aprovados são enviados."
        />
        {d.materials.length === 0 ? (
          <EmptyState
            title="Nenhum material"
            description="Sem material, o SDR não oferece envio de arquivos."
          />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {d.materials.map((m) => (
              <li key={m.id} className="p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.title}</span>
                  <Badge variant={m.approved && m.active ? "secondary" : "outline"}>
                    {!m.active ? "Inativo" : m.approved ? "Aprovado" : "Aguardando aprovação"}
                  </Badge>
                  {d.canManage && m.active && !m.approved && m.url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      disabled={approveMat.isPending}
                      onClick={() =>
                        approveMat.mutate({
                          id: m.id,
                          title: m.title,
                          url: m.url as string,
                          offerIds: linksBy(m.id),
                        })
                      }
                    >
                      Aprovar para envio
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {linksBy(m.id).map(name).join(", ") || "Sem serviço vinculado"}
                </p>
              </li>
            ))}
          </ul>
        )}
        {d.canManage && (
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="mat-t">Título</Label>
                <Input
                  id="mat-t"
                  value={mat.title}
                  onChange={(e) => setMat({ ...mat, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mat-u">Link (https)</Label>
                <Input
                  id="mat-u"
                  value={mat.url}
                  onChange={(e) => setMat({ ...mat, url: e.target.value })}
                />
              </div>
            </div>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-medium">Serviços atendidos</legend>
              {d.offers
                .filter((o) => o.status === "active")
                .map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={mat.offerIds.includes(o.id)}
                      onCheckedChange={(v) =>
                        setMat({
                          ...mat,
                          offerIds: v
                            ? [...mat.offerIds, o.id]
                            : mat.offerIds.filter((x) => x !== o.id),
                        })
                      }
                    />
                    {o.name}
                  </label>
                ))}
            </fieldset>
            <Button
              disabled={!mat.title || !mat.url || addMat.isPending}
              onClick={() => addMat.mutate()}
            >
              Adicionar material
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function SupervisionPanel({ d }: { d: Overview }) {
  const drafts = d.jobs.filter((j) => j.status === "drafted" || j.status === "failed");

  const pending = d.jobs.length - drafts.length;
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Supervisão"
        description={`Rascunhos aguardando aprovação. ${pending} em processamento.`}
      />
      <PolicyCounters d={d} />
      {drafts.length === 0 ? (
        <EmptyState
          title="Nada para revisar"
          description="Novas respostas de clientes aparecem aqui como rascunho."
        />
      ) : (
        drafts.map((j) => <DraftCard key={j.id} job={j} />)
      )}
    </div>
  );
}

function DraftCard({ job }: { job: Overview["jobs"][number] }) {
  const [text, setText] = useState(job.draft_text ?? "");
  const approve = useServerFn(approveSdrDraft);
  const discard = useServerFn(discardSdrDraft);
  const takeover = useServerFn(takeoverSdrConversation);
  const resumeFn = useServerFn(resumeSdrJob);
  const refresh = useRefresh();
  const resume = useMutation({
    mutationFn: (mode: "reconcile" | "requeue") =>
      resumeFn({ data: { jobId: job.id, mode } }),
    onSuccess: (r) => (
      toast.success(
        r.result === "already_sent"
          ? "Já havia sido enviada: confirmado"
          : r.result === "back_to_draft"
            ? "Não enviada: voltou para aprovação"
            : "Retomado na fila",
      ),
      refresh()
    ),
    onError: (e: Error) => (toast.error(e.message), refresh()),
  });
  const run = useMutation({
    mutationFn: (k: "send" | "discard" | "human") =>
      k === "send"
        ? approve({ data: { jobId: job.id, text } })
        : k === "discard"
          ? discard({ data: { jobId: job.id } })
          : takeover({ data: { jobId: job.id, reason: "Assumido na supervisão" } }),
    onSuccess: (_r, k) => (
      toast.success(
        k === "send" ? "Mensagem enviada" : k === "human" ? "Conversa com humano" : "Descartado",
      ),
      refresh()
    ),
    onError: (e: Error) => (toast.error(e.message), refresh()),
  });
  const p = (job.draft_payload ?? {}) as {
    intent?: string;
    offer_keys?: string[];
    warnings?: string[];
  };
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{job.kind === "follow_up" ? "Follow-up" : "Resposta"}</Badge>
        {p.intent && <Badge variant="secondary">{p.intent}</Badge>}
        {(p.offer_keys ?? []).map((k) => (
          <Badge key={k} variant="outline">
            {k}
          </Badge>
        ))}
        {job.status === "failed" && (
          <Badge variant="destructive">Falhou: {sdrReasonLabel(job.error)}</Badge>
        )}
        {job.status === "drafted" && job.error && (
          <Badge variant="outline">{sdrReasonLabel(job.error)}</Badge>
        )}
        {job.block_category && (
          <Badge variant="secondary">{CATEGORY_LABELS[job.block_category] ?? job.block_category}</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Na fila {fmtTime(job.created_at)} · espera {secs(job.created_at, job.ai_started_at)} · IA{" "}
        {secs(job.ai_started_at, job.ai_finished_at)} · envio{" "}
        {secs(job.send_started_at, job.sent_at)} · tentativas {job.attempts ?? 0}
      </p>
      {(p.warnings ?? []).length > 0 && (
        <p className="text-xs text-destructive">Atenção: {(p.warnings ?? []).join("; ")}</p>
      )}
      <Label htmlFor={`d-${job.id}`} className="sr-only">
        Texto do rascunho
      </Label>
      <Textarea
        id={`d-${job.id}`}
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {job.status === "failed" && (
          <Button
            size="sm"
            variant="outline"
            disabled={resume.isPending}
            onClick={() =>
              resume.mutate(job.block_category === "reconcile" ? "reconcile" : "requeue")
            }
          >
            {job.block_category === "reconcile" ? "Reconciliar" : "Retomar"}
          </Button>
        )}
        <Button
          size="sm"
          disabled={run.isPending || job.status !== "drafted" || !text.trim()}
          onClick={() => run.mutate("send")}
        >
          <Send className="mr-1 h-4 w-4" />
          Aprovar e enviar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={run.isPending}
          onClick={() => run.mutate("human")}
        >
          <UserRound className="mr-1 h-4 w-4" />
          Assumir conversa
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={run.isPending}
          onClick={() => run.mutate("discard")}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Descartar
        </Button>
      </div>
    </div>
  );
}

function ResultsPanel({ d }: { d: Overview }) {
  const retry = useServerFn(retrySdrMeetingSync);
  const refresh = useRefresh();
  const r = useMutation({
    mutationFn: (enrollmentId: string) => retry({ data: { enrollmentId } }),
    onSuccess: (x) => (
      x.status === "confirmed"
        ? toast.success("Reunião confirmada no Google")
        : toast.error("Google ainda recusou"),
      refresh()
    ),
    onError: (e: Error) => toast.error(e.message),
  });
  const count = (k: string) => d.metrics[k] ?? 0;
  const by = (stage: string) => d.enrollments.filter((e) => e.commercial_stage === stage).length;
  return (
    <div className="space-y-6">
      <SectionHeader title="Resultados (30 dias)" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Conversas" value={d.enrollments.length} />
        <MetricCard label="Mensagens enviadas" value={count("message_sent:success")} />
        <MetricCard label="Qualificados" value={by("qualified")} />
        <MetricCard
          label="Reuniões confirmadas"
          value={d.enrollments.filter((e) => e.meeting_status === "confirmed").length}
        />
        <MetricCard label="Com humano" value={by("handoff")} />
        <MetricCard label="Recusas" value={by("opted_out")} />
        <MetricCard label="Materiais enviados" value={count("material_sent:success")} />
        <MetricCard label="Falhas de envio" value={count("message_sent:failed")} />
      </div>
      {d.enrollments.length === 0 ? (
        <EmptyState
          title="Sem conversas do SDR"
          description="Ative o SDR numa campanha para começar."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">Telefone</th>
                <th className="p-2">Etapa</th>
                <th className="p-2">Qualificação</th>
                <th className="p-2">Reunião</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.enrollments.map((e) => (
                <tr key={e.id}>
                  <td className="p-2">{e.contact_phone}</td>
                  <td className="p-2">{STAGE[e.commercial_stage ?? ""] ?? e.commercial_stage}</td>
                  <td className="p-2">
                    {(() => {
                      const q = e.qualification_id ? d.qualifications[e.qualification_id] : null;
                      if (!q) return "—";
                      return (
                        <span title={q.questionnaire ?? undefined}>
                          {q.total}/{LEAD_SCORE_MAX} · {leadScoreBandLabel(q.total)} ·{" "}
                          {DECISION[q.decision] ?? q.decision}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-2">{MEETING[e.meeting_status ?? "none"] ?? e.meeting_status}</td>
                  <td className="p-2 text-right">
                    {e.meeting_status === "sync_failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={r.isPending}
                        onClick={() => r.mutate(e.id)}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Reenviar ao Google
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const SDR_REASON_LABELS: Record<string, string> = {
  followup_quota: "Cota de retomadas atingida (janela móvel de 24 h)",
  followup_hours: "Fora do horário de prospecção (retomada)",
  followup_max_reached: "Máximo de retomadas do contato atingido",
  daily_limit: "Bloqueio da cota antiga (descontinuada para respostas)",
  quota_check_failed: "Não foi possível verificar a cota de retomadas",
  window_closed: "Janela de 24 h do WhatsApp fechada",
  not_allowlisted: "Número fora da lista do piloto",
  owner_not_ai: "Conversa assumida por humano",
  stale_version: "Há mensagem mais recente do cliente",
  coalesced: "Agrupada na mensagem mais recente",
  invalid_origin: "Origem inválida (resposta sem mensagem recebida)",
  circuit_open: "Disjuntor técnico aberto",
  repetition_detected: "Texto idêntico à última resposta",
  conversation_rate_anomaly: "Ritmo anormal de respostas na conversa",
  max_attempts: "Tentativas esgotadas",
  provider_failed: "WhatsApp recusou o envio",
  uncertain_after_send: "Envio incerto — reconciliar antes de reenviar",
  reconciled_not_sent: "Reconciliado: não enviado, aguardando aprovação",
  lease_lost: "Processamento substituído por outro",
};

const CATEGORY_LABELS: Record<string, string> = {
  prospecting: "Prospecção",
  conversation: "Conversa",
  technical: "Proteção técnica",
  reconcile: "Reconciliação",
};

function sdrReasonLabel(code: string | null | undefined): string {
  if (!code) return "";
  const key = code.startsWith("uncertain_after_send") ? "uncertain_after_send" : code;
  return SDR_REASON_LABELS[key] ?? code;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function secs(a: string | null | undefined, b: string | null | undefined): string {
  if (!a || !b) return "—";
  return `${Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 1000).toFixed(1)} s`;
}

function PolicyCounters({ d }: { d: Overview }) {
  const c = d.counters;
  const fuLeft = Math.max(0, c.followUps.limit - c.followUps.used);
  const reset = useServerFn(resetSdrBreaker);
  const refresh = useRefresh();
  const m = useMutation({
    mutationFn: () => reset({ data: { workspaceId: d.workspaceId } }),
    onSuccess: () => (toast.success("Disjuntor fechado"), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="status" aria-live="polite">
      <div className="rounded-lg border bg-card p-3 text-sm">
        <p className="font-medium">Prospecção e follow-ups</p>
        <p className="text-xs text-muted-foreground">
          Retomadas: {c.followUps.used} de {c.followUps.limit} · {fuLeft} restantes
          {c.followUps.nextFreeAt && ` · libera ${fmtTime(c.followUps.nextFreeAt)}`}
        </p>
        <p className="text-xs text-muted-foreground">
          Templates: {c.templates.used}
          {c.templates.limit != null ? ` de ${c.templates.limit}` : " (sem cota diária)"}
        </p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-sm">
        <p className="font-medium">Atendimento em conversa</p>
        <p className="text-xs text-muted-foreground">
          {c.replies24h} respostas em 24 h · sem cota comercial
        </p>
      </div>
      <div
        className={`rounded-lg border p-3 text-sm ${c.technical.breakerOpenAt ? "border-destructive/50 bg-destructive/5" : "bg-card"}`}
      >
        <p className="font-medium">Proteção técnica</p>
        <p className="text-xs text-muted-foreground">
          {c.technical.breakerOpenAt
            ? `Disjuntor aberto desde ${fmtTime(c.technical.breakerOpenAt)}: ${c.technical.breakerReason ?? ""}`
            : "Disjuntor fechado"}{" "}
          · {c.technical.alerts24h} alertas em 24 h
        </p>
        {c.technical.breakerOpenAt && d.canManage && (
          <Button size="sm" variant="outline" className="mt-2" disabled={m.isPending} onClick={() => m.mutate()}>
            Fechar disjuntor
          </Button>
        )}
      </div>
    </div>
  );
}
