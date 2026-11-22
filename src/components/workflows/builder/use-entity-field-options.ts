import type { FieldOpt } from "./step-tree";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEntityFieldCatalog } from "@/lib/entity-fields.functions";
import { ENTITY_FIELDS, type WorkflowEntity } from "@/lib/workflows/types";

export function useEntityFieldOptions(entity: WorkflowEntity): FieldOpt[] {
  const fetchCatalog = useServerFn(getEntityFieldCatalog);
  const { data } = useQuery({
    queryKey: ["wf-entity-fields", entity],
    queryFn: () => fetchCatalog({ data: { entity } }),
    staleTime: 5 * 60_000,
    enabled: entity !== "whatsapp_messages" && entity !== "inbox_channel_occurrences",
  });
  if (entity === "inbox_channel_occurrences")
    return ENTITY_FIELDS[entity].map((name) => ({ name, label: name, system: true }));
  if (entity === "whatsapp_messages")
    return [
      { name: "id", label: "ID da mensagem", system: true },
      { name: "workspace_id", label: "Workspace", system: true },
      { name: "owner_id", label: "Criador", system: true },
      { name: "conversation_id", label: "Conversa" },
      {
        name: "direction",
        label: "Direção",
        type: "select",
        options: [{ value: "inbound", label: "Recebida" }],
      },
      { name: "source_key", label: "Conta de origem" },
      { name: "phone_number_id", label: "Número comercial (ID)" },
      {
        name: "provider",
        label: "Integração de origem",
        type: "select",
        options: [
          { value: "cloud", label: "Cloud API" },
          { value: "lovable", label: "Lovable" },
        ],
      },
      { name: "occurred_at", label: "Recebida em", type: "date" },
      { name: "message_type", label: "Tipo de mensagem" },
      { name: "assigned_to", label: "Responsável", ref: "user" },
    ];
  if (data?.fields?.length) {
    return data.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      options: f.options,
      ref: (f as { ref?: FieldOpt["ref"] }).ref,
      system: (f as { system?: boolean }).system,
    }));
  }
  // Fallback: usa constantes locais enquanto o catálogo carrega.
  return (ENTITY_FIELDS[entity] ?? []).map((n) => ({ name: n, label: n }));
}
