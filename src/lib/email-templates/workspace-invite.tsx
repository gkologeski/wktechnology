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
  inviteeEmail?: string;
  workspaceName?: string;
  inviterName?: string;
  roleLabel?: string;
  inviteUrl?: string;
  expiresAt?: string;
  appName?: string;
}

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const heading = { fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: "0 0 12px" };
const text = { fontSize: "14px", lineHeight: "22px", color: "#334155", margin: "0 0 12px" };
const infoBox = {
  background: "#f1f5f9",
  borderLeft: "3px solid #2563eb",
  padding: "12px 14px",
  borderRadius: "6px",
  fontSize: "13px",
  color: "#1e293b",
  margin: "16px 0",
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
const muted = { fontSize: "12px", color: "#94a3b8", margin: "16px 0 0", wordBreak: "break-all" as const };

const roleNames: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  member: "Membro",
};

const WorkspaceInviteEmail = ({
  inviteeEmail,
  workspaceName,
  inviterName,
  roleLabel,
  inviteUrl,
  expiresAt,
  appName = "WK Technology",
}: Props) => {
  const role = roleLabel ? roleNames[roleLabel] ?? roleLabel : "membro";
  const expDate = expiresAt ? new Date(expiresAt).toLocaleDateString("pt-BR") : null;
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        {inviterName ?? "Sua equipe"} convidou você para o workspace {workspaceName ?? appName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Você foi convidado para o {appName}</Heading>
          <Text style={text}>
            {inviteeEmail ? `Olá ${inviteeEmail},` : "Olá,"} {inviterName ?? "um administrador"}{" "}
            convidou você para acessar o workspace{" "}
            <strong>{workspaceName ?? appName}</strong> como <strong>{role}</strong>.
          </Text>
          <Section style={infoBox}>
            <Text style={{ ...text, margin: 0 }}>
              Este convite é para usar o sistema {appName}. Ao aceitar, você criará sua senha e
              poderá entrar imediatamente.
            </Text>
          </Section>
          {inviteUrl && (
            <Section style={{ margin: "20px 0" }}>
              <Button href={inviteUrl} style={button}>
                Aceitar convite
              </Button>
            </Section>
          )}
          {inviteUrl && (
            <Text style={muted}>
              Se o botão não funcionar, copie e cole este link no navegador:
              <br />
              {inviteUrl}
            </Text>
          )}
          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0 12px" }} />
          <Text style={muted}>
            {expDate ? `Este convite expira em ${expDate}. ` : ""}Se você não esperava este
            e-mail, pode ignorá-lo com segurança.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: WorkspaceInviteEmail,
  subject: (data: Record<string, unknown>) => {
    const ws = (data?.workspaceName as string) ?? "WK Technology";
    return `Convite para o workspace ${ws}`;
  },
  displayName: "Convite de workspace",
  previewData: {
    inviteeEmail: "convidado@empresa.com",
    workspaceName: "WK Technology",
    inviterName: "Maria",
    roleLabel: "member",
    inviteUrl: "https://app.wktechnology.com.br/accept-invite/exemplo-token",
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  },
} satisfies TemplateEntry;
