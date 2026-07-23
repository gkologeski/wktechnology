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
  recipientName?: string;
  mentionerName?: string;
  category?: "mention" | "assignment";
  snippet?: string;
  link?: string;
  appName?: string;
}

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const heading = { fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: "0 0 12px" };
const text = { fontSize: "14px", lineHeight: "22px", color: "#334155", margin: "0 0 12px" };
const snippetBox = {
  background: "#f1f5f9",
  borderLeft: "3px solid #2563eb",
  padding: "12px 14px",
  borderRadius: "6px",
  fontSize: "13px",
  color: "#1e293b",
  margin: "16px 0",
  whiteSpace: "pre-wrap" as const,
};
const button = {
  background: "#2563eb",
  color: "#ffffff",
  padding: "10px 18px",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 500,
  textDecoration: "none",
  display: "inline-block",
};
const muted = { fontSize: "12px", color: "#94a3b8", margin: "16px 0 0" };

const MentionEmail = ({
  recipientName,
  mentionerName,
  category = "mention",
  snippet,
  link,
  appName = "WK Technology CRM",
}: Props) => {
  const verb = category === "assignment" ? "atribuiu algo a você" : "mencionou você";
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        {mentionerName ?? "Alguém"} {verb} no {appName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>
            {mentionerName ?? "Alguém"} {verb}
          </Heading>
          <Text style={text}>
            {recipientName ? `Olá ${recipientName},` : "Olá,"} você recebeu uma nova{" "}
            {category === "assignment" ? "atribuição" : "menção"} no {appName}.
          </Text>
          {snippet && (
            <Section style={snippetBox}>
              <Text style={{ ...text, margin: 0 }}>{snippet}</Text>
            </Section>
          )}
          {link && (
            <Section style={{ margin: "20px 0" }}>
              <Button href={link} style={button}>
                Abrir no CRM
              </Button>
            </Section>
          )}
          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0 12px" }} />
          <Text style={muted}>
            Você está recebendo este e-mail porque ativou notificações de{" "}
            {category === "assignment" ? "atribuições" : "menções"} em suas preferências.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: MentionEmail,
  subject: (data: Record<string, unknown>) => {
    const who = (data?.mentionerName as string) ?? "Alguém";
    const verb = data?.category === "assignment" ? "atribuiu algo a você" : "mencionou você";
    return `${who} ${verb}`;
  },
  displayName: "Menção / Atribuição",
  previewData: {
    recipientName: "Maria",
    mentionerName: "João",
    category: "mention",
    snippet: "Olá Maria, pode revisar a proposta do cliente X?",
    link: "https://app.wktechnology.com.br/deals/abc",
  },
} satisfies TemplateEntry;
