// Assistente da proposta (mesmo padrão do assistente de cotação):
// Identificação -> Itens e valores -> Conteúdo (modelo de proposta) -> Revisão.
// Nada é gravado até "Criar proposta"; ao concluir, abre o documento.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
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
import { WordEditor } from "@/components/word-editor-lazy";
import { sanitizeHtml } from "@/components/rich-html-editor";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { renderQuoteTemplate } from "@/lib/quote-template-renderer";
import {
  itemsTableHtml,
  normalizeProposalTemplateHtml,
} from "@/lib/proposals/proposal-template-html";
import { createProposal, updateProposal } from "@/lib/proposals.functions";
import { createProposalFromQuote, getProposalDraft } from "@/lib/sales-flow.functions";
import type { ProposalDraft, ProposalDraftResult } from "@/lib/proposals/proposal-draft-types";

const STEPS = [
  { key: "basics", label: "Identificação" },
  { key: "items", label: "Itens e valores" },
  { key: "content", label: "Conteúdo" },
  { key: "review", label: "Revisão" },
] as const;

const NONE = "__none__";

export type ProposalSource = { quoteId: string } | { dealId: string } | { proposalId: string };

type Template = {
  id: string;
  name: string;
  description: string | null;
  html: string;
  services: string[];
};

type Props = {
  source: ProposalSource | null;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando a proposta for criada/atualizada (ou já existir). */
  onDone?: (proposalId: string) => void;
};

/** Modelo sugerido: o que cobre mais serviços do catálogo presentes nos itens. */
function suggest(templates: Template[], serviceIds: string[]): Template | null {
  let best: Template | null = null;
  let score = 0;
  for (const t of templates) {
    const s = t.services.filter((id) => serviceIds.includes(id)).length;
    if (s > score) [best, score] = [t, s];
  }
  return best;
}

