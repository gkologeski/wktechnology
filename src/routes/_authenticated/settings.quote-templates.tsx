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

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QuoteVisualEditor, defaultDocument } from "@/components/quote-templates/visual-editor";
import { QuoteTemplateEditor } from "@/components/quote-templates/template-editor";
import { isTemplateDocument, type TemplateDocument } from "@/lib/quote-template-blocks";
import { Plus, Copy, Trash2, Star, Save } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/quote-templates")({
  component: QuoteTemplatesPage,
});

type DraftMeta = { name: string; description: string };

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
  const [meta, setMeta] = useState<DraftMeta>({ name: "", description: "" });
  const [doc, setDoc] = useState<TemplateDocument | null>(null);
  const [html, setHtml] = useState<string>("");
  const [mode, setMode] = useState<"visual" | "code">("visual");
  const [dirty, setDirty] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: () => list(),
  });

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
      setMeta({ name: current.name ?? "", description: current.description ?? "" });
      setHtml(current.html ?? "");
      const existing = (current as { blocks?: unknown }).blocks;
      if (isTemplateDocument(existing)) {
        setDoc(existing);
        setMode("visual");
      } else {
        setDoc(null);
        // Modelos legados (system templates) abrem em modo "Avançado" por padrão
        setMode(current.is_system ? "code" : "code");
      }
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
          blocks: defaultDocument() as any,
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
      const patch: {
        name?: string;
        description?: string | null;
        html?: string;
        blocks?: any;
      } = {
        description: meta.description || null,
      };
      if (!isSystem) patch.name = meta.name;
      if (mode === "visual" && doc) {
        patch.blocks = doc as any;
      } else {
        patch.html = html;
      }
      return update({ data: { id: selectedId, patch } });
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

  const initVisualFromLegacy = () => {
    setDoc(defaultDocument());
    setMode("visual");
    setDirty(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modelos de cotação</h1>
          <p className="text-sm text-muted-foreground">
            Monte modelos arrastando blocos. Cada cotação no negócio escolhe qual modelo enviar ao
            cliente.
          </p>
        </div>
        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} size="lg">
          <Plus className="h-4 w-4 mr-1.5" /> Novo modelo
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Sidebar de modelos */}
        <Card className="h-fit border-border/60 shadow-sm">
          <CardContent className="p-2">
            {isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Carregando…</p>
            ) : sortedTemplates.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Nenhum modelo.</p>
            ) : (
              <ul className="space-y-1">
                {sortedTemplates.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className={`group w-full rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
                        selectedId === t.id
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate ${selectedId === t.id ? "font-semibold text-primary" : "font-medium"}`}
                        >
                          {t.name}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          {t.is_default && (
                            <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                              <Star className="h-2.5 w-2.5 mr-0.5" /> Padrão
                            </Badge>
                          )}
                          {t.is_system && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                              Sistema
                            </Badge>
                          )}
                        </span>
                      </div>
                      {t.description && (
                        <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
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

        {/* Editor */}
        <div className="space-y-4">
          {!current ? (
            <Card>
              <CardContent className="p-12 text-center text-sm text-muted-foreground">
                Selecione ou crie um modelo para editar.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Toolbar de metadados */}
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Nome do modelo
                      </Label>
                      <Input
                        value={meta.name}
                        onChange={(e) => {
                          setMeta({ ...meta, name: e.target.value });
                          setDirty(true);
                        }}
                        disabled={isSystem}
                        placeholder="Ex.: Modelo padrão da equipe"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Descrição
                      </Label>
                      <Input
                        value={meta.description}
                        onChange={(e) => {
                          setMeta({ ...meta, description: e.target.value });
                          setDirty(true);
                        }}
                        placeholder="Quando usar este modelo"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDefaultMut.mutate(current.id)}
                          disabled={setDefaultMut.isPending}
                        >
                          <Star className="h-3.5 w-3.5 mr-1" /> Padrão
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
                          onClick={async () => {
                            if ((await confirmDialog(`Excluir o modelo "${current.name}"?`)))
                              deleteMut.mutate(current.id);
                          }}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => saveMut.mutate()}
                        disabled={saveMut.isPending || !dirty}
                        className="ml-1"
                      >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        {saveMut.isPending ? "Salvando…" : dirty ? "Salvar" : "Salvo"}
                      </Button>
                    </div>
                  </div>
                  {isSystem && (
                    <p className="text-[11px] text-muted-foreground">
                      Modelo do sistema — nome bloqueado. Duplique para personalizar.
                    </p>
                  )}

                  <Tabs
                    value={mode}
                    onValueChange={(v) => setMode(v as "visual" | "code")}
                    className="w-full"
                  >
                    <TabsList className="h-9">
                      <TabsTrigger value="visual" className="text-xs">
                        Editor visual
                      </TabsTrigger>
                      <TabsTrigger value="code" className="text-xs">
                        HTML avançado
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Editor area */}
              {mode === "visual" ? (
                doc ? (
                  <QuoteVisualEditor
                    doc={doc}
                    onChange={(d) => {
                      setDoc(d);
                      setDirty(true);
                    }}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Este modelo foi criado em HTML. Você pode convertê-lo para o editor visual
                        de blocos — o HTML original será substituído por uma estrutura padrão.
                      </p>
                      <Button onClick={initVisualFromLegacy}>Converter para editor visual</Button>
                    </CardContent>
                  </Card>
                )
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <QuoteTemplateEditor
                      value={{ name: meta.name, description: meta.description, html }}
                      onChange={(v) => {
                        setMeta({ name: v.name, description: v.description });
                        setHtml(v.html);
                        setDirty(true);
                      }}
                      readOnlyName={isSystem}
                    />
                    {doc && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Atenção: salvar no modo HTML descarta a estrutura visual de blocos deste
                        modelo.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
