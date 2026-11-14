import type { TemplateEntry } from "./registry";
function ContractSignatureRequest({
  signerName,
  documentTitle,
  workspaceName,
  signUrl,
}: {
  signerName: string;
  documentTitle: string;
  workspaceName: string;
  signUrl: string;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
        <h1>Solicitação de assinatura</h1>
        <p>Olá, {signerName}.</p>
        <p>
          {workspaceName} solicita sua assinatura no documento <strong>{documentTitle}</strong>.
        </p>
        <p>
          <a href={signUrl}>Consultar documento e assinar</a>
        </p>
        <p>
          Este link é pessoal. Confira o documento antes de assinar e não compartilhe seu acesso.
        </p>
      </body>
    </html>
  );
}
export const template: TemplateEntry = {
  component: ContractSignatureRequest,
  subject: (d) => `Assinatura solicitada: ${d.documentTitle}`,
  displayName: "Convite para assinatura de contrato",
};
