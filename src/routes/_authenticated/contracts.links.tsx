// Fila de vinculação manual entre contratos de prestação e de compra.
// Alimentada pela importação em lote: contratos sem par identificado pela IA.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, Link2, ScanSearch, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dismissContractLink,
  listContractsPendingLink,
  type PendingLinkRow,
} from "@/lib/contracts/import.functions";
import {
  listContracts,
  linkContractParent,
  linkContractAmendment,
} from "@/lib/contracts.functions";
import { DEFAULT_CONTRACTS_SEARCH } from "@/lib/contracts/list-search";
import { AiLinkSuggestionsDialog } from "@/components/contracts/ai-link-suggestions-dialog";
import { AiLinkSuggestionsHistoryCard } from "@/components/contracts/ai-link-suggestions-history-card";


export const Route = createFileRoute("/_authenticated/contracts/links")({
  head: () => ({
    meta: [
      { title: "Vinculação de contratos" },
      {
        name: "description",
        content: "Vincule manualmente contratos de compra aos contratos de prestação.",
      },
      { property: "og:title", content: "Vinculação de contratos" },
      {
        property: "og:description",
        content: "Fila de contratos importados sem vínculo identificado automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractLinksPage,
});

const ROLE_LABEL: Record<string, string> = { provider: "Prestação", client: "Compra" };

function ContractLinksPage() {
  const listFn = useServerFn(listContractsPendingLink);
  const dismissFn = useServerFn(dismissContractLink);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "provider" | "client" | "amendment">("all");
  const [target, setTarget] = useState<PendingLinkRow | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);


  const { data = [], isLoading } = useQuery({
    queryKey: ["contracts-pending-link", role],
    queryFn: () => listFn({ data: { role } }) as Promise<PendingLinkRow[]>,
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((r) =>
      `${r.title} ${r.number ?? ""} ${r.company_name ?? ""}`.toLowerCase().includes(term),
    );
  }, [data, search]);

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id, dismissed: true } }),
    onSuccess: () => {
      toast.success("Contrato removido da fila de vinculação.");
      void qc.invalidateQueries({ queryKey: ["contracts-pending-link"] });
      void qc.invalidateQueries({ queryKey: ["contracts", "pending-link-count"] });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vinculação de contratos"
        count={rows.length}
        countLabel={rows.length === 1 ? "pendência" : "pendências"}
        description="Contratos importados em que o par prestação ↔ compra não foi identificado automaticamente."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAiOpen(true)} disabled={rows.length === 0}>
              <Sparkles className="h-4 w-4 mr-2" /> Analisar com IA
            </Button>
            <Button variant="outline" onClick={() => setRolesOpen(true)}>
              <ScanSearch className="h-4 w-4 mr-2" /> Recalcular papéis
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contracts" search={DEFAULT_CONTRACTS_SEARCH}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Contratos
              </Link>
            </Button>
          </div>
        }

      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="link-search">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="link-search"
              className="pl-8"
              placeholder="Número, título ou empresa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5 sm:w-56">
          <Label htmlFor="link-role">Tipo</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger id="link-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="provider">Prestação</SelectItem>
              <SelectItem value="client">Compra</SelectItem>
              <SelectItem value="amendment">Aditivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Link2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Nada pendente de vinculação</p>
          <p className="text-xs text-muted-foreground">
            Contratos importados sem par identificado aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to="/contracts/$id"
                    params={{ id: r.id }}
                    className="font-medium text-sm hover:underline truncate"
                  >
                    {r.number ? `${r.number} · ` : ""}
                    {r.title}
                  </Link>
                  <Badge variant="secondary">
                    {r.document_kind === "amendment" ? "Aditivo" : (ROLE_LABEL[r.role] ?? r.role)}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.company_name ? `Contraparte: ${r.company_name}` : "Sem contraparte vinculada"}
                  {r.contracting_name ? ` · Contratante: ${r.contracting_name}` : ""}
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {r.reason}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setTarget(r)}>
                  <Link2 className="h-4 w-4 mr-2" /> Vincular
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismiss.mutate(r.id)}
                  disabled={dismiss.isPending}
                  aria-label="Remover da fila"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AiLinkSuggestionsHistoryCard />



      {target ? (
        <LinkDialog
          row={target}
          onOpenChange={(v) => !v && setTarget(null)}
          onLinked={() => {
            setTarget(null);
            void qc.invalidateQueries({ queryKey: ["contracts-pending-link"] });
            void qc.invalidateQueries({ queryKey: ["contracts", "pending-link-count"] });
            void qc.invalidateQueries({ queryKey: ["contracts"] });
          }}
        />
      ) : null}

      {aiOpen ? (
        <AiLinkSuggestionsDialog
          role={role}
          onOpenChange={(v) => setAiOpen(v)}
          onApplied={() => {
            void qc.invalidateQueries({ queryKey: ["contracts-pending-link"] });
            void qc.invalidateQueries({ queryKey: ["contracts", "pending-link-count"] });
            void qc.invalidateQueries({ queryKey: ["contracts"] });
          }}
        />
      ) : null}
    </div>
  );
}

