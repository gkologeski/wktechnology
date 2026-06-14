import { createFileRoute } from "@tanstack/react-router";
import { EntityList } from "@/components/entity-list";
import { formatDateTime } from "@/lib/crm";
import { htmlToPlain } from "@/components/rich-html-editor";
import type { Activity } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesPage,
});

function NotesPage() {
  return (
    <EntityList<Activity>
      table="activities"
      title="Notas"
      description="Notas livres associadas a leads, contatos, empresas e negócios."
      entitySingularLabel="nota"
      lockedFilters={[{ type: "condition", field: "type", op: "eq", value: "note" }]}
      searchKeys={["subject", "body"]}
      inlineEditable={["subject"]}
      columns={[
        { key: "subject", label: "Assunto", render: (r) => r.subject || "(sem assunto)" },
        {
          key: "body",
          label: "Conteúdo",
          render: (r) => {
            const plain = htmlToPlain(r.body ?? "");
            return plain ? plain.slice(0, 120) + (plain.length > 120 ? "…" : "") : "—";
          },
        },
        { key: "created_at", label: "Criada em", render: (r) => formatDateTime(r.created_at) },
      ]}
      fields={[
        { name: "subject", label: "Assunto" },
        { name: "body", label: "Conteúdo", type: "html", required: true },
      ]}
      defaults={{ type: "note" } as Partial<Activity>}
    />
  );
}
