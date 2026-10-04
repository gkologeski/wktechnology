import { CompanyAvatarFromInfo } from "@/components/companies/company-avatar";
import { useLinkedCompany } from "@/hooks/use-company-logos";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { associateInboxIdentity } from "@/lib/inbox/identity.functions";

type EntityType = "contact" | "lead";

export function InboxIdentityLinker({
  channel,
  conversationId,
  contactId,
  leadId,
  status,
  onLinked,
}: {
  channel: "whatsapp" | "email" | "chat";
  conversationId: string;
  contactId?: string | null;
  leadId?: string | null;
  status?: string | null;
  onLinked: () => void;
}) {
  const associate = useServerFn(associateInboxIdentity);
  const [entityType, setEntityType] = useState<EntityType>(contactId ? "contact" : "lead");
  const [entityId, setEntityId] = useState<string | null>(contactId ?? leadId ?? null);
  const mutation = useMutation({
    mutationFn: () => {
      if (!entityId) throw new Error("Selecione um contato ou lead.");
      return associate({ data: { channel, conversationId, entityType, entityId } });
    },
    onSuccess: () => {
      toast.success("Conversa associada");
      onLinked();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const linked = !!contactId || !!leadId;
  const { data: linkedCompany } = useLinkedCompany(contactId, leadId);
  const label =
    status === "ambiguous"
      ? "Mais de um registro corresponde. Escolha manualmente."
      : status === "not_found"
        ? "Nenhum registro correspondente foi encontrado."
        : linked
          ? `Associado ${status === "manual" ? "manualmente" : "automaticamente"}.`
          : "Associe esta conversa a um cliente.";

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-medium">Cliente associado</p>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {linkedCompany && (
        <div className="flex items-center gap-2 rounded-md border border-border/60 p-2">
          <CompanyAvatarFromInfo
            id={linkedCompany.id}
            name={linkedCompany.name}
            info={linkedCompany}
            size="sm"
          />
          <span className="min-w-0 truncate text-xs font-medium">{linkedCompany.name}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1" aria-label="Tipo de registro">
        <Button
          type="button"
          size="sm"
          variant={entityType === "contact" ? "secondary" : "ghost"}
          onClick={() => {
            setEntityType("contact");
            setEntityId(contactId ?? null);
          }}
        >
          Contato
        </Button>
        <Button
          type="button"
          size="sm"
          variant={entityType === "lead" ? "secondary" : "ghost"}
          onClick={() => {
            setEntityType("lead");
            setEntityId(leadId ?? null);
          }}
        >
          Lead
        </Button>
      </div>
      <EntityCombobox
        entity={entityType === "contact" ? "contacts" : "leads"}
        select="id, first_name, last_name, email"
        searchColumn="first_name"
        searchColumns={["first_name", "last_name", "email", "phone"]}
        value={entityId}
        onChange={(id) => setEntityId(id)}
        labelFrom={(row) =>
          [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
          String(row.email ?? "Sem nome")
        }
        hintFrom={(row) => (row.email ? String(row.email) : null)}
        placeholder={`Buscar ${entityType === "contact" ? "contato" : "lead"}…`}
        emptyLabel={`${entityType === "contact" ? "Contato" : "Lead"} não encontrado`}
        icon={Users}
      />
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={!entityId || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Associando…" : linked ? "Atualizar associação" : "Associar"}
      </Button>
    </div>
  );
}
