import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { QuickCreateCompanyDialog } from "@/components/record/quick-create-dialogs";
import { useRelatedIds } from "@/hooks/use-related-ids";
import { usePipelines } from "@/lib/pipelines";
import type { Lead } from "@/lib/db-types";
import { useToastCreated } from "@/lib/toast-nav";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";

export function CreateDealFromLeadDialog({
  open,
  onOpenChange,
  lead,
  onCreated,
  onSaved,
  initialDescription,
  initialPipelineId,
  initialStageValue,
  initialExpectedClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead;
  onCreated?: (dealId: string) => void;
  onSaved?: (r: { id: string; action: "created" }) => void;
  initialDescription?: string;
  /** Pré-preenchimentos (usados quando o modal é aberto por workflow). */
  initialPipelineId?: string | null;
  initialStageValue?: string | null;
  initialExpectedClose?: string | null;
}) {
  const { user } = useAuth();
  const toastCreated = useToastCreated();
  const { pipelines } = usePipelines("deal");
  const defaultPipeline = useMemo(
    () => pipelines.find((p) => p.is_default) ?? pipelines[0] ?? null,
    [pipelines],
  );

  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [name, setName] = useState("");
  const [value, setValue] = useState<string>("");
  const [currency, setCurrency] = useState("BRL");
  const [expectedClose, setExpectedClose] = useState<string>("");
  const [description, setDescription] = useState(initialDescription ?? "");

  // company / contact
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");

  const [contactId, setContactId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [pendingCompanyName, setPendingCompanyName] = useState("");

  const pipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? defaultPipeline ?? null,
    [pipelines, pipelineId, defaultPipeline],
  );

  // initialize defaults when opening / lead changes
  useEffect(() => {
    if (!open) return;
    const p =
      (initialPipelineId ? pipelines.find((x) => x.id === initialPipelineId) : null) ??
      defaultPipeline ??
      pipelines[0] ??
      null;
    setPipelineId(p?.id ?? "");
    const preferred = initialStageValue
      ? p?.stages.find((s) => s.value === initialStageValue)
      : undefined;
    const qualifiedStage =
      preferred ?? p?.stages.find((s) => s.value === "qualified") ?? p?.stages[0] ?? null;
    setStageId(qualifiedStage?.value ?? "");
    const fullName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
    setName(fullName ? `Negócio - ${fullName}` : "Novo negócio");
    setValue("");
    setCurrency("BRL");
    setExpectedClose(initialExpectedClose ?? "");
    setDescription(initialDescription ?? "");
    setCompanyId(lead.company_id ?? null);
    setCompanyName(lead.company_name ?? "");
    setContactId(
      (lead as unknown as { converted_contact_id?: string | null }).converted_contact_id ?? null,
    );

    // Tenta localizar contato existente pelo e-mail/telefone do lead e pré-selecioná-lo,
    // assim como já fazemos com a empresa.
    const knownContactId =
      (lead as unknown as { converted_contact_id?: string | null }).converted_contact_id ?? null;
    if (knownContactId && lead.company_id) return;
    const email = (lead.email ?? "").trim().toLowerCase();
    const phone = (lead.phone ?? "").trim();
    if (!email && !phone) return;
    let cancelled = false;
    (async () => {
      let query = supabase
        .from("contacts")
        .select("id, company_id, company_name, companies(id, name)")
        .eq("workspace_id", lead.workspace_id)
        .limit(1);
      if (email) {
        query = query.ilike("email", email);
      } else {
        query = query.eq("phone", phone);
      }
      const { data } = await query.maybeSingle();
      if (cancelled || !data) return;
      const row = data as {
        id: string;
        company_id: string | null;
        company_name: string | null;
        companies: { id: string; name: string } | null;
      };
      if (!knownContactId) setContactId(row.id);
      if (lead.company_id) {
        // Empresa do lead tem prioridade.
      } else if (row.companies?.id) {
        setCompanyId(row.companies.id);
        setCompanyName(row.companies.name);
      } else if (row.company_name) {
        setCompanyName(row.company_name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    lead,
    defaultPipeline,
    pipelines,
    initialDescription,
    initialPipelineId,
    initialStageValue,
    initialExpectedClose,
  ]);

  // ensure stage matches selected pipeline
  useEffect(() => {
    if (!pipeline) return;
    if (!pipeline.stages.some((s) => s.value === stageId)) {
      const q = pipeline.stages.find((s) => s.value === "qualified") ?? pipeline.stages[0];
      setStageId(q?.value ?? "");
    }
  }, [pipeline, stageId]);

  // Prioriza registros já associados ao contato/empresa selecionado.
  const related = useRelatedIds({ companyId, contactId });

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Informe o nome do negócio");
      return;
    }
    if (!pipeline || !stageId) {
      toast.error("Selecione pipeline e estágio");
      return;
    }

    setSaving(true);
    try {
      // resolve company: usa id selecionado, ou cria a partir do nome do lead
      let resolvedCompanyId: string | null = companyId;
      const cName = companyName.trim();
      if (!resolvedCompanyId && cName) {
        const { data: existing } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", user.id)
          .eq("workspace_id", lead.workspace_id)
          .ilike("name", cName)
          .maybeSingle();
        if (existing?.id) {
          resolvedCompanyId = existing.id;
        } else {
          const { data: c, error } = await supabase
            .from("companies")
            .insert({ owner_id: user.id, workspace_id: lead.workspace_id, name: cName })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          resolvedCompanyId = c?.id ?? null;
        }
      }

      // resolve contact: usa id selecionado, ou cria a partir do lead
      let resolvedContactId: string | null = contactId;
      if (!resolvedContactId) {
        const { data: ct, error } = await supabase
          .from("contacts")
          .insert({
            owner_id: user.id,
            workspace_id: lead.workspace_id,
            first_name: lead.first_name,
            last_name: lead.last_name,
            email: lead.email,
            phone: lead.phone,
            company_id: resolvedCompanyId,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        resolvedContactId = ct?.id ?? null;
      }

      const numericValue = value ? Number(value) : 0;
      const stageEntry = pipeline.stages.find((s) => s.value === stageId);
      const legacyStage: "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost" =
        stageEntry?.type === "won" ? "won" : stageEntry?.type === "lost" ? "lost" : "qualified";
      const { data: deal, error: de } = await supabase
        .from("deals")
        .insert({
          owner_id: user.id,
          workspace_id: lead.workspace_id,
          name: name.trim(),
          stage: legacyStage as never,
          stage_id: stageId,
          pipeline_id: pipeline.id,
          company_id: resolvedCompanyId,
          primary_contact_id: resolvedContactId,
          value: Number.isFinite(numericValue) ? numericValue : 0,
          currency,
          expected_close_date: expectedClose || null,
          description: description || null,
        })
        .select("id")
        .single();
      if (de) throw new Error(de.message);

      // Associa o contato ao negócio (aba "Contatos"/associações do negócio).
      if (resolvedContactId) {
        const { error: dcErr } = await supabase
          .from("deal_contacts")
          .insert({ deal_id: deal!.id, contact_id: resolvedContactId });
        if (dcErr && !/duplicate key/i.test(dcErr.message)) {
          toast.error(`Negócio criado, mas o contato não foi associado: ${dcErr.message}`);
        }
      }

      // mark lead qualified (e vincula a empresa resolvida quando o lead ainda não tem)
      const { data: leadAffected } = await supabase
        .from("leads")
        .update({
          status: "qualified",
          converted_at: new Date().toISOString(),
          converted_contact_id: resolvedContactId,
          converted_deal_id: deal!.id,
          ...(resolvedCompanyId && !lead.company_id ? { company_id: resolvedCompanyId } : {}),
        })
        .eq("id", lead.id)
        .select("id");
      // Negócio já criado: se o RLS bloqueou a atualização do lead, avisa sem
      // reverter a criação.
      deniedIfUnaffected(leadAffected, "atualizar o lead");

      toastCreated("Negócio criado e lead qualificado", "Ir para o negócio", (nav) =>
        nav({ to: "/deals/$id", params: { id: deal!.id } }),
      );
      onCreated?.(deal!.id);
      onSaved?.({ id: deal!.id, action: "created" });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar negócio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar negócio</DialogTitle>
            <DialogDescription>
              O lead será marcado como qualificado após a criação do negócio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Pipeline</Label>
              <Select value={pipelineId} onValueChange={setPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estágio</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(pipeline?.stages ?? []).map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label>Nome do negócio</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label>Empresa</Label>
              <EntityCombobox
                entity="companies"
                select="id,name"
                searchColumns={["name", "domain"]}
                labelFrom={(r) => String((r as { name?: string }).name ?? "")}
                value={companyId}
                onChange={(id, item) => {
                  setCompanyId(id);
                  setCompanyName(item?.label ?? "");
                }}
                placeholder={companyName || "Selecionar empresa…"}
                priorityIds={related.companies.filter((id) => id !== companyId)}
                onCreateNew={(name) => {
                  setPendingCompanyName(name);
                  setCreateCompanyOpen(true);
                }}
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label>Contato</Label>
              <EntityCombobox
                entity="contacts"
                select="id,first_name,last_name,email"
                searchColumn="first_name"
                searchColumns={["first_name", "last_name", "email", "phone"]}
                labelFrom={(r) => {
                  const row = r as { first_name?: string; last_name?: string; email?: string };
                  return (
                    `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.email || "—"
                  );
                }}
                hintFrom={(r) => (r as { email?: string | null }).email ?? null}
                value={contactId}
                onChange={(id) => setContactId(id)}
                placeholder="Selecionar contato (vazio cria a partir do lead)"
                priorityIds={related.contacts.filter((id) => id !== contactId)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyInput
                currency={currency}
                value={value === "" ? null : Number(value)}
                onValueChange={(n) => setValue(n === null ? "" : String(n))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Moeda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label>Previsão de fechamento</Label>
              <Input
                type="date"
                value={expectedClose}
                onChange={(e) => setExpectedClose(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label>Descrição</Label>
              <RichHtmlEditor value={description} onChange={setDescription} minHeight={140} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving || !name.trim() || !pipelineId || !stageId}>
              {saving ? "Criando…" : "Criar negócio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuickCreateCompanyDialog
        open={createCompanyOpen}
        onOpenChange={setCreateCompanyOpen}
        initialName={pendingCompanyName}
        onCreated={(id) => {
          setCompanyId(id);
          setCompanyName(pendingCompanyName);
        }}
      />
    </>
  );
}
