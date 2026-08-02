// Painel de Avaliações do Tomador. Sprint 2 do TechPeople.
// Avaliações periódicas (mensal/trimestral) preenchidas pelo cliente/tomador
// do serviço com notas por dimensão e feedback qualitativo.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
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
  listReviews,
  upsertReview,
  deleteReview,
  REVIEW_CADENCES,
  REVIEW_CADENCE_LABELS,
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  type ReviewRow,
  type ReviewCadence,
  type ReviewStatus,
  type ReviewRatings,
} from "@/lib/people/performance.functions";

// Dimensões padrão de avaliação do tomador.
const DIMENSIONS: Array<{ key: string; label: string }> = [
  { key: "delivery", label: "Entrega" },
  { key: "quality", label: "Qualidade técnica" },
  { key: "communication", label: "Comunicação" },
  { key: "collaboration", label: "Colaboração" },
  { key: "reliability", label: "Confiabilidade" },
];

function StarRating({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className="p-0.5 disabled:cursor-default"
        >
          <Star
            className={`h-4 w-4 ${
              n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewsPanel({ personId, canWrite }: { personId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listReviews);
  const delFn = useServerFn(deleteReview);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewRow | null>(null);

  const { data: reviews = [] } = useQuery({
    queryKey: ["person-reviews", personId],
    queryFn: () => listFn({ data: { person_id: personId } }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-reviews", personId] });
      toast.success("Avaliação removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {canWrite ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova avaliação
          </Button>
        </div>
      ) : null}

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            <ClipboardCheck className="h-6 w-6 mx-auto mb-2 opacity-60" />
            Nenhuma avaliação registrada.
          </CardContent>
        </Card>
      ) : (
        reviews.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {REVIEW_CADENCE_LABELS[r.cadence]} · {r.period_start} → {r.period_end}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2 items-center">
                    <Badge variant="secondary">{REVIEW_STATUS_LABELS[r.status]}</Badge>
                    {r.reviewer_name ? (
                      <span>
                        por {r.reviewer_name}
                        {r.reviewer_role ? ` — ${r.reviewer_role}` : ""}
                      </span>
                    ) : null}
                    {r.overall_score !== null ? (
                      <span className="flex items-center gap-1">
                        <StarRating value={Math.round(r.overall_score)} readOnly />
                        <span>{r.overall_score.toFixed(1)}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                {canWrite ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (await confirmDialog("Remover avaliação?")) del.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-1 md:grid-cols-2 text-xs">
                {DIMENSIONS.map((d) => (
                  <div key={d.key} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{d.label}</span>
                    <StarRating value={Number(r.ratings?.[d.key] ?? 0)} readOnly />
                  </div>
                ))}
              </div>

              {r.strengths ? (
                <div className="text-xs">
                  <div className="font-medium text-muted-foreground">Pontos fortes</div>
                  <div className="whitespace-pre-line">{r.strengths}</div>
                </div>
              ) : null}
              {r.improvements ? (
                <div className="text-xs">
                  <div className="font-medium text-muted-foreground">A desenvolver</div>
                  <div className="whitespace-pre-line">{r.improvements}</div>
                </div>
              ) : null}
              {r.comments ? (
                <div className="text-xs">
                  <div className="font-medium text-muted-foreground">Comentários</div>
                  <div className="whitespace-pre-line">{r.comments}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}

      <ReviewDialog open={open} onOpenChange={setOpen} personId={personId} review={editing} />
    </div>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  personId,
  review,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  review: ReviewRow | null;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertReview);

  const [reviewerName, setReviewerName] = useState(review?.reviewer_name ?? "");
  const [reviewerRole, setReviewerRole] = useState(review?.reviewer_role ?? "");
  const [cadence, setCadence] = useState<ReviewCadence>(review?.cadence ?? "monthly");
  const [status, setStatus] = useState<ReviewStatus>(review?.status ?? "draft");
  const [periodStart, setPeriodStart] = useState(review?.period_start ?? "");
  const [periodEnd, setPeriodEnd] = useState(review?.period_end ?? "");
  const [ratings, setRatings] = useState<ReviewRatings>(review?.ratings ?? {});
  const [strengths, setStrengths] = useState(review?.strengths ?? "");
  const [improvements, setImprovements] = useState(review?.improvements ?? "");
  const [comments, setComments] = useState(review?.comments ?? "");

  const key = review?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (open && lastKey !== key) {
    setReviewerName(review?.reviewer_name ?? "");
    setReviewerRole(review?.reviewer_role ?? "");
    setCadence(review?.cadence ?? "monthly");
    setStatus(review?.status ?? "draft");
    setPeriodStart(review?.period_start ?? "");
    setPeriodEnd(review?.period_end ?? "");
    setRatings(review?.ratings ?? {});
    setStrengths(review?.strengths ?? "");
    setImprovements(review?.improvements ?? "");
    setComments(review?.comments ?? "");
    setLastKey(key);
  }

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: review?.id ?? null,
          person_id: personId,
          reviewer_name: reviewerName || null,
          reviewer_role: reviewerRole || null,
          cadence,
          status,
          period_start: periodStart,
          period_end: periodEnd,
          ratings,
          overall_score: null,
          strengths: strengths || null,
          improvements: improvements || null,
          comments: comments || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-reviews", personId] });
      toast.success(review ? "Avaliação atualizada" : "Avaliação criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{review ? "Editar avaliação" : "Nova avaliação do tomador"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Avaliador (nome)</Label>
            <Input
              value={reviewerName ?? ""}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Ex.: João Silva"
            />
          </div>
          <div className="space-y-1">
            <Label>Cargo do avaliador</Label>
            <Input
              value={reviewerRole ?? ""}
              onChange={(e) => setReviewerRole(e.target.value)}
              placeholder="Ex.: CTO / Gerente"
            />
          </div>
          <div className="space-y-1">
            <Label>Cadência</Label>
            <Select value={cadence} onValueChange={(v) => setCadence(v as ReviewCadence)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_CADENCES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {REVIEW_CADENCE_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ReviewStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {REVIEW_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Início do período</Label>
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Fim do período</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>

          <div className="md:col-span-2 space-y-2 pt-2 border-t">
            <Label>Notas por dimensão</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {DIMENSIONS.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{d.label}</span>
                  <StarRating
                    value={Number(ratings[d.key] ?? 0)}
                    onChange={(v) => setRatings({ ...ratings, [d.key]: v })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Pontos fortes</Label>
            <Textarea
              rows={3}
              value={strengths ?? ""}
              onChange={(e) => setStrengths(e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>A desenvolver</Label>
            <Textarea
              rows={3}
              value={improvements ?? ""}
              onChange={(e) => setImprovements(e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Comentários adicionais</Label>
            <Textarea
              rows={3}
              value={comments ?? ""}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!periodStart || !periodEnd || save.isPending}
            onClick={() => save.mutate()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
