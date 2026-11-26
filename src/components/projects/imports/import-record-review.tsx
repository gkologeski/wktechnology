import { useImportAccess } from "./use-import-access";
import { assertImportUiAccess } from "./import-access";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchCreateField } from "@/components/ui/search-create-field";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  listImportJourneyTargets,
  reviewImportJourneyRecord,
} from "@/lib/projects/imports/import-journey.functions";
import type { JourneyRecordDetail } from "@/lib/projects/imports/import-journey";
import type { ImportQueryScope } from "./import-format";

export function useImportRecordReview(
  record: JourneyRecordDetail | undefined,
  scope: ImportQueryScope,
  readOnly: boolean,
  version: string,
) {
  const access = useImportAccess(scope);
  const targetsFn = useServerFn(listImportJourneyTargets);
  const save = useServerFn(reviewImportJourneyRecord);
  const client = useQueryClient();
  const writing = useRef(false);
  const [note, setNote] = useState("");
  const [targetText, setTargetText] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetFocused, setTargetFocused] = useState(false);
  const [assigneeText, setAssigneeText] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assigneeFocused, setAssigneeFocused] = useState(false);
  const term = useDebouncedValue(targetText, 300);
  const reviewerTerm = useDebouncedValue(assigneeText, 300);
  const writable =
    !!record?.canManage &&
    access.canManage(record.provider) &&
    !readOnly &&
    version === "current" &&
    !!record.currentVersionId;
  useEffect(() => {
    setTargetId(null);
    setTargetText("");
    setAssigneeId(null);
    setAssigneeText("");
  }, [record?.currentVersionId]);
  const targets = useQuery({
    queryKey: [
      "project-import-journey",
      ...scope,
      "targets",
      record?.id,
      "link",
      record?.targetType,
      term,
    ],
    queryFn: () => {
      assertImportUiAccess(access, record?.provider, true);
      return targetsFn({ data: { id: record!.id, q: term, purpose: "link" } });
    },
    enabled: writable && !!record?.targetType && targetFocused && !targetId,
    retry: false,
  });
  const reviewers = useQuery({
    queryKey: ["project-import-journey", ...scope, "targets", record?.id, "review", reviewerTerm],
    queryFn: () => {
      assertImportUiAccess(access, record?.provider, true);
      return targetsFn({ data: { id: record!.id, q: reviewerTerm, purpose: "review" } });
    },
    enabled: writable && assigneeFocused && !assigneeId,
    retry: false,
  });
  const action = useMutation({
    mutationFn: (kind: "review" | "link") => {
      assertImportUiAccess(access, record?.provider, true);
      if (!writable) throw new Error("Conferência indisponível nesta versão ou sessão.");
      return save({
        data: {
          id: record!.id,
          versionId: record!.currentVersionId,
          action: kind,
          note: note.trim(),
          targetId: kind === "link" ? targetId! : undefined,
          assigneeId: assigneeId ?? undefined,
        },
      });
    },
    onSuccess: async () => {
      setNote("");
      setTargetId(null);
      setTargetText("");
      setAssigneeId(null);
      setAssigneeText("");
      await client.invalidateQueries({ queryKey: ["project-import-journey", ...scope] });
      toast.success(
        "Conferência registrada. O original foi preservado; a situação será reavaliada no processamento da origem.",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a operação."),
    onSettled: () => {
      writing.current = false;
    },
  });
  const submit = (kind: "review" | "link") => {
    if (!writable || writing.current || note.trim().length < 8) return;
    writing.current = true;
    action.mutate(kind);
  };
  return {
    submit,
    record,
    writable,
    note,
    setNote,
    targetText,
    setTargetText,
    targetId,
    setTargetId,
    setTargetFocused,
    assigneeText,
    setAssigneeText,
    assigneeId,
    setAssigneeId,
    setAssigneeFocused,
    targets,
    reviewers,
    action,
  };
}

type ReviewState = ReturnType<typeof useImportRecordReview>;

export function ImportRecordReviewFields({ review }: { review: ReviewState }) {
  const { record, writable, action } = review;
  if (!record) return null;
  if (!writable)
    return record.reviewAssignee ? (
      <p className="text-xs text-muted-foreground">
        Responsável atual pela conferência:{" "}
        <strong className="font-medium">{record.reviewAssignee.label}</strong>
      </p>
    ) : null;
  const targetLabel = record.targetType === "project" ? "Projeto" : "Pessoa";
  return (
    <section className="space-y-4 border-t border-border-subtle pt-5">
      <h3 className="text-sm font-medium">Conferência no TechERP</h3>
      {record.reviewAssignee && (
        <p className="text-xs text-muted-foreground">
          Responsável atual: <strong className="font-medium">{record.reviewAssignee.label}</strong>
        </p>
      )}
      {record.targetType && (
        <div className="space-y-2">
          <Label htmlFor="import-link-target">
            {targetLabel} {targetLabel === "Pessoa" ? "cadastrada" : "cadastrado"}
          </Label>
          <SearchCreateField
            id="import-link-target"
            label={targetLabel}
            text={review.targetText}
            selectedId={review.targetId}
            options={review.targets.data?.options ?? []}
            loading={review.targets.isFetching}
            searched={review.targets.isSuccess}
            error={
              review.targets.isError ? "Não foi possível carregar os cadastros autorizados." : null
            }
            disabled={action.isPending}
            onFocus={() => review.setTargetFocused(true)}
            onTextChange={(value) => {
              review.setTargetText(value);
              review.setTargetId(null);
            }}
            onPick={(option) => {
              review.setTargetId(option.id);
              review.setTargetText(option.label);
            }}
            onClear={() => {
              review.setTargetText("");
              review.setTargetId(null);
            }}
            onRetry={() => void review.targets.refetch()}
          />
          <p className="text-xs text-muted-foreground">
            Escolha explícita de cadastro autorizado. O nome parecido não cria um vínculo
            automaticamente.
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="import-review-assignee">Encaminhar para (opcional)</Label>
        <SearchCreateField
          id="import-review-assignee"
          label="Responsável pela conferência"
          text={review.assigneeText}
          selectedId={review.assigneeId}
          options={review.reviewers.data?.options ?? []}
          loading={review.reviewers.isFetching}
          searched={review.reviewers.isSuccess}
          error={
            review.reviewers.isError
              ? "Não foi possível consultar os responsáveis autorizados."
              : null
          }
          disabled={action.isPending}
          onFocus={() => review.setAssigneeFocused(true)}
          onTextChange={(value) => {
            review.setAssigneeText(value);
            review.setAssigneeId(null);
          }}
          onPick={(option) => {
            review.setAssigneeId(option.id);
            review.setAssigneeText(option.label);
          }}
          onClear={() => {
            review.setAssigneeText("");
            review.setAssigneeId(null);
          }}
          onRetry={() => void review.reviewers.refetch()}
        />
        <p className="text-xs text-muted-foreground">
          Somente membros ativos com acesso à origem. Sem escolher outro nome, a anotação mantém o
          responsável atual.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="import-review-note">Motivo ou orientação para a conferência</Label>
        <Textarea
          id="import-review-note"
          value={review.note}
          onChange={(event) => review.setNote(event.target.value)}
          maxLength={4000}
          placeholder="Registre o que confirmou ou o que precisa ser verificado na origem…"
          disabled={action.isPending}
        />
        <p className="text-xs text-muted-foreground">
          Informe pelo menos 8 caracteres. O registro permanece pendente até a reavaliação da
          origem.
        </p>
      </div>
    </section>
  );
}

export function ImportRecordReviewActions({ review }: { review: ReviewState }) {
  if (!review.writable) return null;
  const disabled = review.action.isPending || review.note.trim().length < 8;
  return (
    <>
      <Button
        variant={review.targetId ? "outline" : "default"}
        disabled={disabled}
        onClick={() => review.submit("review")}
      >
        {review.action.isPending && !review.targetId && (
          <Loader2 className="animate-spin" aria-hidden />
        )}
        {review.assigneeId ? "Encaminhar conferência" : "Registrar anotação"}
      </Button>
      {review.targetId && (
        <Button disabled={disabled} onClick={() => review.submit("link")}>
          {review.action.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {review.assigneeId ? "Salvar vínculo e encaminhar" : "Salvar vínculo"}
        </Button>
      )}
    </>
  );
}
