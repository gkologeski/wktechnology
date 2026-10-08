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

interface ProfileLine {
  title: string;
  quantity: number;
  seniority?: string | null;
}
interface Props {
  approverName?: string;
  requesterName?: string;
  dealName?: string;
  profiles?: ProfileLine[];
  link?: string;
}

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const heading = { fontSize: "20px", fontWeight: 600, color: "#0f172a", margin: "0 0 12px" };
const text = { fontSize: "14px", lineHeight: "22px", color: "#334155", margin: "0 0 12px" };
const item = { fontSize: "14px", lineHeight: "20px", color: "#1e293b", margin: "0 0 6px" };
const box = {
  background: "#f1f5f9",
  padding: "12px 14px",
  borderRadius: "6px",
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
const muted = { fontSize: "12px", color: "#94a3b8", margin: "16px 0 0" };

const RoleProfileApprovalEmail = ({
  approverName,
  requesterName,
  dealName,
  profiles = [],
  link,
}: Props) => {
  const positions = profiles.reduce((a, p) => a + (p.quantity || 0), 0);
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        {`Aprovação de ${profiles.length} perfil(is) de vaga${dealName ? ` — ${dealName}` : ""}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Perfis de vaga aguardando sua aprovação</Heading>
          <Text style={text}>
            {approverName ? `Olá, ${approverName}.` : "Olá."}{" "}
            {requesterName ?? "Um colega"} pediu sua validação como líder da equipe
            {dealName ? ` no negócio ${dealName}` : ""}.
          </Text>
          <Section style={box}>
            {profiles.map((p, i) => (
              <Text key={i} style={item}>
                • {p.title} — {p.quantity} {p.quantity === 1 ? "posição" : "posições"}
                {p.seniority ? ` · ${p.seniority}` : ""}
              </Text>
            ))}
            <Text style={{ ...item, color: "#64748b", marginTop: "8px" }}>
              {profiles.length} {profiles.length === 1 ? "perfil" : "perfis"} · {positions}{" "}
              {positions === 1 ? "posição" : "posições"}
            </Text>
          </Section>
          <Text style={text}>
            Abra o negócio para aprovar ou solicitar ajustes em cada perfil. É preciso estar
            conectado.
          </Text>
          {link ? (
            <Button href={link} style={button}>
              Revisar perfis
            </Button>
          ) : null}
          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0 0" }} />
          <Text style={muted}>TechERP · Vagas e perfis</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: RoleProfileApprovalEmail,
  subject: (d: Record<string, unknown>) =>
    `Aprovação de perfis de vaga${d["dealName"] ? ` — ${String(d["dealName"])}` : ""}`,
  displayName: "Aprovação de perfis de vaga",
  previewData: {
    approverName: "Líder",
    requesterName: "Vendedor",
    dealName: "Negócio exemplo",
    profiles: [
      { title: "Desenvolvedor Delphi", quantity: 2, seniority: "Sênior" },
      { title: "Desenvolvedor React", quantity: 3, seniority: "Pleno" },
    ],
    link: "https://app.wktechnology.com.br/deals/exemplo",
  },
} satisfies TemplateEntry;
