// Assistente de geração de proposta a partir de uma cotação (mesmo padrão do
// assistente de cotação). Nada é gravado até "Criar proposta".
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import { WordEditor, type WordEditorHandle } from "@/components/word-editor-lazy";
import { sanitizeHtml } from "@/components/rich-html-editor";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { formatCurrency } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { createProposal, listClauses, updateProposal } from "@/lib/proposals.functions";
import { supabase } from "@/integrations/supabase/client";
import { createProposalFromQuote, getProposalDraftFromQuote } from "@/lib/sales-flow.functions";

const STEPS = [
  { key: "basics", label: "Identificação" },
  { key: "items", label: "Itens e valores" },
  { key: "content", label: "Conteúdo" },
  { key: "review", label: "Revisão" },
] as const;

const NONE = "__none__";

export type ProposalSource = { quoteId: string } | { dealId: string } | { proposalId: string };

type Draft = {
  title: string;
  body: string;
  total_amount: number | null;
  currency: string;
  expires_at: string | null;
  assigned_to: string | null;
  quote_number: string | null;
  service_line: string | null;
  items: Array<{ id: string; name: string; billing: string }>;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
};
type Loaded = { reused: true; existingId: string } | { reused: false; draft: Draft };

type Props = {
  source: ProposalSource | null;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando a proposta for criada (ou já existir). */
  onDone?: (proposalId: string) => void;
};

