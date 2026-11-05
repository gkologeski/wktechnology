import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { DealPicker } from "@/components/ats/deal-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getContractSignature,
  prepareContractSignature,
  attestExternalSignature,
  revokeContractEvidence,
  selectCommercialContract,
  saveContractHiringOrigin,
  getSignedContractEvidenceUrl,
} from "@/lib/hiring/signature.functions";
import type { SignatureContext } from "@/lib/hiring/signature.types";

export function ContractSignatureCard({
  contractId,
  revisionKey,
}: {
  contractId: string;
  revisionKey: string;
}) {
  const load = useServerFn(getContractSignature);
  const result = useQuery({
    queryKey: ["contract-signature", contractId, revisionKey],
    queryFn: () => load({ data: { contractId } }),
    staleTime: 0,
    retry: false,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assinatura e origem do recrutamento</CardTitle>
      </CardHeader>
      <CardContent>
        {result.isLoading ? (
          <p>Carregando evidências…</p>
        ) : result.error ? (
          <p role="alert" className="text-destructive">
            {result.error.message}
          </p>
        ) : result.data ? (
          <SignatureForm key={result.data.hash} contractId={contractId} value={result.data} />
        ) : null}
      </CardContent>
    </Card>
  );
}
function SignatureForm({ contractId, value: c }: { contractId: string; value: SignatureContext }) {
  const { can, canAny } = usePermissions();
  const manage = c.can_manage && can("techcontracts.signature_evidence.manage.workspace");
  const qc = useQueryClient();
  const prepare = useServerFn(prepareContractSignature),
    attest = useServerFn(attestExternalSignature),
    revoke = useServerFn(revokeContractEvidence),
    source = useServerFn(selectCommercialContract),
    origin = useServerFn(saveContractHiringOrigin),
    url = useServerFn(getSignedContractEvidenceUrl);
  const [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"native" | "external" | "revoke" | null>(null);
  const [deal, setDeal] = useState(c.deal_id),
    [entity, setEntity] = useState(c.entity_id ?? "");
  const [customerName, setCustomerName] = useState(""),
    [customerEmail, setCustomerEmail] = useState(""),
    [issuerName, setIssuerName] = useState(""),
    [issuerEmail, setIssuerEmail] = useState("");
  const [pdf, setPdf] = useState<File | null>(null),
    [signedOn, setSignedOn] = useState(""),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [evidence, setEvidence] = useState("");
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["contract-signature", contractId] }),
        qc.invalidateQueries({ queryKey: ["contract", contractId] }),
        qc.invalidateQueries({ queryKey: ["hiring-demand"] }),
        qc.invalidateQueries({ queryKey: ["recruitment-authorization"] }),
      ]);
      setMode(null);
      setPdf(null);
      setConfirmed(false);
      setNote("");
      toast.success("Operação registrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };
  const upload = async () => {
    if (!pdf || pdf.size > 5 * 1024 * 1024) throw new Error("Selecione um PDF de até 5 MB.");
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("Falha ao ler PDF."));
      reader.readAsDataURL(pdf);
    });
    await attest({
      data: { contractId, hash: c.hash, pdf: base64, signedOn, reference, note, confirmed: true },
    });
  };
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3">
        <p className="font-medium">
          {c.reason ? "Autorização comercial pendente" : "Assinatura válida para a versão atual"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {c.reason ??
            "A demanda ainda depende da aprovação da área e do CEO e das demais regras do recrutamento."}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        As ações usam a versão salva deste contrato. Alterar conteúdo, partes ou condições exige
        nova evidência. Marcar o contrato como ativo ou preencher uma data não comprova assinatura.
      </p>
      {manage && (
        <div className="space-y-3 rounded-md border p-3">
          <h3 className="font-medium">Origem comercial</h3>
          <Label>Negócio</Label>
          <DealPicker value={deal} onChange={setDeal} disabled={busy} />
          <Label>Entidade WK prestadora</Label>
          <Select value={entity || undefined} onValueChange={setEntity} disabled={busy}>
            <SelectTrigger aria-label="Entidade WK prestadora">
              <SelectValue placeholder="Selecione o CNPJ" />
            </SelectTrigger>
            <SelectContent>
              {c.entities.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                  {l.cnpj ? ` · ${l.cnpj}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O cliente será o mesmo do negócio selecionado. A mudança de origem ou entidade invalida
            a correspondência com assinaturas anteriores.
          </p>
          <Button
            variant="outline"
            disabled={busy || !deal || !entity || (deal === c.deal_id && entity === c.entity_id)}
            onClick={() =>
              act(() =>
                origin({ data: { contractId, hash: c.hash, dealId: deal!, entityId: entity } }),
              )
            }
          >
            Salvar origem
          </Button>
        </div>
      )}
      <p className="text-sm">
        {c.commercial_source
          ? "Este é o contrato comercial selecionado para recrutamento do negócio."
          : "Este contrato ainda não foi escolhido como origem de recrutamento do negócio."}
      </p>
      {manage && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || !c.deal_id || c.commercial_source}
            onClick={() => act(() => source({ data: { contractId } }))}
          >
            Definir como origem do recrutamento
          </Button>
          <Button
            disabled={
              busy ||
              !canAny([
                "techcontracts.esign.create.own",
                "techcontracts.esign.create.team",
                "techcontracts.esign.create.workspace",
              ])
            }
            onClick={() => setMode("native")}
          >
            Preparar assinatura no TechERP
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setMode("external")}>
            Registrar assinatura externa
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {c.evidence.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma evidência registrada.</p>
        )}
        {c.evidence.map((e) => (
          <div key={e.id} className="rounded-md border p-3">
            <p className="font-medium">
              {e.kind === "native" ? "Assinatura no TechERP" : "Documento externo atestado"} ·{" "}
              {e.revoked_at ? "Revogada" : e.current_version ? "Versão atual" : "Versão anterior"}
            </p>
            <p className="text-sm text-muted-foreground">
              {e.reference ?? e.note}
              {e.signed_on ? ` · Assinatura: ${e.signed_on.split("-").reverse().join("/")}` : ""}
            </p>
            {e.revocation_reason && <p className="text-sm">{e.revocation_reason}</p>}
            <div className="mt-2 flex gap-2">
              {e.document_id && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/settings/esign" search={{ document: e.document_id }}>
                    Abrir assinatura
                  </Link>
                </Button>
              )}
              {e.kind === "external" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const link = await url({ data: { evidenceId: e.id } });
                      window.open(link, "_blank", "noopener,noreferrer");
                    })
                  }
                >
                  Ver PDF
                </Button>
              )}
              {manage && !e.revoked_at && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setEvidence(e.id);
                    setNote("");
                    setMode("revoke");
                  }}
                >
                  Revogar evidência
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setMode(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "native"
                ? "Preparar assinatura do contrato"
                : mode === "external"
                  ? "Registrar assinatura externa"
                  : "Revogar evidência"}
            </DialogTitle>
          </DialogHeader>
          {mode === "native" && (
            <div className="space-y-3">
              <p className="text-sm">
                O documento será preparado a partir do contrato salvo e seus serviços. Envio e
                coleta das assinaturas continuam na área de Assinaturas.
              </p>
              <Label>Representante do cliente</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                maxLength={255}
              />
              <Label>E-mail do cliente</Label>
              <EmailInput value={customerEmail} onChange={setCustomerEmail} />
              <Label>Representante da entidade WK</Label>
              <Input
                value={issuerName}
                onChange={(e) => setIssuerName(e.target.value)}
                maxLength={255}
              />
              <Label>E-mail do representante WK</Label>
              <EmailInput value={issuerEmail} onChange={setIssuerEmail} />
              <Button
                disabled={busy || !customerName || !issuerName || !customerEmail || !issuerEmail}
                onClick={() =>
                  act(() =>
                    prepare({
                      data: {
                        contractId,
                        hash: c.hash,
                        customerName,
                        customerEmail,
                        issuerName,
                        issuerEmail,
                      },
                    }),
                  )
                }
              >
                Preparar documento
              </Button>
            </div>
          )}
          {mode === "external" && (
            <div className="space-y-3">
              <p className="text-sm">
                Registro por conferência humana do documento assinado fora do ERP. O PDF e sua
                integridade serão preservados; não é uma validação criptográfica das assinaturas.
              </p>
              <Label>PDF assinado (até 5 MB)</Label>
              <Input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
              />
              <Label>Data da assinatura</Label>
              <IsoDatePicker
                value={signedOn}
                onChange={(v) => setSignedOn(v ?? "")}
                ariaLabel="Data da assinatura externa"
                required
              />
              <Label>Referência do provedor ou certificado</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={500}
              />
              <Label>Como foi conferido</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              <label className="flex gap-2 text-sm">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
                Conferi a assinatura das partes e confirmo que o PDF corresponde à versão salva do
                contrato.
              </label>
              <Button
                disabled={
                  busy ||
                  !pdf ||
                  !signedOn ||
                  reference.trim().length < 3 ||
                  note.trim().length < 20 ||
                  !confirmed
                }
                onClick={() => act(upload)}
              >
                Registrar atestado
              </Button>
            </div>
          )}
          {mode === "revoke" && (
            <div className="space-y-3">
              <p className="text-sm">
                A evidência permanece no histórico e deixa de autorizar novas operações de
                recrutamento.
              </p>
              <Label>Motivo</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              <Button
                variant="destructive"
                disabled={busy || note.trim().length < 10}
                onClick={() => act(() => revoke({ data: { evidenceId: evidence, note } }))}
              >
                Revogar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
