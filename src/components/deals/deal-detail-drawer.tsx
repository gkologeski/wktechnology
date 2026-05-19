import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/crm";
import type { Deal, Company, Contact } from "@/lib/db-types";
import type { Pipeline } from "@/lib/pipelines";
import { ActivityTimeline } from "@/components/activity-timeline";
import { DealLineItems } from "@/components/deals/deal-line-items";
import { toast } from "sonner";
import { Database, Trash2, Package } from "lucide-react";

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

  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));

  const currentStageValue = String(v.stage_id ?? v.stage ?? "");

  const save = async () => {
    if (!ownerId) return;
    const stageKey = String(v.stage_id ?? v.stage ?? pipeline?.stages[0]?.value ?? "new");
    const payload: Record<string, unknown> = {
      owner_id: ownerId,
      name: String(v.name ?? ""),
      value: Number(v.value || 0),
      currency: String(v.currency || "BRL"),
      stage_id: stageKey,
      pipeline_id: pipeline?.id ?? null,
      company_id: (v.company_id as string) || null,
      primary_contact_id: (v.primary_contact_id as string) || null,
      expected_close_date: (v.expected_close_date as string) || null,
      notes: (v.notes as string) || null,
      description: (v.description as string) || null,
      hs_priority: (v.hs_priority as string) || null,
    };
    if (LEGACY_ENUM.includes(stageKey)) payload.stage = stageKey;
    else payload.stage = "new";

    if (!payload.name) return toast.error("Nome obrigatório");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = deal
      ? await sb.from("deals").update(payload).eq("id", deal.id)
      : await sb.from("deals").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["deals"] });
    onOpenChange(false);
  };

  const remove = async () => {
    if (!deal) return;
    if (!confirm("Excluir este negócio?")) return;
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["deals"] });
    onOpenChange(false);
  };

  const currentStage = pipeline?.stages.find((s) => s.value === currentStageValue);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hsRaw = (deal as any)?.hs_raw as { properties?: Record<string, unknown> } | undefined;
  const knownKeys = new Set([
    "name", "amount", "dealstage", "pipeline", "closedate", "dealtype", "description", "hs_priority",
    "hubspot_owner_id", "hs_object_id", "createdate", "hs_lastmodifieddate",
  ]);
  const hsExtras = hsRaw?.properties
    ? Object.entries(hsRaw.properties).filter(([k, val]) => !knownKeys.has(k) && val !== null && val !== "")
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[560px] p-0 flex flex-col">
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
                  style={{ background: `color-mix(in oklab, ${currentStage.color} 20%, transparent)` }}
                >
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: currentStage.color }} />
                  {currentStage.label}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-5 mt-3 self-start">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            {!isNew && <TabsTrigger value="items"><Package className="h-3.5 w-3.5 mr-1" />Itens</TabsTrigger>}
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
                  <Input
                    type="number"
                    step="0.01"
                    value={String(v.value ?? "")}
                    onChange={(e) => set("value", e.target.value)}
                  />
                </Field>
                <Field label="Moeda">
                  <Input value={String(v.currency ?? "BRL")} onChange={(e) => set("currency", e.target.value)} />
                </Field>
              </div>
              <Field label="Estágio">
                <Select
                  value={currentStageValue}
                  onValueChange={(val) => {
                    set("stage_id", val);
                    set("stage", val);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(pipeline?.stages ?? []).map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                        {typeof s.probability === "number" ? ` · ${s.probability}%` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Empresa">
                <Select
                  value={String(v.company_id ?? "none")}
                  onValueChange={(val) => set("company_id", val === "none" ? null : val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Contato principal">
                <Select
                  value={String(v.primary_contact_id ?? "none")}
                  onValueChange={(val) => set("primary_contact_id", val === "none" ? null : val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name ?? ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
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
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
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
                <Textarea
                  rows={2}
                  value={String(v.description ?? "")}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <Field label="Notas">
                <Textarea
                  rows={3}
                  value={String(v.notes ?? "")}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </TabsContent>

            {!isNew && (
              <TabsContent value="activity" className="mt-0">
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
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
                      <div className="text-sm truncate" title={String(val)}>{String(val)}</div>
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
