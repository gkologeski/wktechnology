# RASCUNHO-PROPOSTA — Salvar proposta como rascunho

Porte P · estimativa 45 min a 1h15.

## Objetivo
No assistente de proposta, o botão "Salvar rascunho" fica disponível em qualquer etapa, igual à cotação. Hoje só existe o salvar da última etapa, que exige condições de pagamento completas.

## Comportamento
- Rodapé do assistente: "Cancelar" · "Voltar" · **"Salvar rascunho"** · "Próximo"/"Salvar".
- "Salvar rascunho" grava o que já foi preenchido (título, texto, modelo, responsável, valor, validade, condições parciais) com situação **Rascunho**, mostra "Rascunho salvo." e abre a ficha da proposta.
- Exige apenas título (e a cotação/negócio de origem). Condições de pagamento incompletas não bloqueiam o rascunho.
- O botão final "Salvar" continua validando as condições de pagamento como hoje.
- Ao enviar para aprovação ou ao cliente, as validações atuais permanecem (proposta incompleta não sai como rascunho para o cliente).
- Reabrir a edição de um rascunho traz os dados salvos.

## Permissões
Reusa as chaves existentes: criar `techsales.proposals.create`, alterar `techsales.proposals.update`; condições só para quem pode alterar (regra atual). Sem chave nova.

## Ajuda
Atualizar "Gerenciar propostas" (nova versão) com a seção "Salvar como rascunho".

## Detalhes técnicos
- `src/components/proposals/proposal-wizard.tsx`: extrair a gravação de `submit()` em `persist({ validateTerms })`; novo `saveDraft()` chama `persist({ validateTerms: false })`; botão no rodapé desabilitado com `saving || !titleOk || !draft`.
- Conferir que criação via `createProposalFromQuote`/`createBlank` já nasce em `draft`; se o envio/aprovação não valida condições no servidor, adicionar essa checagem na transição (sem migração prevista).
- Atualizar hash do contrato em `permission-contracts.json` para o arquivo alterado; `permissions:check`, testes de propostas, `help:coverage`, typecheck.
- Teste no navegador: salvar rascunho na 1ª etapa sem condições e reabrir.
