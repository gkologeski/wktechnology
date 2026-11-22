import { SupplierDocumentIntake } from "@/components/hiring-requests/supplier-document-intake";
import { PreparationOriginNotice } from "@/components/hiring-requests/preparation-origin-notice";
import { useEffect, useRef, useState } from "react";
import { ApprovalPanel } from "./approval-panel";
import { FormalizationPanel } from "./formalization-panel";
import { ExecutionPanel } from "./execution-panel";
import { ExecutionHistory } from "./execution-history";
import { OperationsPanel } from "./operations-panel";
import { OperationsHistory } from "./operations-history";
import { EconomicsPanel } from "./economics-panel";
import { EconomicsHistory } from "./economics-history";
import { PayablesHistory, PayablesPanel } from "./payables-panel";
import { getPreparationApproval } from "./approvals.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  PageHeader,
  FormSection,
  EmptyState,
  ListPageSkeleton,
  MetaPill,
} from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { useSharedAction } from "@/lib/access-control/use-shared-action";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { readViewAs } from "@/lib/view-as-client";
import { PreparationReferenceField } from "@/components/hiring-requests/preparation-reference-field";
import { PreparationForm } from "@/components/hiring-requests/preparation-form";
import {
  listPreparation,
  savePreparation,
  preparationHistory,
  searchPreparationPicker,
  preparationReference,
} from "./requests.functions";
import {
  resourceFor,
  statusLabels,
  emptyPreparation,
  preparationData,
  type RequestKind,
  type PreparationRow,
  type PreparationData,
  wizardSteps,
  modalityLabels,
} from "./types";
function useDebounced(value: string) {
  const [v, set] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => set(value), 300);
    return () => clearTimeout(timer);
  }, [value]);
  return v;
}
export function PreparationScreen({
  kind,
  requestId,
  fiscalDocumentId,
}: {
  kind: RequestKind;
  requestId?: string;
  fiscalDocumentId?: string;
}) {
  const p = usePermissions();
  const { user } = useAuth();
  if (p.isLoading) return <ListPageSkeleton />;
  if (p.isError || !p.workspaceId)
    return (
      <div role="alert" className="p-6">
        Não foi possível verificar o workspace.{" "}
        <Button onClick={p.refetch}>Tentar novamente</Button>
      </div>
    );
  return user ? (
    <PreparationContent
      key={`${user.id}:${p.workspaceId}:${kind}:${requestId ?? "list"}:${fiscalDocumentId ?? "none"}`}
      userId={user.id}
      kind={kind}
      requestId={requestId}
      fiscalDocumentId={fiscalDocumentId}
    />
  ) : null;
}
function PreparationContent({
  kind,
  requestId,
  userId,
  fiscalDocumentId,
}: {
  kind: RequestKind;
  requestId?: string;
  userId: string;
  fiscalDocumentId?: string;
}) {
  const resource = resourceFor(kind),
    p = usePermissions();
  const canView = useSharedAction(resource, "view"),
    canCreate = useSharedAction(resource, "create"),
    canUpdate = useSharedAction(resource, "update");
  const canReadReference = useSharedAction(resource + ".reference", "view");
  const canWriteReference = useSharedAction(resource + ".reference", "update");
  const [step, setStep] = useState(0),
    [referenceValue, setReferenceValue] = useState<number | null>(null),
    [referenceDirty, setReferenceDirty] = useState(false);
  const cancelAllowed =
    !p.isLoading &&
    !p.isError &&
    !!p.workspaceId &&
    canView &&
    !readViewAs()?.readOnly &&
    p.can(resource + ".cancel.update.workspace");
  const [search, setSearch] = useState(""),
    term = useDebounced(search),
    [offset, setOffset] = useState(0),
    [open, setOpen] = useState(false),
    [row, setRow] = useState<PreparationRow | null>(null),
    [form, setForm] = useState<PreparationData>(emptyPreparation(kind)),
    [originBlocked, setOriginBlocked] = useState(false),
    [error, setError] = useState(""),
    [cancel, setCancel] = useState(false),
    [historyOffset, setHistoryOffset] = useState(0);
  const qc = useQueryClient(),
    listFn = useServerFn(listPreparation),
    saveFn = useServerFn(savePreparation),
    historyFn = useServerFn(preparationHistory),
    referenceFn = useServerFn(preparationReference);
  const directFn = useServerFn(getPreparationApproval);
  const direct = useQuery({
    queryKey: ["preparation-direct", userId, p.workspaceId, kind, requestId],
    enabled: canView && !!requestId,
    queryFn: () => directFn({ data: { kind, id: requestId ?? "" } }),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const openedDirect = useRef<string | null>(null);
  useEffect(() => {
    if (requestId && direct.isError) {
      openedDirect.current = null;
      setOpen(false);
      setRow(null);
      setReferenceValue(null);
      return;
    }
    if (
      !direct.isFetchedAfterMount ||
      direct.isFetching ||
      !direct.data ||
      !requestId ||
      openedDirect.current === requestId
    )
      return;
    openedDirect.current = requestId;
    const saved = direct.data.request;
    setStep(3);
    setRow(saved);
    setForm(savedToForm(saved));
    setOpen(true);
    setReferenceValue(null);
    setReferenceDirty(false);
    setHistoryOffset(0);
    setError("");
  }, [direct.data, direct.isFetchedAfterMount, direct.isFetching, direct.isError, requestId]);
  const directPending = !!requestId && row?.id === requestId && direct.isFetching;
  const reference = useQuery({
    queryKey: ["preparation-reference", userId, p.workspaceId, kind, row?.id, row?.revision],
    enabled: open && !!row && canReadReference,
    queryFn: () => referenceFn({ data: { kind, id: row?.id ?? "" } }),
    retry: false,
  });
  useEffect(() => {
    if (!canReadReference) {
      setReferenceValue(null);
      setReferenceDirty(false);
    } else if (reference.data && !referenceDirty) setReferenceValue(reference.data.reference_value);
  }, [canReadReference, reference.data, referenceDirty]);
  const pending = useRef<{ operation: string; fingerprint: string } | null>(null);
  const query = useQuery({
    queryKey: ["preparation-page", userId, p.workspaceId, kind, term, offset],
    enabled: canView,
    queryFn: () => listFn({ data: { kind, search: term, offset } }),
    retry: false,
  });
  const history = useQuery({
    queryKey: [
      "preparation-history",
      userId,
      p.workspaceId,
      kind,
      row?.id,
      row?.revision,
      historyOffset,
    ],
    enabled: open && !!row && canView,
    queryFn: () => historyFn({ data: { kind, id: row?.id ?? "", offset: historyOffset } }),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (input: {
      kind: RequestKind;
      id: string | null;
      revision: number;
      operation: string;
      form: PreparationData & { reference_value?: number | null };
    }) => saveFn({ data: input }),
    onSuccess: (saved) => {
      pending.current = null;
      setRow(saved);
      setForm(preparationData.parse(savedToForm(saved)));
      setError("");
      setCancel(false);
      setReferenceDirty(false);
      void qc.invalidateQueries({ queryKey: ["preparation-reference"] });
      void qc.invalidateQueries({ queryKey: ["preparation-page"] });
      void qc.invalidateQueries({ queryKey: ["preparation-history"] });
      void qc.invalidateQueries({ queryKey: ["preparation-approval"] });
    },
    onError: (e) => setError(e.message),
  });
  function submit(data: PreparationData) {
    if (data.status !== "cancelled" && originBlocked) {
      setError("Confira os vínculos e a entidade legal na Conferência da origem antes de salvar.");
      return;
    }
    try {
      const parsed = {
        ...preparationData.parse(data),
        ...(referenceDirty && canWriteReference && data.status !== "cancelled"
          ? { reference_value: referenceValue }
          : {}),
      };
      const fingerprint = JSON.stringify({ id: row?.id, revision: row?.revision, data: parsed });
      if (pending.current?.fingerprint !== fingerprint)
        pending.current = { operation: crypto.randomUUID(), fingerprint };
      const operation = pending.current?.operation;
      if (!operation) return;
      save.mutate({
        kind,
        id: row?.id ?? null,
        revision: row?.revision ?? 0,
        operation,
        form: parsed,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dados inválidos.");
    }
  }
  function edit(r: PreparationRow | null) {
    setStep(r ? 3 : 0);
    setReferenceValue(null);
    setReferenceDirty(false);
    setRow(r);
    setForm(r ? savedToForm(r) : emptyPreparation(kind));
    setHistoryOffset(0);
    setError("");
    pending.current = null;
    setOpen(true);
  }
  const locked = save.isPending || row?.status === "cancelled" || (row ? !canUpdate : !canCreate);
  if (p.isLoading) return <ListPageSkeleton />;
  if (p.isError)
    return (
      <div role="alert" className="p-6">
        Não foi possível verificar suas permissões.{" "}
        <Button onClick={p.refetch}>Tentar novamente</Button>
      </div>
    );
  if (!canView)
    return (
      <EmptyState
        title="Acesso não autorizado"
        description="Esta página exige permissão específica para consultar solicitações."
      />
    );
  const rows = query.data?.slice(0, 50) ?? [];
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-5 min-w-0">
      <PageHeader
        title={
          kind === "professional" ? "Solicitações de contratação" : "Contratação de fornecedores"
        }
        eyebrow={kind === "professional" ? "TechPeople" : "TechContracts"}
        primaryAction={
          canCreate ? (
            <Button onClick={() => edit(null)}>
              <Plus className="size-4" />
              Nova solicitação
            </Button>
          ) : null
        }
      />
      {requestId && direct.isLoading && <ListPageSkeleton />}
      {requestId && direct.isError && (
        <div role="alert">
          Não foi possível abrir a solicitação deste link. Confira seu acesso e workspace.{" "}
          <Button variant="outline" onClick={() => void direct.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-3 items-center">
        <Label htmlFor="requests-search">
          <Search className="size-4" aria-hidden />
          <span className="sr-only">Buscar solicitações por título</span>
        </Label>
        <Input
          id="requests-search"
          type="search"
          className="max-w-md"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="Buscar por título"
        />
      </div>
      {query.isLoading ? (
        <ListPageSkeleton />
      ) : query.isError ? (
        <div role="alert">
          Não foi possível carregar as solicitações.{" "}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Revisão</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-normal break-words">{r.title}</TableCell>
                <TableCell>
                  <MetaPill>{statusLabels[r.status]}</MetaPill>
                </TableCell>
                <TableCell>{r.revision}</TableCell>
                <TableCell>
                  <Button variant="ghost" onClick={() => edit(r)}>
                    Abrir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title={term ? "Nenhuma solicitação encontrada" : "Nenhuma solicitação"}
          action={canCreate ? <Button onClick={() => edit(null)}>Nova solicitação</Button> : null}
        />
      )}
      <div className="flex items-center justify-end gap-3">
        <Button
          aria-label="Página anterior"
          variant="outline"
          disabled={offset === 0 || query.isFetching}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm">Página {Math.floor(offset / 50) + 1}</span>
        <Button
          aria-label="Próxima página"
          variant="outline"
          disabled={(query.data?.length ?? 0) <= 50 || query.isFetching}
          onClick={() => setOffset(offset + 50)}
        >
          <ChevronRight />
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!save.isPending) setOpen(v);
        }}
      >
        <DialogContent
          className="sm:max-w-6xl max-h-[90dvh] overflow-y-auto"
          onEscapeKeyDown={(event) => {
            const target = event.target;
            if (
              target instanceof HTMLElement &&
              target.getAttribute("role") === "combobox" &&
              target.getAttribute("aria-expanded") === "true"
            )
              event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {directPending
                ? "Conferindo acesso à solicitação…"
                : row
                  ? row.title
                  : "Nova solicitação"}
            </DialogTitle>
          </DialogHeader>
          <fieldset
            className="contents"
            disabled={directPending}
            hidden={directPending}
            inert={directPending || undefined}
            style={directPending ? { display: "none" } : undefined}
          >
            <nav
              aria-label="Etapas da solicitação"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              {wizardSteps.map((label, index) => (
                <Button
                  key={label}
                  variant={step === index ? "default" : "outline"}
                  aria-current={step === index ? "step" : undefined}
                  onClick={() => setStep(index)}
                >
                  {index + 1}. {label}
                </Button>
              ))}
            </nav>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0">
                {kind === "supplier" && step === 0 && (
                  <SupplierDocumentIntake
                    key={`${row?.id ?? "new"}:${open}`}
                    form={form}
                    disabled={locked}
                    canWriteReference={
                      canReadReference && canWriteReference && (!row || reference.isSuccess)
                    }
                    onApply={setForm}
                    onReference={(n) => {
                      setReferenceValue(n);
                      setReferenceDirty(true);
                    }}
                  />
                )}
                <PreparationForm
                  step={step}
                  referenceValue={referenceValue}
                  canReadReference={canReadReference && (!row || reference.isSuccess)}
                  canWriteReference={canWriteReference && (!row || reference.isSuccess)}
                  onReferenceChange={(v) => {
                    setReferenceValue(v);
                    setReferenceDirty(true);
                  }}
                  kind={kind}
                  value={form}
                  onChange={setForm}
                  disabled={locked}
                  picker={(picker, label, value, onChange) => (
                    <PreparationReferenceField
                      key={picker}
                      kind={kind}
                      picker={picker}
                      label={label}
                      value={value}
                      onChange={onChange}
                      disabled={locked || step === 3}
                      company={form.company_id}
                      commercialContractId={form.commercial_contract_id}
                    />
                  )}
                />
                {step === 2 && row && canReadReference && reference.isError && (
                  <div role="alert">
                    Não foi possível carregar o valor.{" "}
                    <Button variant="outline" onClick={() => void reference.refetch()}>
                      Tentar novamente
                    </Button>
                  </div>
                )}
                {step === 3 && (
                  <FormSection title="Preparação">
                    <Label htmlFor="request-status">Situação</Label>
                    <Select
                      disabled={locked || !row}
                      value={form.status}
                      onValueChange={(v) => {
                        if (v === "draft" || v === "ready") setForm({ ...form, status: v });
                      }}
                    >
                      <SelectTrigger id="request-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="ready">Pronta para aprovação</SelectItem>
                        {form.status === "cancelled" && (
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Pronta para aprovação não significa aprovada. Não autoriza recrutamento,
                      admissão, contratos ou envio de mensagens.
                    </p>
                  </FormSection>
                )}
                {row && (
                  <FormSection title={`Histórico · revisão ${row.revision}`}>
                    {history.isLoading ? (
                      <ListPageSkeleton />
                    ) : history.isError ? (
                      <div role="alert">
                        Não foi possível carregar o histórico.{" "}
                        <Button variant="outline" onClick={() => void history.refetch()}>
                          Tentar novamente
                        </Button>
                      </div>
                    ) : (
                      <>
                        <ol className="space-y-3">
                          {history.data?.slice(0, 50).map((e) => (
                            <li key={e.id} className="border-b py-2 text-sm">
                              <strong>
                                Revisão {e.revision} · {statusLabels[e.snapshot.status]}
                              </strong>
                              <p>{e.snapshot.title}</p>
                              <p className="whitespace-pre-wrap break-words">
                                {e.snapshot.scope_text}
                              </p>
                              <p className="text-muted-foreground">
                                {new Date(e.created_at).toLocaleString("pt-BR")} · Autor{" "}
                                {e.actor_id}
                              </p>
                            </li>
                          ))}
                        </ol>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            disabled={!historyOffset}
                            onClick={() => setHistoryOffset(Math.max(0, historyOffset - 50))}
                          >
                            Mais recente
                          </Button>
                          <Button
                            variant="outline"
                            disabled={(history.data?.length ?? 0) <= 50}
                            onClick={() => setHistoryOffset(historyOffset + 50)}
                          >
                            Mais antigo
                          </Button>
                        </div>
                      </>
                    )}
                  </FormSection>
                )}
                {row && <ExecutionHistory kind={kind} row={row} />}
                {row && (
                  <OperationsHistory
                    kind={kind}
                    row={row}
                    fiscalDocumentId={row.id === requestId ? fiscalDocumentId : undefined}
                  />
                )}
                {row && <EconomicsHistory kind={kind} row={row} />}
                {row && <PayablesHistory kind={kind} row={row} />}
                {row && (
                  <ApprovalPanel
                    key={`history:${row.id}`}
                    kind={kind}
                    row={row}
                    dirty={
                      referenceDirty || JSON.stringify(form) !== JSON.stringify(savedToForm(row))
                    }
                    busy={save.isPending}
                    history
                  />
                )}
              </div>
              <aside className="border-l pl-4 space-y-5 min-w-0">
                <h2 className="font-semibold">Resumo e jornada</h2>
                <p className="break-words">{form.title || "Nova solicitação"}</p>
                <p>{modalityLabels[form.modality]}</p>
                <p>
                  {statusLabels[form.status]} · Revisão {row?.revision ?? "inicial"}
                </p>
                <ol className="space-y-2">
                  {wizardSteps.map((label, index) => (
                    <li key={label}>
                      <Button
                        variant="ghost"
                        aria-current={step === index ? "step" : undefined}
                        onClick={() => setStep(index)}
                      >
                        {label}
                      </Button>
                    </li>
                  ))}
                </ol>
                <PreparationOriginNotice
                  kind={kind}
                  form={form}
                  enabled={open}
                  editable={!locked}
                  onBlocked={setOriginBlocked}
                  onUseEntity={(id) => setForm((v) => ({ ...v, legal_entity_id: id }))}
                />
                <h3 className="font-semibold">Responsáveis</h3>
                <p className="text-sm break-words">
                  Solicitante: {row?.created_by ?? "Você ao salvar"}
                </p>
                <AreaSummary kind={kind} id={form.area_id} />
                {row ? (
                  <ApprovalPanel
                    key={row.id}
                    kind={kind}
                    row={row}
                    dirty={
                      referenceDirty || JSON.stringify(form) !== JSON.stringify(savedToForm(row))
                    }
                    busy={save.isPending}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Salve a solicitação antes de solicitar aprovação.
                  </p>
                )}
                {row && (
                  <FormalizationPanel
                    key={`formal:${row.id}`}
                    kind={kind}
                    row={row}
                    dirty={
                      referenceDirty || JSON.stringify(form) !== JSON.stringify(savedToForm(row))
                    }
                    busy={save.isPending}
                  />
                )}
                {row && (
                  <ExecutionPanel
                    key={`exec:${row.id}`}
                    kind={kind}
                    row={row}
                    dirty={
                      referenceDirty || JSON.stringify(form) !== JSON.stringify(savedToForm(row))
                    }
                    busy={save.isPending}
                  />
                )}
                {row && (
                  <OperationsPanel
                    key={`ops:${row.id}`}
                    kind={kind}
                    row={row}
                    dirty={
                      referenceDirty || JSON.stringify(form) !== JSON.stringify(savedToForm(row))
                    }
                    busy={save.isPending}
                  />
                )}
                {row && <EconomicsPanel key={`econ:${row.id}`} kind={kind} row={row} />}
                {row && <PayablesPanel key={`pay:${row.id}`} kind={kind} row={row} />}
              </aside>
            </div>
            {error && (
              <div role="alert" className="text-destructive space-y-2">
                {error}
                {error.includes("REVISION_CONFLICT") && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const fresh = await listFn({
                        data: { kind, search: row?.title ?? "", offset: 0 },
                      });
                      const found = fresh.find((r) => r.id === row?.id);
                      if (found) edit(found);
                      else setError("Solicitação não encontrada. Feche e atualize a lista.");
                    }}
                  >
                    Recarregar solicitação
                  </Button>
                )}
              </div>
            )}
            <DialogFooter className="flex-wrap gap-2">
              {row && row.status !== "cancelled" && cancelAllowed && (
                <Button
                  variant="destructive"
                  disabled={save.isPending}
                  onClick={() => setCancel(true)}
                >
                  Cancelar solicitação
                </Button>
              )}
              <Button variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>
                Fechar
              </Button>
              <Button
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep(Math.max(0, step - 1))}
              >
                Voltar
              </Button>
              {step < 3 && <Button onClick={() => setStep(step + 1)}>Continuar</Button>}
              <Button
                disabled={
                  locked ||
                  originBlocked ||
                  !form.title.trim() ||
                  (canReadReference && !!row && !reference.isSuccess)
                }
                onClick={() => submit(form)}
              >
                {save.isPending ? "Salvando…" : row ? "Salvar alterações" : "Criar rascunho"}
              </Button>
            </DialogFooter>
          </fieldset>
        </DialogContent>
      </Dialog>
      <AlertDialog open={cancel && !directPending} onOpenChange={setCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação ficará cancelada, sem apagar o histórico e sem efeitos em outros
              registros. Alterações ainda não salvas não serão incluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (row) submit({ ...savedToForm(row), status: "cancelled" });
              }}
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function AreaSummary({ kind, id }: { kind: RequestKind; id: string | null }) {
  const { workspaceId } = usePermissions();
  const fn = useServerFn(searchPreparationPicker);
  const result = useQuery({
    queryKey: ["preparation-area-summary", workspaceId, kind, id],
    enabled: !!id,
    queryFn: () => fn({ data: { kind, picker: "area", selected: id, search: "", company: null } }),
    retry: false,
  });
  return (
    <p className="text-sm break-words">
      Área:{" "}
      {!id
        ? "Não definida"
        : result.isLoading
          ? "Carregando…"
          : (result.data?.[0]?.label ?? "Indisponível para consulta")}
    </p>
  );
}
function savedToForm(r: PreparationRow): PreparationData {
  return {
    title: r.title,
    scope_text: r.scope_text,
    purpose: r.purpose,
    area_id: r.area_id,
    legal_entity_id: r.legal_entity_id,
    regime: r.regime,
    person_id: r.person_id,
    company_id: r.company_id,
    contact_id: r.contact_id,
    deal_id: r.deal_id,
    additional_deal_ids: r.additional_deal_ids ?? [],
    project_id: r.project_id,
    commercial_contract_id: r.commercial_contract_id,
    status: r.status,
    selection_mode: r.selection_mode,
    modality: r.modality,
    release_condition: r.release_condition,
  };
}
