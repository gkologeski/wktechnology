import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IsoDatePicker } from "@/components/iso-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useSharedAction } from "@/lib/access-control/use-shared-action";
import {
  decideDelivery,
  getOperations,
  listDeliveryProjects,
  reviewFiscalDocument,
  saveDelivery,
  submitDelivery,
  uploadFiscalDocument,
} from "./operations.functions";
import {
  allowedFiscalTypes,
  deliveryStatusLabel,
  fiscalTypeLabel,
  modalityLabel,
  FISCAL_MAX_BYTES,
  type FiscalDocType,
  type FreelanceModality,
  type OpsContext,
  type OpsDelivery,
  type OpsFiscal,
} from "./operations-types";
import { resourceFor, type RequestKind, type PreparationRow } from "./types";

const NONE = "__none__";
export function useOperations(kind: RequestKind, row: PreparationRow) {
  const p = usePermissions(),
    view = useSharedAction(resourceFor(kind), "view"),
    get = useServerFn(getOperations);
  const q = useQuery({
    queryKey: ["hiring-operations", p.workspaceId, row.id, row.revision],
    enabled: view,
    queryFn: () => get({ data: { kind, id: row.id } }) as Promise<OpsContext>,
    retry: false,
  });
  return { view, q };
}
const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  void qc.invalidateQueries({ queryKey: ["hiring-operations"] });

/** Lateral actions: define/submit/decide deliveries and upload/review private fiscal documents. */
export function OperationsPanel({
  kind,
  row,
  dirty,
  busy,
}: {
  kind: RequestKind;
  row: PreparationRow;
  dirty: boolean;
  busy: boolean;
}) {
  const { view, q } = useOperations(kind, row);
  if (!view) return null;
  if (q.isLoading) return <p role="status">Carregando entregas…</p>;
  if (q.isError)
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>Entregas e documentos fiscais indisponíveis.</p>
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const d = q.data;
  if (!d || !d.started) return null;
  const locked = dirty || busy || q.isFetching;
  return (
    <section className="space-y-4 text-sm" aria-label="Entregas e documentos fiscais">
      <h3 className="font-semibold">Entregas e documentos fiscais</h3>
      {d.proof_problem && <p role="status">{d.proof_problem}</p>}
      <p className="text-xs text-muted-foreground">
        Aceites e conferências não geram títulos nem pagamentos e não autenticam documentos junto a
        órgãos fiscais.
      </p>
      {!d.proof_problem && d.can_manage_deliveries && (
        <DeliveryForm kind={kind} row={row} ctx={d} locked={locked} />
      )}
      {!d.proof_problem &&
        d.deliveries.map((x) => (
          <DeliveryActions key={x.id} kind={kind} row={row} ctx={d} delivery={x} locked={locked} />
        ))}
      {!d.proof_problem && d.can_register_fiscal && (
        <FiscalUpload kind={kind} row={row} ctx={d} locked={locked} />
      )}
      {!d.proof_problem &&
        (d.fiscal ?? [])
          .filter((f) => f.can_review)
          .map((f) => <FiscalReview key={f.id} kind={kind} row={row} doc={f} locked={locked} />)}
    </section>
  );
}

