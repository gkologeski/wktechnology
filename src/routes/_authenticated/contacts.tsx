import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EntityList } from "@/components/entity-list";
import { Button } from "@/components/ui/button";
import type { Contact, Company } from "@/lib/db-types";
import { Sparkles, MessageCircle, Mail, Phone } from "lucide-react";
import { BulkEnrichDialog } from "@/components/enrichment/bulk-enrich-dialog";
import { CallDialer } from "@/components/voice/call-dialer";
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";
import { SendEmailDialog } from "@/components/email/send-email-dialog";

export const Route = createFileRoute("/_authenticated/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const qc = useQueryClient();
  const [enrichIds, setEnrichIds] = useState<string[] | null>(null);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", "select"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id,name").order("name");
      return (data ?? []) as Pick<Company, "id" | "name">[];
    },
  });

  const companyMap = new Map(companies.map((c) => [c.id, c.name]));


  return (
    <EntityList<Contact>
      table="contacts"
      title="Contatos"
      description="Pessoas com quem você se relaciona."
      csvEnabled
      searchKeys={["first_name", "last_name", "email", "phone"]}
      columns={[
        { key: "first_name", label: "Nome", render: (r) => `${r.first_name} ${r.last_name ?? ""}`.trim() },
        { key: "email", label: "Email" },
        { key: "phone", label: "Telefone" },
        { key: "company_id", label: "Empresa", render: (r) => (r.company_id ? companyMap.get(r.company_id) ?? "—" : "—") },
        { key: "job_title", label: "Cargo" },
      ]}
      fields={[
        { name: "first_name", label: "Nome", required: true },
        { name: "last_name", label: "Sobrenome" },
        { name: "email", label: "Email", type: "email" },
        { name: "phone", label: "Telefone", type: "tel" },
        { name: "job_title", label: "Cargo" },
        {
          name: "company_id", label: "Empresa", type: "select",
          options: companies.map((c) => ({ value: c.id, label: c.name })),
        },
        { name: "notes", label: "Notas", type: "textarea" },
      ]}
      bulkEditFields={[
        { name: "job_title", label: "Cargo" },
        { name: "company_id", label: "Empresa", type: "select", options: companies.map((c) => ({ value: c.id, label: c.name })) },
      ]}
      bulkActions={(ids) => (
        <Button variant="outline" size="sm" onClick={() => setEnrichIds(ids)}>
          <Sparkles className="h-4 w-4 mr-1" /> Enriquecer
        </Button>
      )}
      rowActions={(row) => {
        const name = `${row.first_name} ${row.last_name ?? ""}`.trim();
        const phone = (row.phone || row.mobile_phone) as string | undefined;
        return (
          <div className="flex items-center gap-1">
            {row.email && (
              <SendEmailDialog
                defaultTo={row.email}
                contactId={row.id}
                contactName={name}
                trigger={
                  <Button size="icon" variant="ghost" title="Enviar email">
                    <Mail className="h-4 w-4" />
                  </Button>
                }
              />
            )}
            {phone && (
              <CallDialer
                defaultTo={phone}
                contactId={row.id}
                contactName={name}
                trigger={
                  <Button size="icon" variant="ghost" title="Ligar">
                    <Phone className="h-4 w-4" />
                  </Button>
                }
              />
            )}
            {phone && (
              <SendWhatsAppDialog
                defaultTo={phone}
                contactId={row.id}
                contactName={name}
                trigger={
                  <Button size="icon" variant="ghost" title="Enviar WhatsApp">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                }
              />
            )}
          </div>
        );
      }}
    />
    <BulkEnrichDialog
      open={!!enrichIds}
      onOpenChange={(o) => !o && setEnrichIds(null)}
      ids={enrichIds ?? []}
      entity="contact"
      onDone={() => qc.invalidateQueries({ queryKey: ["contacts"] })}
    />
    </>
  );
}
