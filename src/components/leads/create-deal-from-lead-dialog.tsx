import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { usePipelines } from "@/lib/pipelines";
import type { Lead } from "@/lib/db-types";

type Match = { id: string; name: string };

export function CreateDealFromLeadDialog({
  open,
  onOpenChange,
  lead,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead;
  onCreated?: (dealId: string) => void;
}) {
  const { user } = useAuth();
  const { pipelines, selected: defaultPipeline } = usePipelines("deal");

  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [name, setName] = useState("");
  const [value, setValue] = useState<string>("");
  const [currency, setCurrency] = useState("BRL");
  const [expectedClose, setExpectedClose] = useState<string>("");
  const [description, setDescription] = useState("");

  // company / contact
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyMatches, setCompanyMatches] = useState<Match[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Match | null>(null);

  const [contactQuery, setContactQuery] = useState("");
  const [contactMatches, setContactMatches] = useState<Match[]>([]);
  const [selectedContact, setSelectedContact] = useState<Match | null>(null);

  const [saving, setSaving] = useState(false);

  const pipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? defaultPipeline ?? null,
    [pipelines, pipelineId, defaultPipeline],
  );

  // initialize defaults when opening / lead changes
  useEffect(() => {
    if (!open) return;
    const p = defaultPipeline ?? pipelines[0] ?? null;
    setPipelineId(p?.id ?? "");
    const qualifiedStage =
      p?.stages.find((s) => s.value === "qualified") ?? p?.stages[0] ?? null;
    setStageId(qualifiedStage?.value ?? "");
    const fullName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
    setName(fullName ? `Negócio - ${fullName}` : "Novo negócio");
    setValue("");
    setCurrency("BRL");
    setExpectedClose("");
    setDescription("");
    setCompanyQuery(lead.company_name ?? "");
    setSelectedCompany(null);
    setContactQuery(fullName);
    setSelectedContact(null);
  }, [open, lead, defaultPipeline, pipelines]);

  // ensure stage matches selected pipeline
  useEffect(() => {
    if (!pipeline) return;
    if (!pipeline.stages.some((s) => s.value === stageId)) {
      const q = pipeline.stages.find((s) => s.value === "qualified") ?? pipeline.stages[0];
      setStageId(q?.value ?? "");
    }
  }, [pipeline, stageId]);

  // company search
  useEffect(() => {
    const q = companyQuery.trim();
    if (q.length < 3 || (selectedCompany && selectedCompany.name === q)) {
      setCompanyMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .ilike("name", `%${q}%`)
        .order("name")
        .limit(500);
      setCompanyMatches((data ?? []) as Match[]);
    }, 250);
    return () => clearTimeout(t);
  }, [companyQuery, selectedCompany]);

  // contact search
  useEffect(() => {
    const q = contactQuery.trim();
    if (q.length < 3 || (selectedContact && selectedContact.name === q)) {
      setContactMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(500);
      const matches = (data ?? []).map((c) => ({
        id: c.id as string,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
          (c.email as string | null) || "Sem nome",
      }));
      setContactMatches(matches);
    }, 250);
    return () => clearTimeout(t);
  }, [contactQuery, selectedContact]);

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("Informe o nome do negócio"); return; }
    if (!pipeline || !stageId) { toast.error("Selecione pipeline e estágio"); return; }

    setSaving(true);
    try {
      // resolve company
      let companyId: string | null = selectedCompany?.id ?? null;
      const cName = companyQuery.trim();
      if (!companyId && cName) {
        const { data: existing } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", user.id)
          .eq("workspace_id", lead.workspace_id)
          .ilike("name", cName)
          .maybeSingle();
        if (existing?.id) {
          companyId = existing.id;
        } else {
          const { data: c, error } = await supabase
            .from("companies")
            .insert({ owner_id: user.id, workspace_id: lead.workspace_id, name: cName })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          companyId = c?.id ?? null;
        }
      }

      // resolve contact
      let contactId: string | null = selectedContact?.id ?? null;
      if (!contactId) {
        const { data: ct, error } = await supabase
          .from("contacts")
          .insert({
            owner_id: user.id,
            workspace_id: lead.workspace_id,
            first_name: lead.first_name,
            last_name: lead.last_name,
            email: lead.email,
            phone: lead.phone,
            company_id: companyId,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        contactId = ct?.id ?? null;
      }

      const numericValue = value ? Number(value) : 0;
      const stageEntry = pipeline.stages.find((s) => s.value === stageId);
      const legacyStage: "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost" =
        stageEntry?.type === "won" ? "won"
        : stageEntry?.type === "lost" ? "lost"
        : "qualified";
      const { data: deal, error: de } = await supabase
        .from("deals")
        .insert({
          owner_id: user.id,
          workspace_id: lead.workspace_id,
          name: name.trim(),
          stage: legacyStage as never,
          stage_id: stageId,
          pipeline_id: pipeline.id,
          company_id: companyId,
          primary_contact_id: contactId,
          value: Number.isFinite(numericValue) ? numericValue : 0,
          currency,
          expected_close_date: expectedClose || null,
          description: description || null,
        })
        .select("id")
        .single();
      if (de) throw new Error(de.message);

      // mark lead qualified
      await supabase
        .from("leads")
        .update({
          status: "qualified",
          converted_at: new Date().toISOString(),
          converted_contact_id: contactId,
          converted_deal_id: deal!.id,
        })
        .eq("id", lead.id);

      toast.success("Negócio criado e lead qualificado");
      onCreated?.(deal!.id);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar negócio");
    } finally {
      setSaving(false);
    }
  };

  return (
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
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estágio</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(pipeline?.stages ?? []).map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label>Nome do negócio</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5 col-span-2 relative">
            <Label>Empresa</Label>
            <Input
              value={companyQuery}
              onChange={(e) => { setCompanyQuery(e.target.value); setSelectedCompany(null); }}
              placeholder="Buscar ou criar"
            />
            {companyMatches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md">
                {companyMatches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => { setSelectedCompany(m); setCompanyQuery(m.name); setCompanyMatches([]); }}
                  >{m.name}</button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5 col-span-2 relative">
            <Label>Contato</Label>
            <Input
              value={contactQuery}
              onChange={(e) => { setContactQuery(e.target.value); setSelectedContact(null); }}
              placeholder="Buscar contato existente (vazio cria a partir do lead)"
            />
            {contactMatches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                {contactMatches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => { setSelectedContact(m); setContactQuery(m.name); setContactMatches([]); }}
                  >{m.name}</button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Valor</Label>
            <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Moeda</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label>Previsão de fechamento</Label>
            <Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Criando…" : "Criar negócio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
