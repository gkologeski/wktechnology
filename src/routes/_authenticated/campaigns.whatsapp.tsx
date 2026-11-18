import { FormSection } from "@/components/techhire/ui";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSdrPlaybooks } from "@/hooks/use-default-sdr-agent";
import { agentOptionLabel, sortDefaultFirst } from "@/lib/prospecting/sdr/default-agent";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Megaphone, Play, Pause, X, Plus, Pencil, Copy, Trash2, Loader2 } from "lucide-react";
import {
  createWhatsAppCampaign,
  deleteWhatsAppCampaign,
  getWhatsAppCampaignForEdit,
  duplicateWhatsAppCampaign,
  listWhatsAppCampaigns,
  setWhatsAppCampaignStatus,
  updateWhatsAppCampaign,
  getCampaignSenderAgent,
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
import { CampaignAssignmentSection } from "@/components/whatsapp/campaign-assignment-section";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import type { AssignmentMode } from "@/lib/whatsapp/campaign-assignment";
import { listCloudSenders } from "@/lib/whatsapp/cloud-connections.functions";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/crm";
import { estimateRemainingMs, validateInterval } from "@/lib/whatsapp/campaign-pacing";
import {
  missingRotationVariables,
  rotationVariableKey,
} from "@/lib/whatsapp/campaign-template-rotation";
import {
  addSenderPick,
  groupTemplatesBySender,
  parsePick,
  pickValue,
} from "@/lib/whatsapp/campaign-template-groups";

const WIZARD_STEPS = ["Números", "Mensagem", "Público", "Atendimento", "Ritmo e revisão"] as const;

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
  const permissions = usePermissions();
  const [sender, setSender] = useState("lovable");
  // ROTACAO-NUMEROS: números oficiais adicionais (máx. 4 + principal).
  const [extraSenders, setExtraSenders] = useState<string[]>([]);
  const [senderMode, setSenderMode] = useState<"sequential" | "random">("sequential");
  const [consentEvidence, setConsentEvidence] = useState("");
  const sendersFn = useServerFn(listCloudSenders);
  const senders = useQuery({ queryKey: ["wa-cloud-senders"], queryFn: () => sendersFn() });
  const gatewaySender = senders.data?.find((n) => n.via_gateway) ?? null;
  const senderReal = sender === "lovable" ? (gatewaySender?.phone_number_id ?? "") : sender;
  // Conector Lovable sem rodízio continua salvo como antes (sem número fixo).
  const senderIdForSave =
    sender === "lovable" ? (extraSenders.length ? senderReal || null : null) : sender;
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
    queryKey: ["wa", "templates", "campaigns", sender],
    queryFn: () => tmplFn({ data: { phoneNumberId: sender === "lovable" ? null : sender } }),
    staleTime: 60_000,
  });
  // MODELOS-POR-NUMERO: catálogo de cada número extra do rodízio, unido ao do principal.
  const extraCatalogs = useQueries({
    queries: extraSenders
      .filter((id) => id !== senderReal)
      .map((id) => ({
        queryKey: ["wa", "templates", "campaigns", id],
        queryFn: () => tmplFn({ data: { phoneNumberId: id } }),
        staleTime: 60_000,
      })),
  });
  const extraIds = extraSenders.filter((id) => id !== senderReal);
  const senderLabel = (id: string) =>
    senders.data?.find((x) => x.phone_number_id === id)?.display_phone_number ?? id;
  type CatalogItem = NonNullable<typeof catalogQ.data>["items"][number] & { senders: string[] };
  const templates: CatalogItem[] = (() => {
    const map = new Map<string, CatalogItem>();
    const add = (items: NonNullable<typeof catalogQ.data>["items"], id: string) => {
      for (const t of items) {
        const cur = map.get(t.name);
        if (!cur) map.set(t.name, { ...t, senders: t.approved && id ? [id] : [] });
        else if (t.approved && id && !cur.senders.includes(id)) {
          cur.senders.push(id);
          if (!cur.approved) map.set(t.name, { ...t, senders: cur.senders });
        }
      }
    };
    add(catalogQ.data?.items ?? [], senderReal);
    extraCatalogs.forEach((q, i) => add(q.data?.items ?? [], extraIds[i]));
    return [...map.values()];
  })();
  const rotatingNumbers = extraIds.length > 0;
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
  // AGENTE-DO-NUMERO: o agente é definido pelo canal de atendimento do número.
  const senderAgentFn = useServerFn(getCampaignSenderAgent);
  const senderAgentQ = useQuery({
    queryKey: ["wa-campaign-sender-agent", sender],
    queryFn: () => senderAgentFn({ data: { phone_number_id: sender } }),
    enabled: sender !== "lovable",
    staleTime: 30_000,
  });
  const senderAgent = sender === "lovable" ? { kind: "free" as const } : senderAgentQ.data;
  const agentLocked = sender !== "lovable" && senderAgent?.kind !== "free";
  useEffect(() => {
    if (!senderAgent || senderAgent.kind === "free") return;
    setSdrPlaybook(senderAgent.kind === "locked" ? senderAgent.agentId : "__none__");
  }, [senderAgent]);
  const [assignMode, setAssignMode] = useState<AssignmentMode>("auto");
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const { data: activeMembers = [] } = useWorkspaceMembers();
  const assignment = { assignment_mode: assignMode, assignment_member_ids: assignIds };
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
  // Rodízio: modelos adicionais aprovados (máx. 4 + principal).
  const [extraTpls, setExtraTpls] = useState<{ name: string; weight: number }[]>([]);
  const [primaryWeight, setPrimaryWeight] = useState(1);
  // WIZARD-CAMPANHA-WA: números escolhidos para cada modelo (opção número › modelo).
  const [tplSenders, setTplSenders] = useState<Record<string, string[]>>({});
  const [step, setStep] = useState(0);
  const groups = groupTemplatesBySender([
    { senderId: senderReal || "primary", items: catalogQ.data?.items ?? [] },
    ...extraIds.map((id, i) => ({ senderId: id, items: extraCatalogs[i]?.data?.items ?? [] })),
  ]);
  const shortNum = (id: string) => {
    const d = senderLabel(id).replace(/\D/g, "");
    return d.length >= 8 ? `${d.slice(-8, -4)}-${d.slice(-4)}` : senderLabel(id);
  };
  const groupLabel = (id: string) => {
    const n = senders.data?.find((x) => x.phone_number_id === id);
    return n ? `${n.display_phone_number} · ${n.verified_name || "Meta"}` : "Número principal";
  };
  const chosenSenders = (name: string, approved: string[]) => {
    const picked = (tplSenders[name] ?? []).filter((id) => approved.includes(id));
    return picked.length ? picked : approved;
  };
  const [rotationMode, setRotationMode] = useState<"sequential" | "weighted">("sequential");
  const extraSelected = extraTpls
    .map((e) => ({ ...e, tpl: templates.find((t) => t.name === e.name) }))
    .filter((e) => e.tpl && e.name !== templateName);
  const varCount = Math.max(
    selectedTpl?.variableCount ?? 0,
    ...extraSelected.map((e) => e.tpl?.variableCount ?? 0),
  );
  const rotationPayload = isHsm
    ? [
        {
          name: templateName,
          language: selectedTpl?.language ?? null,
          body: selectedTpl?.body ?? null,
          variableCount: selectedTpl?.variableCount ?? 0,
          weight: primaryWeight,
          ...(rotatingNumbers
            ? { senders: chosenSenders(templateName, selectedTpl?.senders ?? []) }
            : {}),
        },
        ...extraSelected.map((e) => ({
          name: e.name,
          language: e.tpl?.language ?? null,
          body: e.tpl?.body ?? null,
          variableCount: e.tpl?.variableCount ?? 0,
          weight: e.weight,
          ...(rotatingNumbers ? { senders: chosenSenders(e.name, e.tpl?.senders ?? []) } : {}),
        })),
      ]
    : [];
  // Um quadro de variáveis por modelo: cada modelo tem as próprias variáveis.
  const variableGroups = rotationPayload.map((t, idx) => ({
    label: t.name,
    body: t.body ?? undefined,
    keys: Array.from({ length: t.variableCount }, (_, i) =>
      rotationVariableKey(t.name, i + 1, idx === 0),
    ),
  }));
  const isEditing = editingId !== null;
  // Estado da campanha em edição: rascunho troca o público; pausada só exibe.
  const [editStatus, setEditStatus] = useState<string>("");
  const [editTotal, setEditTotal] = useState(0);
  const [hasStoredAudience, setHasStoredAudience] = useState(false);
  const [audienceTouched, setAudienceTouched] = useState(false);

  function resetForm() {
    setSender("lovable");
    setExtraSenders([]);
    setSenderMode("sequential");
    setConsentEvidence("");
    setEditingId(null);
    setEditStatus("");
    setEditTotal(0);
    setHasStoredAudience(false);
    setAudienceTouched(false);
    setName("");
    setBody("");
    setTemplateName("__none__");
    setExtraTpls([]);
    setPrimaryWeight(1);
    setTplSenders({});
    setStep(0);
    setRotationMode("sequential");
    setRate(10);
    setRecipientsRaw("");
    setAudience(EMPTY_AUDIENCE);
    setMediaUrl("");
    setSdrPlaybook(defaultPlaybookId ?? "__none__");
    setIvMin("");
    setIvMax("");
    setAssignMode("auto");
    setAssignIds([]);
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
    setTplSenders({});
    setStep(c.status === "paused" ? 4 : 0);
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
            excludeCustomers: full.exclude_customers ?? true,
            excludeOpenDeals: full.exclude_open_deals ?? true,
          });
          setRecipientsRaw(cfg.manualRaw);
          setHasStoredAudience(true);
        } else {
          setAudience({
            ...EMPTY_AUDIENCE,
            recentDays: full.recent_contact_days ?? 7,
            excludeCustomers: full.exclude_customers ?? true,
            excludeOpenDeals: full.exclude_open_deals ?? true,
          });
        }
        setBody(full.body_template ?? "");
        setSender(
          !full.sender_phone_number_id ||
            full.sender_phone_number_id === gatewaySender?.phone_number_id
            ? "lovable"
            : full.sender_phone_number_id,
        );
        setExtraSenders(Array.isArray(full.sender_rotation) ? full.sender_rotation : []);
        setSenderMode(full.sender_rotation_mode === "random" ? "random" : "sequential");
        setConsentEvidence(full.consent_evidence || "");
        setTemplateName(full.template_name || "__none__");
        {
          const rot = (Array.isArray(full.template_rotation) ? full.template_rotation : []) as {
            name: string;
            weight?: number;
            senders?: string[];
          }[];
          setTplSenders(
            Object.fromEntries(
              rot.filter((t) => t.senders?.length).map((t) => [t.name, t.senders as string[]]),
            ),
          );
          setPrimaryWeight(rot.find((t) => t.name === full.template_name)?.weight ?? 1);
          setExtraTpls(
            rot
              .filter((t) => t.name !== full.template_name)
              .map((t) => ({ name: t.name, weight: t.weight ?? 1 })),
          );
          setRotationMode(full.rotation_mode === "weighted" ? "weighted" : "sequential");
        }
        setMediaUrl(full.media_url ?? "");
        setSdrPlaybook(full.sdr_playbook_id ?? "__none__");
        setAssignMode((full.assignment_mode as AssignmentMode) ?? "auto");
        setAssignIds(full.assignment_member_ids ?? []);
      })
      .catch(() => toast.error("Não foi possível carregar os dados salvos da campanha."));
  }

  const create = useMutation({
    mutationFn: async () => {
      const action = editingId ? "update" : "create";
      if (
        !permissions.canAny(
          ["own", "team", "workspace"].map(
            (scope) => `techsales.marketing.campaigns.${action}.${scope}`,
          ),
        )
      )
        throw new Error("Sem permissão para salvar campanhas.");
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
            const missing = missingRotationVariables(rotationPayload, audience.variableMap);
            if (missing.length > 0) throw new Error(`Defina as variáveis: ${missing.join(", ")}`);
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
            audience_config: toAudienceConfig(audience, recipientsRaw),
          };
        }
        // Campanha com público salvo (rascunho sem troca ou pausada): atualiza as
        // variáveis dos pendentes para os modelos do rodízio.
        let refresh_variables: Record<string, unknown> | undefined;
        if (!replace_audience && isHsm && hasStoredAudience && audience.mode !== "manual") {
          const audR = audiencePayload(audience);
          const missing = missingRotationVariables(rotationPayload, audience.variableMap);
          if (missing.length > 0) throw new Error(`Defina as variáveis: ${missing.join(", ")}`);
          if (audR) refresh_variables = { audience: audR, variable_map: audience.variableMap };
        }
        return updateFn({
          data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            replace_audience: replace_audience as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            refresh_variables: refresh_variables as any,
            id: editingId,
            name,
            body_template: selectedTpl?.body ?? body,
            template_name: templateName !== "__none__" ? templateName : null,
            sender_phone_number_id: senderIdForSave,
            sender_rotation: extraSenders.filter((n) => n !== senderIdForSave),
            sender_rotation_mode: senderMode,
            consent_evidence: sender === "lovable" ? null : consentEvidence,
            template_language: selectedTpl?.language ?? null,
            content_variables_template,
            template_rotation: rotationPayload,
            rotation_mode: rotationMode,
            media_url: mediaUrl || null,
            rate_per_minute: rate,
            sdr_playbook_id: isHsm && sdrPlaybook !== "__none__" ? sdrPlaybook : null,
            assignment,
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
        const missing = missingRotationVariables(rotationPayload, audience.variableMap);
        if (missing.length > 0) throw new Error(`Defina as variáveis: ${missing.join(", ")}`);
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
          sender_phone_number_id: senderIdForSave,
          sender_rotation: extraSenders.filter((n) => n !== senderIdForSave),
          sender_rotation_mode: senderMode,
          consent_evidence: sender === "lovable" ? null : consentEvidence,
          template_language: selectedTpl?.language ?? undefined,
          content_variables_template,
          template_rotation: rotationPayload,
          rotation_mode: rotationMode,
          media_url: mediaUrl || undefined,
          rate_per_minute: rate,
          recipients,
          audience: audiencePl,
          variable_map: manual ? undefined : audience.variableMap,
          skip_missing: audience.skipMissing,
          recent_contact_days: audience.recentDays,
          recent_overrides: audience.recentOverrides,
          exclude_customers: audience.excludeCustomers,
          exclude_open_deals: audience.excludeOpenDeals,
          commercial_overrides: audience.commercialOverrides,
          audience_config: toAudienceConfig(audience, recipientsRaw),
          sdr_playbook_id: isHsm && sdrPlaybook !== "__none__" ? sdrPlaybook : null,
          assignment,
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
            <nav aria-label="Etapas da campanha" className="mb-2">
              <ol className="flex flex-wrap gap-1">
                {WIZARD_STEPS.map((label, i) => (
                  <li key={label}>
                    <Button
                      type="button"
                      size="sm"
                      variant={i === step ? "default" : "ghost"}
                      aria-current={i === step ? "step" : undefined}
                      disabled={i > step && !name}
                      onClick={() => setStep(i)}
                    >
                      {i + 1}. {label}
                    </Button>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {step === 0 && (
                <>
                  <FormSection title="Identificação" className="gap-3 py-4 md:grid-cols-1">
                    <div>
                      <label htmlFor="camp-name" className="text-xs text-muted-foreground">
                        Nome da campanha
                      </label>
                      <Input
                        id="camp-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Black Friday Outubro"
                      />
                    </div>
                  </FormSection>
                  <FormSection
                    title="Remetente"
                    description="Número que envia as mensagens desta campanha."
                    className="gap-3 py-4 md:grid-cols-1"
                  >
                    <div>
                      <label htmlFor="camp-sender" className="text-xs text-muted-foreground">
                        Número remetente
                      </label>
                      <Select
                        value={sender}
                        disabled={isEditing && editStatus !== "draft"}
                        onValueChange={(value) => {
                          setSender(value);
                          const real = value === "lovable" ? gatewaySender?.phone_number_id : value;
                          setExtraSenders((xs) => xs.filter((x) => x !== real));
                          setTemplateName("__none__");
                        }}
                      >
                        <SelectTrigger id="camp-sender">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lovable">
                            {gatewaySender
                              ? `${gatewaySender.display_phone_number} · ${gatewaySender.verified_name || "Meta"} (Conector Lovable)`
                              : "Conector Lovable atual"}
                          </SelectItem>
                          {senders.data
                            ?.filter((n) => !n.via_gateway)
                            .map((number) => (
                              <SelectItem
                                key={number.phone_number_id}
                                value={number.phone_number_id}
                                disabled={number.quality_rating === "RED"}
                              >
                                {number.display_phone_number} · {number.verified_name || "Meta"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {senders.isError && (
                        <p role="alert" className="text-sm text-destructive">
                          Não foi possível consultar os números oficiais.
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Cada contato recebe sempre pelo mesmo número. O número principal só muda em
                        rascunho; o rodízio também pode ser ajustado com a campanha pausada.
                      </p>
                      {(sender !== "lovable" || gatewaySender) && (
                        <div className="mt-3 space-y-2 rounded-md border border-border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">Rodízio de números</p>
                              <p className="text-xs text-muted-foreground">
                                Adicione até 4 números oficiais para intercalar os envios. Os
                                modelos escolhidos precisam estar aprovados em todos eles.
                              </p>
                            </div>
                            <Select
                              value={senderMode}
                              disabled={
                                isEditing && editStatus !== "draft" && editStatus !== "paused"
                              }
                              onValueChange={(v) => setSenderMode(v as "sequential" | "random")}
                            >
                              <SelectTrigger
                                className="w-48"
                                aria-label="Modo de rodízio de números"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sequential">Intercalar em sequência</SelectItem>
                                <SelectItem value="random">Sortear</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <ul className="space-y-1">
                            {[senderReal, ...extraSenders].map((id, idx) => {
                              const n = senders.data?.find((x) => x.phone_number_id === id);
                              return (
                                <li key={id} className="flex items-center gap-2 text-sm">
                                  <span className="flex-1 truncate">
                                    {n
                                      ? `${n.display_phone_number} · ${n.verified_name || "Meta"}`
                                      : id}
                                    {idx === 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        {" "}
                                        · principal
                                      </span>
                                    )}
                                  </span>
                                  {idx > 0 && (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      disabled={
                                        isEditing &&
                                        editStatus !== "draft" &&
                                        editStatus !== "paused"
                                      }
                                      aria-label={`Remover número ${n?.display_phone_number ?? id}`}
                                      onClick={() =>
                                        setExtraSenders((xs) => xs.filter((x) => x !== id))
                                      }
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          {extraSenders.length < 4 &&
                            (senders.data ?? []).some(
                              (x) =>
                                x.phone_number_id !== senderReal &&
                                !extraSenders.includes(x.phone_number_id) &&
                                x.quality_rating !== "RED",
                            ) && (
                              <Select
                                value=""
                                disabled={
                                  isEditing && editStatus !== "draft" && editStatus !== "paused"
                                }
                                onValueChange={(v) => setExtraSenders((xs) => [...xs, v])}
                              >
                                <SelectTrigger aria-label="Adicionar número ao rodízio">
                                  <SelectValue placeholder="Adicionar número" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(senders.data ?? [])
                                    .filter(
                                      (x) =>
                                        x.phone_number_id !== senderReal &&
                                        !extraSenders.includes(x.phone_number_id) &&
                                        x.quality_rating !== "RED",
                                    )
                                    .map((x) => (
                                      <SelectItem key={x.phone_number_id} value={x.phone_number_id}>
                                        {x.display_phone_number} · {x.verified_name || "Meta"}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            )}
                        </div>
                      )}
                      {sender !== "lovable" && (
                        <div className="mt-2">
                          <label className="text-xs text-muted-foreground">
                            Origem da autorização dos destinatários
                          </label>
                          <Textarea
                            value={consentEvidence}
                            onChange={(event) => setConsentEvidence(event.target.value)}
                            placeholder="Informe onde estão registrados os consentimentos desta lista: formulário, data, campanha ou referência verificável."
                            maxLength={2000}
                          />
                          <p className="text-xs text-muted-foreground">
                            Este registro é uma declaração do responsável. Ter o telefone no CRM ou
                            um template aprovado não comprova consentimento.
                          </p>
                        </div>
                      )}
                    </div>
                  </FormSection>
                </>
              )}
              {step === 1 && (
                <>
                  <FormSection
                    title="Mensagem"
                    description="Modelo aprovado ou texto livre, e mídia opcional."
                    className="gap-3 py-4 md:grid-cols-1"
                  >
                    <div>
                      <label htmlFor="camp-template" className="text-xs text-muted-foreground">
                        Template
                      </label>
                      <Select
                        value={
                          templateName === "__none__"
                            ? "__none__"
                            : pickValue(
                                (tplSenders[templateName] ?? selectedTpl?.senders ?? [])[0] ||
                                  senderReal ||
                                  "primary",
                                templateName,
                              )
                        }
                        onValueChange={(v) => {
                          const pick = parsePick(v);
                          if (!pick) return setTemplateName("__none__");
                          setTemplateName(pick.name);
                          setExtraTpls((xs) => xs.filter((x) => x.name !== pick.name));
                          setTplSenders((m) => ({ ...m, [pick.name]: [pick.senderId] }));
                        }}
                      >
                        <SelectTrigger id="camp-template">
                          <SelectValue placeholder="Nenhum (texto livre)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum (texto livre)</SelectItem>
                          {groups.map((g) => (
                            <SelectGroup key={g.senderId}>
                              <SelectLabel>{groupLabel(g.senderId)}</SelectLabel>
                              {g.items.map((t) => (
                                <SelectItem
                                  key={pickValue(g.senderId, t.name)}
                                  value={pickValue(g.senderId, t.name)}
                                >
                                  {shortNum(g.senderId)} › {t.name}{" "}
                                  {t.approved ? `· ${t.language}` : `· ${t.status}`}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      {catalogState !== "ready" && (
                        <div className="mt-1 flex items-center gap-2 text-xs" aria-live="polite">
                          <span
                            className={
                              catalogState === "error"
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }
                          >
                            {catalogMessage(catalogState)}
                          </span>
                          {(catalogState === "error" || catalogState === "empty") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void catalogQ.refetch()}
                            >
                              Atualizar modelos
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {isHsm && (
                      <div className="space-y-2 rounded-md border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">Rodízio de modelos</p>
                            <p className="text-xs text-muted-foreground">
                              Adicione até 4 modelos aprovados. Cada contato recebe sempre o mesmo
                              modelo, enviado por um dos números em que ele está aprovado.
                            </p>
                          </div>
                          <Select
                            value={rotationMode}
                            onValueChange={(v) => setRotationMode(v as "sequential" | "weighted")}
                          >
                            <SelectTrigger className="w-48" aria-label="Modo de rodízio">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sequential">Sequencial (A, B, C…)</SelectItem>
                              <SelectItem value="weighted">Aleatório com peso</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <ul className="space-y-1">
                          {[
                            { name: templateName, weight: primaryWeight, primary: true },
                            ...extraSelected.map((e) => ({
                              name: e.name,
                              weight: e.weight,
                              primary: false,
                            })),
                          ].map((t) => (
                            <li key={t.name} className="flex items-center gap-2 text-sm">
                              <span className="flex-1 truncate">
                                {t.name}
                                {t.primary && (
                                  <span className="text-xs text-muted-foreground">
                                    {" "}
                                    · principal
                                  </span>
                                )}
                                {rotatingNumbers && (
                                  <span className="text-xs text-muted-foreground">
                                    {" · "}
                                    {chosenSenders(
                                      t.name,
                                      templates.find((x) => x.name === t.name)?.senders ?? [],
                                    )
                                      .map(shortNum)
                                      .join(", ")}
                                  </span>
                                )}
                              </span>
                              {rotationMode === "weighted" && (
                                <Input
                                  type="number"
                                  min={1}
                                  max={100}
                                  className="h-8 w-20"
                                  aria-label={`Peso do modelo ${t.name}`}
                                  value={t.weight}
                                  onChange={(e) => {
                                    const w = Math.min(
                                      100,
                                      Math.max(1, Number(e.target.value) || 1),
                                    );
                                    if (t.primary) setPrimaryWeight(w);
                                    else
                                      setExtraTpls((xs) =>
                                        xs.map((x) =>
                                          x.name === t.name ? { ...x, weight: w } : x,
                                        ),
                                      );
                                  }}
                                />
                              )}
                              {!t.primary && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  aria-label={`Remover modelo ${t.name}`}
                                  onClick={() =>
                                    setExtraTpls((xs) => xs.filter((x) => x.name !== t.name))
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                        <Select
                          value=""
                          onValueChange={(v) => {
                            const pick = parsePick(v);
                            if (!pick) return;
                            const inRotation =
                              pick.name === templateName ||
                              extraSelected.some((e) => e.name === pick.name);
                            if (!inRotation) {
                              if (extraSelected.length >= 4) return;
                              setExtraTpls((xs) => [...xs, { name: pick.name, weight: 1 }]);
                              setTplSenders((m) => ({ ...m, [pick.name]: [pick.senderId] }));
                            } else {
                              setTplSenders((m) => {
                                const base = m[pick.name]?.length
                                  ? m
                                  : {
                                      ...m,
                                      [pick.name]: chosenSenders(
                                        pick.name,
                                        templates.find((x) => x.name === pick.name)?.senders ?? [],
                                      ).slice(0, 1),
                                    };
                                return addSenderPick(base, pick.name, pick.senderId);
                              });
                            }
                          }}
                        >
                          <SelectTrigger aria-label="Adicionar modelo ao rodízio">
                            <SelectValue placeholder="Adicionar modelo ao rodízio" />
                          </SelectTrigger>
                          <SelectContent>
                            {groups.map((g) => {
                              const opts = g.items.filter((t) => {
                                if (!t.approved) return false;
                                const inRot =
                                  t.name === templateName ||
                                  extraSelected.some((e) => e.name === t.name);
                                if (!inRot) return extraSelected.length < 4;
                                const all = templates.find((x) => x.name === t.name)?.senders ?? [];
                                return !chosenSenders(t.name, all).includes(g.senderId);
                              });
                              if (!opts.length) return null;
                              return (
                                <SelectGroup key={g.senderId}>
                                  <SelectLabel>{groupLabel(g.senderId)}</SelectLabel>
                                  {opts.map((t) => (
                                    <SelectItem
                                      key={pickValue(g.senderId, t.name)}
                                      value={pickValue(g.senderId, t.name)}
                                    >
                                      {shortNum(g.senderId)} › {t.name} · {t.language} ·{" "}
                                      {t.variableCount} variáveis
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
                        editado. Defina as {varCount} variáveis no quadro abaixo.
                      </p>
                    )}
                    <div>
                      <label htmlFor="camp-media" className="text-xs text-muted-foreground">
                        URL de mídia (opcional)
                      </label>
                      <Input
                        id="camp-media"
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </FormSection>
                </>
              )}
              {step === 2 && (
                <>
                  <FormSection
                    title="Público"
                    description="Quem vai receber a campanha."
                    className="gap-3 py-4 md:grid-cols-1"
                  >
                    {isEditing && !hasStoredAudience && (
                      <p className="text-xs text-muted-foreground" role="note">
                        O público desta campanha não foi registrado (criada antes desta versão). Ela
                        tem {editTotal} destinatário(s).
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
                        variableCount={isHsm ? varCount : 0}
                        variableGroups={isHsm ? variableGroups : undefined}
                        manualRaw={recipientsRaw}
                        onManualRaw={(r) => {
                          setAudienceTouched(true);
                          setRecipientsRaw(r);
                        }}
                        manualCount={parseRecipients(recipientsRaw).length}
                      />
                    )}
                  </FormSection>
                </>
              )}
              {step === 3 && (
                <>
                  {isHsm && (
                    <FormSection title="Após a resposta" className="gap-3 py-4 md:grid-cols-1">
                      <div>
                        <label htmlFor="camp-sdr" className="text-xs text-muted-foreground">
                          Agente SDR após resposta (opcional)
                        </label>
                        <Select
                          value={sdrPlaybook}
                          onValueChange={setSdrPlaybook}
                          disabled={agentLocked}
                        >
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
                        {agentLocked && (
                          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                            {senderAgentQ.isLoading
                              ? "Verificando o agente do número…"
                              : senderAgent?.kind === "none"
                                ? "Sem agente neste canal: as respostas vão para a distribuição configurada. "
                                : "Definido pelo canal de atendimento do número. "}
                            Para trocar, altere em Canais de Atendimento.
                          </p>
                        )}
                        {senderAgentQ.isError && (
                          <p role="alert" className="mt-1 text-xs text-destructive">
                            Não foi possível verificar o agente do número.
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Quando o cliente responder, o SDR prepara a conversa para sua aprovação.
                        </p>
                      </div>
                    </FormSection>
                  )}
                  <FormSection
                    title="Distribuição das conversas"
                    description="Quem fica responsável pelas conversas geradas por esta campanha."
                    className="gap-3 py-4 md:grid-cols-1"
                  >
                    <CampaignAssignmentSection
                      mode={assignMode}
                      memberIds={assignIds}
                      members={activeMembers}
                      onChange={(m, ids) => {
                        setAssignMode(m);
                        setAssignIds(ids);
                      }}
                    />
                  </FormSection>
                </>
              )}
              {step === 4 && (
                <>
                  <FormSection
                    title="Ritmo de envio"
                    description="Velocidade e intervalo entre disparos."
                    className="gap-3 py-4 md:grid-cols-1"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="camp-rate" className="text-xs text-muted-foreground">
                          Msgs por minuto
                        </label>
                        <Input
                          id="camp-rate"
                          type="number"
                          min={1}
                          max={120}
                          value={rate}
                          onChange={(e) => setRate(Number(e.target.value))}
                        />
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
                        <p
                          className={`text-xs ${ivError ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {ivError ??
                            "Em branco usa o padrão do workspace (Agente SDR › Configuração). Cada disparo espera um tempo sorteado nesse intervalo; pode atrasar até ~1 min além do sorteado."}
                        </p>
                      </fieldset>
                    </div>
                  </FormSection>
                  <FormSection title="Revisão" className="gap-2 py-4 md:grid-cols-1">
                    <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                      {[
                        [
                          "Números",
                          [senderReal, ...extraIds].filter(Boolean).map(shortNum).join(", ") ||
                            "Conector Lovable",
                          0,
                        ],
                        [
                          "Modelos",
                          isHsm
                            ? rotationPayload
                                .map(
                                  (t) =>
                                    `${t.name}${"senders" in t && t.senders?.length ? ` (${t.senders.map(shortNum).join(", ")})` : ""}`,
                                )
                                .join("; ")
                            : "Texto livre",
                          1,
                        ],
                        [
                          "Público",
                          audience.mode === "manual"
                            ? `${parseRecipients(recipientsRaw).length} contato(s) digitados`
                            : "Público configurado",
                          2,
                        ],
                        [
                          "Atendimento",
                          sdrPlaybook !== "__none__" && isHsm
                            ? "Agente SDR ligado"
                            : "Sem agente SDR",
                          3,
                        ],
                      ].map(([k, v, st]) => (
                        <div key={String(k)} className="contents">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="flex min-w-0 items-start justify-between gap-2">
                            <span className="min-w-0 break-words">{v}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="link"
                              className="h-auto p-0"
                              onClick={() => setStep(Number(st))}
                            >
                              Editar
                            </Button>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </FormSection>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((n) => n - 1)}>
                  Voltar
                </Button>
              )}
              {step < WIZARD_STEPS.length - 1 && (
                <Button
                  variant={isEditing ? "outline" : "default"}
                  disabled={!name}
                  title={!name ? "Informe o nome da campanha" : undefined}
                  onClick={() => setStep((n) => n + 1)}
                >
                  Continuar
                </Button>
              )}
              {(step === WIZARD_STEPS.length - 1 || isEditing) && (
                <Button
                  onClick={() => create.mutate()}
                  disabled={create.isPending || !name}
                  aria-busy={create.isPending}
                >
                  {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  <span aria-live="polite">
                    {create.isPending
                      ? isEditing
                        ? "Salvando alterações…"
                        : "Salvando rascunho e destinatários…"
                      : isEditing
                        ? "Salvar alterações"
                        : "Criar rascunho"}
                  </span>
                </Button>
              )}
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
                {c.sent} enviadas · {c.failed} falhas
                {c.status === "completed" && c.total - c.sent - c.failed > 0
                  ? ` · ${c.total - c.sent - c.failed} ignoradas por regras`
                  : ""}
                {` · ${c.total} na lista`}
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
