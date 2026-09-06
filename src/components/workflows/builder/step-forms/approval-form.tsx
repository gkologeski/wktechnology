import { UserPicker } from "./pickers";
import type { FieldOpt } from "../step-tree";
import {
  countSteps,
  describeAction,
  defaultActionOfType,
  ACTION_ICONS,
  getBranchList,
  setBranchList,
  isBranchKey,
} from "../step-tree";
import { useEntityFieldOptions } from "../use-entity-field-options";
import {
  ConditionListEditor,
  FieldValueEditor,
  newLeafCondition,
  normalizeTopGroup,
  denormalizeTopGroup,
} from "../conditions-editor";
import { EntityPickerDialog } from "../entity-picker-dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Webhook, X, ArrowUp, ArrowDown } from "lucide-react";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExtraFieldsEditor, FkPicker } from "../../extra-fields-editor";
import { GenericRecordForm } from "../../generic-record-form";
import { TokenInput, TokenTextarea } from "../../token-input";
import { useWorkspaceSubstatuses } from "@/lib/pipelines/substatuses";
import { ActionTemplatesBar } from "../../action-templates-bar";
import { ACTION_LABELS, type WorkflowEntity, type WorkflowAction } from "@/lib/workflows/types";
import { useServerFn } from "@tanstack/react-start";
import { listAvailableSurveys } from "@/lib/surveys/survey-activity.functions";


export function ApprovalStepForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "approval_step" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Título da aprovação</Label>
        <TokenInput
          value={action.title}
          onValueChange={(v) => onChange({ ...action, title: v })}
          placeholder="Aprovar desconto de {{name}}"
        />
      </div>
      <div className="space-y-1">
        <Label>Contexto para o aprovador (opcional)</Label>
        <TokenTextarea
          value={action.note ?? ""}
          onValueChange={(v) => onChange({ ...action, note: v })}
          rows={3}
          placeholder="Detalhes que o aprovador precisa ver."
        />
      </div>
      <div className="space-y-1">
        <Label>Aprovador (deixe vazio para o dono do workflow)</Label>
        <UserPicker
          value={action.approver_user_id ?? ""}
          onChange={(v) => onChange({ ...action, approver_user_id: v || undefined })}
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Switch
          checked={action.halt_on_reject ?? true}
          onCheckedChange={(v) => onChange({ ...action, halt_on_reject: v })}
          id="halt_on_reject"
        />
        <Label htmlFor="halt_on_reject" className="text-xs">
          Interromper workflow em caso de rejeição
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        O workflow pausa aqui. O aprovador recebe uma notificação e decide em Configurações →
        Workflows → Aprovações pendentes.
      </p>
    </div>
  );
}
