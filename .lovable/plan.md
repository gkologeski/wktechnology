# Identidade histórica inativa para colaboradores do Clockify (em lote)

## Situação atual
- 201 pessoas no Clockify: 10 vinculadas automaticamente, 4 já confirmadas e **187 pendentes**. Todas as 187 têm e-mail.
- O importador já cria identidade histórica, mas **uma pessoa por vez**. Ela fica com conta bloqueada e membro inativo no workspace WK (mesmo modelo usado pelos responsáveis do HubSpot): sem convite, sem acesso e sem papéis.
- Cerca de 110 mil apontamentos dessas pessoas aguardam em revisão.

## O que será feito
1. **Ação em lote** "Criar identidade histórica para todos os pendentes" na aba Mapeamentos, com confirmação mostrando a quantidade.
2. Para cada pessoa pendente, reaproveitar a função existente (sem duplicar lógica):
   - e-mail já usado na plataforma: **não cria**. Se for membro do workspace WK, vincula a ele; caso contrário, fica pendente para escolha manual.
   - falha de uma pessoa não interrompe as outras; resultado por pessoa (criada / vinculada / pendente com motivo).
   - processamento em blocos pequenos, retomável e idempotente (se rodar de novo, ignora quem já tem vínculo).
3. Depois da criação, **liberar os apontamentos** dessas pessoas da revisão e retomar a gravação de horas dentro da mesma execução de importação (sem criar outra execução), com overlaps legados indo para revisão como hoje.
4. Relatório final: identidades criadas, vinculadas, pendentes e horas/apontamentos gravados.

## Garantias
- Somente workspace WK; só owner/admin pode acionar (checado no servidor).
- Nenhum convite, e-mail, notificação, workflow ou cobrança disparado.
- Nenhuma conta ativa criada; nenhum papel admin; nada é alterado no Clockify.
- Membros inativos não aparecem como opção de responsável e não ganham acesso.
- Não publica.

## Detalhes técnicos
- Nova função `createClockifyHistoricalIdentitiesBulk` em `clockify-service.server.ts` + server fn fina em `clockify.functions.ts`; loop sobre `clockify_mappings` (`entity_type='user'`, `decision='pending'`), lotes de 20 dentro do `BUDGET_MS`.
- Conflito de e-mail: busca em `profiles`/`workspace_members` do WK antes de `auth.admin.createUser`.
- Reprocessamento: marcar staging `pending_review|unmapped_user` dessas pessoas como `ready` e reabrir a fase `entries_write` da execução `4614397f…`.
- Testes unitários para: ignorar já vinculados, não criar com e-mail existente, falha isolada. Validação: typecheck, lint, build, testes e Playwright na aba Mapeamentos; contagens antes/depois no banco.
