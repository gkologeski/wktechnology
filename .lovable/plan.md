# PROPOSTA-EMAIL — Envio da proposta ao cliente por e-mail

Porte **P/M**, estimativa **60–90 minutos** (código + testes + Ajuda + validação no preview). Publicação fica separada, após sua conferência.

## O que muda para o usuário

Na página da proposta (status Rascunho ou Aprovada):

- O botão **"Enviar ao cliente"** passa a se chamar **"Enviar ao cliente aprovar por e-mail"**. Ao clicar, abre uma janela com:
  - **Remetente**: sua conta de e-mail conectada (fixa para não admins; admin escolhe entre contas, mesma regra já usada no restante do sistema).
  - **Para**: já preenchido com o e-mail do contato da proposta/negócio, editável; campos **Cc** opcionais.
  - **Assunto** e **mensagem** pré-preenchidos (ex.: "Proposta comercial — {empresa}"), editáveis, com o botão/link "Ver e aprovar proposta".
  - Botão **Enviar**. Ao enviar: a proposta é selada (como hoje), o e-mail sai pela sua conta e fica registrado na timeline do negócio/contato.
- Novo botão **"Copiar link para cliente aprovar"**: sela a proposta (mesmo efeito do envio) e copia o link público onde o cliente aceita ou recusa. Útil para mandar por WhatsApp.
- O "Copiar link" atual (visualização) e "Baixar PDF" continuam.
- Mensagens claras para: sem conta de e-mail conectada (link para conectar), conta desconectada, e-mail inválido, falha no envio (a proposta não fica marcada como enviada se o e-mail falhar).

## Fluxo

```text
Aprovada/Rascunho → [Enviar por e-mail] → sela + envia Gmail + registra atividade → status "Enviada"
                  → [Copiar link p/ aprovar] → sela + copia link → status "Enviada"
Cliente abre link → Aceitar/Recusar (já existe)
```

## Detalhes técnicos

- Nova server function `sendProposalByEmail` em `src/lib/proposals.functions.ts` (fina), lógica em `src/lib/proposals/proposal-email.server.ts`:
  - Permissão `techsales.proposal_send` (manage) — mesma do envio atual, sem chave nova; remetente validado como no `sendGmailEmail` (não admin só a própria conta).
  - Ordem segura: valida conta/destinatários → gera/obtém token público → envia via `gmail.server` (`buildRawMime`/`gmailSendRaw`) → só então chama o selo existente (`sendProposal`), evitando proposta "enviada" sem e-mail; idempotência por proposta+versão.
  - Registra atividade de e-mail vinculada a deal/contato/empresa.
- "Copiar link para cliente aprovar" reutiliza `sendProposal` + token compartilhado já existentes.
- UI: `src/routes/_authenticated/proposals.$id.tsx` + novo `src/components/proposals/send-proposal-email-dialog.tsx` (EmailInput, labels, loading/erro).
- Testes: permitido, sem chave, deny, outro workspace, inativo; não admin tentando conta alheia; falha no Gmail não sela.
- Contrato em `permission-contracts.json`, artigo Ajuda `docs/help/crm/editar-enviar-proposta.md` (versão +1) e catálogo.
- Não altera banco, a página pública de aceite nem a regra de aprovação interna.
