// Gera um contrato a partir de um modelo (com variáveis já mescladas).
// Usado no TechContracts e no TechSales (aba de contratos do negócio).
import { readViewAs } from "@/lib/view-as-client";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { usedTokens } from "@/lib/contracts/template-tokens";
import { sanitizeHtml } from "@/components/rich-html-editor";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, FileStack, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  listContractTemplates,
  listContractTemplateSources,
  listTemplateServiceOptions,
  previewContractFromTemplate,
  createContractFromTemplate,
} from "@/lib/contracts/templates.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId?: string | null;
  companyId?: string | null;
  onCreated?: (contractId: string) => void;
};

export function ApplyContractTemplateDialog({
  open,
  onOpenChange,
  dealId,
  companyId,
  onCreated,
}: Props) {
  const permissions = usePermissions();
  const canCreate =
    !permissions.isLoading &&
    !permissions.isError &&
    !readViewAs()?.readOnly &&
    readViewAs()?.mode !== "role" &&
    (permissions.can("techcontracts.contracts.create.own") ||
      permissions.can("techcontracts.contracts.create.workspace"));
  const listSources = useServerFn(listContractTemplateSources);
  const [proposalId, setProposalId] = useState("none");
  const [entityId, setEntityId] = useState("none");
  const listTemplates = useServerFn(listContractTemplates);
  const listServices = useServerFn(listTemplateServiceOptions);
  const previewFn = useServerFn(previewContractFromTemplate);
  const createFn = useServerFn(createContractFromTemplate);
  const navigate = useNavigate();

  const [templateId, setTemplateId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("none");
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState<{ title: string; body_html: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contract-templates", "published"],
    queryFn: () => listTemplates({ data: { status: "published" } }),
    enabled: open,
  });
  const { data: services = [] } = useQuery({
    queryKey: ["contract-template-services-options"],
    queryFn: () => listServices(),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: sources, isError: sourcesError } = useQuery({
    queryKey: ["contract-template-sources", companyId, dealId],
    queryFn: () =>
      listSources({ data: { companyId: companyId ?? undefined, dealId: dealId ?? undefined } }),
    enabled: open && canCreate,
  });
  const selected = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const requiresProposal = usedTokens(selected?.body_html).some((key) =>
    key.startsWith("proposal."),
  );
  const ready =
    canCreate &&
    !!templateId &&
    (!requiresProposal || (proposalId !== "none" && entityId !== "none"));

  function reset() {
    setProposalId("none");
    setEntityId("none");
    setTemplateId("");
    setServiceId("none");
    setTitle("");
    setPreview(null);
  }

  async function loadPreview() {
    if (!ready) return;
    setLoadingPreview(true);
    try {
      const result = await previewFn({
        data: {
          templateId,
          proposalId: proposalId === "none" ? undefined : proposalId,
          contractingLegalEntityId: entityId === "none" ? undefined : entityId,
          dealId: dealId ?? undefined,
          companyId: companyId ?? undefined,
          serviceCatalogId: serviceId === "none" ? undefined : serviceId,
          title: title.trim() || undefined,
        },
      });
      setPreview({ title: result.title, body_html: result.body_html });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function generate() {
    if (!ready) return;
    setCreating(true);
    try {
      const row = await createFn({
        data: {
          templateId,
          proposalId: proposalId === "none" ? undefined : proposalId,
          contractingLegalEntityId: entityId === "none" ? undefined : entityId,
          dealId: dealId ?? undefined,
          companyId: companyId ?? undefined,
          serviceCatalogId: serviceId === "none" ? undefined : serviceId,
          title: title.trim() || undefined,
        },
      });
      toast.success("Contrato gerado em rascunho.");
      onCreated?.(row.id);
      reset();
      onOpenChange(false);
      navigate({ to: "/contracts/$id", params: { id: row.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-4 w-4 text-primary" /> Gerar contrato a partir de modelo
          </DialogTitle>
          <DialogDescription>
            As variáveis do modelo são preenchidas com os dados da empresa, do negócio e do serviço
            selecionados. Para modelos com Proposta Comercial, selecione a versão aceita pelo
            cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sourcesError ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar as propostas e pessoas jurídicas. Confira seu acesso e tente
              novamente.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="apply-template">Modelo publicado</Label>
            <Select
              value={templateId}
              onValueChange={(v) => {
                setTemplateId(v);
                setPreview(null);
              }}
            >
              <SelectTrigger id="apply-template">
                <SelectValue placeholder={isLoading ? "Carregando…" : "Selecione um modelo"} />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhum modelo publicado. Publique um modelo em Contratos → Modelos.
                  </div>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selected?.services?.length ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {selected.services.map((s) => (
                  <Badge key={s.id} variant="outline" className="text-[10px]">
                    {s.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apply-proposal">
              Proposta Comercial aceita{requiresProposal ? " (obrigatória)" : " (opcional)"}
            </Label>
            <Select
              value={proposalId}
              onValueChange={(v) => {
                setProposalId(v);
                setPreview(null);
              }}
            >
              <SelectTrigger id="apply-proposal">
                <SelectValue placeholder="Selecione a proposta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione a proposta</SelectItem>
                {sources?.proposals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} — versão {p.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Somente propostas aceitas pelo cliente. A versão vinculada será preservada.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apply-entity">
              Pessoa jurídica prestadora{requiresProposal ? " (obrigatória)" : ""}
            </Label>
            <Select
              value={entityId}
              onValueChange={(v) => {
                setEntityId(v);
                setPreview(null);
              }}
            >
              <SelectTrigger id="apply-entity">
                <SelectValue placeholder="Selecione a pessoa jurídica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione a pessoa jurídica</SelectItem>
                {sources?.entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                    {e.cnpj ? ` — ${e.cnpj}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apply-service">Serviço (opcional)</Label>
            <Select
              value={serviceId}
              onValueChange={(v) => {
                setServiceId(v);
                setPreview(null);
              }}
            >
              <SelectTrigger id="apply-service">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apply-title">Título do contrato (opcional)</Label>
            <Input
              id="apply-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setPreview(null);
              }}
              placeholder="Deixe em branco para gerar automaticamente"
            />
          </div>

          {preview ? (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-medium">{preview.title}</p>
              <article
                className="prose prose-sm max-h-72 max-w-none overflow-y-auto dark:prose-invert"
                // Sanitizado: o HTML do modelo é editável e não pode executar script.
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(preview.body_html ?? "") }}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={loadPreview} disabled={!ready || loadingPreview}>
            {loadingPreview ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-1 h-4 w-4" />
            )}
            Pré-visualizar
          </Button>
          <Button onClick={generate} disabled={!ready || creating}>
            {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Gerar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
