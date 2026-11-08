// Monta o e-mail padrão de envio da proposta para aprovação do cliente.
// Puro e compartilhado entre a tela e os testes.

export type ProposalEmailInput = {
  title: string;
  company: string | null;
  contact: string | null;
  link: string;
  message: string;
};

export function defaultProposalSubject(title: string, company: string | null): string {
  return company ? `Proposta comercial — ${company}` : `Proposta comercial — ${title}`;
}

export function defaultProposalMessage(contact: string | null): string {
  const first = contact?.trim().split(/\s+/)[0];
  return [
    first ? `Olá, ${first}, tudo bem?` : "Olá, tudo bem?",
    "",
    "Segue a nossa proposta comercial. Pelo link abaixo você pode revisá-la e registrar sua aprovação ou recusa.",
    "",
    "Fico à disposição para qualquer dúvida.",
  ].join("\n");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildProposalEmail(input: ProposalEmailInput): { html: string; text: string } {
  const text = `${input.message.trim()}\n\nVer e aprovar proposta: ${input.link}\n`;
  const paragraphs = input.message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `${paragraphs}<p><a href="${esc(input.link)}" style="display:inline-block;padding:10px 18px;background:#1f3a5f;color:#ffffff;border-radius:6px;text-decoration:none">Ver e aprovar proposta</a></p><p style="font-size:12px;color:#666">Se o botão não abrir, copie este endereço: ${esc(input.link)}</p>`;
  return { html, text };
}
