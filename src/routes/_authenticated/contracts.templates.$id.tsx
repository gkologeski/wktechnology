import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check, Eye, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WordEditor, type WordEditorHandle } from "@/components/word-editor-lazy";
import { TokenPills } from "@/components/ui/token-pills";
import {
  CONTRACT_TEMPLATE_TOKENS,
  mergeTemplateBody,
  unknownTokens,
  usedTokens,
} from "@/lib/contracts/template-tokens";
import {
  getContractTemplate,
  updateContractTemplate,
  listTemplateServiceOptions,
} from "@/lib/contracts/templates.functions";
import { SERVICE_TYPES } from "@/lib/contracts/import-schemas";

export const Route = createFileRoute("/_authenticated/contracts/templates/$id")({
  head: () => ({
    meta: [
      { title: "Editar modelo de contrato" },
      {
        name: "description",
        content: "Edite o corpo do modelo, as variáveis e os serviços vinculados.",
      },
      { property: "og:title", content: "Editar modelo de contrato" },
      {
        property: "og:description",
        content: "Corpo em Rich Text, variáveis por entidade e vínculo com serviços.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractTemplateEditorPage,
});

const SERVICE_TYPE_LABEL: Record<string, string> = {
  outsourcing: "Outsourcing",
  desenvolvimento: "Desenvolvimento",
  manutencao: "Manutenção",
  consultoria: "Consultoria",
  licenciamento: "Licenciamento",
  outros: "Outros",
};

function ContractTemplateEditorPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const get = useServerFn(getContractTemplate);
  const update = useServerFn(updateContractTemplate);
  const listServices = useServerFn(listTemplateServiceOptions);
  const editorRef = useRef<WordEditorHandle>(null);

  const { data: template, isLoading } = useQuery({
    queryKey: ["contract-template", id],
    queryFn: () => get({ data: { id } }),
  });
  const { data: services = [] } = useQuery({
    queryKey: ["contract-template-services-options"],
    queryFn: () => listServices(),
    staleTime: 60_000,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState<"provider" | "client">("provider");
  const [serviceType, setServiceType] = useState<string>("none");
  const [body, setBody] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!template) return;
    setName(template.name ?? "");
    setDescription(template.description ?? "");
    setRole((template.role as "provider" | "client") ?? "provider");
    setServiceType(template.service_type ?? "none");
    setBody(template.body_html ?? "");
    setServiceIds(template.serviceIds ?? []);
    setDirty(false);
  }, [template]);

  const tokensInBody = useMemo(() => usedTokens(body), [body]);
  const unknown = useMemo(() => unknownTokens(body), [body]);

  const save = useCallback(
    async (patch?: { status?: "draft" | "published" | "archived" }) => {
      setSaving(true);
      try {
        await update({
          data: {
            id,
            patch: {
              name: name.trim() || "Modelo sem nome",
              description: description.trim() || null,
              role,
              service_type: serviceType === "none" ? null : serviceType,
              body_html: body,
              serviceIds,
              ...(patch?.status ? { status: patch.status } : {}),
            },
          },
        });
        setDirty(false);
        qc.invalidateQueries({ queryKey: ["contract-template", id] });
        qc.invalidateQueries({ queryKey: ["contract-templates"] });
        toast.success(
          patch?.status === "published" ? "Modelo publicado." : "Modelo salvo.",
        );
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [id, name, description, role, serviceType, body, serviceIds, update, qc],
  );

  const previewHtml = useMemo(
    () => mergeTemplateBody(body, {}, { keepUnknown: false }),
    [body],
  );

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando modelo…</div>;
  }
  if (!template) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Modelo não encontrado.</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate({ to: "/contracts/templates" })}>
          Voltar para modelos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" aria-label="Voltar" asChild>
            <Link to="/contracts/templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-primary">
              {name || "Modelo de contrato"}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline">
                {template.status === "published" ? "Publicado" : template.status === "archived" ? "Arquivado" : "Rascunho"}
              </Badge>
              {dirty ? (
                <span className="text-xs text-muted-foreground">Alterações não salvas</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-1 h-4 w-4" /> Pré-visualizar
          </Button>
          <Button variant="outline" onClick={() => save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Salvar rascunho
          </Button>
          <Button onClick={() => save({ status: "published" })} disabled={saving}>
            <Check className="mr-1 h-4 w-4" /> Publicar
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nome do modelo</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-role">Tipo de contrato</Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v as "provider" | "client");
                  setDirty(true);
                }}
              >
                <SelectTrigger id="tpl-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="provider">Prestação</SelectItem>
                  <SelectItem value="client">Compra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-service-type">Tipo de serviço</Label>
              <Select
                value={serviceType}
                onValueChange={(v) => {
                  setServiceType(v);
                  setDirty(true);
                }}
              >
                <SelectTrigger id="tpl-service-type">
                  <SelectValue placeholder="Não definido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não definido</SelectItem>
                  {SERVICE_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SERVICE_TYPE_LABEL[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-description">Descrição</Label>
              <Textarea
                id="tpl-description"
                value={description}
                rows={2}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
                placeholder="Quando usar este modelo…"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Corpo do contrato</Label>
            <p className="text-xs text-muted-foreground">
              Escreva o contrato e insira variáveis clicando nas pills ao lado. Elas são
              substituídas pelos dados reais ao gerar o contrato.
            </p>
            <WordEditor
              ref={editorRef}
              value={body}
              onChange={(html) => {
                setBody(html);
                setDirty(true);
              }}
              minHeight={520}
              placeholder="Digite ou cole o texto do contrato…"
            />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-medium">Variáveis</h2>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Clique para inserir na posição do cursor.
            </p>
            <TokenPills
              tokens={CONTRACT_TEMPLATE_TOKENS}
              label="Disponíveis"
              onInsert={(token) => {
                editorRef.current?.insertHtml(token);
                editorRef.current?.focus();
                setDirty(true);
              }}
            />
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-medium">Serviços vinculados</h2>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              O modelo aparece sugerido quando o serviço for usado.
            </p>
            {services.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum serviço no catálogo.</p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {services.map((s) => {
                  const checked = serviceIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border accent-primary"
                        checked={checked}
                        onChange={() => {
                          setServiceIds((prev) =>
                            checked ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                          );
                          setDirty(true);
                        }}
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-medium">Variáveis usadas</h2>
            {tokensInBody.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Nenhuma variável no corpo ainda.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1">
                {tokensInBody.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className={
                      unknown.includes(t)
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : ""
                    }
                  >
                    {`{{${t}}}`}
                  </Badge>
                ))}
              </div>
            )}
            {unknown.length > 0 ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Variáveis destacadas não fazem parte do catálogo e ficarão em branco.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização do modelo</DialogTitle>
            <DialogDescription>
              Variáveis sem valor aparecem como [[rótulo]]. Ao gerar o contrato, elas são
              preenchidas com os dados reais.
            </DialogDescription>
          </DialogHeader>
          <article
            className="prose prose-sm max-w-none dark:prose-invert"
            // Conteúdo próprio do workspace, produzido no editor do sistema.
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
