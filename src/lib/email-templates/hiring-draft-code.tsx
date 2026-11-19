import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
function HiringDraftCode({ code }: { code: string }) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Confirme o acesso ao seu e-mail para responder à minuta</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ padding: "24px" }}>
          <Heading>Código para responder à minuta</Heading>
          <Text>Seu código temporário: {code}</Text>
          <Text>
            Válido por 10 minutos, uma única vez. Não compartilhe este código. Se não solicitou,
            ignore esta mensagem.
          </Text>
          <Text>
            O código confirma controle do e-mail; não é assinatura nem verificação de identidade
            civil.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
export const template = {
  component: HiringDraftCode,
  subject: "Código para responder à minuta · TechERP",
  displayName: "Código de aceite de minuta",
} satisfies TemplateEntry;