export function ProposalWizard({ source, onOpenChange, onDone }: Props) {
  const open = !!source;
  const quoteId = source && "quoteId" in source ? source.quoteId : null;
  const editId = source && "proposalId" in source ? source.proposalId : null;
  const blankDealId = source && "dealId" in source ? source.dealId : null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getDraft = useServerFn(getProposalDraftFromQuote);
  const create = useServerFn(createProposalFromQuote);
  const createBlank = useServerFn(createProposal);
  const update = useServerFn(updateProposal);
  const lcl = useServerFn(listClauses);
  const members = useWorkspaceMembers();
  const editorRef = useRef<WordEditorHandle>(null);

  const draftQ = useQuery({
    queryKey: ["proposal-draft", source],
    queryFn: async (): Promise<Loaded> => {
      if (quoteId) return (await getDraft({ data: { quoteId } })) as Loaded;
      if (editId) {
        const { data, error } = await supabase
          .from("proposals")
          .select(
            "title, body, total_amount, currency, expires_at, assigned_to, locked, company_id, contact_id, deal_id",
          )
          .eq("id", editId)
          .single();
        if (error) throw error;
        if (data.locked) throw new Error("Proposta travada: não pode ser editada.");
        return {
          reused: false,
          draft: {
            ...data,
            total_amount: data.total_amount != null ? Number(data.total_amount) : null,
            quote_number: null,
            service_line: null,
            items: [],
          },
        };
      }
      const { data: deal, error } = await supabase
        .from("deals")
        .select("name, value, currency, assigned_to, company_id, primary_contact_id")
        .eq("id", blankDealId!)
        .single();
      if (error) throw error;
      return {
        reused: false,
        draft: {
          title: `Proposta — ${deal.name}`,
          body: "<h1>Proposta</h1><h2>Escopo</h2><p></p><h2>Condições comerciais</h2><p></p>",
          total_amount: deal.value != null ? Number(deal.value) : null,
          currency: deal.currency ?? "BRL",
          expires_at: null,
          assigned_to: deal.assigned_to,
          quote_number: null,
          service_line: null,
          items: [],
          company_id: deal.company_id,
          contact_id: deal.primary_contact_id,
          deal_id: blankDealId,
        },
      };
    },
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });
  const clausesQ = useQuery({
    queryKey: ["clauses"],
    queryFn: () => lcl(),
    enabled: open,
  });

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const res = draftQ.data;
  const draft: Draft | null = res && !res.reused ? res.draft : null;

  // Cotação que já tem proposta: vai direto para a existente.
  useEffect(() => {
    if (res?.reused && res.existingId) {
      toast.info("Esta cotação já tem proposta.");
      onOpenChange(false);
      onDone?.(res.existingId);
      void navigate({ to: "/proposals/$id", params: { id: res.existingId } });
    }
  }, [res, navigate, onOpenChange, onDone]);

  useEffect(() => {
    if (draft) {
      setStep(0);
      setTitle(draft.title);
      setBody(draft.body);
      setAmount(draft.total_amount);
      setExpires(draft.expires_at ? draft.expires_at.slice(0, 10) : null);
      setAssignee(draft.assigned_to);
    }
  }, [draft]);

  const currency = draft?.currency ?? "BRL";
  const titleOk = title.trim().length > 0;

  async function submit() {
    if (!source) return;
    setSaving(true);
    try {
      if (editId) {
        await update({
          data: {
            id: editId,
            patch: { title: title.trim(), body, total_amount: amount, expires_at: expires },
          },
        });
        await supabase.from("proposals").update({ assigned_to: assignee }).eq("id", editId);
        toast.success("Proposta atualizada.");
        void qc.invalidateQueries({ queryKey: ["deal-proposals"] });
        void qc.invalidateQueries({ queryKey: ["proposal", editId] });
        onOpenChange(false);
        onDone?.(editId);
        return;
      }
      if (blankDealId && draft) {
        const row = await createBlank({
          data: {
            title: title.trim(),
            body,
            dealId: blankDealId,
            companyId: draft.company_id,
            contactId: draft.contact_id,
            totalAmount: amount,
            currency: draft.currency,
            expiresAt: expires,
          },
        });
        if (assignee)
          await supabase.from("proposals").update({ assigned_to: assignee }).eq("id", row.id);
        toast.success("Proposta criada.");
        void qc.invalidateQueries({ queryKey: ["deal-proposals"] });
        onOpenChange(false);
        onDone?.(row.id);
        void navigate({ to: "/proposals/$id", params: { id: row.id } });
        return;
      }
      if (!quoteId) return;
      const r = await create({
        data: {
          quoteId,
          title: title.trim(),
          body,
          total_amount: amount,
          expires_at: expires,
          assigned_to: assignee,
        },
      });
      toast.success(r.reused ? "Esta cotação já tem proposta." : "Proposta criada.");
      void qc.invalidateQueries({ queryKey: ["deal-proposals"] });
      onOpenChange(false);
      onDone?.(r.id);
      void navigate({ to: "/proposals/$id", params: { id: r.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const memberName = (id: string | null) => (id ? members.nameFor(id) : "Sem responsável");

  return (
    <Dialog open={open} onOpenChange={(v) => (saving ? undefined : onOpenChange(v))}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editId ? "Editar proposta" : "Nova proposta"}
            {draft?.quote_number ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                a partir da cotação {draft.quote_number}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {editId
              ? "Revise cada passo. As alterações só são gravadas no último passo."
              : "Revise cada passo. A proposta só é criada no último passo."}
          </DialogDescription>
        </DialogHeader>

        <ol className="mb-2 grid grid-cols-4 gap-2" aria-label="Etapas">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s.key} aria-current={active ? "step" : undefined}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                    active && "border-primary bg-primary/5 text-primary",
                    done && "border-primary/40 text-foreground",
                    !active && !done && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                      (active || done) && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="truncate">{s.label}</span>
                </div>
              </li>
            );
          })}
        </ol>

        {draftQ.isLoading || (res?.reused ?? false) ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-9 animate-pulse rounded-md bg-muted" />
            <div className="h-9 animate-pulse rounded-md bg-muted" />
            <div className="h-32 animate-pulse rounded-md bg-muted" />
          </div>
        ) : draftQ.isError ? (
          <div className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
            <p className="text-destructive">
              {(draftQ.error as Error)?.message || "Não foi possível carregar os dados."}
            </p>
            <Button size="sm" variant="outline" onClick={() => void draftQ.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : draft ? (
          <>
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pw-title">Título *</Label>
                  <Input id="pw-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  {!titleOk && <p className="text-xs text-destructive">Informe o título.</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pw-assignee">Responsável</Label>
                    <Select
                      value={assignee ?? NONE}
                      onValueChange={(v) => setAssignee(v === NONE ? null : v)}
                    >
                      <SelectTrigger id="pw-assignee">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem responsável</SelectItem>
                        {(members.data ?? []).map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.full_name || m.user_id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Validade</Label>
                    <DatePicker
                      value={expires ? parseISO(expires) : undefined}
                      onChange={(d) => setExpires(format(d, "yyyy-MM-dd"))}
                      onClear={() => setExpires(null)}
                      placeholder="Sem validade"
                      ariaLabel="Validade da proposta"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Empresa, contato e negócio vêm {quoteId ? "da cotação" : "do negócio"}
                  {draft.service_line ? ` · Tipo de serviço: ${draft.service_line}` : ""}.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                {draft.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {quoteId ? "A cotação não tem itens." : "Sem itens de cotação nesta proposta."}
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {draft.items.map((it) => (
                      <li key={it.id} className="p-2">
                        <div className="text-sm font-medium">{it.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {it.billing}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {quoteId && (
                  <p className="text-xs text-muted-foreground">
                    Para mudar os itens, edite a cotação.
                  </p>
                )}
                <div className="space-y-1.5 sm:max-w-xs">
                  <Label htmlFor="pw-amount">Valor total da proposta</Label>
                  <CurrencyInput
                    id="pw-amount"
                    value={amount}
                    onValueChange={setAmount}
                    currency={currency}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 md:grid-cols-[1fr_200px]">
                <WordEditor ref={editorRef} value={body} onChange={setBody} minHeight={320} />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Cláusulas prontas</p>
                  {clausesQ.isLoading && <div className="h-8 animate-pulse rounded-md bg-muted" />}
                  {!clausesQ.isLoading && (clausesQ.data ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma cláusula cadastrada.</p>
                  )}
                  {(clausesQ.data ?? []).map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start truncate"
                      onClick={() => {
                        const html = `<hr/>${c.body}`;
                        if (editorRef.current) editorRef.current.insertHtml(html);
                        else setBody((b) => b + html);
                      }}
                    >
                      {c.title}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3 text-sm">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Título</dt>
                    <dd className="font-medium">{title}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Responsável</dt>
                    <dd>{memberName(assignee)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor total</dt>
                    <dd className="tabular-nums">
                      {amount != null ? formatCurrency(amount, currency) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Validade</dt>
                    <dd>{expires ? format(parseISO(expires), "dd/MM/yyyy") : "Sem validade"}</dd>
                  </div>
                </dl>
                <div
                  className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
                />
              </div>
            )}
          </>
        ) : null}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
          </div>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!draft || !titleOk}>
              Avançar <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => void submit()} disabled={saving || !titleOk}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editId ? "Salvar proposta" : "Criar proposta"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
