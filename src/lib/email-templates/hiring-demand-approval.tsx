import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
function HiringDemandApprovalEmail({ link }: { link: string }) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Demanda de contratação aguardando aprovação</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif" }}>
        <Container style={{ padding: "32px" }}>
          <Heading>Demanda de contratação</Heading>
          <Text>
            Há uma demanda aguardando sua decisão como gestor ou CEO. Entre no TechERP para revisar
            a versão atual, consultar os detalhes e aprovar ou rejeitar com justificativa.
          </Text>
          <Text>A mensagem não concede acesso nem representa uma aprovação.</Text>
          <Button href={link}>Revisar demanda</Button>
        </Container>
      </Body>
    </Html>
  );
}
export const template: TemplateEntry = {
  component: HiringDemandApprovalEmail,
  subject: "TechHire · Demanda de contratação para aprovação",
  displayName: "Aprovação de demanda de contratação",
};