function DeliveryForm({
  kind,
  row,
  ctx,
  locked,
  edit,
}: {
  kind: RequestKind;
  row: PreparationRow;
  ctx: OpsContext;
  locked: boolean;
  edit?: OpsDelivery;
}) {
  const qc = useQueryClient(),
    act = useServerFn(saveDelivery),
    list = useServerFn(listDeliveryProjects);
  const c = edit?.current;
  const [title, setTitle] = useState(c?.title ?? ""),
    [criteria, setCriteria] = useState(c?.criteria ?? ""),
    [from, setFrom] = useState(c?.period_start ?? ""),
    [to, setTo] = useState(c?.period_end ?? ""),
    [responsible, setResponsible] = useState(c?.responsible_id ?? ""),
    [project, setProject] = useState(c?.project_id ?? ""),
    [milestone, setMilestone] = useState(c?.milestone_id ?? ""),
    [reason, setReason] = useState(""),
    [projectSearch, setProjectSearch] = useState(""),
    [milestoneSearch, setMilestoneSearch] = useState(""),
    [operation, setOperation] = useState(() => crypto.randomUUID());
  const debouncedProject = useDebouncedValue(projectSearch, 250),
    debouncedMilestone = useDebouncedValue(milestoneSearch, 250);
  const refs = useQuery({
    queryKey: [
      "hiring-delivery-projects",
      row.id,
      project || null,
      milestone || null,
      debouncedProject,
      debouncedMilestone,
    ],
    queryFn: () =>
      list({
        data: {
          kind,
          id: row.id,
          projectId: project || null,
          milestoneId: milestone || null,
          projectSearch: debouncedProject,
          milestoneSearch: debouncedMilestone,
        },
      }),
    retry: false,
  });
  const m = useMutation({
    mutationFn: () =>
      act({
        data: {
          kind,
          id: row.id,
          deliveryId: edit?.id ?? null,
          version: edit?.version ?? null,
          title,
          criteria,
          periodStart: from,
          periodEnd: to,
          responsibleId: responsible,
          projectId: project || null,
          milestoneId: milestone || null,
          reason: edit ? reason : null,
          operation,
        },
      }),
    onSuccess: () => {
      setOperation(crypto.randomUUID());
      if (!edit) {
        setTitle("");
        setCriteria("");
      }
      invalidate(qc);
    },
  });
  const p = `delivery-${edit?.id ?? "new"}-${row.id}`;
  const dis = locked || m.isPending;
  const valid =
    title.trim().length >= 3 &&
    criteria.trim().length >= 10 &&
    !!from &&
    !!to &&
    !!responsible &&
    (!edit || reason.trim().length >= 5);
  return (
    <fieldset
      className="space-y-2 border-t pt-3"
      aria-label={edit ? "Alterar entrega" : "Nova entrega"}
    >
      <legend className="font-medium">{edit ? "Nova versão da entrega" : "Nova entrega"}</legend>
      <Label htmlFor={`${p}-title`}>Título</Label>
      <Input
        id={`${p}-title`}
        value={title}
        maxLength={200}
        disabled={dis}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Label htmlFor={`${p}-criteria`}>Critérios de aceite</Label>
      <Textarea
        id={`${p}-criteria`}
        value={criteria}
        maxLength={5000}
        disabled={dis}
        onChange={(e) => setCriteria(e.target.value)}
      />
      <Label htmlFor={`${p}-from`}>Período — início</Label>
      <IsoDatePicker
        id={`${p}-from`}
        value={from}
        min={ctx.period?.starts_at}
        max={ctx.period?.ends_at ?? undefined}
        disabled={dis}
        onChange={(v) => setFrom(v ?? "")}
      />
      <Label htmlFor={`${p}-to`}>Período — fim</Label>
      <IsoDatePicker
        id={`${p}-to`}
        value={to}
        min={from || ctx.period?.starts_at}
        max={ctx.period?.ends_at ?? undefined}
        disabled={dis}
        onChange={(v) => setTo(v ?? "")}
      />
      <Label htmlFor={`${p}-resp`}>Responsável pelo aceite</Label>
      <Select value={responsible || undefined} onValueChange={setResponsible} disabled={dis}>
        <SelectTrigger id={`${p}-resp`}>
          <SelectValue
            placeholder={
              ctx.eligible_responsibles.length ? "Selecione" : "Ninguém com permissão de aceite"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {ctx.eligible_responsibles.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name ?? "Usuário sem nome"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor={`${p}-project-search`}>Buscar projeto</Label>
      <Input
        id={`${p}-project-search`}
        value={projectSearch}
        maxLength={100}
        disabled={dis}
        onChange={(e) => setProjectSearch(e.target.value)}
        placeholder="Nome do projeto — até 50 resultados"
      />
      <Label htmlFor={`${p}-project`}>Projeto (opcional)</Label>
      <Select
        value={project || NONE}
        onValueChange={(v) => {
          setProject(v === NONE ? "" : v);
          setMilestone("");
        }}
        disabled={dis || refs.isLoading}
      >
        <SelectTrigger id={`${p}-project`}>
          <SelectValue placeholder="Sem projeto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sem projeto</SelectItem>
          {(refs.data?.projects ?? []).map((x) => (
            <SelectItem key={x.id} value={x.id}>
              {x.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {project && (
        <>
          <Label htmlFor={`${p}-ms-search`}>Buscar marco</Label>
          <Input
            id={`${p}-ms-search`}
            value={milestoneSearch}
            maxLength={100}
            disabled={dis}
            onChange={(e) => setMilestoneSearch(e.target.value)}
            placeholder="Nome do marco — até 50 resultados"
          />
          <Label htmlFor={`${p}-ms`}>Marco (opcional)</Label>
          <Select
            value={milestone || NONE}
            onValueChange={(v) => setMilestone(v === NONE ? "" : v)}
            disabled={dis}
          >
            <SelectTrigger id={`${p}-ms`}>
              <SelectValue placeholder="Sem marco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem marco</SelectItem>
              {(refs.data?.milestones ?? []).map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      {refs.isError && <p role="status">Projetos indisponíveis para o seu usuário.</p>}
      {edit && (
        <>
          <Label htmlFor={`${p}-reason`}>Motivo da alteração</Label>
          <Textarea
            id={`${p}-reason`}
            value={reason}
            maxLength={2000}
            disabled={dis}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            A nova versão exige novo aceite; o histórico anterior é preservado.
          </p>
        </>
      )}
      <Button disabled={dis || !valid} onClick={() => m.mutate()}>
        {edit ? "Salvar nova versão" : "Registrar entrega"}
      </Button>
      {m.isError && (
        <p role="alert" className="text-destructive">
          {m.error.message}
        </p>
      )}
    </fieldset>
  );
}

function DeliveryActions({
  kind,
  row,
  ctx,
  delivery,
  locked,
}: {
  kind: RequestKind;
  row: PreparationRow;
  ctx: OpsContext;
  delivery: OpsDelivery;
  locked: boolean;
}) {
  const qc = useQueryClient(),
    sub = useServerFn(submitDelivery),
    dec = useServerFn(decideDelivery);
  const [evidence, setEvidence] = useState(""),
    [reason, setReason] = useState(""),
    [editing, setEditing] = useState(false),
    [op, setOp] = useState(() => crypto.randomUUID());
  const done = () => {
    setOp(crypto.randomUUID());
    setEvidence("");
    setReason("");
    invalidate(qc);
  };
  const s = useMutation({
    mutationFn: () =>
      sub({
        data: {
          kind,
          id: row.id,
          deliveryId: delivery.id,
          version: delivery.version,
          evidence,
          operation: op,
        },
      }),
    onSuccess: done,
  });
  const d = useMutation({
    mutationFn: (decision: "accepted" | "rejected") =>
      dec({
        data: {
          kind,
          id: row.id,
          deliveryId: delivery.id,
          version: delivery.version,
          contentHash: delivery.current.content_hash,
          decision,
          reason,
          operation: op,
        },
      }),
    onSuccess: done,
  });
  const p = `delivery-act-${delivery.id}`;
  const dis = locked || s.isPending || d.isPending;
  const canSubmit =
    ctx.can_manage_deliveries && (delivery.status === "open" || delivery.status === "rejected");
  if (!canSubmit && !delivery.can_decide && !ctx.can_manage_deliveries) return null;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="font-medium">
        {delivery.current.title} · v{delivery.version} · {deliveryStatusLabel[delivery.status]}
      </p>
      {canSubmit && (
        <>
          <Label htmlFor={`${p}-ev`}>Evidência da entrega</Label>
          <Textarea
            id={`${p}-ev`}
            value={evidence}
            maxLength={5000}
            disabled={dis}
            onChange={(e) => setEvidence(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={dis || evidence.trim().length < 10}
            onClick={() => s.mutate()}
          >
            Submeter para aceite
          </Button>
        </>
      )}
      {delivery.can_decide && (
        <>
          <p className="text-xs text-muted-foreground">
            Você é o responsável nomeado. Decida sobre esta versão exata (v{delivery.version}).
          </p>
          <Label htmlFor={`${p}-reason`}>Motivo da decisão</Label>
          <Textarea
            id={`${p}-reason`}
            value={reason}
            maxLength={2000}
            disabled={dis}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={dis || reason.trim().length < 5} onClick={() => d.mutate("accepted")}>
              Aceitar entrega
            </Button>
            <Button
              variant="outline"
              disabled={dis || reason.trim().length < 5}
              onClick={() => d.mutate("rejected")}
            >
              Rejeitar
            </Button>
          </div>
        </>
      )}
      {ctx.can_manage_deliveries && (
        <Button
          variant="ghost"
          size="sm"
          disabled={dis}
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
        >
          {editing ? "Fechar alteração" : "Alterar entrega"}
        </Button>
      )}
      {editing && <DeliveryForm kind={kind} row={row} ctx={ctx} locked={locked} edit={delivery} />}
      {(s.isError || d.isError) && (
        <p role="alert" className="text-destructive">
          {(s.error ?? d.error)?.message}
        </p>
      )}
    </div>
  );
}

function FiscalUpload({
  kind,
  row,
  ctx,
  locked,
}: {
  kind: RequestKind;
  row: PreparationRow;
  ctx: OpsContext;
  locked: boolean;
}) {
  const qc = useQueryClient(),
    up = useServerFn(uploadFiscalDocument);
  const types = allowedFiscalTypes(kind, ctx.regime);
  const [file, setFile] = useState<File | null>(null),
    [docType, setDocType] = useState<FiscalDocType | "">(types.length === 1 ? types[0] : ""),
    [modality, setModality] = useState<FreelanceModality | "">(""),
    [issuer, setIssuer] = useState(""),
    [taker, setTaker] = useState(""),
    [amount, setAmount] = useState(""),
    [currency, setCurrency] = useState("BRL"),
    [number, setNumber] = useState(""),
    [issued, setIssued] = useState(""),
    [delivery, setDelivery] = useState(""),
    [op, setOp] = useState(() => crypto.randomUUID());
  const m = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione o arquivo.");
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000)
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return up({
        data: {
          kind,
          id: row.id,
          fileName: file.name,
          base64: btoa(bin),
          docType: docType as FiscalDocType,
          modality: docType === "freelance_document" ? (modality as FreelanceModality) : null,
          issuerTaxId: issuer,
          takerTaxId: docType === "payroll_evidence" ? null : taker,
          amount: Number(amount.replace(",", ".")),
          currency: currency.toUpperCase(),
          documentNumber: number,
          issuedOn: issued,
          deliveryId: delivery || null,
          operation: op,
        },
      });
    },
    onSuccess: () => {
      setOp(crypto.randomUUID());
      setFile(null);
      setNumber("");
      setAmount("");
      invalidate(qc);
    },
  });
  const p = `fiscal-${row.id}`;
  const dis = locked || m.isPending;
  const tooBig = !!file && file.size > FISCAL_MAX_BYTES;
  const valid =
    !!file &&
    !tooBig &&
    !!docType &&
    (docType !== "freelance_document" || !!modality) &&
    issuer.replace(/\D/g, "").length >= 11 &&
    (docType === "payroll_evidence" || taker.replace(/\D/g, "").length === 14) &&
    Number(amount.replace(",", ".")) > 0 &&
    /^[A-Za-z]{3}$/.test(currency) &&
    number.trim().length > 0 &&
    !!issued;
  return (
    <fieldset className="space-y-2 border-t pt-3" aria-label="Enviar documento fiscal">
      <legend className="font-medium">Enviar documento fiscal privado</legend>
      <p className="text-xs text-muted-foreground">
        Fica em armazenamento privado, separado dos anexos assinados. PDF, XML, PNG ou JPEG até 10
        MB.
      </p>
      <Label htmlFor={`${p}-file`}>Arquivo</Label>
      <Input
        id={`${p}-file`}
        type="file"
        accept=".pdf,.xml,.png,.jpg,.jpeg"
        disabled={dis}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {tooBig && (
        <p role="alert" className="text-destructive">
          Arquivo acima de 10 MB.
        </p>
      )}
      <Label htmlFor={`${p}-type`}>Tipo</Label>
      <Select
        value={docType || undefined}
        onValueChange={(v) => setDocType(v as FiscalDocType)}
        disabled={dis}
      >
        <SelectTrigger id={`${p}-type`}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {types.map((t) => (
            <SelectItem key={t} value={t}>
              {fiscalTypeLabel[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {docType === "freelance_document" && (
        <>
          <Label htmlFor={`${p}-mod`}>Modalidade (escolha explícita)</Label>
          <Select
            value={modality || undefined}
            onValueChange={(v) => setModality(v as FreelanceModality)}
            disabled={dis}
          >
            <SelectTrigger id={`${p}-mod`}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(modalityLabel) as FreelanceModality[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {modalityLabel[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      <Label htmlFor={`${p}-issuer`}>CPF/CNPJ do emitente</Label>
      <Input
        id={`${p}-issuer`}
        inputMode="numeric"
        value={issuer}
        maxLength={20}
        disabled={dis}
        onChange={(e) => setIssuer(e.target.value)}
      />
      {docType !== "payroll_evidence" && (
        <>
          <Label htmlFor={`${p}-taker`}>CNPJ do tomador (entidade WK)</Label>
          <Input
            id={`${p}-taker`}
            inputMode="numeric"
            value={taker}
            maxLength={20}
            disabled={dis}
            onChange={(e) => setTaker(e.target.value)}
          />
        </>
      )}
      <Label htmlFor={`${p}-amount`}>Valor</Label>
      <Input
        id={`${p}-amount`}
        inputMode="decimal"
        value={amount}
        disabled={dis}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Label htmlFor={`${p}-cur`}>Moeda (ISO)</Label>
      <Input
        id={`${p}-cur`}
        value={currency}
        maxLength={3}
        disabled={dis}
        onChange={(e) => setCurrency(e.target.value)}
      />
      <Label htmlFor={`${p}-num`}>Número / competência</Label>
      <Input
        id={`${p}-num`}
        value={number}
        maxLength={60}
        disabled={dis}
        onChange={(e) => setNumber(e.target.value)}
      />
      <Label htmlFor={`${p}-issued`}>Data de emissão</Label>
      <IsoDatePicker
        id={`${p}-issued`}
        value={issued}
        min={ctx.period?.starts_at}
        disabled={dis}
        onChange={(v) => setIssued(v ?? "")}
      />
      {ctx.deliveries.length > 0 && (
        <>
          <Label htmlFor={`${p}-del`}>Entrega relacionada (opcional)</Label>
          <Select
            value={delivery || NONE}
            onValueChange={(v) => setDelivery(v === NONE ? "" : v)}
            disabled={dis}
          >
            <SelectTrigger id={`${p}-del`}>
              <SelectValue placeholder="Nenhuma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhuma</SelectItem>
              {ctx.deliveries.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.current.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      <Button disabled={dis || !valid} onClick={() => m.mutate()}>
        Enviar documento
      </Button>
      {m.isPending && <p role="status">Enviando e conferindo integridade…</p>}
      {m.isError && (
        <p role="alert" className="text-destructive">
          {m.error.message}
        </p>
      )}
    </fieldset>
  );
}

function FiscalReview({
  kind,
  row,
  doc,
  locked,
}: {
  kind: RequestKind;
  row: PreparationRow;
  doc: OpsFiscal;
  locked: boolean;
}) {
  const qc = useQueryClient(),
    act = useServerFn(reviewFiscalDocument);
  const [reason, setReason] = useState(""),
    [op, setOp] = useState(() => crypto.randomUUID());
  const m = useMutation({
    mutationFn: (decision: "verified" | "rejected") =>
      act({
        data: {
          kind,
          id: row.id,
          documentId: doc.id,
          sha256: doc.sha256,
          decision,
          reason,
          operation: op,
        },
      }),
    onSuccess: () => {
      setOp(crypto.randomUUID());
      setReason("");
      invalidate(qc);
    },
  });
  const p = `fiscal-review-${doc.id}`;
  const dis = locked || m.isPending;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="font-medium">
        Conferência do Financeiro · {fiscalTypeLabel[doc.doc_type]} {doc.document_number}
      </p>
      <p className="text-xs text-muted-foreground">
        Confira arquivo, CNPJs, valor e moeda. A conferência é humana e não autentica o documento
        junto à prefeitura ou SEFAZ.
      </p>
      <Label htmlFor={`${p}-reason`}>Motivo</Label>
      <Textarea
        id={`${p}-reason`}
        value={reason}
        maxLength={2000}
        disabled={dis}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={dis || reason.trim().length < 5} onClick={() => m.mutate("verified")}>
          Confirmar conferência
        </Button>
        <Button
          variant="outline"
          disabled={dis || reason.trim().length < 5}
          onClick={() => m.mutate("rejected")}
        >
          Rejeitar documento
        </Button>
      </div>
      {m.isError && (
        <p role="alert" className="text-destructive">
          {m.error.message}
        </p>
      )}
    </div>
  );
}
