import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function EditResponseDialog({
  open,
  onOpenChange,
  survey,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  survey: {
    id: string;
    kind: "csat" | "nps";
    score: number | null;
    comment: string | null;
    responded_at: string | null;
  } | null;
  onSaved?: () => void;
}) {
  const [score, setScore] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScore(survey?.score != null ? String(survey.score) : "");
    setComment(survey?.comment ?? "");
  }, [survey]);

  if (!survey) return null;
  const max = survey.kind === "nps" ? 10 : 5;

  async function save() {
    if (!survey) return;
    const n = score === "" ? null : Number(score);
    if (n !== null && (Number.isNaN(n) || n < 0 || n > max)) {
      return toast.error(`Score deve estar entre 0 e ${max}.`);
    }
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { score: n, comment: comment.trim() || null };
      if (n !== null && !survey.responded_at) patch.responded_at = new Date().toISOString();
      const { error } = await (
        supabase as unknown as {
          from: (t: string) => {
            update: (v: unknown) => {
              eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        }
      )
        .from("survey_responses")
        .update(patch)
        .eq("id", survey.id);
      if (error) throw error;
      toast.success("Resposta atualizada.");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar resposta ({survey.kind.toUpperCase()})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Score (0–{max})</Label>
            <Input
              type="number"
              min={0}
              max={max}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comentário</Label>
            <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
