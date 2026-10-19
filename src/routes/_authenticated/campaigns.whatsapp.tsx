import { createFileRoute, Link } from "@tanstack/react-router";
import { useSdrPlaybooks } from "@/hooks/use-default-sdr-agent";
import { agentOptionLabel, sortDefaultFirst } from "@/lib/prospecting/sdr/default-agent";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Play, Pause, X, Plus, Pencil, Copy, Trash2 } from "lucide-react";
import {
  createWhatsAppCampaign,
  deleteWhatsAppCampaign,
  getWhatsAppCampaignForEdit,
  duplicateWhatsAppCampaign,
  listWhatsAppCampaigns,
  setWhatsAppCampaignStatus,
  updateWhatsAppCampaign,
} from "@/lib/whatsapp-campaigns.functions";
import { canDeleteCampaign, canEditCampaign } from "@/lib/whatsapp/campaign-actions";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  CampaignAudiencePanel,
  EMPTY_AUDIENCE,
  audiencePayload,
  hydrateAudienceConfig,
  toAudienceConfig,
  type AudienceState,
} from "@/components/whatsapp/campaign-audience-panel";
import { getWhatsAppTemplateCatalog } from "@/lib/whatsapp.functions";
import { catalogMessage, composerPolicy } from "@/lib/whatsapp/composer-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/crm";
import { estimateRemainingMs, validateInterval } from "@/lib/whatsapp/campaign-pacing";

export const Route = createFileRoute("/_authenticated/campaigns/whatsapp")({
  component: CampaignsPage,
});

function parseRecipients(raw: string): { phone: string; variables: Record<string, string> }[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/[,;\t]/).map((p) => p.trim());
      const phone = parts[0];
      const variables: Record<string, string> = {};
      parts.slice(1).forEach((v, i) => {
        variables[String(i + 1)] = v;
      });
      return { phone, variables };
    });
}

function CampaignsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listWhatsAppCampaigns);
  const tmplFn = useServerFn(getWhatsAppTemplateCatalog);
  const createFn = useServerFn(createWhatsAppCampaign);
  const updateFn = useServerFn(updateWhatsAppCampaign);
  const statusFn = useServerFn(setWhatsAppCampaignStatus);

  const { data: items = [] } = useQuery({
    queryKey: ["wa-campaigns"],
    queryFn: () => listFn(),
    refetchInterval: 5000,
  });
  const catalogQ = useQuery({
    queryKey: ["wa", "templates", "campaigns"],
    queryFn: () => tmplFn({ data: {} }),
    staleTime: 60_000,
  });
  const templates = catalogQ.data?.items ?? [];
  // Erro, catálogo não sincronizado e catálogo vazio são estados distintos.
  const catalogState = composerPolicy({
    channelReady: catalogQ.data ? catalogQ.data.channelReady : catalogQ.isError ? false : null,
    windowChecking: false,
    windowError: false,
    withinWindow: null,
    templateRequiredByServer: false,
    templates: catalogQ.data ? templates : null,
    templatesLoading: catalogQ.isLoading,
    templatesError: catalogQ.isError,
  }).catalogState;

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [templateName, setTemplateName] = useState<string>("__none__");
  const [rate, setRate] = useState(10);
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [audience, setAudience] = useState<AudienceState>(EMPTY_AUDIENCE);
  const editFn = useServerFn(getWhatsAppCampaignForEdit);
  const [mediaUrl, setMediaUrl] = useState("");
  const [sdrPlaybook, setSdrPlaybook] = useState<string>("__none__");
  // Intervalo aleatório entre disparos: "" = usar o padrão do workspace.
  const [ivMin, setIvMin] = useState<string>("");
  const [ivMax, setIvMax] = useState<string>("");
  const ownInterval = ivMin !== "" || ivMax !== "";
  const ivError = ownInterval ? validateInterval(Number(ivMin || 0), Number(ivMax || 0)) : null;
  const intervalPayload = ownInterval
    ? { send_interval_min_s: Number(ivMin || 0), send_interval_max_s: Number(ivMax || 0) }
    : { send_interval_min_s: null, send_interval_max_s: null };
  const { data: playbooksData, defaultPlaybookId } = useSdrPlaybooks();
  const playbooks = sortDefaultFirst(
    (playbooksData?.items ?? []) as { id: string; name: string; enabled: boolean }[],
    defaultPlaybookId,
  );

  const selectedTpl = templates.find((t) => t.name === templateName);
  const isHsm = !!selectedTpl;
  const isEditing = editingId !== null;
  // Estado da campanha em edição: rascunho troca o público; pausada só exibe.
  const [editStatus, setEditStatus] = useState<string>("");
  const [editTotal, setEditTotal] = useState(0);
  const [hasStoredAudience, setHasStoredAudience] = useState(false);
  const [audienceTouched, setAudienceTouched] = useState(false);

  function resetForm() {
    setEditingId(null);
    setEditStatus("");
    setEditTotal(0);
    setHasStoredAudience(false);
    setAudienceTouched(false);
    setName("");
    setBody("");
    setTemplateName("__none__");
    setRate(10);
    setRecipientsRaw("");
    setAudience(EMPTY_AUDIENCE);
    setMediaUrl("");
    setSdrPlaybook(defaultPlaybookId ?? "__none__");
    setIvMin("");
    setIvMax("");
  }

  function openEdit(c: (typeof items)[number]) {
    // Fetch existing fields for editing. The list query already gives basic
    // fields; for body/template/media we lazily prefill from what the list has
    // and read the rest only when needed. For simplicity we accept that body
    // and template_name are not in the list payload — user can re-pick them.
    setEditingId(c.id);
    setName(c.name);
    setRate(c.rate_per_minute);
    setIvMin(c.interval_source === "campaign" ? String(c.interval_min_s) : "");
    setIvMax(c.interval_source === "campaign" ? String(c.interval_max_s) : "");
    setBody("");
    setTemplateName("__none__");
    setMediaUrl("");
    setRecipientsRaw("");
    setAudience(EMPTY_AUDIENCE);
    setEditStatus(c.status);
    setEditTotal(c.total ?? 0);
    setHasStoredAudience(false);
    setAudienceTouched(false);
    setOpen(true);
    void editFn({ data: { id: c.id } })
      .then((full) => {
        const cfg = hydrateAudienceConfig(full.audience_config);
        setEditStatus(full.status);
        setEditTotal(full.total ?? 0);
        if (cfg) {
          setAudience({
            ...cfg.state,
            recentDays: full.recent_contact_days ?? cfg.state.recentDays,
          });
          setRecipientsRaw(cfg.manualRaw);
          setHasStoredAudience(true);
        } else {
          setAudience({ ...EMPTY_AUDIENCE, recentDays: full.recent_contact_days ?? 7 });
        }
        setBody(full.body_template ?? "");
        setTemplateName(full.template_name || "__none__");
        setMediaUrl(full.media_url ?? "");
        setSdrPlaybook(full.sdr_playbook_id ?? "__none__");
      })
      .catch(() => toast.error("Não foi possível carregar os dados salvos da campanha."));
  }

  const create = useMutation({
    mutationFn: async () => {
      if (ivError) throw new Error(ivError);
      if (isEditing && editingId) {
        // Para HSM monta content_variables_template a partir de {{1}}..{{N}}
        let content_variables_template: Record<string, string> | undefined;
        if (isHsm && selectedTpl?.variableCount) {
          content_variables_template = {};
          for (let i = 1; i <= selectedTpl.variableCount; i++) {
            content_variables_template[String(i)] = `{{${i}}}`;
          }
        }
        let replace_audience: Record<string, unknown> | undefined;
        if (editStatus === "draft" && audienceTouched) {
          const manualE = audience.mode === "manual";
          const recipientsE = manualE ? parseRecipients(recipientsRaw) : [];
          const audE = manualE ? undefined : audiencePayload(audience);
          if (manualE && recipientsE.length === 0)
            throw new Error("Adicione pelo menos um destinatário");
          if (!manualE && !audE) throw new Error("Escolha o público da campanha");
          if (!manualE && isHsm) {
            for (let i = 1; i <= (selectedTpl?.variableCount ?? 0); i++) {
              const b = audience.variableMap[String(i)];
              if (!b?.field) throw new Error(`Defina o campo da variável {{${i}}}`);
              if (b.field === "__free__" && !b.fallback?.trim())
                throw new Error(`Escreva o texto da variável {{${i}}}`);
            }
          }
          replace_audience = {
            recipients: recipientsE,
            audience: audE,
            variable_map: manualE ? undefined : audience.variableMap,
            skip_missing: audience.skipMissing,
            recent_contact_days: audience.recentDays,
            recent_overrides: audience.recentOverrides,
          exclude_customers: audience.excludeCustomers,
          exclude_open_deals: audience.excludeOpenDeals,
          commercial_overrides: audience.commercialOverrides,
            exclude_customers: audience.excludeCustomers,
            exclude_open_deals: audience.excludeOpenDeals,
            commercial_overrides: audience.commercialOverrides,
            audience_config: toAudienceConfig(audience, recipientsRaw),
          };
        }
        return updateFn({
          data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            replace_audience: replace_audience as any,
            id: editingId,
            name,
            body_template: selectedTpl?.body ?? body,
            template_name: templateName !== "__none__" ? templateName : null,
            template_language: selectedTpl?.language ?? null,
            content_variables_template,
            media_url: mediaUrl || null,
            rate_per_minute: rate,
            sdr_playbook_id: isHsm && sdrPlaybook !== "__none__" ? sdrPlaybook : null,
            ...intervalPayload,
          },
        });
      }
      const manual = audience.mode === "manual";
      const recipients = manual ? parseRecipients(recipientsRaw) : [];
      const audiencePl = manual ? undefined : audiencePayload(audience);
      if (manual && recipients.length === 0) throw new Error("Adicione pelo menos um destinatário");
      if (!manual && !audiencePl) throw new Error("Escolha o público da campanha");
      if (!manual && isHsm) {
        for (let i = 1; i <= (selectedTpl?.variableCount ?? 0); i++) {
          const b = audience.variableMap[String(i)];
          if (!b?.field) throw new Error(`Defina o campo da variável {{${i}}}`);
          if (b.field === "__free__" && !b.fallback?.trim())
            throw new Error(`Escreva o texto da variável {{${i}}}`);
        }
      }

      // Para HSM monta content_variables_template a partir de {{1}}..{{N}}
      let content_variables_template: Record<string, string> | undefined;
      if (isHsm && selectedTpl?.variableCount) {
        content_variables_template = {};
        for (let i = 1; i <= selectedTpl.variableCount; i++) {
          content_variables_template[String(i)] = `{{${i}}}`;
        }
      }

      return createFn({
        data: {
          name,
          body_template: selectedTpl?.body ?? body,
          template_name: templateName !== "__none__" ? templateName : undefined,
          template_language: selectedTpl?.language ?? undefined,
          content_variables_template,
          media_url: mediaUrl || undefined,
          rate_per_minute: rate,
          recipients,
          audience: audiencePl,
          variable_map: manual ? undefined : audience.variableMap,
          skip_missing: audience.skipMissing,
          recent_contact_days: audience.recentDays,
          recent_overrides: audience.recentOverrides,
          audience_config: toAudienceConfig(audience, recipientsRaw),
          sdr_playbook_id: isHsm && sdrPlaybook !== "__none__" ? sdrPlaybook : null,
          ...intervalPayload,
        },
      });
    },
    onSuccess: () => {
      toast.success(isEditing ? "Campanha atualizada" : "Campanha criada como rascunho");
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["wa-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: (vars: { id: string; status: "running" | "paused" | "canceled" }) =>
      statusFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-campaigns"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicateFn = useServerFn(duplicateWhatsAppCampaign);
  const deleteFn = useServerFn(deleteWhatsAppCampaign);
  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Cópia criada em rascunho");
      void qc.invalidateQueries({ queryKey: ["wa-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Campanha excluída");
      void qc.invalidateQueries({ queryKey: ["wa-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> Campanhas WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Disparos em massa com fila e limite de mensagens por minuto.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" /> Nova campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Editar campanha" : "Nova campanha"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Black Friday Outubro"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Template</label>
                  <Select value={templateName} onValueChange={setTemplateName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum (texto livre)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum (texto livre)</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name} {t.approved ? `· ${t.language}` : `· ${t.status}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {catalogState !== "ready" && (
                    <div className="mt-1 flex items-center gap-2 text-xs" aria-live="polite">
                      <span
                        className={
                          catalogState === "error" ? "text-destructive" : "text-muted-foreground"
                        }
                      >
                        {catalogMessage(catalogState)}
                      </span>
                      {(catalogState === "error" || catalogState === "empty") && (
                        <Button size="sm" variant="outline" onClick={() => void catalogQ.refetch()}>
                          Atualizar modelos
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Msgs por minuto</label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                  />
                </div>
              </div>
              <fieldset className="space-y-1">
                <legend className="text-xs text-muted-foreground">
                  Intervalo aleatório entre disparos (segundos)
                </legend>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={3600}
                    aria-label="Intervalo mínimo em segundos"
                    placeholder="padrão"
                    value={ivMin}
                    onChange={(e) => setIvMin(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <Input
                    type="number"
                    min={0}
                    max={3600}
                    aria-label="Intervalo máximo em segundos"
                    placeholder="padrão"
                    value={ivMax}
                    onChange={(e) => setIvMax(e.target.value)}
                  />
                </div>
                <p className={`text-xs ${ivError ? "text-destructive" : "text-muted-foreground"}`}>
                  {ivError ??
                    "Em branco usa o padrão do workspace (Agente SDR › Configuração). Cada disparo espera um tempo sorteado nesse intervalo; pode atrasar até ~1 min além do sorteado."}
                </p>
              </fieldset>
              <div>
                <label htmlFor="camp-body" className="text-xs text-muted-foreground">
                  Mensagem (use {`{{1}}, {{2}}`} para variáveis)
                </label>
                <Textarea
                  id="camp-body"
                  rows={isHsm ? 5 : 3}
                  value={isHsm ? (selectedTpl?.body ?? "") : body}
                  disabled={isHsm}
                  aria-describedby={isHsm ? "camp-body-hint" : undefined}
                  placeholder={isHsm ? "Prévia indisponível para este modelo" : undefined}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              {isHsm && (
                <p id="camp-body-hint" className="text-xs text-muted-foreground">
                  Texto do modelo aprovado pela Meta ({selectedTpl?.language}) — não pode ser
                  editado. Defina as {selectedTpl?.variableCount ?? 0} variáveis no quadro abaixo.
                </p>
              )}
              {isHsm && (
                <div>
                  <label htmlFor="camp-sdr" className="text-xs text-muted-foreground">
                    Agente SDR após resposta (opcional)
                  </label>
                  <Select value={sdrPlaybook} onValueChange={setSdrPlaybook}>
                    <SelectTrigger id="camp-sdr">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Desligado</SelectItem>
                      {playbooks.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {agentOptionLabel(p, defaultPlaybookId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quando o cliente responder, o SDR prepara a conversa para sua aprovação.
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">URL de mídia (opcional)</label>
                <Input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              {isEditing && !hasStoredAudience && (
                <p className="text-xs text-muted-foreground" role="note">
                  O público desta campanha não foi registrado (criada antes desta versão). Ela tem{" "}
                  {editTotal} destinatário(s).
                  {editStatus === "draft"
                    ? " Para trocar, monte um novo público abaixo."
                    : " Para mudar a lista, duplique a campanha."}
                </p>
              )}
              {(!isEditing || editStatus === "draft" || hasStoredAudience) && (
                <CampaignAudiencePanel
                  value={audience}
                  onChange={(v) => {
                    setAudienceTouched(true);
                    setAudience(v);
                  }}
                  readOnly={isEditing && editStatus !== "draft"}
                  variableCount={isHsm ? (selectedTpl?.variableCount ?? 0) : 0}
                  manualRaw={recipientsRaw}
                  onManualRaw={(r) => {
                    setAudienceTouched(true);
                    setRecipientsRaw(r);
                  }}
                  manualCount={parseRecipients(recipientsRaw).length}
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !name}>
                {isEditing ? "Salvar alterações" : "Criar rascunho"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="divide-y">
        {items.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma campanha ainda.
          </div>
        )}
        {items.map((c) => (
          <div key={c.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link to="/campaigns/whatsapp" className="font-medium truncate hover:underline">
                  {c.name}
                </Link>
                <Badge variant={c.status === "running" ? "default" : "secondary"}>{c.status}</Badge>
                <Badge variant="outline">{c.rate_per_minute}/min</Badge>
                {c.interval_max_s > 0 && (
                  <Badge variant="outline">
                    {c.interval_min_s}–{c.interval_max_s}s
                    {c.interval_source === "workspace" ? " (padrão)" : ""}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.sent}/{c.total} enviadas · {c.failed} falhas
                {c.started_at ? ` · iniciou ${formatDateTime(c.started_at)}` : ""}
                {c.status === "running" && <PacingInfo c={c} />}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openEdit(c)}
                disabled={!canEditCampaign(c.status)}
                title={
                  canEditCampaign(c.status)
                    ? undefined
                    : "Só é possível editar campanhas em rascunho ou pausadas"
                }
              >
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Duplicar ${c.name}`}
                title="Duplicar"
                disabled={duplicate.isPending}
                onClick={() => duplicate.mutate(c.id)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Excluir ${c.name}`}
                title={
                  canDeleteCampaign(c.status) ? "Excluir" : "Pause a campanha antes de excluir"
                }
                disabled={!canDeleteCampaign(c.status) || remove.isPending}
                onClick={async () => {
                  const ok = await confirmDialog(
                    `Excluir a campanha "${c.name}" e seus ${c.total} destinatário(s)? As mensagens já enviadas continuam nas conversas.`,
                  );
                  if (ok) remove.mutate(c.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {c.status !== "running" && c.status !== "completed" && c.status !== "canceled" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus.mutate({ id: c.id, status: "running" })}
                >
                  <Play className="h-4 w-4 mr-1" /> Iniciar
                </Button>
              )}
              {c.status === "running" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatus.mutate({ id: c.id, status: "paused" })}
                >
                  <Pause className="h-4 w-4 mr-1" /> Pausar
                </Button>
              )}
              {(c.status === "running" || c.status === "paused" || c.status === "draft") && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => changeStatus.mutate({ id: c.id, status: "canceled" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function PacingInfo({
  c,
}: {
  c: {
    total: number;
    sent: number;
    failed: number;
    rate_per_minute: number;
    interval_min_s: number;
    interval_max_s: number;
    next_send_at: string | null;
  };
}) {
  const pending = Math.max(0, c.total - c.sent - c.failed);
  const remaining = estimateRemainingMs(
    pending,
    { min: c.interval_min_s, max: c.interval_max_s },
    c.rate_per_minute,
  );
  const nextIn = c.next_send_at
    ? Math.round((new Date(c.next_send_at).getTime() - Date.now()) / 1000)
    : null;
  return (
    <>
      {c.interval_max_s > 0 &&
        nextIn != null &&
        pending > 0 &&
        (nextIn > 0
          ? ` · próximo disparo em ~${nextIn}s`
          : " · próximo disparo na próxima rodada (até ~2 min)")}
      {pending > 0 && ` · término previsto em ~${Math.max(1, Math.round(remaining / 60000))} min`}
    </>
  );
}
