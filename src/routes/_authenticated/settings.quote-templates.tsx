import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listQuoteTemplates,
  getQuoteTemplate,
  createQuoteTemplate,
  updateQuoteTemplate,
  deleteQuoteTemplate,
  setDefaultQuoteTemplate,
  duplicateQuoteTemplate,
} from "@/lib/quote-templates.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  QuoteTemplateEditor,
  type TemplateEditorValue,
} from "@/components/quote-templates/template-editor";
import { Plus, Copy, Trash2, Star, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/quote-templates")({
  component: QuoteTemplatesPage,
});

function QuoteTemplatesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listQuoteTemplates);
  const get = useServerFn(getQuoteTemplate);
  const create = useServerFn(createQuoteTemplate);
  const update = useServerFn(updateQuoteTemplate);
  const del = useServerFn(deleteQuoteTemplate);
  const setDef = useServerFn(setDefaultQuoteTemplate);
  const dup = useServerFn(duplicateQuoteTemplate);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateEditorValue>({ name: "", description: "", html: "" });
  const [dirty, setDirty] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: () => list(),
  });

  // Select the default (or first) template by default once loaded.
  useEffect(() => {
    if (!selectedId && templates.length) {
      const def = templates.find((t) => t.is_default) ?? templates[0];
      setSelectedId(def.id);
    }
  }, [templates, selectedId]);

  const { data: current } = useQuery({
    queryKey: ["quote-template", selectedId],
    queryFn: () => (selectedId ? get({ data: { id: selectedId } }) : null),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (current) {
      setDraft({
        name: current.name ?? "",
        description: current.description ?? "",
        html: current.html ?? "",
      });
      setDirty(false);
    }
  }, [current]);

  const isSystem = current?.is_system ?? false;
  const isDefault = current?.is_default ?? false;

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          name: "Novo modelo",
          description: "",
          html: "<!doctype html>\n<html>\n  <body style=\"font-family:sans-serif;padding:32px\">\n    <h1>{{quote.title}}</h1>\n    <p>Total: <strong>{{quote.total}}</strong></p>\n    {{#actions/}}\n  </body>\n</html>",
        },
      }),
    onSuccess: (row) => {
      toast.success("Modelo criado.");
      qc.invalidateQueries({ queryKey: ["quote-templates"] });
      setSelectedId(row.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dupMut = useMutation({
    mutationFn: (id: string) => dup({ data: { id } }),
    onSuccess: (row) => {
      toast.success("Modelo duplicado.");
      qc.invalidateQueries({ queryKey: ["quote-templates"] });
      setSelectedId(row.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Selecione um modelo.");
      return update({
        data: {
          id: selectedId,
          patch: {
            name: isSystem ? undefined : draft.name,
            description: draft.description || null,
            html: draft.html,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Modelo salvo.");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["quote-templates"] });
      qc.invalidateQueries({ queryKey: ["quote-template", selectedId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => setDef({ data: { id } }),
    onSuccess: () => {
      toast.success("Modelo definido como padrão.");
      qc.invalidateQueries({ queryKey: ["quote-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Modelo excluído.");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["quote-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [templates],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Modelos de cotação</h1>
          <p className="text-sm text-muted-foreground">
            Crie modelos HTML reutilizáveis. Cada cotação no negócio escolhe qual modelo enviar ao cliente.
          </p>
        </div>
        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Novo modelo
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-2">
            {isLoading ? (
              <p className="p-2 text-sm text-muted-foreground">Carregando…</p>
            ) : sortedTemplates.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">Nenhum modelo.</p>
            ) : (
              <ul className="space-y-0.5">
                {sortedTemplates.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        selectedId === t.id ? "bg-muted font-medium" : "hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{t.name}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          {t.is_default && (
                            <Badge variant="default" className="h-4 px-1.5 text-[10px]">
                              <Star className="h-2.5 w-2.5 mr-0.5" /> Padrão
                            </Badge>
                          )}
                          {t.is_system && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                              Sistema
                            </Badge>
                          )}
                        </span>
                      </div>
                      {t.description && (
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {t.description}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            {!current ? (
              <p className="text-sm text-muted-foreground">
                Selecione ou crie um modelo para editar.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDefaultMut.mutate(current.id)}
                        disabled={setDefaultMut.isPending}
                      >
                        <Star className="h-3.5 w-3.5 mr-1" /> Definir como padrão
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => dupMut.mutate(current.id)}
                      disabled={dupMut.isPending}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
                    </Button>
                    {!isSystem && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`Excluir o modelo "${current.name}"?`)) deleteMut.mutate(current.id);
                        }}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                      </Button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveMut.mutate()}
                    disabled={saveMut.isPending || !dirty}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {saveMut.isPending ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
                <Separator />
                <QuoteTemplateEditor
                  value={draft}
                  onChange={(v) => {
                    setDraft(v);
                    setDirty(true);
                  }}
                  readOnlyName={isSystem}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
