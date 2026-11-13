import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Save, Play, Pause, Check, AlertCircle } from "lucide-react";
import {
  callCampaignChecklist,
  callCampaignStatusLabel,
} from "@/lib/prospecting/calls/status-label";
import { toast } from "sonner";
import {
  getCampaign,
  upsertCampaign,
  listCampaignAttempts,
  setCampaignStatus,
  auditCampaignQueueability,
  previewCallAudience,
  type Campaign,
  type Variant,
  type Attempt,
  type LeadAudit,
} from "@/lib/prospecting-campaigns.functions";
import type { AudienceRule } from "@/lib/prospecting-audience.functions";
import { HubspotListBuilder } from "@/components/prospecting/list-builder";
import {
  CampaignAudiencePanel,
  EMPTY_AUDIENCE,
  hydrateAudienceConfig,
  type AudienceState,
} from "@/components/whatsapp/campaign-audience-panel";
import { hasCallAudience, parseManualPhones } from "@/lib/prospecting/calls/call-audience";
import { CampaignCallFollowup } from "@/components/prospecting/campaign-call-followup";
import { listScripts, type ProspectingScript } from "@/lib/prospecting-scripts.functions";

export const Route = createFileRoute("/_authenticated/campaigns/calls/$id")({
  component: CampaignDetailPage,
});

const STEPS = ["Público", "Roteiros", "Agenda", "Pós-ligação", "Revisar e iniciar"];

