import type { FieldOpt } from "../../step-tree";
import {
  countSteps,
  describeAction,
  defaultActionOfType,
  ACTION_ICONS,
  getBranchList,
  setBranchList,
  isBranchKey,
} from "../../step-tree";
import { useEntityFieldOptions } from "../../use-entity-field-options";
import {
  ConditionListEditor,
  FieldValueEditor,
  newLeafCondition,
  normalizeTopGroup,
  denormalizeTopGroup,
} from "../../conditions-editor";
import { EntityPickerDialog } from "../../entity-picker-dialog";
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


export function CopyFromAssociationForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "copy_field_from_association" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Associação de origem</Label>
        <AssociationSelect
          entity={entity}
          value={action.association}
          onChange={(v) => onChange({ ...action, association: v })}
        />
      </div>
      <div>
        <Label className="text-xs">Campo de origem</Label>
        <Input
          value={action.source_field}
          onChange={(e) => onChange({ ...action, source_field: e.target.value })}
          placeholder="ex: industry"
        />
      </div>
      <div>
        <Label className="text-xs">Campo de destino (nesta entidade)</Label>
        <FieldSelect
          entity={entity}
          value={action.target_field}
          onChange={(v) => onChange({ ...action, target_field: v })}
        />
      </div>
    </div>
  );
}

export function AssociateRecordsForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "associate_records" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Associação</Label>
        <AssociationSelect
          entity={entity}
          value={action.association}
          onChange={(v) => onChange({ ...action, association: v })}
        />
      </div>
      <div>
        <Label className="text-xs">ID do registro alvo</Label>
        <TokenInput
          value={action.target_id}
          onValueChange={(v) => onChange({ ...action, target_id: v })}
          placeholder="uuid ou {{company_id}}"
        />
      </div>
    </div>
  );
}

export function DisassociateRecordsForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "disassociate_records" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div>
      <Label className="text-xs">Associação a remover</Label>
      <AssociationSelect
        entity={entity}
        value={action.association}
        onChange={(v) => onChange({ ...action, association: v })}
      />
    </div>
  );
}
