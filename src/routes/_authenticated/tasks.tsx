import { createFileRoute } from "@tanstack/react-router";
import { EntityList } from "@/components/entity-list";
import { TASK_STATUSES, TASK_PRIORITIES, formatDateTime } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

function TasksPage() {
  return (
    <EntityList<Activity>
      table="activities"
      title="Tarefas"
      description="Gerencie suas tarefas como no HubSpot."
      entitySingularLabel="tarefa"
      lockedFilters={[{ type: "condition", field: "type", op: "eq", value: "task" }]}
      searchKeys={["subject", "body"]}
      boardStageField="task_status"
      boardStages={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
      inlineEditable={["task_status", "task_priority", "subject"]}
      columns={[
        { key: "subject", label: "Assunto", render: (r) => r.subject || "(sem assunto)" },
        { key: "task_status", label: "Status", render: (r) => TASK_STATUSES.find((s) => s.value === r.task_status)?.label ?? "—" },
        { key: "task_priority", label: "Prioridade", render: (r) => TASK_PRIORITIES.find((p) => p.value === r.task_priority)?.label ?? "—" },
        { key: "due_date", label: "Vencimento", render: (r) => formatDateTime(r.due_date) },
        { key: "completed", label: "Concluída", render: (r) => (r.completed ? "Sim" : "Não") },
      ]}
      fields={[
        { name: "subject", label: "Assunto", required: true },
        { name: "body", label: "Descrição", type: "textarea" },
        { name: "due_date", label: "Vencimento", type: "date" },
        { name: "task_status", label: "Status", type: "select", options: TASK_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
        { name: "task_priority", label: "Prioridade", type: "select", options: TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label })) },
      ]}
      defaults={{ type: "task", task_status: "NOT_STARTED" } as Partial<Activity>}
      bulkEditFields={[
        { name: "task_status", label: "Status", type: "select", options: TASK_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
        { name: "task_priority", label: "Prioridade", type: "select", options: TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label })) },
      ]}
    />
  );
}
