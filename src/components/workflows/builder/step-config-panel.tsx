import type { FieldOpt } from "./step-tree";
import { ACTION_LABELS, type WorkflowEntity, type WorkflowAction } from "@/lib/workflows/types";
import { GenericRecordForm } from "../generic-record-form";
import { ActionTemplatesBar } from "../action-templates-bar";
import { CoreStepForm } from "./step-forms/core-forms";
import { AtsStepForm } from "./step-forms/ats-forms";
import { CrmCreateStepForm } from "./step-forms/crm-create-forms";
import { CrmRecordStepForm } from "./step-forms/crm-record-forms";
import { FieldStepForm } from "./step-forms/field-forms";
import { MessagingStepForm } from "./step-forms/messaging-forms";
import {
  CopyFromAssociationForm,
  AssociateRecordsForm,
  DisassociateRecordsForm,
} from "./step-forms/association-forms";
import {
  SwitchByValueForm,
  BranchMultiForm,
  DelayUntilDateForm,
} from "./step-forms/flow-forms";
import { FormatDataForm, CreateSurveyActivityForm } from "./step-forms/data-forms";
import { ApprovalStepForm } from "./step-forms/approval-form";

export function StepConfigPanel({
  action,
  entity,
  entityFields,
  priorFields = [],
  onChange,
}: {
  action: WorkflowAction;
  entity: WorkflowEntity;
  entityFields: FieldOpt[];
  priorFields?: FieldOpt[];
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{ACTION_LABELS[action.type]}</h3>
        <p className="text-xs text-muted-foreground mt-1">Configure os detalhes deste passo.</p>
      </div>
      <ActionTemplatesBar action={action} entity={entity} onApply={onChange} />
      <StepConfigForm
        action={action}
        entity={entity}
        entityFields={entityFields}
        priorFields={priorFields}
        onChange={onChange}
      />
    </div>
  );
}

function StepConfigForm({
  action,
  entity,
  entityFields,
  priorFields = [],
  onChange,
}: {
  action: WorkflowAction;
  entity: WorkflowEntity;
  entityFields: FieldOpt[];
  priorFields?: FieldOpt[];
  onChange: (a: WorkflowAction) => void;
}) {
  switch (action.type) {
    case "set_field":
    case "set_substatus":
    case "create_activity":
    case "assign_to":
    case "rotate_assign":
    case "add_to_sequence":
    case "send_notification":
    case "webhook":
    case "delay":
    case "branch_if":
      return (
        <CoreStepForm
          action={action}
          entity={entity}
          entityFields={entityFields}
          priorFields={priorFields}
          onChange={onChange}
        />
      );
    case "create_ats_job":
    case "advance_ats_application_stage":
    case "create_ats_candidate":
    case "assign_recruiter":
      return <AtsStepForm action={action} entityFields={entityFields} onChange={onChange} />;
    case "create_lead":
    case "create_contact":
    case "create_company":
      return <CrmCreateStepForm action={action} entity={entity} onChange={onChange} />;
    case "create_deal":
    case "create_ticket":
    case "create_task":
      return <CrmRecordStepForm action={action} entity={entity} onChange={onChange} />;
    case "clear_field":
    case "increment_field":
    case "open_deal_dialog":
      return <FieldStepForm action={action} entity={entity} onChange={onChange} />;
    case "send_email":
    case "send_whatsapp":
    case "send_slack":
    case "send_teams":
      return <MessagingStepForm action={action} onChange={onChange} />;
    case "copy_field_from_association":
      return <CopyFromAssociationForm entity={entity} action={action} onChange={onChange} />;
    case "associate_records":
      return <AssociateRecordsForm entity={entity} action={action} onChange={onChange} />;
    case "disassociate_records":
      return <DisassociateRecordsForm entity={entity} action={action} onChange={onChange} />;
    case "switch_by_value":
      return (
        <SwitchByValueForm
          entity={entity}
          entityFields={entityFields}
          action={action}
          onChange={onChange}
        />
      );
    case "branch_multi":
      return (
        <BranchMultiForm
          entity={entity}
          entityFields={entityFields}
          priorFields={priorFields}
          action={action}
          onChange={onChange}
        />
      );
    case "delay_until_date":
      return <DelayUntilDateForm entity={entity} action={action} onChange={onChange} />;
    case "format_data":
      return <FormatDataForm action={action} onChange={onChange} />;
    case "create_survey_activity":
      return <CreateSurveyActivityForm action={action} onChange={onChange} />;
    case "approval_step":
      return <ApprovalStepForm action={action} onChange={onChange} />;
    case "create_record":
    case "update_record":
    case "delete_record":
      return <GenericRecordForm action={action} onChange={onChange} triggerEntity={entity} />;
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return null;
    }
  }
}
