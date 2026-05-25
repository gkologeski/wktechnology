import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Mail, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { PropertiesPanel } from "@/components/properties-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { AssociationsPanel } from "@/components/record/associations-panel";
import type { Contact, Company } from "@/lib/db-types";
import { toast } from "sonner";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { CallDialer } from "@/components/voice/call-dialer";
import { SendWhatsAppDialog } from "@/components/whatsapp/send-whatsapp-dialog";

export const Route = createFileRoute("/_authenticated/contacts/$id")({
  component: ContactDetail,
});

function ContactDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const load = async () => {
    const { data } = await supabase.from("contacts").select("*").eq("id", id).single();
    setContact(data as Contact | null);
    if (data?.company_id) {
      const { data: c } = await supabase.from("companies").select("*").eq("id", data.company_id).single();
      setCompany(c as Company | null);
    } else {
      setCompany(null);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  if (!contact) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const remove = async () => {
    if (!confirm("Excluir contato?")) return;
    await supabase.from("contacts").delete().eq("id", contact.id);
    toast.success("Excluído");
    navigate({ to: "/contacts" });
  };

  const fullName = `${contact.first_name} ${contact.last_name ?? ""}`.trim() || "Sem nome";
  const phone = (contact.phone || contact.mobile_phone) as string | undefined;

  const header = (
    <>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/contacts"><ArrowLeft className="h-4 w-4 mr-1" /> Contatos</Link>
        </Button>
        <div className="flex gap-2">
          {contact.email && (
            <SendEmailDialog defaultTo={contact.email} contactId={contact.id} contactName={fullName}
              trigger={<Button size="sm" variant="outline"><Mail className="h-4 w-4 mr-1" /> Email</Button>} />
          )}
          {phone && (
            <CallDialer defaultTo={phone} contactId={contact.id} contactName={fullName}
              trigger={<Button size="sm" variant="outline"><Phone className="h-4 w-4 mr-1" /> Ligar</Button>} />
          )}
          {phone && (
            <SendWhatsAppDialog defaultTo={phone} contactId={contact.id} contactName={fullName}
              trigger={<Button size="sm" variant="outline"><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</Button>} />
          )}
          <Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 text-sm font-semibold text-primary">
            {(contact.first_name?.[0] ?? "?").toUpperCase()}{(contact.last_name?.[0] ?? "").toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{fullName}</h1>
            <p className="text-sm text-muted-foreground">
              {contact.job_title && <span>{contact.job_title} · </span>}
              {company && <Link to="/companies/$id" params={{ id: company.id }} className="text-primary hover:underline">{company.name}</Link>}
              {!company && <span>{contact.email ?? "sem email"}</span>}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <RecordLayout
      header={header}
      left={
        <PropertiesPanel
          entity="contacts" table="contacts" row={contact as unknown as Record<string, unknown> & { id: string }}
          props={[
            { key: "first_name", label: "Nome", primary: true },
            { key: "last_name", label: "Sobrenome", primary: true },
            { key: "email", label: "Email", type: "email", primary: true },
            { key: "phone", label: "Telefone", type: "tel", primary: true },
            { key: "mobile_phone", label: "Celular", type: "tel", primary: true },
            { key: "job_title", label: "Cargo", primary: true },
            { key: "notes", label: "Notas" },
          ]}
          onSaved={load}
        />
      }
      center={
        <>
          <AiSummaryPanel entity="contact" entityId={contact.id} />
          <h2 className="font-semibold text-sm">Atividades</h2>
          <ActivityTimeline relatedKey="related_contact_id" relatedId={contact.id} />
        </>
      }
      right={<AssociationsPanel entity="contact" entityId={contact.id} companyId={contact.company_id} />}
    />
  );
}
