import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Mail, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { CallHistoryPanel } from "@/components/voice/call-history-panel";
import { MeetingsPanel } from "@/components/meetings/meetings-panel";
import { StartVideoButton } from "@/components/meetings/start-video-button";
import { PropertiesPanel } from "@/components/properties-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { AssociationsPanel } from "@/components/record/associations-panel";
import { FocusQueueBar } from "@/components/focus-queue-bar";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[contact] load error", error);
      setLoadError(error.message);
      setContact(null);
      setLoading(false);
      return;
    }
    setContact(data as Contact | null);
    if (data?.company_id) {
      const { data: c } = await supabase
        .from("companies")
        .select("*")
        .eq("id", data.company_id)
        .maybeSingle();
      setCompany(c as Company | null);
    } else {
      setCompany(null);
    }
    setLoading(false);
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground p-6">Carregando...</p>;
  if (loadError)
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-destructive">Erro ao carregar contato: {loadError}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/contacts">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
      </div>
    );
  if (!contact)
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          Contato não encontrado ou você não tem acesso a ele.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/contacts">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
      </div>
    );

  const remove = async () => {
    if (!confirm("Excluir contato?")) return;
    await supabase.from("contacts").delete().eq("id", contact.id);
    toast.success("Excluído");
    navigate({ to: "/contacts" });
  };

  const fullName = `${contact.first_name} ${contact.last_name ?? ""}`.trim() || "Sem nome";
  const phone = (contact.phone || contact.mobile_phone) as string | undefined;

  const header = (
    <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-6 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-5 min-w-0">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link to="/contacts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary/20 border-4 border-card">
            {(contact.first_name?.[0] ?? "?").toUpperCase()}
            {(contact.last_name?.[0] ?? "").toUpperCase()}
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{fullName}</h1>
          <p className="text-muted-foreground text-sm truncate">
            {contact.job_title && <span>{contact.job_title}</span>}
            {contact.job_title && company && <span> em </span>}
            {company && (
              <Link
                to="/companies/$id"
                params={{ id: company.id }}
                className="text-primary hover:underline"
              >
                {company.name}
              </Link>
            )}
            {!contact.job_title && !company && <span>{contact.email ?? "sem email"}</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {contact.email && (
          <SendEmailDialog
            defaultTo={contact.email}
            contactId={contact.id}
            contactName={fullName}
            trigger={
              <Button variant="outline" className="rounded-xl gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" /> Email
              </Button>
            }
          />
        )}
        {phone && (
          <CallDialer
            defaultTo={phone}
            contactId={contact.id}
            contactName={fullName}
            trigger={
              <Button variant="outline" className="rounded-xl gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" /> Ligar
              </Button>
            }
          />
        )}
        {phone && (
          <SendWhatsAppDialog
            defaultTo={phone}
            contactId={contact.id}
            contactName={fullName}
            trigger={
              <Button className="rounded-xl gap-2 shadow-md shadow-primary/20">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            }
          />
        )}
        <StartVideoButton
          entity="contact"
          entityId={contact.id}
          defaultTitle={`Reunião com ${fullName}`}
          variant="outline"
          size="default"
          className="rounded-xl"
        />
        <div className="h-8 w-px bg-border mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
          onClick={remove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <FocusQueueBar entity="contacts" currentId={contact.id} />
      <RecordLayout
        header={header}
        left={
        <PropertiesPanel
          entity="contacts"
          table="contacts"
          row={contact as unknown as Record<string, unknown> & { id: string }}
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
          <CallHistoryPanel entity="contact" entityId={contact.id} />
          <MeetingsPanel entity="contact" entityId={contact.id} />
          <ActivityTimeline relatedKey="related_contact_id" relatedId={contact.id} />
        </>
      }
      right={
        <AssociationsPanel entity="contact" entityId={contact.id} companyId={contact.company_id} />
      }
      />
    </>
  );
}