type VariantForm = { script_id: string; weight: number; segment_id: string | null };

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getCampaign);
  const saveFn = useServerFn(upsertCampaign);
  const attemptsFn = useServerFn(listCampaignAttempts);
  const statusFn = useServerFn(setCampaignStatus);
  const scriptsFn = useServerFn(listScripts);
  const auditFn = useServerFn(auditCampaignQueueability);
  const previewFn = useServerFn(previewCallAudience);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [variants, setVariants] = useState<VariantForm[]>([]);
  const [scripts, setScripts] = useState<ProspectingScript[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [audienceMode, setAudienceMode] = useState<"static" | "dynamic">("static");
  const [audienceRules, setAudienceRules] = useState<AudienceRule[]>([]);
  const [audit, setAudit] = useState<LeadAudit[]>([]);
  const [step, setStep] = useState(0);
  const [callAudience, setCallAudience] = useState<AudienceState>({
    ...EMPTY_AUDIENCE,
    base: "leads",
  });
  const [manualRaw, setManualRaw] = useState("");
  const [useNewAudience, setUseNewAudience] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const out = await getFn({ data: { id } });
    setCampaign(out.campaign);
    setVariants(
      out.variants.map((v: Variant) => ({
        script_id: v.script_id,
        weight: v.weight,
        segment_id: v.segment_id,
      })),
    );
    const rawRules = (out.campaign.audience_rules ?? []) as AudienceRule[];
    const stored = hydrateAudienceConfig(out.campaign.audience_config);
    if (stored) {
      setCallAudience({
        ...stored.state,
        base: stored.state.base === "contacts" ? "contacts" : "leads",
      });
      setManualRaw(stored.manualRaw);
    }
    setUseNewAudience(
      !!stored || (rawRules.length === 0 && (out.campaign.lead_ids?.length ?? 0) === 0),
    );
    setAudienceMode(out.campaign.audience_mode ?? "static");
    // Compat: se não há regras mas existem lead_ids legados, mostra como bloco manual.
    if (rawRules.length === 0 && (out.campaign.lead_ids?.length ?? 0) > 0) {
      setAudienceRules([{ source: "manual", lead_ids: out.campaign.lead_ids }]);
    } else {
      setAudienceRules(rawRules);
    }
    const [att, aud] = await Promise.all([
      attemptsFn({ data: { campaign_id: id } }),
      auditFn({ data: { campaign_id: id } }),
    ]);
    setAttempts(att);
    setAudit(aud);
  };
  useEffect(() => {
    refresh();
    scriptsFn({ data: { includeArchived: true } }).then(setScripts);
    /* eslint-disable-next-line */
  }, [id]);

  // Stats per variant — MUST be declared before any early return to keep hook order stable
  const stats = useMemo(() => {
    const byVariant: Record<
      string,
      { total: number; answered: number; success: number; durations: number[] }
    > = {};
    for (const a of attempts) {
      const key = a.variant_id ?? "none";
      const s = (byVariant[key] ??= { total: 0, answered: 0, success: 0, durations: [] });
      s.total += 1;
      if (a.status === "completed") s.answered += 1;
      if (a.success_evaluation && a.success_evaluation.toLowerCase().includes("success"))
        s.success += 1;
      if (a.duration_seconds) s.durations.push(a.duration_seconds);
    }
    return byVariant;
  }, [attempts]);

  if (!campaign) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  const callAudienceConfig = {
    state: {
      mode: callAudience.mode,
      queueId: callAudience.queueId,
      base: (callAudience.base === "contacts" ? "contacts" : "leads") as "leads" | "contacts",
      groups: callAudience.groups as unknown[],
      groupsLogic: callAudience.groupsLogic,
      recentOverrides: callAudience.recentOverrides,
      excludeCustomers: callAudience.excludeCustomers,
      excludeOpenDeals: callAudience.excludeOpenDeals,
      commercialOverrides: callAudience.commercialOverrides,
    },
    manualRaw: callAudience.mode === "manual" ? manualRaw : "",
  };
  const checklist = callCampaignChecklist({
    hasAudience: useNewAudience
      ? hasCallAudience(callAudienceConfig)
      : audit.length > 0 || audienceRules.length > 0,
    variants,
    weighted: campaign.assignment_mode === "weighted",
    days: campaign.dialing_window.days,
    start: campaign.dialing_window.start,
    end: campaign.dialing_window.end,
  });
  const blockers = checklist.filter((c) => !c.ok);
  const canStart = blockers.length === 0;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    try {
      await saveFn({
        data: {
          id: campaign.id,
          name: campaign.name,
          assignment_mode: campaign.assignment_mode,
          max_attempts: campaign.max_attempts,
          retry_interval_minutes: campaign.retry_interval_minutes,
          source_type: "manual",
          source_ref: null,
          lead_ids: [],
          dialing_window: campaign.dialing_window,
          variants: variants.filter((v) => v.script_id),
          audience_mode: audienceMode,
          audience_rules: audienceRules,
          recent_contact_days: campaign.recent_contact_days ?? 7,
          recent_contact_scope: campaign.recent_contact_scope ?? "calls",
          audience_config: useNewAudience ? callAudienceConfig : null,
        },
      });
      toast.success("Salvo");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const scriptName = (sid: string | null) => scripts.find((s) => s.id === sid)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/campaigns/calls">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Link>
        </Button>
        <h2 className="text-lg font-semibold flex-1">{campaign.name}</h2>
        <Badge variant={campaign.status === "running" ? "default" : "outline"}>
          {callCampaignStatusLabel(campaign.status)}
        </Badge>
      </div>

      <nav aria-label="Passos da campanha" className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => {
          const done = i < 3 ? checklist[i]!.ok : i === 3;
          return (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={step === i ? "default" : "outline"}
              aria-current={step === i ? "step" : undefined}
              onClick={() => setStep(i)}
            >
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs">
                {done && step !== i ? <Check className="h-3 w-3" aria-label="concluído" /> : i + 1}
              </span>
              {label}
            </Button>
          );
        })}
      </nav>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Público</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-md">
              <Label>Nome</Label>
              <Input
                value={campaign.name}
                onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
              />
            </div>
            {useNewAudience ? (
              <CampaignAudiencePanel
                channel="calls"
                value={callAudience}
                onChange={setCallAudience}
                variableCount={0}
                manualRaw={manualRaw}
                onManualRaw={setManualRaw}
                manualCount={parseManualPhones(manualRaw).length}
                recentSlot={
                  <div className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Label htmlFor="recent-scope" className="text-muted-foreground">
                        Desconsiderar
                      </Label>
                      <Select
                        value={campaign.recent_contact_scope ?? "calls"}
                        onValueChange={(v) =>
                          setCampaign({
                            ...campaign,
                            recent_contact_scope: v as "calls" | "calls_whatsapp",
                          })
                        }
                      >
                        <SelectTrigger id="recent-scope" className="w-auto min-w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="calls">
                            ligações realizadas de outra campanha
                          </SelectItem>
                          <SelectItem value="calls_whatsapp">
                            ligações e mensagens de WhatsApp realizadas de outra campanha
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Label htmlFor="recent-days" className="text-muted-foreground">
                        em até
                      </Label>
                      <Input
                        id="recent-days"
                        type="number"
                        min={0}
                        max={365}
                        className="w-20"
                        value={campaign.recent_contact_days ?? 7}
                        onChange={(e) =>
                          setCampaign({
                            ...campaign,
                            recent_contact_days: Math.max(
                              0,
                              Math.min(365, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                      <span className="text-muted-foreground">dias</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use 0 para desligar. Quem se encaixa fica fora da fila ao iniciar e aparece
                      com o motivo na revisão.
                    </p>
                  </div>
                }
                previewOverride={{
                  key: JSON.stringify([
                    callAudienceConfig,
                    campaign.recent_contact_days ?? 7,
                    campaign.recent_contact_scope ?? "calls",
                  ]),
                  enabled: hasCallAudience(callAudienceConfig),
                  fn: () =>
                    previewFn({
                      data: {
                        campaign_id: campaign.id,
                        audience_config: callAudienceConfig,
                        recent_contact_days: campaign.recent_contact_days ?? 7,
                        recent_contact_scope: campaign.recent_contact_scope ?? "calls",
                      },
                    }),
                }}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                  <span className="flex-1">
                    Esta campanha usa o montador de público anterior. Troque para o mesmo quadro das
                    campanhas de WhatsApp; o público antigo deixa de valer ao salvar.
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setUseNewAudience(true)}>
                    Usar o novo quadro
                  </Button>
                </div>
                <div>
                  <Label>Público da campanha</Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    Combine filtros em diferentes entidades para gerar a lista de leads. Em modo
                    dinâmico, a lista é recalculada toda vez que a campanha é iniciada.
                  </p>
                  <HubspotListBuilder
                    mode={audienceMode}
                    rules={audienceRules}
                    onChange={setAudienceRules}
                    onModeChange={setAudienceMode}
                  />
                </div>
                <div className="rounded-md border p-3 space-y-2">
                  <div className="text-sm font-medium">Regras de exclusão</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Label htmlFor="recent-scope" className="text-muted-foreground">
                      Desconsiderar
                    </Label>
                    <Select
                      value={campaign.recent_contact_scope ?? "calls"}
                      onValueChange={(v) =>
                        setCampaign({
                          ...campaign,
                          recent_contact_scope: v as "calls" | "calls_whatsapp",
                        })
                      }
                    >
                      <SelectTrigger id="recent-scope" className="w-auto min-w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="calls">ligações realizadas de outra campanha</SelectItem>
                        <SelectItem value="calls_whatsapp">
                          ligações e mensagens de WhatsApp realizadas de outra campanha
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Label htmlFor="recent-days" className="text-muted-foreground">
                      em até
                    </Label>
                    <Input
                      id="recent-days"
                      type="number"
                      min={0}
                      max={365}
                      className="w-20"
                      value={campaign.recent_contact_days ?? 7}
                      onChange={(e) =>
                        setCampaign({
                          ...campaign,
                          recent_contact_days: Math.max(
                            0,
                            Math.min(365, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                    <span className="text-muted-foreground">dias</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use 0 para desligar. Quem se encaixa fica fora da fila ao iniciar e aparece com
                    o motivo na revisão.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>2. Roteiros</CardTitle>
            </CardHeader>
            <CardContent className="max-w-md">
              <div>
                <Label>Modo de atribuição</Label>
                <Select
                  value={campaign.assignment_mode}
                  onValueChange={(v) =>
                    setCampaign({ ...campaign, assignment_mode: v as "weighted" | "segment" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weighted">A/B por peso</SelectItem>
                    <SelectItem value="segment">Por segmento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Variantes (A/B)</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setVariants([
                      ...variants,
                      {
                        script_id: scripts.find((s) => !s.archived_at)?.id ?? "",
                        weight: 50,
                        segment_id: null,
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {variants.length === 0 && (
                <p className="text-sm text-muted-foreground">Adicione ao menos um script.</p>
              )}
              {variants.map((v, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Script</Label>
                    <Select
                      value={v.script_id}
                      onValueChange={(val) =>
                        setVariants(
                          variants.map((x, idx) => (idx === i ? { ...x, script_id: val } : x)),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {scripts
                          .filter((s) => !s.archived_at || s.id === v.script_id)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                              {s.archived_at ? " (arquivado)" : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Label>Peso</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={v.weight}
                      onChange={(e) =>
                        setVariants(
                          variants.map((x, idx) =>
                            idx === i ? { ...x, weight: parseInt(e.target.value, 10) || 0 } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {campaign.assignment_mode === "weighted" && variants.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Soma dos pesos: {variants.reduce((s, v) => s + v.weight, 0)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Agenda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label>Máx. tentativas por pessoa</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={campaign.max_attempts}
                  onChange={(e) =>
                    setCampaign({ ...campaign, max_attempts: parseInt(e.target.value, 10) || 3 })
                  }
                />
              </div>
              <div>
                <Label>Intervalo entre tentativas (min)</Label>
                <Input
                  type="number"
                  min={5}
                  value={campaign.retry_interval_minutes}
                  onChange={(e) =>
                    setCampaign({
                      ...campaign,
                      retry_interval_minutes: parseInt(e.target.value, 10) || 240,
                    })
                  }
                />
              </div>
              <div>
                <Label>Janela início</Label>
                <Input
                  value={campaign.dialing_window.start}
                  onChange={(e) =>
                    setCampaign({
                      ...campaign,
                      dialing_window: { ...campaign.dialing_window, start: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label>Janela fim</Label>
                <Input
                  value={campaign.dialing_window.end}
                  onChange={(e) =>
                    setCampaign({
                      ...campaign,
                      dialing_window: { ...campaign.dialing_window, end: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {[
                  { v: 0, l: "Dom" },
                  { v: 1, l: "Seg" },
                  { v: 2, l: "Ter" },
                  { v: 3, l: "Qua" },
                  { v: 4, l: "Qui" },
                  { v: 5, l: "Sex" },
                  { v: 6, l: "Sáb" },
                ].map((d) => {
                  const active = campaign.dialing_window.days.includes(d.v);
                  return (
                    <Button
                      key={d.v}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => {
                        const days = active
                          ? campaign.dialing_window.days.filter((x) => x !== d.v)
                          : [...campaign.dialing_window.days, d.v].sort();
                        setCampaign({
                          ...campaign,
                          dialing_window: { ...campaign.dialing_window, days },
                        });
                      }}
                    >
                      {d.l}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">4. Pós-ligação (opcional)</h3>
          <CampaignCallFollowup
            key={campaign.updated_at}
            campaign={campaign}
            scripts={scripts.filter((s) => !s.archived_at)}
            leads={audit}
            onChanged={refresh}
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>5. Revisar e iniciar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="space-y-2 text-sm">
                {checklist.map((c, i) => (
                  <li key={c.key} className="flex items-start gap-2">
                    {c.ok ? (
                      <Check className="mt-0.5 h-4 w-4 text-primary" aria-label="pronto" />
                    ) : (
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 text-destructive"
                        aria-label="pendente"
                      />
                    )}
                    <div className="flex-1">
                      <div>{c.label}</div>
                      {!c.ok && <div className="text-xs text-muted-foreground">{c.hint}</div>}
                    </div>
                    {!c.ok && (
                      <Button size="sm" variant="link" onClick={() => setStep(i)}>
                        Corrigir
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Exclusão:{" "}
                {(campaign.recent_contact_days ?? 7) === 0
                  ? "desligada"
                  : `${campaign.recent_contact_scope === "calls_whatsapp" ? "ligações e WhatsApp" : "ligações"} de outra campanha nos últimos ${campaign.recent_contact_days ?? 7} dia(s)`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Auditoria de enfileiramento</CardTitle>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguém no público da campanha.</p>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-2">
                    {audit.filter((a) => a.queueable).length} de {audit.length} na fila de ligação
                    ao iniciar.
                  </div>
                  <div className="divide-y text-sm">
                    {audit.map((a) => (
                      <div key={a.lead_id} className="py-2 flex items-start gap-3">
                        <Badge variant={a.queueable ? "default" : "secondary"} className="mt-0.5">
                          {a.queueable ? "OK" : "Bloqueado"}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{a.lead_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.phone ?? "sem telefone"} · {a.attempts} tentativa(s)
                            {a.last_status ? ` · último: ${a.last_status}` : ""}
                          </div>
                          {a.reasons.length > 0 && (
                            <ul className="mt-1 text-xs text-muted-foreground list-disc list-inside">
                              {a.reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Voltar
        </Button>
        <span className="flex-1 text-xs text-muted-foreground" aria-live="polite">
          {campaign.status !== "running" && !canStart
            ? `Para iniciar: ${blockers[0]?.hint ?? ""}`
            : ""}
        </span>
        <Button variant="outline" onClick={save} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />
          Salvar rascunho
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)}>Próximo</Button>
        ) : campaign.status === "running" ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await statusFn({ data: { id: campaign.id, status: "paused" } });
              })
            }
          >
            <Pause className="h-3.5 w-3.5 mr-1" />
            Pausar
          </Button>
        ) : (
          <Button
            disabled={!canStart || busy}
            title={canStart ? undefined : blockers[0]?.hint}
            onClick={() =>
              run(async () => {
                await save();
                await statusFn({ data: { id: campaign.id, status: "running" } });
                toast.success("Campanha iniciada");
              })
            }
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            {campaign.status === "paused" ? "Retomar" : "Iniciar"}
          </Button>
        )}
      </div>

      <h3 className="pt-2 text-sm font-semibold text-muted-foreground">Execução e resultados</h3>
      <Card>
        <CardHeader>
          <CardTitle>Resultados por variante</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(stats).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem chamadas ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Variante</th>
                  <th className="text-right p-2">Chamadas</th>
                  <th className="text-right p-2">Atendidas</th>
                  <th className="text-right p-2">Sucesso</th>
                  <th className="text-right p-2">Duração média</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats).map(([vid, s]) => {
                  const variant = vid === "none" ? null : variants[0]; // best-effort label
                  const avg = s.durations.length
                    ? Math.round(s.durations.reduce((a, b) => a + b, 0) / s.durations.length)
                    : 0;
                  const rate = s.total ? Math.round((s.answered / s.total) * 100) : 0;
                  const succ = s.total ? Math.round((s.success / s.total) * 100) : 0;
                  return (
                    <tr key={vid} className="border-t">
                      <td className="p-2">
                        {vid === "none" ? "—" : scriptName(variant?.script_id ?? null)}
                      </td>
                      <td className="p-2 text-right">{s.total}</td>
                      <td className="p-2 text-right">
                        {s.answered} ({rate}%)
                      </td>
                      <td className="p-2 text-right">
                        {s.success} ({succ}%)
                      </td>
                      <td className="p-2 text-right">{avg}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chamadas recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma chamada.</p>
          ) : (
            <div className="space-y-3">
              {attempts.slice(0, 50).map((a) => {
                const failed = a.status === "failed" || !!a.ended_reason;
                return (
                  <details key={a.id} className="border rounded-md p-2 text-sm">
                    <summary className="cursor-pointer flex items-center gap-2">
                      <Badge
                        variant={
                          failed ? "destructive" : a.status === "completed" ? "default" : "outline"
                        }
                      >
                        {a.status}
                      </Badge>
                      <span className="font-medium">{scriptName(a.script_id)}</span>
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {a.ended_reason ?? a.summary ?? a.vapi_call_id ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.duration_seconds ?? 0}s
                      </span>
                      {a.recording_url && (
                        <a
                          className="text-xs text-primary underline"
                          href={a.recording_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ▶
                        </a>
                      )}
                    </summary>
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Vapi call ID:</span>{" "}
                          <code>{a.vapi_call_id ?? "—"}</code>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Criada em:</span>{" "}
                          {new Date(a.created_at).toLocaleString()}
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Ended reason:</span>{" "}
                          {a.ended_reason ?? "—"}
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">WhatsApp pós-ligação:</span>{" "}
                          {a.followup_status === "sent"
                            ? "enviado"
                            : a.followup_status === "skipped"
                              ? `não enviado (${a.followup_error ?? "regra"})`
                              : a.followup_status === "failed"
                                ? `falhou (${a.followup_error ?? "erro"})`
                                : a.followup_status === "sending"
                                  ? "enviando"
                                  : "—"}
                        </div>
                      </div>
                      {a.summary && (
                        <div>
                          <div className="text-muted-foreground mb-1">Resumo</div>
                          <div className="whitespace-pre-wrap">{a.summary}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-muted-foreground mb-1">Request enviado para Vapi</div>
                        <pre className="bg-muted rounded p-2 overflow-x-auto max-h-64 text-[11px]">
                          {a.vapi_request ? JSON.stringify(a.vapi_request, null, 2) : "—"}
                        </pre>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Response / erro da Vapi</div>
                        <pre className="bg-muted rounded p-2 overflow-x-auto max-h-64 text-[11px]">
                          {a.vapi_response ? JSON.stringify(a.vapi_response, null, 2) : "—"}
                        </pre>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
