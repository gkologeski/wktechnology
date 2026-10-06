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
import { TabsContent } from "@/components/ui/tabs";
import { EmptyState, MetricCard, SectionHeader } from "@/components/techhire/ui";
import {
  approveSdrDraft,
  discardSdrDraft,
  getSdrOverview,
  retrySdrMeetingSync,
  saveSdrMaterial,
  saveSdrSettings,
  setSdrOfferActive,
  takeoverSdrConversation,
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
      <TabsContent value="sdr-settings" className="mt-4">{body((d) => <SettingsPanel d={d} />)}</TabsContent>
      <TabsContent value="sdr-catalog" className="mt-4">{body((d) => <CatalogPanel d={d} />)}</TabsContent>
      <TabsContent value="sdr-supervision" className="mt-4">{body((d) => <SupervisionPanel d={d} />)}</TabsContent>
      <TabsContent value="sdr-results" className="mt-4">{body((d) => <ResultsPanel d={d} />)}</TabsContent>
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
    daily_send_limit: s?.daily_send_limit ?? 50,
    quiet_hours_start: s?.quiet_hours_start ?? 20,
    quiet_hours_end: s?.quiet_hours_end ?? 8,
  });
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
      {!d.canManage && <p className="text-sm text-muted-foreground">Somente administradores podem alterar.</p>}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <ToggleRow id="sdr-enabled" label="Ativar SDR neste workspace" checked={form.enabled} disabled={dis}
          onChange={(v) => setForm({ ...form, enabled: v })} />
        <ToggleRow id="sdr-auto" label="Envio automático (sem aprovação)"
          hint="Também exige playbook em modo automático. Recomendado manter desligado no piloto."
          checked={form.auto_send_enabled} disabled={dis}
          onChange={(v) => setForm({ ...form, auto_send_enabled: v })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField id="sdr-limit" label="Limite diário de envios" value={form.daily_send_limit} disabled={dis}
            onChange={(v) => setForm({ ...form, daily_send_limit: v })} />
          <NumField id="sdr-qs" label="Silêncio a partir de (h)" value={form.quiet_hours_start} disabled={dis}
            onChange={(v) => setForm({ ...form, quiet_hours_start: v })} />
          <NumField id="sdr-qe" label="Silêncio até (h)" value={form.quiet_hours_end} disabled={dis}
            onChange={(v) => setForm({ ...form, quiet_hours_end: v })} />
        </div>
        <Button onClick={() => m.mutate()} disabled={dis}>
          {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Para ativar numa campanha, ligue “SDR” e escolha o playbook na campanha de WhatsApp.
      </p>
    </div>
  );
}

