# FORMALIZA-SOLICITA — auditoria prévia do pacote 3, lote 2

Porte G, estimativa 6–10 horas após definição da identidade do aceite externo. Sem código funcional, migration, aplicação, publicação ou ação real neste lote.

## Sequência e provas

O lote APROVA-SOLICITA (`669b60901`) foi auditado. Reexecutados `bun run permissions:check` e `bunx vitest run src/lib/hiring/requests/approval-postgres.test.ts src/lib/hiring/requests/boundary.test.ts`: 23/23 testes passaram; o gate global continua bloqueado por dois findings preexistentes do contrato de `src/integrations/supabase/types.ts`. Esse arquivo permanece intocado. Validação hospedada/CI completa do lote anterior permanece pendente; não houve aplicação ou publicação.

## Reutilização confirmada por código

- `contract_drafts.deal_id` e `proposal_id` são nullable (0312); estrutura/versões podem receber origem própria. A unicidade por proposal não garante um instrumento por solicitação; novo vínculo protegido será necessário.
- Jurídico usa `contract_draft_approvers` + `contract_draft_is_approver`; responsáveis Financeiro/assinatura e prazos existem em `contract_handoff_settings` (0362). Sua fila atual exige deal; não deve receber negócio fictício.
- `contract_draft_open`, `deal_contract_draft_prepare`, merge e guard de contrato aceito são centrados em venda. Não reduzir seus controles; criar despacho explícito de origem de contratação.
- Cadeia antiga de compra `purchasing → finance → legal` não equivale ao fluxo aprovado `jurídico → aceite externo → Financeiro → assinatura humana`. Não reutilizar essa cadeia como se fosse equivalente.
- `hiring_contract_native_prepare` (0358) rejeita client/sem deal e exige company. `hiring_contract_esign_body_without_attachments` (0367) rotula entidade prestadora/cliente. Adaptar apenas nova origem; manter corpos históricos.
- Preparação nativa por contatos preserva CONTRATANTE/CONTRATADO e participantes opcionais obrigatórios quando incluídos (0360). Pacote de anexos/PDF congelado está em 0367 e `signature-package.server.ts`.
- ForSign autoriza com `hiring_contract_signature_context` antes de acesso privilegiado e chamadas externas; envio nativo usa `contract_esign_request`. Gates da formalização precisarão ser chamados novamente imediatamente antes dos efeitos, além de proteger RPCs/triggers/link público.
- 0375 invalida só aprovação da solicitação; a formalização precisa propagar invalidação a ciclos jurídicos/financeiros, capacidades públicas e envios futuros, sem apagar assinaturas históricas.

## Decisão necessária antes da implementação

Hoje `/minuta/$token` e `contract_draft_public_decide` aceitam quem detém um UUID bearer e informa um nome. Não verificam identidade externa nem possuem prazo. Um usuário interno pode encerrar sua sessão e usar o mesmo link; bloquear apenas sessão autenticada ou esconder ação não cumpre a exigência de não aceitar em nome da contraparte.

Proposta para confirmação: link aleatório com prazo/revogação vinculado ao conteúdo/anexos aprovados, mais código de uso único entregue exclusivamente ao e-mail canônico da contraparte; rejeitar identidade vinculada a conta interna do workspace. Não entregar o código a operador interno, não expor em eventos/listas e não usar aceite manual interno. Implementação/testes usarão provedor controlado, sem e-mails reais; a verificação real depende da capacidade de envio configurada, que não foi auditada no serviço hospedado.

Mesmo essa solução prova controle do e-mail, não identidade civil nem assinatura; o aceite da minuta deve permanecer separado da assinatura e da execução do pacote 4.

Nenhum arquivo funcional criado/alterado ou removido. Somente roadmap e este parecer preparados. Próximo passo: confirmar mecanismo de identidade e implementar lote completo com migration revisável, contratos de permissão, Ajuda e SQL real, preservando vendas.