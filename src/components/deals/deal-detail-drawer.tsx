import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { useRelatedIds } from "@/hooks/use-related-ids";
import { usePipelines } from "@/lib/pipelines";


import { formatCurrency } from "@/lib/crm";
import type { Deal, Company, Contact } from "@/lib/db-types";
import type { Pipeline } from "@/lib/pipelines";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { DealLineItems } from "@/components/deals/deal-line-items";
import { DealQuotes } from "@/components/deals/deal-quotes";
import { toast } from "sonner";
import { Database, Trash2, Package, FileText } from "lucide-react";
import { LostReasonDialog, type LostReasonResult } from "@/components/deals/lost-reason-dialog";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const LEGACY_ENUM = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

export function DealDetailDrawer({
  open,
  onOpenChange,
  deal,
  pipeline,
  companies,
  contacts,
  ownerId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  deal: Deal | null;
  pipeline: Pipeline | null;
  companies: Pick<Company, "id" | "name">[];
  contacts: Pick<Contact, "id" | "first_name" | "last_name">[];
  ownerId?: string;
}) {
  const qc = useQueryClient();
  const isNew = !deal;
  const [v, setV] = useState<Record<string, unknown>>({});
  const [showHs, setShowHs] = useState(false);
  const { pipelines } = usePipelines("deal");

  const activePipeline: Pipeline | null =
    pipelines.find((p) => p.id === (v.pipeline_id as string)) ?? pipeline ?? null;

  useEffect(() => {
    setV(
      deal ?? {
        stage: pipeline?.stages[0]?.value ?? "new",
        stage_id: pipeline?.stages[0]?.value ?? "new",
        value: 0,
        currency: "BRL",
        pipeline_id: pipeline?.id ?? null,
      },
    );
  }, [deal, pipeline]);

  const changePipeline = (val: string) => {
    const next = pipelines.find((p) => p.id === val);
    const firstStage = next?.stages[0]?.value ?? "new";
    setV((s) => ({
      ...s,
      pipeline_id: val,
      stage_id: firstStage,
      stage: firstStage,
    }));
  };

  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));

  const currentStageValue = String(v.stage_id ?? v.stage ?? "");


  const [lostOpen, setLostOpen] = useState(false);

  const persist = async (extra?: Record<string, unknown>) => {
    if (!ownerId) return;
    const stageKey = String(v.stage_id ?? v.stage ?? activePipeline?.stages[0]?.value ?? "new");
    const payload: Record<string, unknown> = {
      owner_id: ownerId,
      name: String(v.name ?? ""),
      value: Number(v.value || 0),
      currency: String(v.currency || "BRL"),
      stage_id: stageKey,
      pipeline_id: activePipeline?.id ?? pipeline?.id ?? null,
      company_id: (v.company_id as string) || null,
      primary_contact_id: (v.primary_contact_id as string) || null,
      expected_close_date: (v.expected_close_date as string) || null,

      notes: (v.notes as string) || null,
      description: (v.description as string) || null,
      hs_priority: (v.hs_priority as string) || null,
      ...(extra ?? {}),
    };
    const stageType = activePipeline?.stages.find((s) => s.value === stageKey)?.type;
    if (LEGACY_ENUM.includes(stageKey)) payload.stage = stageKey;
    else if (stageType === "lost") payload.stage = "lost";
    else if (stageType === "won") payload.stage = "won";
    else payload.stage = "new";

    if (!payload.name) {
      toast.error("Nome obrigatório");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = deal
      ? await sb.from("deals").update(payload).eq("id", deal.id)
      : await sb.from("deals").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["deals"] });
    onOpenChange(false);
  };

  const save = async () => {
    const stageKey = String(v.stage_id ?? v.stage ?? activePipeline?.stages[0]?.value ?? "new");
    const stageType = activePipeline?.stages.find((s) => s.value === stageKey)?.type;
    const becameLost =
      (stageType === "lost" || stageKey === "lost") &&
      deal?.stage !== "lost" &&
      !(v.closed_lost_reason as string | null);
    if (becameLost) {
      setLostOpen(true);
      return;
    }
    await persist();
  };

  const confirmLost = async (result: LostReasonResult) => {
    const notes = result.notes ? `${result.reasonLabel} — ${result.notes}` : result.reasonLabel;
    await persist({ closed_lost_reason: notes });
  };

  const { can } = usePermissions();
  const { user } = useAuth();
  const dealOwnerId = (deal as unknown as { owner_id?: string | null } | null)?.owner_id ?? null;
  const canDelete =
    !!deal &&
    (can("techsales.deals.delete.workspace") ||
      can("techsales.deals.delete.team") ||
      (can("techsales.deals.delete.own") && !!user?.id && dealOwnerId === user.id));

  const remove = async () => {
    if (!deal) return;
    if (!canDelete) {
      toast.error("Você não tem permissão para excluir este negócio.");
      return;
    }
    if (!confirm("Excluir este negócio?")) return;
    const id = deal.id;
    // Optimistic: remover de todas as queries de deals em cache imediatamente
    const snapshots = qc.getQueriesData<Deal[]>({ queryKey: ["deals"] });
    for (const [key, data] of snapshots) {
      if (Array.isArray(data)) {
        qc.setQueryData<Deal[]>(key, data.filter((d) => d.id !== id));
      }
    }
    onOpenChange(false);
    const { data: deleted, error } = await supabase
      .from("deals")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      for (const [key, data] of snapshots) qc.setQueryData(key, data);
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["deals"] });
      return;
    }
    if (!deleted || deleted.length === 0) {
      // RLS bloqueou silenciosamente (0 linhas afetadas)
      for (const [key, data] of snapshots) qc.setQueryData(key, data);
      toast.error("Você não tem permissão para excluir este negócio.");
      qc.invalidateQueries({ queryKey: ["deals"] });
      return;
    }
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["deals"] });
  };

  const currentStage = activePipeline?.stages.find((s) => s.value === currentStageValue);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hsRaw = (deal as any)?.hs_raw as { properties?: Record<string, unknown> } | undefined;
  const knownKeys = new Set([
    "name",
    "amount",
    "dealstage",
    "pipeline",
    "closedate",
    "dealtype",
    "description",
    "hs_priority",
    "hubspot_owner_id",
    "hs_object_id",
    "createdate",
    "hs_lastmodifieddate",
  ]);
  const hsExtras = hsRaw?.properties
    ? Object.entries(hsRaw.properties).filter(
        ([k, val]) => !knownKeys.has(k) && val !== null && val !== "",
      )
    : [];

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={
          isNew
            ? "!top-[50%] !left-[50%] !right-auto !bottom-auto !translate-x-[-50%] !translate-y-[-50%] !h-auto !max-h-[90vh] !w-[min(640px,95vw)] !max-w-[640px] !border !rounded-lg !p-0 flex flex-col overflow-y-auto data-[state=closed]:!slide-out-to-right-0 data-[state=open]:!slide-in-from-right-0"
            : "w-full sm:max-w-[560px] p-0 flex flex-col"
        }
      >


        <SheetHeader className="px-5 pt-5 pb-3 border-b sticky top-0 bg-background z-10">
          <SheetTitle className="text-lg">{isNew ? "Novo negócio" : deal?.name}</SheetTitle>
          {!isNew && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xl font-semibold tabular-nums">
                {formatCurrency(Number(v.value ?? 0), String(v.currency ?? "BRL"))}
              </span>
              {currentStage && (
                <Badge
                  variant="secondary"
                  className="gap-1.5"
                  style={{
                    background: `color-mix(in oklab, ${currentStage.color} 20%, transparent)`,
                  }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: currentStage.color }}
                  />
                  {currentStage.label}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-5 mt-3 self-start">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            {!isNew && (
              <TabsTrigger value="items">
                <Package className="h-3.5 w-3.5 mr-1" />
                Itens
              </TabsTrigger>
            )}
            {!isNew && (
              <TabsTrigger value="quotes">
                <FileText className="h-3.5 w-3.5 mr-1" />
                Cotações
              </TabsTrigger>
            )}
            {!isNew && <TabsTrigger value="activity">Atividades</TabsTrigger>}
            {!isNew && hsExtras.length > 0 && (
              <TabsTrigger value="hs">
                <Database className="h-3.5 w-3.5 mr-1" /> HubSpot
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <TabsContent value="overview" className="mt-0 space-y-3">
              <Field label="Nome *">
                <Input value={String(v.name ?? "")} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Valor">
                  <CurrencyInput
                    currency={String(v.currency ?? "BRL")}
                    value={v.value as number | null | undefined}
                    onValueChange={(n) => set("value", n ?? "")}
                  />
                </Field>
                <Field label="Moeda">
                  <Input
                    value={String(v.currency ?? "BRL")}
                    onChange={(e) => set("currency", e.target.value)}
                  />
                </Field>
              </div>
              {pipelines.length > 0 && (
                <Field label="Funil">
                  <Select
                    value={String(v.pipeline_id ?? activePipeline?.id ?? "")}
                    onValueChange={changePipeline}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Estágio">
                <Select
                  value={currentStageValue}
                  onValueChange={(val) => {
                    set("stage_id", val);
                    set("stage", val);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(activePipeline?.stages ?? []).map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                        {typeof s.probability === "number" ? ` · ${s.probability}%` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <DealRelatedFields v={v} set={set} />

              <div className="grid grid-cols-2 gap-2">
                <Field label="Data prevista">
                  <Input
                    type="date"
                    value={String(v.expected_close_date ?? "").slice(0, 10)}
                    onChange={(e) => set("expected_close_date", e.target.value)}
                  />
                </Field>
                <Field label="Prioridade">
                  <Select
                    value={String(v.hs_priority ?? "none")}
                    onValueChange={(val) => set("hs_priority", val === "none" ? null : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Descrição">
                <RichHtmlEditor
                  value={String(v.description ?? "")}
                  onChange={(html) => set("description", html)}
                  minHeight={100}
                />
              </Field>
              <Field label="Notas">
                <RichHtmlEditor
                  value={String(v.notes ?? "")}
                  onChange={(html) => set("notes", html)}
                  minHeight={140}
                />
              </Field>
            </TabsContent>

            {!isNew && (
              <TabsContent value="items" className="mt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  Itens deste negócio. O valor total recalcula o campo "Valor" automaticamente.
                </p>
                <DealLineItems
                  dealId={deal!.id}
                  ownerId={ownerId!}
                  currency={String(v.currency ?? "BRL")}
                />
              </TabsContent>
            )}

            {!isNew && (
              <TabsContent value="quotes" className="mt-0">
                <DealQuotes dealId={deal!.id} />
              </TabsContent>
            )}

            {!isNew && (
              <TabsContent value="activity" className="mt-0 space-y-4">
                <AiSummaryPanel entity="deal" entityId={deal!.id} />
                <ActivityTimeline relatedKey="related_deal_id" relatedId={deal!.id} />
              </TabsContent>
            )}

            {!isNew && hsExtras.length > 0 && (
              <TabsContent value="hs" className="mt-0 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Propriedades adicionais sincronizadas do HubSpot (somente leitura).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {hsExtras.map(([k, val]) => (
                    <div key={k} className="rounded border bg-muted/30 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {k}
                      </div>
                      <div className="text-sm truncate" title={String(val)}>
                        {String(val)}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHs(!showHs)}
                  className="text-xs"
                >
                  {showHs ? "Esconder" : "Mostrar"} raw JSON
                </Button>
                {showHs && (
                  <pre className="text-[10px] bg-muted p-2 rounded overflow-auto max-h-64">
                    {JSON.stringify(hsRaw, null, 2)}
                  </pre>
                )}
              </TabsContent>
            )}
          </div>
        </Tabs>

        <div className="border-t px-5 py-3 flex items-center justify-between bg-background">
          {!isNew ? (
            <Button variant="ghost" size="sm" onClick={remove}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    <LostReasonDialog
      open={lostOpen}
      onOpenChange={setLostOpen}
      dealName={(v.name as string) ?? deal?.name ?? null}
      onConfirm={confirmLost}
    />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function DealRelatedFields({
  v,
  set,
}: {
  v: Record<string, unknown>;
  set: (k: string, val: unknown) => void;
}) {
  const companyId = (v.company_id as string) || null;
  const contactId = (v.primary_contact_id as string) || null;
  const related = useRelatedIds({ companyId, contactId });
  return (
    <>
      <Field label="Empresa">
        <EntityCombobox
          entity="companies"
          select="id,name"
          searchColumn="name"
          searchColumns={["name", "domain"]}
          labelFrom={(r) => String((r as { name?: string }).name ?? "")}
          value={companyId}
          onChange={(id) => set("company_id", id)}
          placeholder="Selecionar empresa…"
          priorityIds={related.companies.filter((id) => id !== companyId)}
        />
      </Field>
      <Field label="Contato principal">
        <EntityCombobox
          entity="contacts"
          select="id,first_name,last_name,email"
          searchColumn="first_name"
          searchColumns={["first_name", "last_name", "email", "phone"]}
          labelFrom={(r) => {
            const row = r as { first_name?: string; last_name?: string; email?: string };
            return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.email || "—";
          }}
          hintFrom={(r) => (r as { email?: string | null }).email ?? null}
          value={contactId}
          onChange={(id) => set("primary_contact_id", id)}
          placeholder="Selecionar contato…"
          priorityIds={related.contacts.filter((id) => id !== contactId)}
        />
      </Field>
    </>
  );
}
