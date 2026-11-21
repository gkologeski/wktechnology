import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getMetaTemplateContext,
  listMetaTemplates,
  createMetaTemplate,
  updateMetaTemplate,
  inspectMetaTemplateDeletion,
  deleteMetaTemplate,
  uploadMetaTemplateSample,
} from "@/lib/whatsapp/meta-template-center.functions";
import {
  emptyMetaTemplateDraft,
  META_TEMPLATE_RESOURCE,
  type MetaTemplate,
  type MetaTemplateAction,
  type MetaTemplateDraft,
  type MetaTemplateDeletionPreview,
  type MetaTemplateTarget,
} from "@/lib/whatsapp/meta-template-types";
import { MetaTemplateEditor } from "./meta-template-editor";
import { MetaTemplateDetails } from "./meta-template-preview";

const SELECT =
  "flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50";
type Filters = { search: string; status: string; category: string; language: string };
const EMPTY_FILTERS: Filters = { search: "", status: "", category: "", language: "" };
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
export function filterMetaTemplates(items: MetaTemplate[], filters: Filters) {
  const query = fold(filters.search.trim());
  return items.filter(
    (item) =>
      (!filters.status || item.status === filters.status) &&
      (!filters.category || item.category === filters.category) &&
      (!filters.language || item.language === filters.language) &&
      (!query ||
        fold(`${item.name} ${item.language} ${JSON.stringify(item.components)}`).includes(query)),
  );
}
function failure(error: unknown) {
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues))
    return String(error.issues[0]?.message || "Revise os campos do modelo.");
  return error instanceof Error ? error.message : "Não foi possível concluir a operação na Meta.";
}
function managerUrl(target?: MetaTemplateTarget) {
  return target?.wabaId && /^\d+$/.test(target.wabaId)
    ? `https://business.facebook.com/wa/manage/message-templates/?waba_id=${target.wabaId}`
    : "https://business.facebook.com/wa/manage/message-templates/";
}
async function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const separator = value.indexOf(",");
      if (separator < 0) reject(Error("Não foi possível ler a amostra."));
      else resolve(value.slice(separator + 1));
    };
    reader.onerror = () => reject(Error("Não foi possível ler a amostra."));
    reader.readAsDataURL(file);
  });
}
export function MetaTemplatesPage() {
  const permissions = usePermissions();
  const { user } = useAuth();
  const viewAs = readViewAs();
  if (permissions.isLoading)
    return (
      <p role="status" className="flex items-center gap-2 p-6">
        <Loader2 className="size-4 animate-spin" />
        Conferindo acesso aos modelos…
      </p>
    );
  if (permissions.isError)
    return (
      <div role="alert" className="space-y-3 p-6">
        <p>Não foi possível confirmar seu acesso ao workspace.</p>
        <Button variant="outline" onClick={permissions.refetch}>
          Tentar novamente
        </Button>
      </div>
    );
  if (
    !user?.id ||
    !permissions.workspaceId ||
    !permissions.canAll([
      `${META_TEMPLATE_RESOURCE}.view.workspace`,
      "system.channels.view.workspace",
      "system.whatsapp.view.workspace",
    ])
  )
    return (
      <p role="alert" className="p-6">
        Sem permissão para consultar os modelos de mensagens Meta neste workspace.
      </p>
    );
  const capabilities = Object.fromEntries(
    (["view", "create", "update", "delete"] as const).map((action) => [
      action,
      permissions.can(`${META_TEMPLATE_RESOURCE}.${action}.workspace`),
    ]),
  ) as Record<MetaTemplateAction, boolean>;
  return (
    <MetaTemplatesWorkspace
      key={`${user.id}:${permissions.workspaceId}`}
      userId={user.id}
      workspaceId={permissions.workspaceId}
      permissions={capabilities}
      readOnly={viewAs?.readOnly === true || viewAs?.mode === "role"}
    />
  );
}

