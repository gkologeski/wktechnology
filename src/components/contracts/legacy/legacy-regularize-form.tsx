import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  regularizeContractLegacy,
  uploadContractLegacyEvidence,
} from "@/lib/contracts/legacy.functions";
import {
  LEGACY_EVIDENCE_MAX_BYTES,
  LEGACY_SITUATION_LABEL,
  type LegacySituation,
} from "@/lib/contracts/legacy-types";
import {
  regularizeBlockers,
  todayIso,
  type LegacyEvidence,
  type RegularizeDraft,
} from "@/lib/contracts/legacy-view";

function toBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Revisão humana e regularização; nada é presumido de IA, status ou origem importada. */
export function LegacyRegularizeForm({
  contractId,
  revision,
  evidence,
  allowed,
  blockedByMissing,
}: {
  contractId: string;
  revision: number;
  evidence: LegacyEvidence[];
  allowed: boolean;
  blockedByMissing: boolean;
}) {
  const { can } = usePermissions();
  const permitted = allowed && can("techcontracts.legacy_contracts.approve.workspace");
  const qc = useQueryClient();
  const upload = useServerFn(uploadContractLegacyEvidence);
  const regularize = useServerFn(regularizeContractLegacy);
  const ready = evidence.find((e) => e.status === "attested" && e.revision === revision) ?? null;
  const [d, setD] = useState<RegularizeDraft>({
    situation: "",
    signedOn: null,
    signatureConfirmed: false,
    startsOn: null,
    endsOn: null,
    terminatedOn: null,
    autoRenew: false,
    autoRenewConfirmed: false,
    externalReference: "",
    reason: "",
    evidenceReady: false,
  });
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);
  const [uploadOp, setUploadOp] = useState(() => crypto.randomUUID());
  const [saveOp, setSaveOp] = useState(() => crypto.randomUUID());
  const set = (p: Partial<RegularizeDraft>) => setD((x) => ({ ...x, ...p }));
  const today = todayIso();
  const blockers = regularizeBlockers({ ...d, evidenceReady: !!ready }, today);
  const refresh = () => qc.invalidateQueries({ queryKey: ["contract-legacy", contractId] });

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > LEGACY_EVIDENCE_MAX_BYTES || !/\.pdf$/i.test(file.name)) {
      toast.error("Envie o PDF do original assinado (até 5 MB).");
      return;
    }
    setBusy("upload");
    try {
      await upload({
        data: {
          contractId,
          expectedRevision: revision,
          fileName: file.name,
          base64: toBase64(await file.arrayBuffer()),
          operationId: uploadOp,
        },
      });
      toast.success("PDF assinado conferido pelo servidor.");
      setUploadOp(crypto.randomUUID());
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function submit() {
    if (!ready || !d.situation || !d.signedOn || !d.startsOn) return;
    setBusy("save");
    try {
      await regularize({
        data: {
          contractId,
          expectedRevision: revision,
          situation: d.situation,
          signedOn: d.signedOn,
          signatureConfirmed: true,
          startsOn: d.startsOn,
          endsOn: d.endsOn,
          terminatedOn: d.situation === "terminated" ? d.terminatedOn : null,
          autoRenew: d.autoRenew,
          autoRenewConfirmed: d.autoRenewConfirmed,
          evidenceId: ready.id,
          evidenceSha256: ready.sha256,
          externalReference: d.externalReference,
          reason: d.reason,
          operationId: saveOp,
        },
      });
      toast.success("Contrato legado regularizado.");
      setSaveOp(crypto.randomUUID());
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["contract", contractId] })]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const disabled = !permitted || busy !== null;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="legacy-pdf">PDF original assinado</Label>
        <Input
          id="legacy-pdf"
          type="file"
          accept="application/pdf,.pdf"
          disabled={disabled}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {busy === "upload"
            ? "Enviando e conferindo…"
            : ready
              ? `Conferido: ${ready.file_name}`
              : "Arquivo separado do importado; o DOCX de minuta não serve como evidência."}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="legacy-situation">Situação</Label>
        <Select
          value={d.situation}
          onValueChange={(v) => set({ situation: v as LegacySituation })}
          disabled={disabled}
        >
          <SelectTrigger id="legacy-situation">
            <SelectValue placeholder="Escolha" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LEGACY_SITUATION_LABEL) as LegacySituation[]).map((k) => (
              <SelectItem key={k} value={k}>
                {LEGACY_SITUATION_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Data da assinatura (conferida no original)</Label>
        <IsoDatePicker value={d.signedOn} onChange={(v) => set({ signedOn: v })} max={today} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={d.signatureConfirmed}
            onCheckedChange={(v) => set({ signatureConfirmed: v === true })}
            disabled={disabled}
          />
          Conferi a assinatura humana no PDF (não usei extração automática)
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Início da vigência</Label>
          <IsoDatePicker value={d.startsOn} onChange={(v) => set({ startsOn: v })} />
        </div>
        <div className="space-y-1">
          <Label>Fim da vigência</Label>
          <IsoDatePicker value={d.endsOn} onChange={(v) => set({ endsOn: v })} />
        </div>
      </div>
      {d.situation === "terminated" ? (
        <div className="space-y-1">
          <Label>Data da rescisão</Label>
          <IsoDatePicker
            value={d.terminatedOn}
            onChange={(v) => set({ terminatedOn: v })}
            max={today}
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={d.autoRenew}
            onCheckedChange={(v) => set({ autoRenew: v === true, autoRenewConfirmed: false })}
            disabled={disabled}
          />
          Possui renovação automática
        </label>
        {d.autoRenew ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={d.autoRenewConfirmed}
              onCheckedChange={(v) => set({ autoRenewConfirmed: v === true })}
              disabled={disabled}
            />
            Conferi a cláusula de renovação no original
          </label>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="legacy-ref">Referência do documento/origem</Label>
        <Input
          id="legacy-ref"
          value={d.externalReference}
          maxLength={500}
          disabled={disabled}
          onChange={(e) => set({ externalReference: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="legacy-why">Justificativa</Label>
        <Textarea
          id="legacy-why"
          value={d.reason}
          maxLength={2000}
          disabled={disabled}
          onChange={(e) => set({ reason: e.target.value })}
        />
      </div>
      {blockers.length > 0 ? (
        <ul className="text-xs text-muted-foreground list-disc pl-5" aria-live="polite">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={disabled || blockers.length > 0 || blockedByMissing}
        title={permitted ? undefined : "Sem permissão"}
      >
        {busy === "save" ? "Regularizando…" : "Regularizar contrato legado"}
      </Button>
    </form>
  );
}
