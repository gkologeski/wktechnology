import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { WordEditor } from "@/components/word-editor-lazy";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteProposalTemplate,
  listProposalTemplates,
  saveProposalTemplate,
} from "@/lib/proposals/proposal-templates.functions";
import { cn } from "@/lib/utils";
import { normalizeProposalTemplateHtml } from "@/lib/proposals/proposal-template-html";

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
};
const EMPTY: Draft = { id: null, name: "", description: "", html: "", services: [] };

const VARIABLES = [
  "{{company.name}}",
  "{{contact.name}}",
  "{{deal.name}}",
  "{{total}}",
  "{{valid_until}}",
  "{{{items_table}}}",
];

function ProposalTemplatesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listProposalTemplates);
  const save = useServerFn(saveProposalTemplate);
  const del = useServerFn(deleteProposalTemplate);
  const [draft, setDraft] = useState<Draft | null>(null);

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
  const templates = templatesQ.data ?? [];

  useEffect(() => {
    if (!draft && templates[0]) {
      const t = templates[0];
      setDraft({
        ...t,
        html: normalizeProposalTemplateHtml(t.html),
        description: t.description ?? "",
      });
    }
  }, [templates, draft]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["proposal-templates-admin"] });
    void qc.invalidateQueries({ queryKey: ["proposal-templates"] });
  };
  const saveM = useMutation({
    mutationFn: (d: Draft) =>
      save({ data: { ...d, description: d.description.trim() || null, name: d.name.trim() } }),
    onSuccess: (r) => {
      toast.success("Modelo salvo.");
      setDraft((d) => (d ? { ...d, id: r.id } : d));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: "Excluir modelo?",
      description: "Propostas já criadas não são afetadas.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await del({ data: { id } });
      toast.success("Modelo excluído.");
      setDraft(null);
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold">Modelos de proposta</h1>
          <p className="text-sm text-muted-foreground">
            Textos comerciais por serviço do catálogo. O assistente de proposta sugere o modelo
            ligado aos serviços dos itens de linha.
          </p>
        </div>
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="mr-1 h-4 w-4" /> Novo modelo
        </Button>
      </div>

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
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <nav aria-label="Modelos" className="space-y-1">
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum modelo. Crie o primeiro.</p>
            )}
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setDraft({
                    ...t,
                    html: normalizeProposalTemplateHtml(t.html),
                    description: t.description ?? "",
                  })
                }
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  draft?.id === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t.services.length} serviço(s) vinculado(s)
                </div>
              </button>
            ))}
          </nav>

          {draft ? (
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pt-name">Nome *</Label>
                    <Input
                      id="pt-name"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pt-desc">Descrição</Label>
                    <Input
                      id="pt-desc"
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                  </div>
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
                            checked={draft.services.includes(s.id)}
                            onCheckedChange={(v) =>
                              setDraft({
                                ...draft,
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
                  <Label>Conteúdo</Label>
                  <WordEditor
                    key={draft.id ?? "novo"}
                    value={draft.html}
                    onChange={(html) => setDraft((d) => (d ? { ...d, html } : d))}
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
                </div>
                <div className="flex justify-between gap-2">
                  {draft.id ? (
                    <Button variant="ghost" onClick={() => void remove(draft.id!)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Excluir
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    onClick={() => saveM.mutate(draft)}
                    disabled={saveM.isPending || !draft.name.trim()}
                  >
                    <Save className="mr-1 h-4 w-4" /> Salvar
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
