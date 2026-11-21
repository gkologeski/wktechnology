import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import {
  notificationCentralUrl,
  NOTIFICATION_UPDATE_SUBJECT,
  NOTIFICATION_UPDATE_TEXT,
} from "@/lib/notifications/delivery-content";

type Props = { centralUrl?: string };

export function NotificationUpdateEmail({ centralUrl }: Props) {
  let url = notificationCentralUrl();
  if (centralUrl) {
    try {
      const candidate = new URL(centralUrl);
      if (
        candidate.pathname === "/notifications" &&
        !candidate.username &&
        !candidate.password &&
        !candidate.search &&
        !candidate.hash
      )
        url = notificationCentralUrl(candidate.origin);
    } catch {
      /* Invalid preview input keeps the canonical system URL. */
    }
  }
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{NOTIFICATION_UPDATE_SUBJECT}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" }}>
        <Container style={{ padding: "32px 28px", maxWidth: "560px" }}>
          <Heading style={{ fontSize: "20px", color: "#0f172a" }}>
            {NOTIFICATION_UPDATE_SUBJECT}
          </Heading>
          <Text style={{ fontSize: "14px", lineHeight: "22px", color: "#334155" }}>
            {NOTIFICATION_UPDATE_TEXT}
          </Text>
          <Text style={{ fontSize: "14px", lineHeight: "22px", color: "#334155" }}>
            Entre no TechERP e selecione o workspace autorizado para consultar os detalhes.
          </Text>
          <Button
            href={url}
            style={{
              backgroundColor: "#0f172a",
              color: "#ffffff",
              borderRadius: "8px",
              padding: "10px 18px",
            }}
          >
            Abrir central
          </Button>
          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0 12px" }} />
          <Text style={{ fontSize: "12px", color: "#64748b" }}>
            Gerencie seus canais e preferências na central. Este aviso não aprova nem conclui uma
            tarefa.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: NotificationUpdateEmail,
  subject: NOTIFICATION_UPDATE_SUBJECT,
  displayName: "Atualização da central de notificações",
  previewData: { centralUrl: notificationCentralUrl() },
} satisfies TemplateEntry;
