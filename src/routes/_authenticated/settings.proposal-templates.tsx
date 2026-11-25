import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, LayoutTemplate, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { WordEditor } from "@/components/word-editor-lazy";
import { VisualProposalEditor } from "@/components/proposals/visual-editor/visual-proposal-editor";
import {
  ProposalTemplateList,
  type ProposalTemplateItem,
} from "@/components/proposals/proposal-template-list";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteProposalTemplate,
  duplicateProposalTemplate,
  listProposalTemplates,
  saveProposalTemplate,
} from "@/lib/proposals/proposal-templates.functions";
import { normalizeProposalTemplateHtml } from "@/lib/proposals/proposal-template-html";
import {
  createBlankVisualDesign,
  tryParseVisualDesign,
  type VisualDesign,
} from "@/lib/proposals/visual-design";
import { createNexxusStarterDesign } from "@/lib/proposals/nexxus-starter-template";
import { extractPlainSummaryFromDesign } from "@/lib/proposals/visual-renderer";
import { listContractTemplates } from "@/lib/contracts/templates.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings/proposal-templates")({
  head: () => ({
    meta: [
      { title: "Modelos de proposta — Configurações" },
      { name: "description", content: "Modelos de proposta comercial por serviço do catálogo." },
      { property: "og:title", content: "Modelos de proposta — Configurações" },
      { property: "og:description", content: "Modelos de proposta comercial por serviço." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProposalTemplatesPage,
});

type Draft = {
  id: string | null;
  name: string;
  description: string;
  html: string;
  services: string[];
  contract_template_id: string | null;
  layout_kind: "rich_text" | "visual";
  design_json: VisualDesign | null;
};
const EMPTY: Draft = {
  id: null,
  name: "",
  description: "",
  html: "",
  services: [],
  contract_template_id: null,
  layout_kind: "rich_text",
  design_json: null,
};

function toDraft(t: ProposalTemplateItem): Draft {
  const layoutKind = t.layout_kind === "visual" ? "visual" : "rich_text";
  const parsedDesign =
    layoutKind === "visual"
      ? (tryParseVisualDesign(t.design_json) ?? createBlankVisualDesign())
      : null;
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    html: normalizeProposalTemplateHtml(t.html),
    services: t.services,
    contract_template_id: t.contract_template_id,
    layout_kind: layoutKind,
    design_json: parsedDesign,
  };
}

const VARIABLES = [
  "{{company.name}}",
  "{{contact.name}}",
  "{{deal.name}}",
  "{{total}}",
  "{{valid_until}}",
  "{{{items_table}}}",
  "{{company_legal_name}}",
  "{{company_cnpj}}",
  "{{contracting.name}}",
  "{{contracting.cnpj}}",
];

function ProposalTemplatesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listProposalTemplates);
  const save = useServerFn(saveProposalTemplate);
  const del = useServerFn(deleteProposalTemplate);
  const duplicate = useServerFn(duplicateProposalTemplate);
  const listContracts = useServerFn(listContractTemplates);
  const { can } = usePermissions();
  const allowed = (resource: string, action: string) =>
    ["own", "team", "workspace"].some((s) => can(`${resource}.${action}.${s}`));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editorNonce, setEditorNonce] = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const canCreate = allowed("techsales.proposal_templates", "create");
  const canUpdate = allowed("techsales.proposal_templates", "update");
  const canDelete = allowed("techsales.proposal_templates", "delete");
  const canSave = draft?.id ? canUpdate : canCreate;
  const canReadContracts = allowed("techcontracts.contract_templates", "view");

  const contractsQ = useQuery({
    queryKey: ["proposal-contract-models"],
    queryFn: () => listContracts({ data: { status: "published" } }),
    enabled: canReadContracts,
  });

  const templatesQ = useQuery({ queryKey: ["proposal-templates-admin"], queryFn: () => list() });
  const servicesQ = useQuery({
    queryKey: ["service-catalog-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_catalog")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const templates = useMemo(() => templatesQ.data ?? [], [templatesQ.data]);

  useEffect(() => {
    if (!draft && !dirty && templates[0]) {
      setDraft(toDraft(templates[0]));
    }
  }, [templates, draft, dirty]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["proposal-templates-admin"] });
    void qc.invalidateQueries({ queryKey: ["proposal-templates"] });
  };

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const saveM = useMutation({
    mutationFn: (d: Draft) => {
      const html =
        d.layout_kind === "visual" && d.design_json
          ? d.html.trim() || extractPlainSummaryFromDesign(d.design_json)
          : d.html;
      return save({
        data: {
          ...d,
          html,
          description: d.description.trim() || null,
          name: d.name.trim(),
          layout_kind: d.layout_kind,
          design_json: d.layout_kind === "visual" ? d.design_json : null,
        },
      });
    },
    onSuccess: (r) => {
      toast.success("Modelo salvo.");
      setDraft((d) => (d ? { ...d, id: r.id } : d));
      setDirty(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateM = useMutation({
    mutationFn: (id: string) => duplicate({ data: { id } }),
    onSuccess: (created) => {
      toast.success("Modelo duplicado.");
      qc.setQueryData<ProposalTemplateItem[]>(["proposal-templates-admin"], (prev) =>
        prev
          ? [...prev.filter((item) => item.id !== created.id), created].sort((a, b) =>
              a.name.localeCompare(b.name, "pt-BR"),
            )
          : [created],
      );
      setDraft(toDraft(created));
      setDirty(false);
      setEditorNonce((n) => n + 1);
      invalidate();
      requestAnimationFrame(() => nameInputRef.current?.focus());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: (_res, deletedId) => {
      toast.success("Modelo excluído.");
      qc.setQueryData<ProposalTemplateItem[]>(["proposal-templates-admin"], (prev) =>
        prev ? prev.filter((item) => item.id !== deletedId) : prev,
      );
      if (draft?.id === deletedId) {
        const remaining = templates.find((t) => t.id !== deletedId);
        setDraft(remaining ? toDraft(remaining) : null);
        setDirty(false);
        setEditorNonce((n) => n + 1);
      }
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isBusy = saveM.isPending || duplicateM.isPending || deleteM.isPending;
  const busyTemplateId = duplicateM.isPending
    ? duplicateM.variables
    : deleteM.isPending
      ? deleteM.variables
      : null;

  async function confirmDiscardIfDirty() {
    if (!dirty) return true;
    return confirmDialog({
      title: "Descartar alterações não salvas?",
      description: "As alterações feitas no modelo atual serão perdidas se você continuar.",
      confirmLabel: "Descartar e continuar",
    });
  }

  async function openTemplate(t: ProposalTemplateItem, focusName = false) {
    if (draft?.id === t.id) {
      if (focusName) nameInputRef.current?.focus();
      return;
    }
    if (!(await confirmDiscardIfDirty())) return;
    setDraft(toDraft(t));
    setDirty(false);
    setEditorNonce((n) => n + 1);
    if (focusName) {
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }

  async function startNew(kind: "rich_text" | "visual" = "rich_text") {
    if (!canCreate || isBusy) return;
    if (!(await confirmDiscardIfDirty())) return;
    setDraft({
      ...EMPTY,
      layout_kind: kind,
      design_json: kind === "visual" ? createNexxusStarterDesign() : null,
    });
    setDirty(false);
    setEditorNonce((n) => n + 1);
    requestAnimationFrame(() => nameInputRef.current?.focus());
  }

  async function switchLayoutKind(nextKind: "rich_text" | "visual") {
    if (!draft || draft.layout_kind === nextKind || !canSave || isBusy) return;
    const hasOtherContent =
      nextKind === "visual" ? draft.html.trim().length > 0 : draft.design_json !== null;
    if (hasOtherContent) {
      const ok = await confirmDialog({
        title:
          nextKind === "visual"
            ? "Converter para modelo visual?"
            : "Voltar para modelo de texto rico?",
        description:
          nextKind === "visual"
            ? "O editor abrirá no formato visual de páginas. Você poderá personalizar ou aplicar o modelo editorial."
            : "O layout visual não será usado neste modelo enquanto estiver em texto rico.",
        confirmLabel: "Continuar",
      });
      if (!ok) return;
    }
    updateDraft({
      layout_kind: nextKind,
      design_json:
        nextKind === "visual" ? (draft.design_json ?? createNexxusStarterDesign()) : null,
    });
    setEditorNonce((n) => n + 1);
  }

  async function handleDuplicate(t: ProposalTemplateItem) {
    if (!canCreate || isBusy) return;
    if (!(await confirmDiscardIfDirty())) return;
    duplicateM.mutate(t.id);
  }

  async function remove(target: { id: string; name: string }) {
    if (!canDelete || isBusy) return;
    const ok = await confirmDialog({
      title: `Excluir modelo "${target.name}"?`,
      description: "Propostas já criadas não são afetadas.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    deleteM.mutate(target.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold">Modelos de proposta</h1>
          <p className="text-sm text-muted-foreground">
            Crie modelos visuais em páginas ou em texto rico por serviço do catálogo. O assistente
            de proposta sugere o modelo ligado aos serviços dos itens de linha.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={!canCreate || isBusy}
            onClick={() => void startNew("rich_text")}
          >
            <Plus className="mr-1 h-4 w-4" /> Novo em texto
          </Button>
          <Button disabled={!canCreate || isBusy} onClick={() => void startNew("visual")}>
            <LayoutTemplate className="mr-1 h-4 w-4" /> Novo modelo visual
          </Button>
        </div>
      </div>

      {(duplicateM.isPending || deleteM.isPending) && (
        <div role="status" aria-live="polite" className="sr-only">
          {duplicateM.isPending ? "Duplicando modelo de proposta..." : "Excluindo modelo..."}
        </div>
      )}

      {templatesQ.isLoading ? (
        <div className="h-64 animate-pulse rounded-md bg-muted" aria-busy="true" />
      ) : templatesQ.isError ? (
        <div className="rounded-md border border-destructive/40 p-3 text-sm">
          <p className="text-destructive">Não foi possível carregar os modelos.</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void templatesQ.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div
          className={
            draft?.layout_kind === "visual"
              ? "grid grid-cols-1 gap-4 2xl:grid-cols-[240px_minmax(0,1fr)]"
              : "grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"
          }
        >
          <ProposalTemplateList
            templates={templates}
            selectedId={draft?.id ?? null}
            isBusy={isBusy}
            busyTemplateId={busyTemplateId}
            onSelect={(t) => void openTemplate(t)}
            onEdit={(t) => void openTemplate(t, true)}
            onDuplicate={(t) => void handleDuplicate(t)}
            onDelete={(t) => void remove(t)}
          />

          {draft ? (
            <Card className="min-w-0">
              <CardContent className="min-w-0 space-y-4 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pt-name">Nome *</Label>
                    <Input
                      ref={nameInputRef}
                      id="pt-name"
                      value={draft.name}
                      disabled={!canSave || isBusy}
                      onChange={(e) => updateDraft({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pt-desc">Descrição</Label>
                    <Input
                      id="pt-desc"
                      value={draft.description}
                      disabled={!canSave || isBusy}
                      onChange={(e) => updateDraft({ description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pt-contract">Modelo de contrato vinculado</Label>
                  <Select
                    value={draft.contract_template_id ?? "__none__"}
                    disabled={!canSave || !canReadContracts || contractsQ.isError || isBusy}
                    onValueChange={(value) =>
                      updateDraft({
                        contract_template_id: value === "__none__" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger id="pt-contract">
                      <SelectValue placeholder="Sem vínculo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem vínculo</SelectItem>
                      {(contractsQ.data ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} — WK{" "}
                          {t.role === "client" ? "contratante (compra)" : "contratada (venda)"}
                        </SelectItem>
                      ))}
                      {draft.contract_template_id &&
                        !(contractsQ.data ?? []).some(
                          (t) => t.id === draft.contract_template_id,
                        ) && (
                          <SelectItem value={draft.contract_template_id}>
                            Modelo vinculado indisponível
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Vínculo entre modelos reutilizáveis. Salvar este cadastro não cria uma proposta
                    nem um contrato.
                  </p>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Serviços do catálogo</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(servicesQ.data ?? []).map((s) => {
                      const id = `pt-s-${s.id}`;
                      return (
                        <div key={s.id} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            disabled={!canSave || isBusy}
                            checked={draft.services.includes(s.id)}
                            onCheckedChange={(v) =>
                              updateDraft({
                                services: v
                                  ? [...draft.services, s.id]
                                  : draft.services.filter((x) => x !== s.id),
                              })
                            }
                          />
                          <Label htmlFor={id} className="text-sm font-normal">
                            {s.name}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Conteúdo</Label>
                    <div
                      role="group"
                      aria-label="Formato do modelo"
                      className="inline-flex rounded-md border border-border bg-muted/40 p-0.5"
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant={draft.layout_kind === "visual" ? "default" : "ghost"}
                        className="h-7 gap-1.5 px-2.5 text-xs"
                        disabled={!canSave || isBusy}
                        onClick={() => void switchLayoutKind("visual")}
                      >
                        <LayoutTemplate className="h-3.5 w-3.5" aria-hidden="true" />
                        Visual (páginas)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={draft.layout_kind === "rich_text" ? "default" : "ghost"}
                        className="h-7 gap-1.5 px-2.5 text-xs"
                        disabled={!canSave || isBusy}
                        onClick={() => void switchLayoutKind("rich_text")}
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        Texto rico
                      </Button>
                    </div>
                  </div>

                  {draft.layout_kind === "visual" ? (
                    <VisualProposalEditor
                      key={`visual-${draft.id ?? "novo"}-${editorNonce}`}
                      value={draft.design_json ?? createBlankVisualDesign()}
                      editable={canSave && !isBusy}
                      onChange={(design_json) => updateDraft({ design_json })}
                    />
                  ) : (
                    <>
                      <WordEditor
                        key={`${draft.id ?? "novo"}-${editorNonce}`}
                        value={draft.html}
                        editable={canSave && !isBusy}
                        onChange={(html) => {
                          setDraft((d) => {
                            if (!d || d.html === html) return d;
                            setDirty(true);
                            return { ...d, html };
                          });
                        }}
                        minHeight={360}
                      />
                      <p className="text-xs text-muted-foreground">
                        Variáveis:{" "}
                        {VARIABLES.map((v) => (
                          <code key={v} className="mr-2 rounded bg-muted px-1">
                            {v}
                          </code>
                        ))}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex justify-between gap-2">
                  {draft.id ? (
                    <Button
                      variant="ghost"
                      disabled={!canDelete || isBusy}
                      onClick={() => void remove({ id: draft.id!, name: draft.name })}
                    >
                      {deleteM.isPending && deleteM.variables === draft.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                      )}{" "}
                      Excluir
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    onClick={() => saveM.mutate(draft)}
                    disabled={!canSave || isBusy || !draft.name.trim()}
                  >
                    {saveM.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="mr-1 h-4 w-4" aria-hidden="true" />
                    )}{" "}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um modelo.</p>
          )}
        </div>
      )}
    </div>
  );
}