function LinkDialog({
  row,
  onOpenChange,
  onLinked,
}: {
  row: PendingLinkRow;
  onOpenChange: (v: boolean) => void;
  onLinked: () => void;
}) {
  const listFn = useServerFn(listContracts);
  const linkFn = useServerFn(linkContractParent);
  const linkAmendmentFn = useServerFn(linkContractAmendment);
  const [selected, setSelected] = useState<string | null>(null);

  const isAmendment = row.document_kind === "amendment";
  // Aditivo escolhe o contrato principal do mesmo tipo (prestação/compra).
  // Compra escolhe um pai de prestação; prestação escolhe o filho de compra.
  const wantRole = isAmendment ? row.role : row.role === "client" ? "provider" : "client";

  const { data = [], isLoading } = useQuery({
    queryKey: ["contracts-link-candidates", wantRole],
    queryFn: () => listFn({ data: {} }),
    staleTime: 60_000,
  });

  const options = (
    data as Array<{
      id: string;
      number: string | null;
      title: string;
      role: string;
      document_kind?: string | null;
    }>
  ).filter(
    (c) =>
      c.role === wantRole &&
      c.id !== row.id &&
      (!isAmendment || (c.document_kind ?? "main") === "main"),
  );

  const mut = useMutation({
    mutationFn: async () => {
      if (isAmendment) {
        await linkAmendmentFn({
          data: { amendmentId: row.id, mainContractId: selected as string },
        });
        return;
      }
      const childId = row.role === "client" ? row.id : (selected as string);
      const parentId = row.role === "client" ? (selected as string) : row.id;
      await linkFn({ data: { childId, parentId } });
    },
    onSuccess: () => {
      toast.success(isAmendment ? "Aditivo vinculado." : "Contratos vinculados.");
      onLinked();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular contrato</DialogTitle>
          <DialogDescription>
            {isAmendment
              ? "Escolha o contrato principal ao qual este aditivo pertence."
              : row.role === "client"
                ? "Escolha o contrato de prestação correspondente a este contrato de compra."
                : "Escolha o contrato de compra correspondente a este contrato de prestação."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">
              {row.number ? `${row.number} · ` : ""}
              {row.title}
            </div>
            {row.referenced_numbers.length ? (
              <div className="text-xs text-muted-foreground mt-1">
                Números citados no documento: {row.referenced_numbers.join(", ")}
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="link-target">
              {isAmendment
                ? "Contrato principal"
                : wantRole === "provider"
                  ? "Contrato de prestação"
                  : "Contrato de compra"}
            </Label>
            <Select value={selected ?? ""} onValueChange={setSelected}>
              <SelectTrigger id="link-target">
                <SelectValue placeholder={isLoading ? "Carregando…" : "Selecionar contrato…"} />
              </SelectTrigger>
              <SelectContent>
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.number ? `${c.number} · ` : ""}
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!selected || mut.isPending}>
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
