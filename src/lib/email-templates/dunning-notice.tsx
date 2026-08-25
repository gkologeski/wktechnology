import {
  Body,
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
  subject?: string;
  body?: string;
  invoiceNumber?: string;
  customerName?: string;
  appName?: string;
}

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const heading = { fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: "0 0 12px" };
const text = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#334155",
  margin: "0 0 12px",
  whiteSpace: "pre-wrap" as const,
};
const muted = { fontSize: "12px", color: "#94a3b8", margin: "16px 0 0" };

const DunningNoticeEmail = ({
  subject,
  body,
  invoiceNumber,
  customerName,
  appName = "WK Technology",
}: Props) => {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{subject || `Cobrança${invoiceNumber ? ` — Fatura ${invoiceNumber}` : ""}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>
            {subject || `Aviso de cobrança${invoiceNumber ? ` — ${invoiceNumber}` : ""}`}
          </Heading>
          {customerName && <Text style={text}>Olá {customerName},</Text>}
          <Section>
            <Text style={text}>{body || ""}</Text>
          </Section>
          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0 12px" }} />
          <Text style={muted}>Enviado automaticamente por {appName}.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: DunningNoticeEmail,
  subject: (data: Record<string, unknown>) => {
    const s = data?.subject as string | undefined;
    const inv = data?.invoiceNumber as string | undefined;
    return s || `Cobrança${inv ? ` — Fatura ${inv}` : ""}`;
  },
  displayName: "Cobrança (Régua)",
  previewData: {
    subject: "Fatura 001 vencida",
    body: "Sua fatura 001 no valor de R$ 100,00 venceu em 2025-01-01.",
    invoiceNumber: "001",
    customerName: "Cliente",
  },
} satisfies TemplateEntry;