function MetaTemplatesWorkspace({
  userId,
  workspaceId,
  permissions,
  readOnly,
}: {
  userId: string;
  workspaceId: string;
  permissions: Record<MetaTemplateAction, boolean>;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const contextFn = useServerFn(getMetaTemplateContext);
  const listFn = useServerFn(listMetaTemplates);
  const createFn = useServerFn(createMetaTemplate);
  const updateFn = useServerFn(updateMetaTemplate);
  const inspectDeleteFn = useServerFn(inspectMetaTemplateDeletion);
  const deleteFn = useServerFn(deleteMetaTemplate);
  const uploadFn = useServerFn(uploadMetaTemplateSample);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<MetaTemplate | null>(null);
  const [editor, setEditor] = useState<{
    mode: "create" | "update";
    initial: MetaTemplateDraft;
    template?: MetaTemplate;
    key: string;
  } | null>(null);
  const [deletion, setDeletion] = useState<{
    item: MetaTemplate;
    preview?: MetaTemplateDeletionPreview;
    error?: string;
  } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [confirmAllLanguages, setConfirmAllLanguages] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(filters.search), 200);
    return () => clearTimeout(timer);
  }, [filters.search]);
  const prefix = ["meta-template-center", userId, workspaceId];
  const context = useQuery({
    queryKey: [...prefix, "context"],
    queryFn: () => contextFn({ data: { workspaceId } }),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const contextReady =
    context.isSuccess &&
    !context.isError &&
    context.data.actor === userId &&
    context.data.workspace === workspaceId &&
    context.data.capabilities.view;
  const target = contextReady
    ? context.data.targets.find((entry) => entry.id === selectedTarget)
    : undefined;
  const identity = `${userId}:${workspaceId}:${selectedTarget}`;
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const catalogue = useInfiniteQuery({
    queryKey: [...prefix, "catalogue", selectedTarget],
    enabled: Boolean(contextReady && target),
    retry: false,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      listFn({ data: { workspaceId, targetId: selectedTarget, cursor: pageParam ?? undefined } }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const records = useMemo(() => {
    const byId = new Map<string, MetaTemplate>();
    for (const page of catalogue.data?.pages ?? [])
      for (const item of page.items) byId.set(`${item.id}:${item.language}`, item);
    return [...byId.values()];
  }, [catalogue.data]);
  const filtered = useMemo(
    () => filterMetaTemplates(records, { ...filters, search }),
    [records, filters, search],
  );
  const busyRef = useRef(false);
  const caps = (action: MetaTemplateAction) =>
    Boolean(
      contextReady &&
      target?.enabled &&
      permissions[action] &&
      context.data.capabilities[action] &&
      catalogue.isSuccess &&
      !catalogue.isError &&
      catalogue.data?.pages[0]?.capabilities[action] &&
      !readOnly &&
      !context.data.readOnly,
    );
  const invalidate = async () => {
    await qc.resetQueries({ queryKey: [...prefix, "catalogue", selectedTarget], exact: true });
    for (const queryKey of [
      ["wa", "templates"],
      ["sequence-approved-templates"],
      ["meeting-reminder-templates"],
      ["notification-delivery-templates"],
    ])
      await qc.invalidateQueries({ queryKey, refetchType: "none" });
  };
  const mutate = useMutation({
    retry: false,
    mutationFn: async ({
      operation,
      draft,
      template,
      deletionPreview,
      allLanguages,
      requestIdentity,
    }: {
      operation: "create" | "update" | "delete";
      draft?: MetaTemplateDraft;
      template?: MetaTemplate;
      deletionPreview?: MetaTemplateDeletionPreview;
      allLanguages?: boolean;
      requestIdentity: string;
    }) => {
      if (
        !mounted.current ||
        activeIdentity.current !== requestIdentity ||
        busyRef.current ||
        !target ||
        !caps(operation)
      )
        throw Error("Acesso ou contexto mudou. Atualize a central antes de continuar.");
      busyRef.current = true;
      try {
        if (operation === "create" && draft)
          return await createFn({ data: { workspaceId, targetId: target.id, draft } });
        if (operation === "update" && template && draft)
          return await updateFn({
            data: {
              workspaceId,
              targetId: target.id,
              templateId: template.id,
              expectedFingerprint: template.fingerprint,
              draft,
            },
          });
        if (operation === "delete" && template && deletionPreview)
          return await deleteFn({
            data: {
              workspaceId,
              targetId: target.id,
              templateId: template.id,
              expectedFingerprint: template.fingerprint,
              name: template.name,
              language: template.language,
              confirmAllLanguages: allLanguages === true,
              expectedVariantIds: deletionPreview.variantIds,
            },
          });
        throw Error("A operação está incompleta. Atualize a central.");
      } finally {
        busyRef.current = false;
      }
    },
    onSuccess: async (result, variables) => {
      if (!mounted.current || activeIdentity.current !== variables.requestIdentity) return;
      setOutcome(
        `${result.message} Consulte novamente o catálogo antes de usar o modelo em campanhas, sequências ou notificações.`,
      );
      setEditor(null);
      setDeletion(null);
      setDetail(null);
      await invalidate();
    },
    onError: async (_error, variables) => {
      if (mounted.current && activeIdentity.current === variables.requestIdentity)
        await invalidate();
    },
  });
  const inspectDeletion = useMutation({
    retry: false,
    mutationFn: async ({
      item,
      requestIdentity,
    }: {
      item: MetaTemplate;
      requestIdentity: string;
    }) => {
      if (!target || !caps("delete") || activeIdentity.current !== requestIdentity)
        throw Error("Sem permissão para excluir neste contexto.");
      return inspectDeleteFn({
        data: {
          workspaceId,
          targetId: target.id,
          templateId: item.id,
          expectedFingerprint: item.fingerprint,
        },
      });
    },
    onSuccess: (preview, variables) => {
      if (mounted.current && activeIdentity.current === variables.requestIdentity)
        setDeletion({ item: variables.item, preview });
    },
    onError: (error, variables) => {
      if (mounted.current && activeIdentity.current === variables.requestIdentity)
        setDeletion({ item: variables.item, error: failure(error) });
    },
  });
  const uploading = useRef(false);
  const [uploadPending, setUploadPending] = useState(false);
  const pending = mutate.isPending || inspectDeletion.isPending || uploadPending;
  const changeTarget = (id: string) => {
    if (pending) return;
    setSelectedTarget(id);
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setDetail(null);
    setEditor(null);
    setDeletion(null);
    setOutcome(null);
    mutate.reset();
    inspectDeletion.reset();
  };
  const openEditor = (item?: MetaTemplate, copy = false) => {
    if (pending || !target || !caps(item && !copy ? "update" : "create") || (item && !item.draft))
      return;
    if (item && !copy && (!item.editable || target.provider !== "cloud")) return;
    const draft = structuredClone(item?.draft ?? emptyMetaTemplateDraft());
    if (copy) {
      draft.name = `${draft.name.slice(0, 480)}_v2`;
      draft.headerHandle = "";
    }
    setEditor({
      mode: item && !copy ? "update" : "create",
      initial: draft,
      template: item && !copy ? item : undefined,
      key: `${Date.now()}:${item?.id ?? "new"}`,
    });
    setOutcome(null);
    mutate.reset();
  };
  const openDeletion = (item: MetaTemplate) => {
    if (pending || !caps("delete")) return;
    setDeletion({ item });
    setConfirmation("");
    setConfirmAllLanguages(false);
    mutate.reset();
    inspectDeletion.mutate({ item, requestIdentity: identity });
  };
  const expectedConfirmation = deletion
    ? `${deletion.item.name} · ${deletion.item.language} · ${deletion.item.id}`
    : "";
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Modelos de mensagens Meta"
        description="Crie e acompanhe modelos oficiais das contas WhatsApp Business conectadas."
        actions={
          <>
            <Button
              variant="outline"
              disabled={!target || catalogue.isFetching || pending}
              onClick={() => {
                if (!pending) void catalogue.refetch();
              }}
            >
              <RefreshCw className="mr-2 size-4" />
              Atualizar da Meta
            </Button>
            <Button
              disabled={!caps("create") || pending || catalogue.isFetching}
              onClick={() => openEditor()}
            >
              <Plus className="mr-2 size-4" />
              Novo modelo
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-xl">
          <Label htmlFor="meta-template-target">Conta e números conectados</Label>
          <select
            id="meta-template-target"
            className={SELECT}
            value={selectedTarget}
            disabled={!contextReady || pending}
            onChange={(e) => changeTarget(e.target.value)}
          >
            <option value="">Selecione uma conta WhatsApp Business</option>
            {context.data?.targets.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label} ·{" "}
                {entry.numbers.map((number) => number.phone).join(", ") ||
                  "sem número sincronizado"}
                {!entry.enabled ? " · indisponível" : ""}
              </option>
            ))}
          </select>
        </div>
        <a
          href={managerUrl(target)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          Gerenciador da Meta
          <ExternalLink className="size-4" />
        </a>
      </div>
      {context.isPending ? (
        <p role="status">Carregando contas autorizadas…</p>
      ) : context.isError ? (
        <div role="alert" className="space-y-2">
          <p>Não foi possível carregar as contas. {failure(context.error)}</p>
          <Button variant="outline" onClick={() => void context.refetch()}>
            Tentar carregar contas novamente
          </Button>
        </div>
      ) : !contextReady ? (
        <p role="alert">
          Não foi possível confirmar a identidade e o acesso a este workspace. Atualize a central.
        </p>
      ) : context.data.targets.length === 0 ? (
        <p>
          Nenhuma conta autorizada disponível. Configure uma conexão em{" "}
          <a href="/settings/channels" className="text-primary underline">
            Canais de atendimento
          </a>
          .
        </p>
      ) : !selectedTarget ? (
        <p className="py-10 text-center text-muted-foreground">
          Escolha uma conta para consultar seus modelos na Meta.
        </p>
      ) : !target ? (
        <p role="alert">A conta selecionada deixou de estar disponível neste contexto.</p>
      ) : (
        <>
          <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
            <p>
              <strong>
                Catálogo compartilhado da conta WhatsApp Business
                {target.wabaId ? ` ${target.wabaId}` : ""}.
              </strong>{" "}
              Criar, editar ou excluir aqui afeta os números associados a essa conta:{" "}
              {target.numbers.map((number) => number.phone).join(", ") ||
                "nenhum número sincronizado"}
              .
            </p>
            <p>
              Nenhuma mensagem é enviada por esta central. Os envios continuam sujeitos à aprovação,
              consentimento, janela aplicável, qualidade e limites do canal.
            </p>
            {target.provider === "lovable" && (
              <p>
                Esta conexão usa o conector Lovable. Para alterar um modelo, crie uma cópia com novo
                nome; o anterior é preservado. Cabeçalhos de mídia e variáveis nomeadas exigem
                gerenciamento compatível na Meta.
              </p>
            )}
            {!target.enabled && (
              <p role="status">
                Esta conexão está indisponível para alterações. Confira a conexão antes de
                continuar.
              </p>
            )}
            {(readOnly || context.data.readOnly) && (
              <p role="status">Esta sessão está em modo somente leitura.</p>
            )}
          </div>
          {catalogue.data?.pages[0]?.providerNote && (
            <p className="text-sm text-muted-foreground">{catalogue.data.pages[0].providerNote}</p>
          )}
          {outcome && (
            <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">
              {outcome}
            </p>
          )}
          {mutate.isError && !editor && !deletion && (
            <p
              role="alert"
              className="text-sm text-destructive"
            >{`${failure(mutate.error)} Confira o catálogo atualizado antes de repetir a operação.`}</p>
          )}
          <div
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Filtros dos modelos carregados"
          >
            <div>
              <Label htmlFor="meta-template-search">Buscar nos modelos carregados</Label>
              <Input
                id="meta-template-search"
                value={filters.search}
                onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
                placeholder="Nome ou conteúdo"
              />
            </div>
            {(
              [
                ["status", "Status"],
                ["category", "Categoria"],
                ["language", "Idioma"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={`meta-filter-${key}`}>{label}</Label>
                <select
                  id={`meta-filter-${key}`}
                  className={SELECT}
                  value={filters[key]}
                  onChange={(e) => setFilters((current) => ({ ...current, [key]: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {[...new Set(records.map((item) => item[key]))].sort().map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {catalogue.isPending ? (
            <p role="status" className="py-10">
              Consultando modelos na Meta…
            </p>
          ) : catalogue.isError ? (
            <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-4">
              <p>Não foi possível concluir a consulta. {failure(catalogue.error)}</p>
              <p className="text-sm">A falha não significa que a conta está sem modelos.</p>
              <Button
                variant="outline"
                disabled={catalogue.isFetching}
                onClick={() => void catalogue.refetch()}
              >
                Tentar consultar modelos novamente
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground" role="status">
                {filtered.length} de {records.length} modelos carregados. Os filtros se aplicam aos
                itens carregados; use “Carregar mais modelos” para continuar a consulta.
              </p>
              <MetaTemplateList
                items={filtered}
                target={target}
                pending={pending || catalogue.isFetching}
                canCreate={caps("create")}
                canUpdate={caps("update")}
                canDelete={caps("delete")}
                onDetails={setDetail}
                onEdit={(item) => openEditor(item)}
                onCopy={(item) => openEditor(item, true)}
                onDelete={openDeletion}
              />
              {filtered.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  {records.length
                    ? "Nenhum modelo corresponde aos filtros carregados."
                    : "A Meta não retornou modelos para esta conta."}
                </p>
              )}
              {catalogue.hasNextPage && (
                <Button
                  variant="outline"
                  disabled={catalogue.isFetchingNextPage || pending}
                  onClick={() => void catalogue.fetchNextPage()}
                >
                  {catalogue.isFetchingNextPage ? "Carregando…" : "Carregar mais modelos"}
                </Button>
              )}
            </>
          )}
        </>
      )}
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do modelo</DialogTitle>
            <DialogDescription>
              Conteúdo e status recebidos da Meta. Uma prévia não aprova nem envia o modelo.
            </DialogDescription>
          </DialogHeader>
          {detail && <MetaTemplateDetails template={detail} />}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editor && target)}
        onOpenChange={(open) => {
          if (!open && !pending) setEditor(null);
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "update" ? "Editar modelo na Meta" : "Novo modelo de mensagem"}
            </DialogTitle>
            <DialogDescription>
              Revise o conteúdo e os números da conta antes de enviar a definição à Meta.
            </DialogDescription>
          </DialogHeader>
          {editor && target && (
            <MetaTemplateEditor
              key={`${identity}:${editor.key}`}
              initial={editor.initial}
              mode={editor.mode}
              target={target}
              pending={mutate.isPending}
              canSubmit={caps(editor.mode)}
              error={
                mutate.isError
                  ? `${failure(mutate.error)} Confira o catálogo atualizado antes de repetir a operação.`
                  : null
              }
              onCancel={() => setEditor(null)}
              onSubmit={(draft) =>
                mutate.mutate({
                  operation: editor.mode,
                  draft,
                  template: editor.template,
                  requestIdentity: identity,
                })
              }
              onUpload={async ({ appId, file }) => {
                if (
                  uploading.current ||
                  !target ||
                  target.provider !== "cloud" ||
                  !caps(editor.mode)
                )
                  throw Error("Sem autorização para enviar a amostra neste contexto.");
                const requestIdentity = identity;
                uploading.current = true;
                setUploadPending(true);
                try {
                  const base64 = await fileBase64(file);
                  if (!mounted.current || activeIdentity.current !== requestIdentity)
                    throw Error("O contexto mudou. Abra o editor novamente.");
                  const result = await uploadFn({
                    data: {
                      workspaceId,
                      targetId: target.id,
                      action: editor.mode,
                      appId,
                      filename: file.name,
                      mimeType: file.type,
                      base64,
                    },
                  });
                  if (activeIdentity.current !== requestIdentity || !mounted.current)
                    throw Error("O contexto mudou. Abra o editor novamente.");
                  return result;
                } finally {
                  uploading.current = false;
                  if (mounted.current) setUploadPending(false);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deletion)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeletion(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir modelo na Meta</DialogTitle>
            <DialogDescription>
              A exclusão afeta os números que compartilham esta conta e pode impedir campanhas,
              sequências e notificações que usam o modelo. O histórico de mensagens é preservado.
            </DialogDescription>
          </DialogHeader>
          {deletion && (
            <div className="space-y-4">
              <p className="break-all text-sm">
                Modelo: <strong>{deletion.item.name}</strong>
                <br />
                Idioma: {deletion.item.language}
                <br />
                ID: {deletion.item.id}
              </p>
              {inspectDeletion.isPending ? (
                <p role="status">Conferindo o alcance da exclusão na Meta…</p>
              ) : deletion.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {deletion.error} Feche e atualize o catálogo antes de tentar novamente.
                </p>
              ) : (
                deletion.preview && (
                  <>
                    <p className="text-sm">
                      {deletion.preview.scope === "all_languages"
                        ? `Este conector exclui TODOS os idiomas deste nome: ${deletion.preview.languages.join(", ")}.`
                        : "Será excluída somente a variante de idioma identificada acima."}
                    </p>
                    {deletion.preview.scope === "all_languages" && (
                      <p className="text-xs text-muted-foreground">
                        Esta consulta é um retrato. A exclusão por nome considera todos os idiomas
                        existentes na Meta no momento em que ela processar a operação, inclusive
                        alterações concorrentes.
                      </p>
                    )}
                    {deletion.preview.scope === "all_languages" && (
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={confirmAllLanguages}
                          disabled={pending}
                          onChange={(e) => setConfirmAllLanguages(e.target.checked)}
                        />
                        Confirmo a exclusão de todos os idiomas deste nome nesta conta.
                      </label>
                    )}
                    <div>
                      <Label htmlFor="meta-delete-confirmation">
                        Digite a identificação completa para confirmar
                      </Label>
                      <p className="mb-2 break-all text-xs text-muted-foreground">
                        {expectedConfirmation}
                      </p>
                      <Input
                        id="meta-delete-confirmation"
                        value={confirmation}
                        disabled={pending}
                        onChange={(e) => setConfirmation(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </>
                )
              )}
              {mutate.isError && (
                <p
                  role="alert"
                  className="text-sm text-destructive"
                >{`${failure(mutate.error)} Confira o catálogo atualizado antes de repetir a operação.`}</p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={pending} onClick={() => setDeletion(null)}>
                  Cancelar exclusão
                </Button>
                <Button
                  variant="destructive"
                  disabled={
                    pending ||
                    !caps("delete") ||
                    !deletion.preview ||
                    confirmation !== expectedConfirmation ||
                    (deletion.preview.scope === "all_languages" && !confirmAllLanguages)
                  }
                  onClick={() => {
                    if (
                      !pending &&
                      deletion.preview &&
                      confirmation === expectedConfirmation &&
                      (deletion.preview.scope !== "all_languages" || confirmAllLanguages)
                    )
                      mutate.mutate({
                        operation: "delete",
                        template: deletion.item,
                        deletionPreview: deletion.preview,
                        allLanguages: confirmAllLanguages,
                        requestIdentity: identity,
                      });
                  }}
                >
                  {mutate.isPending ? "Excluindo…" : "Excluir modelo na Meta"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MetaTemplateList({
  items,
  target,
  pending,
  canCreate,
  canUpdate,
  canDelete,
  onDetails,
  onEdit,
  onCopy,
  onDelete,
}: {
  items: MetaTemplate[];
  target: MetaTemplateTarget;
  pending: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onDetails: (template: MetaTemplate) => void;
  onEdit: (template: MetaTemplate) => void;
  onCopy: (template: MetaTemplate) => void;
  onDelete: (template: MetaTemplate) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Modelo</TableHead>
          <TableHead>Idioma</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Status na Meta</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={`${item.id}:${item.language}`}>
            <TableCell>
              <button
                type="button"
                className="break-all text-left font-medium text-primary"
                disabled={pending}
                onClick={() => onDetails(item)}
              >
                {item.name}
              </button>
            </TableCell>
            <TableCell>{item.language}</TableCell>
            <TableCell>{item.category}</TableCell>
            <TableCell>
              <Badge variant="secondary">{item.status}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Conferir ${item.name} ${item.language}`}
                  disabled={pending}
                  onClick={() => onDetails(item)}
                >
                  <FileText className="size-4" />
                </Button>
                {canUpdate && target.provider === "cloud" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${item.name} ${item.language}`}
                    disabled={pending || !item.editable || !item.draft}
                    title={
                      item.editReason ||
                      (item.draft ? "Alterar modelo" : "Formato avançado: gerencie na Meta")
                    }
                    onClick={() => {
                      if (item.editable && item.draft) onEdit(item);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                {canCreate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${target.provider === "lovable" ? "Nova versão de" : "Duplicar"} ${item.name} ${item.language}`}
                    disabled={pending || !item.draft}
                    title={
                      item.draft
                        ? "Criar cópia com novo nome, preservando o modelo atual"
                        : "Formato avançado: gerencie na Meta"
                    }
                    onClick={() => {
                      if (item.draft) onCopy(item);
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir ${item.name} ${item.language}`}
                    disabled={pending}
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