export function ProposalWizard({ source, onOpenChange, onDone }: Props) {
  const open = !!source;
  const editId = source && "proposalId" in source ? source.proposalId : null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getDraft = useServerFn(getProposalDraft);
  const createFromQuote = useServerFn(createProposalFromQuote);
  const createBlank = useServerFn(createProposal);
  const update = useServerFn(updateProposal);
  const members = useWorkspaceMembers();

  const draftQ = useQuery({
    queryKey: ["proposal-draft", source],
    queryFn: () => getDraft({ data: source! }) as Promise<ProposalDraftResult>,
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });
  const templatesQ = useQuery({
    queryKey: ["proposal-templates"],
    enabled: open,
    queryFn: async (): Promise<Template[]> => {
      const [t, s] = await Promise.all([
        supabase.from("proposal_templates").select("id, name, description, html").order("name"),
        supabase.from("proposal_template_services").select("template_id, service_catalog_id"),
      ]);
      if (t.error) throw t.error;
      return (t.data ?? []).map((row) => ({
        ...row,
        services: (s.data ?? [])
          .filter((x) => x.template_id === row.id)
          .map((x) => x.service_catalog_id),
      }));
    },
  });

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const res = draftQ.data;
  const draft: ProposalDraft | null = res && !res.reused ? res.draft : null;
  const templates = templatesQ.data ?? [];
  const serviceIds = useMemo(
    () => (draft?.items ?? []).map((i) => i.service_catalog_id).filter((v): v is string => !!v),
    [draft],
  );
  const suggested = useMemo(() => suggest(templates, serviceIds), [templates, serviceIds]);

  // Cotação que já tem proposta: abre o documento existente.
  useEffect(() => {
    if (res?.reused) {
      toast.info("Esta cotação já tem proposta.");
      onOpenChange(false);
      onDone?.(res.existingId);
      void navigate({ to: "/proposals/$id", params: { id: res.existingId } });
    }
  }, [res, navigate, onOpenChange, onDone]);

  useEffect(() => {
    if (!draft) return;
    setStep(0);
    setTitle(draft.title);
    setBody(draft.body);
    setAmount(draft.total_amount);
    setExpires(draft.expires_at ? draft.expires_at.slice(0, 10) : null);
    setAssignee(draft.assigned_to);
    setTemplateId(draft.proposal_template_id);
  }, [draft]);

  const currency = draft?.currency ?? "BRL";
  const titleOk = title.trim().length > 0;

  function renderTemplate(t: Template): string {
    if (!draft) return normalizeProposalTemplateHtml(t.html);
    return renderQuoteTemplate(normalizeProposalTemplateHtml(t.html), {
      items_table: itemsTableHtml(draft.items),
      company: { name: draft.company_name ?? "" },
      contact: { name: draft.contact_name ?? "" },
      deal: { name: draft.deal_name ?? "" },
      items: draft.items,
      total: amount != null ? formatCurrency(amount, currency) : "",
      valid_until: expires ? format(parseISO(expires), "dd/MM/yyyy") : "",
    });
  }

  async function applyTemplate(t: Template) {
    if (body.trim() && templateId !== t.id) {
      const { confirmDialog } = await import("@/components/ui/confirm-dialog");
      const ok = await confirmDialog({
        title: "Trocar o conteúdo?",
        description: "O texto atual será substituído pelo do modelo escolhido.",
        confirmLabel: "Usar modelo",
      });
      if (!ok) return;
    }
    setTemplateId(t.id);
    setBody(renderTemplate(t));
  }

  function goNext() {
    // Ao entrar em Conteúdo sem texto, aplica o modelo sugerido.
    if (step === 1 && !body.trim()) {
      const t = suggested ?? templates[0];
      if (t) {
        setTemplateId(t.id);
        setBody(renderTemplate(t));
      }
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function afterSave(id: string) {
    await supabase
      .from("proposals")
      .update({ assigned_to: assignee, proposal_template_id: templateId })
      .eq("id", id);
    void qc.invalidateQueries({ queryKey: ["deal-proposals"] });
    void qc.invalidateQueries({ queryKey: ["proposal", id] });
    void qc.invalidateQueries({ queryKey: ["proposal-doc", id] });
    onOpenChange(false);
    onDone?.(id);
    void navigate({ to: "/proposals/$id", params: { id } });
  }

  async function submit() {
    if (!source || !draft) return;
    setSaving(true);
    try {
      if (editId) {
        await update({
          data: {
            id: editId,
            patch: { title: title.trim(), body, total_amount: amount, expires_at: expires },
          },
        });
        toast.success("Proposta atualizada.");
        await afterSave(editId);
      } else if ("quoteId" in source) {
        const r = await createFromQuote({
          data: {
            quoteId: source.quoteId,
            title: title.trim(),
            body,
            total_amount: amount,
            expires_at: expires,
            assigned_to: assignee,
            proposal_template_id: templateId,
          },
        });
        toast.success(r.reused ? "Esta cotação já tem proposta." : "Proposta criada.");
        await afterSave(r.id);
      } else {
        const row = await createBlank({
          data: {
            title: title.trim(),
            body,
            dealId: draft.deal_id,
            companyId: draft.company_id,
            contactId: draft.contact_id,
            totalAmount: amount,
            currency,
            expiresAt: expires,
          },
        });
        toast.success("Proposta criada.");
        await afterSave(row.id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const memberName = (id: string | null) => (id ? members.nameFor(id) : "Sem responsável");
  const chosen = templates.find((t) => t.id === templateId) ?? null;

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
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
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

        {draftQ.isLoading || res?.reused ? (
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
                  <div className="flex flex-col gap-1.5">
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
                  <div className="flex flex-col gap-1.5">
                    <Label>Validade</Label>
                    <DatePicker
                      value={expires ? parseISO(expires) : undefined}
                      onChange={(d) => setExpires(format(d, "yyyy-MM-dd"))}
                      onClear={() => setExpires(null)}
                      placeholder="Sem validade"
                      ariaLabel="Validade da proposta"
                      align="start"
                      side="bottom"
                      className="w-full justify-start"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[draft.company_name, draft.contact_name, draft.deal_name]
                    .filter(Boolean)
                    .join(" · ") || "Sem empresa, contato ou negócio vinculados."}
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                {draft.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {draft.quote_id || draft.deal_id
                      ? "A origem não tem itens de linha."
                      : "Sem itens vinculados."}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Itens {draft.items_origin === "quote" ? "da cotação" : "do negócio"}
                    </p>
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
                    <p className="text-xs text-muted-foreground">
                      Para mudar os itens, edite{" "}
                      {draft.items_origin === "quote"
                        ? "a cotação"
                        : "os itens de linha do negócio"}
                      .
                    </p>
                  </>
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
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Modelo de proposta</p>
                  {templatesQ.isLoading ? (
                    <div className="h-16 animate-pulse rounded-md bg-muted" />
                  ) : templates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum modelo cadastrado. Crie em Configurações › Modelos de proposta.
                    </p>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label="Modelo de proposta"
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      {templates.map((t) => {
                        const active = t.id === templateId;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => void applyTemplate(t)}
                            className={cn(
                              "rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              active ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                            )}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium">
                              {t.name}
                              {suggested?.id === t.id && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-1.5 py-0.5 text-[10px] text-primary">
                                  <Sparkles className="h-3 w-3" aria-hidden="true" /> Sugerido
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {suggested && (
                    <p className="text-xs text-muted-foreground">
                      Sugestão baseada nos serviços do catálogo dos itens de linha.
                    </p>
                  )}
                </div>
                <WordEditor value={body} onChange={setBody} minHeight={300} />
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
                  <div>
                    <dt className="text-xs text-muted-foreground">Modelo</dt>
                    <dd>{chosen?.name ?? "Nenhum"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Itens</dt>
                    <dd>{draft.items.length}</dd>
                  </div>
                </dl>
                <div
                  className="prose prose-sm max-h-64 max-w-none overflow-y-auto rounded-md border bg-muted/30 p-3 dark:prose-invert"
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
            <Button onClick={goNext} disabled={!draft || !titleOk}>
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
