// Template de e-mail para lembretes de tarefas, ligações e reuniões.
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  /** "task" | "call" | "meeting" | outro */
  activityType?: string;
  activityLabel?: string;
  subject?: string;
  dueAt?: string;
  recipientName?: string | null;
  relatedLabel?: string | null;
  link?: string | null;
  appName?: string;
}

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const heading = { fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: "0 0 12px" };
const text = { fontSize: "14px", lineHeight: "22px", color: "#334155", margin: "0 0 8px" };
const strong = { fontSize: "15px", fontWeight: 600, color: "#0f172a", margin: "0 0 8px" };
const button = {
  backgroundColor: "#0f172a",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "10px 18px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};
const muted = { fontSize: "12px", color: "#94a3b8", margin: "16px 0 0" };

export function activityReminderLabel(type?: string): string {
  switch (type) {
    case "meeting":
      return "reunião";
    case "call":
      return "ligação";
    case "task":
      return "tarefa";
    default:
      return "atividade";
  }
}

const ActivityReminderEmail = ({
  activityType,
  activityLabel,
  subject,
  dueAt,
  recipientName,
  relatedLabel,
  link,
  appName = "WK Technology",
}: Props) => {
  const label = activityLabel || activityReminderLabel(activityType);
  const title = `Lembrete de ${label}`;
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`${title}: ${subject || "(sem assunto)"}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>{title}</Heading>
          {recipientName ? <Text style={text}>Olá {recipientName},</Text> : null}
          <Section>
            <Text style={strong}>{subject || "(sem assunto)"}</Text>
            {dueAt ? <Text style={text}>Quando: {dueAt}</Text> : null}
            {relatedLabel ? <Text style={text}>Relacionado a: {relatedLabel}</Text> : null}
          </Section>
          {link ? (
            <Section style={{ margin: "18px 0 0" }}>
              <Button href={link} style={button}>
                Abrir no sistema
              </Button>
            </Section>
          ) : null}
          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0 12px" }} />
          <Text style={muted}>Enviado automaticamente por {appName}.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: ActivityReminderEmail,
  subject: (data: Record<string, unknown>) => {
    const label =
      (data?.activityLabel as string | undefined) ||
      activityReminderLabel(data?.activityType as string | undefined);
    const s = (data?.subject as string | undefined) || "(sem assunto)";
    return `Lembrete de ${label}: ${s}`;
  },
  displayName: "Lembrete de atividade",
  previewData: {
    activityType: "meeting",
    subject: "Reunião de alinhamento",
    dueAt: "05/08/2026 14:00",
    recipientName: "Maria",
    relatedLabel: "Negócio",
    link: "https://app.wktechnology.com.br/tasks",
  },
} satisfies TemplateEntry;
