import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
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
  // Sistema/produto exibido no e-mail (ex.: TechERP)
  productName?: string;
  // Branding
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  // Textos customizáveis
  subject?: string;
  greeting?: string;
  bodyIntro?: string;
  ctaLabel?: string;
  footerNote?: string;
  expiresNote?: string;
}

const roleNames: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  member: "Membro",
};

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const heading = { fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: "0 0 12px" };
const text = { fontSize: "14px", lineHeight: "22px", color: "#334155", margin: "0 0 12px" };
const muted = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "16px 0 0",
  wordBreak: "break-all" as const,
};

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

const WorkspaceInviteEmail = ({
  inviteeEmail,
  workspaceName,
  inviterName,
  roleLabel,
  inviteUrl,
  expiresAt,
  productName,
  brandName,
  logoUrl,
  primaryColor,
  greeting,
  bodyIntro,
  ctaLabel,
  footerNote,
  expiresNote,
}: Props) => {
  const brand = brandName || workspaceName || "WK Technology";
  const product = productName || "TechERP";
  const role = roleLabel ? (roleNames[roleLabel] ?? roleLabel) : "membro";
  const expDate = expiresAt ? new Date(expiresAt).toLocaleDateString("pt-BR") : "";
  const primary = primaryColor || "#2563eb";
  const inviter = inviterName || "um administrador";

  const vars = {
    email: inviteeEmail || "",
    inviter,
    workspace: brand,
    role,
    product,
    expiresAt: expDate,
  };

  const greetingText = interpolate(greeting || "Olá {{email}},", vars);
  const introText = interpolate(
    bodyIntro ||
      "{{inviter}} convidou você para acessar o workspace {{workspace}} do {{product}} como {{role}}. Ao aceitar, você criará sua senha e poderá entrar imediatamente.",
    vars,
  );
  const cta = ctaLabel || "Aceitar convite";
  const expNote = expDate
    ? interpolate(expiresNote || "Este convite expira em {{expiresAt}}.", vars)
    : "";
  const footer = footerNote || "Se você não esperava este e-mail, pode ignorá-lo com segurança.";

  const button = {
    background: primary,
    color: "#ffffff",
    padding: "10px 18px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 500,
    textDecoration: "none",
    display: "inline-block",
  };
  const infoBox = {
    background: "#f1f5f9",
    borderLeft: `3px solid ${primary}`,
    padding: "12px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    color: "#1e293b",
    margin: "16px 0",
  };

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        {inviter} convidou você para o workspace {brand} do {product}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {logoUrl && (
            <Section style={{ marginBottom: "16px" }}>
              <Img src={logoUrl} alt={brand} height="36" style={{ maxHeight: "36px" }} />
            </Section>
          )}
          <Heading style={heading}>
            Você foi convidado para o {brand} — {product}
          </Heading>
          <Text style={text}>{greetingText}</Text>
          <Section style={infoBox}>
            <Text style={{ ...text, margin: 0 }}>{introText}</Text>
          </Section>
          {inviteUrl && (
            <Section style={{ margin: "20px 0" }}>
              <Button href={inviteUrl} style={button}>
                {cta}
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
            {expNote ? `${expNote} ` : ""}
            {footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: WorkspaceInviteEmail,
  subject: (data: Record<string, unknown>) => {
    const subj = (data?.subject as string) || "";
    const ws = (data?.workspaceName as string) || (data?.brandName as string) || "WK Technology";
    const product = (data?.productName as string) || "TechERP";
    if (subj) {
      return subj
        .replace(/\{\{\s*workspace\s*\}\}/g, ws)
        .replace(/\{\{\s*product\s*\}\}/g, product);
    }
    return `Convite para o ${ws} — ${product}`;
  },
  displayName: "Convite de workspace",
  previewData: {
    inviteeEmail: "convidado@empresa.com",
    workspaceName: "WK Technology",
    brandName: "WK Technology",
    inviterName: "Maria",
    roleLabel: "member",
    productName: "TechERP",
    inviteUrl: "https://app.wktechnology.com.br/accept-invite/exemplo-token",
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    primaryColor: "#2563eb",
  },
} satisfies TemplateEntry;
