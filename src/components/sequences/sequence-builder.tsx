import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import {
  ENTITY_LABELS,
  STEP_LABELS,
  EMPTY_STEP,
  type SequenceStep,
  type SequenceEntity,
} from "@/lib/sequences/types";
import { TokenPills } from "@/components/ui/token-pills";
import { SEQUENCE_TOKENS } from "@/lib/message-tokens-catalog";

export interface SequenceDraft {
  id?: string;
  name: string;
  entity: SequenceEntity;
  enabled: boolean;
  steps: SequenceStep[];
}

export const EMPTY_DRAFT: SequenceDraft = {
  name: "Nova sequência",
  entity: "contacts",
  enabled: true,
  steps: [{ ...EMPTY_STEP, wait_days: 0 }],
};

interface Props {
  open: boolean;
  draft: SequenceDraft | null;
  onClose: () => void;
  onSave: (d: SequenceDraft) => void | Promise<void>;
}

export function SequenceBuilder({ open, draft, onClose, onSave }: Props) {
  const [local, setLocal] = useState<SequenceDraft | null>(draft);
  // Reset when draft changes
  if (draft && (local?.id ?? null) !== (draft.id ?? null) && local !== draft) {
    setLocal(draft);
  }
  if (!local) return null;

  const update = (patch: Partial<SequenceDraft>) => setLocal({ ...local, ...patch });
  const updateStep = (i: number, patch: Partial<SequenceStep>) => {
    const next = [...local.steps];
    next[i] = { ...next[i], ...patch } as SequenceStep;
    update({ steps: next });
  };
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= local.steps.length) return;
    const next = [...local.steps];
    [next[i], next[j]] = [next[j], next[i]];
    update({ steps: next });
  };
  const removeStep = (i: number) => update({ steps: local.steps.filter((_, k) => k !== i) });
  const addStep = () => update({ steps: [...local.steps, { ...EMPTY_STEP }] });

  const changeType = (i: number, type: SequenceStep["type"]) => {
    const cur = local.steps[i];
    if (type === "wait") updateStep(i, { type: "wait", wait_days: cur.wait_days } as SequenceStep);
    else
      updateStep(i, {
        type,
        wait_days: cur.wait_days,
        subject: "subject" in cur ? cur.subject : "Follow-up",
      } as SequenceStep);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{local.id ? "Editar sequência" : "Nova sequência"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={local.name} onChange={(e) => update({ name: e.target.value })} />
            </div>
            <div>
              <Label>Entidade</Label>
              <Select
                value={local.entity}
                onValueChange={(v) => update({ entity: v as SequenceEntity })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTITY_LABELS) as SequenceEntity[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {ENTITY_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={local.enabled} onCheckedChange={(v) => update({ enabled: v })} />
            <Label>Ativa</Label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Passos</Label>
              <Button size="sm" variant="outline" onClick={addStep}>
                <Plus className="h-3 w-3 mr-1" /> Passo
              </Button>
            </div>
            <div className="space-y-2">
              {local.steps.map((step, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                    <Select
                      value={step.type}
                      onValueChange={(v) => changeType(i, v as SequenceStep["type"])}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STEP_LABELS) as SequenceStep["type"][]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {STEP_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        className="w-20"
                        value={step.wait_days}
                        onChange={(e) =>
                          updateStep(i, { wait_days: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                      <span className="text-xs text-muted-foreground">dia(s) depois</span>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => moveStep(i, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => moveStep(i, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeStep(i)}
                        disabled={local.steps.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {step.type !== "wait" && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Assunto"
                        value={"subject" in step ? step.subject : ""}
                        onChange={(e) => updateStep(i, { subject: e.target.value })}
                      />
                      <RichHtmlEditor
                        value={"body" in step ? (step.body ?? "") : ""}
                        onChange={(html) => updateStep(i, { body: html })}
                        minHeight={140}
                        placeholder="Conteúdo (opcional). Use {{first_name}} para tokens."
                      />
                      <TokenPills
                        tokens={SEQUENCE_TOKENS}
                        onInsert={(t) => {
                          const active =
                            typeof document !== "undefined" ? document.activeElement : null;
                          if (active && (active as HTMLElement).isContentEditable) {
                            try {
                              document.execCommand("insertText", false, t);
                              return;
                            } catch {
                              /* fallback */
                            }
                          }
                          const current = "body" in step ? (step.body ?? "") : "";
                          updateStep(i, { body: current + t });
                        }}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(local)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