function ToggleRow(p: { id: string; label: string; hint?: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
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

function NumField(p: { id: string; label: string; value: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={p.id}>{p.label}</Label>
      <Input id={p.id} type="number" value={p.value} disabled={p.disabled}
        onChange={(e) => p.onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

function CatalogPanel({ d }: { d: Overview }) {
  const setActive = useServerFn(setSdrOfferActive);
  const saveMat = useServerFn(saveSdrMaterial);
  const refresh = useRefresh();
  const [mat, setMat] = useState({ title: "", url: "", offerIds: [] as string[] });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => setActive({ data: { workspaceId: d.workspaceId, ...v } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const addMat = useMutation({
    mutationFn: () => saveMat({ data: { workspaceId: d.workspaceId, ...mat, approved: true, active: true } }),
    onSuccess: () => (toast.success("Material salvo"), setMat({ title: "", url: "", offerIds: [] }), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });
  const linksBy = (mid: string) => d.links.filter((l) => l.material_id === mid).map((l) => l.offer_id);
  const name = (id: string) => d.offers.find((o) => o.id === id)?.name ?? "?";
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeader title="Portfólio que o SDR conhece" description="Só ofertas ativas e aprovadas entram no agente. Preços nunca são informados." />
        {d.offers.length === 0 ? (
          <EmptyState title="Nenhuma oferta cadastrada" description="Cadastre o portfólio antes de ativar o SDR." />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {d.offers.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{o.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{o.summary}</p>
                  {o.source_url && <p className="truncate text-xs text-muted-foreground">Fonte: {o.source_url}</p>}
                </div>
                <Switch aria-label={`Ativar ${o.name}`} checked={o.status === "active"} disabled={!d.canManage || toggle.isPending}
                  onCheckedChange={(v) => toggle.mutate({ id: o.id, active: v })} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <SectionHeader title="Materiais aprovados" description="Um material pode atender vários serviços. Só links https aprovados são enviados." />
        {d.materials.length === 0 ? (
          <EmptyState title="Nenhum material" description="Sem material, o SDR não oferece envio de arquivos." />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {d.materials.map((m) => (
              <li key={m.id} className="p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.title}</span>
                  <Badge variant={m.approved && m.active ? "secondary" : "outline"}>{m.approved && m.active ? "Aprovado" : "Inativo"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{linksBy(m.id).map(name).join(", ") || "Sem serviço vinculado"}</p>
              </li>
            ))}
          </ul>
        )}
        {d.canManage && (
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="mat-t">Título</Label>
                <Input id="mat-t" value={mat.title} onChange={(e) => setMat({ ...mat, title: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="mat-u">Link (https)</Label>
                <Input id="mat-u" value={mat.url} onChange={(e) => setMat({ ...mat, url: e.target.value })} /></div>
            </div>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-medium">Serviços atendidos</legend>
              {d.offers.filter((o) => o.status === "active").map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={mat.offerIds.includes(o.id)} onCheckedChange={(v) =>
                    setMat({ ...mat, offerIds: v ? [...mat.offerIds, o.id] : mat.offerIds.filter((x) => x !== o.id) })} />
                  {o.name}
                </label>
              ))}
            </fieldset>
            <Button disabled={!mat.title || !mat.url || addMat.isPending} onClick={() => addMat.mutate()}>Adicionar material</Button>
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
      <SectionHeader title="Supervisão" description={`Rascunhos aguardando aprovação. ${pending} em processamento.`} />
      {drafts.length === 0 ? (
        <EmptyState title="Nada para revisar" description="Novas respostas de clientes aparecem aqui como rascunho." />
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
  const refresh = useRefresh();
  const run = useMutation({
    mutationFn: (k: "send" | "discard" | "human") =>
      k === "send"
        ? approve({ data: { jobId: job.id, text } })
        : k === "discard"
          ? discard({ data: { jobId: job.id } })
          : takeover({ data: { jobId: job.id, reason: "Assumido na supervisão" } }),
    onSuccess: (_r, k) => (toast.success(k === "send" ? "Mensagem enviada" : k === "human" ? "Conversa com humano" : "Descartado"), refresh()),
    onError: (e: Error) => (toast.error(e.message), refresh()),
  });
  const p = (job.draft_payload ?? {}) as { intent?: string; offer_keys?: string[]; warnings?: string[] };
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{job.kind === "follow_up" ? "Follow-up" : "Resposta"}</Badge>
        {p.intent && <Badge variant="secondary">{p.intent}</Badge>}
        {(p.offer_keys ?? []).map((k) => <Badge key={k} variant="outline">{k}</Badge>)}
        {job.status === "failed" && <Badge variant="destructive">Falhou: {job.error}</Badge>}
      </div>
      {(p.warnings ?? []).length > 0 && (
        <p className="text-xs text-destructive">Atenção: {(p.warnings ?? []).join("; ")}</p>
      )}
      <Label htmlFor={`d-${job.id}`} className="sr-only">Texto do rascunho</Label>
      <Textarea id={`d-${job.id}`} rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={run.isPending || job.status !== "drafted" || !text.trim()} onClick={() => run.mutate("send")}>
          <Send className="mr-1 h-4 w-4" />Aprovar e enviar
        </Button>
        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate("human")}>
          <UserRound className="mr-1 h-4 w-4" />Assumir conversa
        </Button>
        <Button size="sm" variant="ghost" disabled={run.isPending} onClick={() => run.mutate("discard")}>
          <Trash2 className="mr-1 h-4 w-4" />Descartar
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
    onSuccess: (x) => (x.status === "confirmed" ? toast.success("Reunião confirmada no Google") : toast.error("Google ainda recusou"), refresh()),
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
        <MetricCard label="Reuniões confirmadas" value={d.enrollments.filter((e) => e.meeting_status === "confirmed").length} />
        <MetricCard label="Com humano" value={by("handoff")} />
        <MetricCard label="Recusas" value={by("opted_out")} />
        <MetricCard label="Materiais enviados" value={count("material_sent:success")} />
        <MetricCard label="Falhas de envio" value={count("message_sent:failed")} />
      </div>
      {d.enrollments.length === 0 ? (
        <EmptyState title="Sem conversas do SDR" description="Ative o SDR numa campanha para começar." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="p-2">Telefone</th><th className="p-2">Etapa</th><th className="p-2">Score</th><th className="p-2">Reunião</th><th className="p-2" /></tr>
            </thead>
            <tbody className="divide-y">
              {d.enrollments.map((e) => (
                <tr key={e.id}>
                  <td className="p-2">{e.contact_phone}</td>
                  <td className="p-2">{STAGE[e.commercial_stage ?? ""] ?? e.commercial_stage}</td>
                  <td className="p-2">{e.qualification_score ?? "—"}</td>
                  <td className="p-2">{MEETING[e.meeting_status ?? "none"] ?? e.meeting_status}</td>
                  <td className="p-2 text-right">
                    {e.meeting_status === "sync_failed" && (
                      <Button size="sm" variant="outline" disabled={r.isPending} onClick={() => r.mutate(e.id)}>
                        <RefreshCw className="mr-1 h-3 w-3" />Reenviar ao Google
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
