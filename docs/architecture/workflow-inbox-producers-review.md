# CANAIS-ATENDIMENTO — produtores e correção de OIDs

## Resultado auditado e status

**Pacote 2 integral ainda NÃO concluído nem publicável.** O lock de 0409 e `INBOX_CHANNEL_RUNTIME_READY=false` permanecem. Este registro não substitui a revisão, CI, testes JWT de usuário ou autorização de publicação.

Porte G; previsão informada: 6–8 horas para o pacote integral. O trabalho deste ciclo não cumpriu essa previsão de entrega integral. Base deste ciclo: `12102db143b940bd7f149dcd247b86b1b0b1bedc`, branch isolada `thr_szy0c51n71kd`. Nenhum aceite ou publicação, SQL em produção, mensagem a terceiros, credencial alterada ou concessão a cargos.

## Implementado neste ciclo

- **OIDs:** 0411 restaura os OIDs dos objetos canônicos de 0405, antes renomeados por 0408, e usa `CREATE OR REPLACE` neles. Os OIDs novos de 0408 sobrevivem como forwarders privados. A transação captura os OIDs e o hash das dependências `pg_depend` dos objetos antigos e falha se mudarem. Ambos continuam de propriedade de `techerp_api_subject`. Nesta instância: `notification_source_visible=20498`, `notification_center_source_visible=20407`. Não se presume estabilidade desses números entre bancos.
- **RPC de catálogo:** 0412 mantém `SECURITY INVOKER` e exige contexto de usuário/workspace, membership ativo e chaves efetivas Workflows + canal na chamada direta. Não adiciona Workflows ao gate de leitura de contas usado pelos destinatários Inbox. A matriz completa com JWT de usuário ainda não foi executada.
- **Widget:** 0413 grava mensagem, recibo e evidência na mesma transação, bloqueando a sessão. O UUID da tentativa, hash real do corpo e vínculo visitante/sessão impedem replay divergente. O cliente mantém texto e UUID após falha e repete somente por ação humana. Criação da conversa conserva `created_at` da sessão, não a data da mensagem posterior.
- **Unipile:** 0414 e a rota verificadora persistem SHA-256 do envelope já autenticado, data assinada do provedor e proveniência privada. Não persistem assinatura, segredo ou corpo do webhook no snapshot. Ingestão e projeção usam a rotina canônica existente, na mesma transação. Pré-existente/histórico não ganha proveniência live em retry. Datas não são inventadas a partir da hidratação ou da hora local. Echo permanece excluído.
- Recibos, evidências e ocorrências são imutáveis por trigger. O catálogo não concede chaves a cargos ou workspaces.
- Dois contratos existentes foram revisados somente quanto aos produtores realmente alterados e às RPCs correspondentes. Nenhum contrato fictício foi criado para eliminar as lacunas restantes. Outros blocos do catálogo de contratos foram mantidos byte a byte.
- Foram adicionadas **duas sessões de exemplo neste draft**, em workspaces sintéticos já reservados, sem login ou canal real da WK.

## Arquivos

Criados:

- `drizzle/migrations/0411_inbox_visibility_oid_repair.sql`
- `drizzle/migrations/0412_inbox_catalog_and_receipt_journals.sql`
- `drizzle/migrations/0413_inbox_widget_atomic_producer.sql`
- `drizzle/migrations/0414_inbox_unipile_atomic_producer.sql`
- Snapshots nativos `drizzle/migrations/meta/0411_snapshot.json` a `0414_snapshot.json`
- `src/lib/workflows/widget-producer.test.ts`
- `scripts/isolated-db/inbox-producers-local.ts`
- Este relatório.

Alterados:

- `src/routes/api/public/widget/messages.ts`
- `src/routes/widget.$workspaceId.tsx`
- `src/routes/api/public/unipile/webhook.ts`
- `src/lib/unipile/webhook-events.server.ts`
- `src/lib/unipile/webhook-events.test.ts`
- `docs/security/permission-contracts.json` — somente dois contratos de produtores.
- `db/seed.sql` — somente exemplos sintéticos.
- `roadmap.md`
- Journal e `src/integrations/supabase/types.ts` — atualizados **automaticamente pela ferramenta nativa** após as quatro migrações; não houve edição manual dos tipos ou baseline.

Removidos: nenhum arquivo.

## Migrações, ACL e problemas corrigidos

0411–0414 foram aplicadas **somente no banco local isolado deste draft**, por `lov_database--migration`, e ficaram registradas para revisão. Migrações main históricas não foram editadas. Aceitar o draft transfere suas mudanças de estrutura para o app, mas seus dados não são transferidos; não aceitar enquanto o pacote estiver incompleto.

As novas tabelas têm GRANT service, RLS habilitada e nenhum grant anon/authenticated. RPCs de produtores são service-only e rechecadas internamente. O catálogo de fontes é authenticated-only e invoker. Forwarders/funções privadas não são RPCs de cliente.

Falhas encontradas e corrigidas:

- A primeira tentativa de 0411 usou `jsonb_object_length`, inexistente; foi substituído por contagem de `jsonb_each_text`. A tentativa falha não aplicou SQL.
- O parser nativo rejeitou a tentativa combinada dos produtores. As rotinas foram divididas em migrações legíveis e variáveis compostas trocadas por `record`; somente as quatro versões aplicadas estão no journal.
- Uma conta de exemplo Unipile sem usuário Auth correspondente fez a transação de exemplos falhar. A fixture não válida foi removida; a transação foi reaplicada com somente as sessões válidas.
- Formatação havia normalizado escapes de contratos fora do escopo. Os bytes originais desses blocos foram restaurados antes do fechamento.

## Validações efetivamente executadas

1. `bun run permissions:check`, executado antes de qualquer tentativa de verify/build: **falha**. Última execução: **26 findings** (hashs/contratos herdados e cobertura de novas fronteiras 0411/0412). Não foram relaxadas regras nem atualizado o baseline.
2. `bunx vitest run src/lib/workflows/widget-producer.test.ts src/lib/unipile/webhook-events.test.ts src/lib/unipile/webhook-signature.test.ts src/lib/prospecting/sdr/widget-materials.test.ts`: **37/37 passaram**, quatro arquivos. Testam as rotas/controles reais com SDK e provedor mockados; não são prova SQL/RLS.
3. `psql -X -v ON_ERROR_STOP=1 --single-transaction -f db/seed.sql`: aplicado ao draft após correção da fixture, em transação.
4. `bun scripts/isolated-db/inbox-producers-local.ts`: **9 verificações reais passaram**, usando PostgREST/service-JWT e PostgreSQL local. Concorrência simultânea/replay retornam a mesma mensagem; um recibo/prova/ocorrência; rejeição de corpo alterado, visitante/sessão estrangeiros e UUID ausente; RPC de catálogo bloqueia service; owners/ACL privados preservados; nenhuma ativação sintética.
5. `git diff --check`: passou.
6. Playwright tentou a página pública do widget e a abertura da sessão sintética; **falhou por timeout antes de aparecer o campo Mensagem**. Portanto retry visual e releitura pelo navegador **não foram validados**. HTTP da página respondeu 200; isso não comprova o fluxo.
7. Compilação automática da prévia: última entrada observada `build OK` em 22/11/2026 00:25:18 UTC; não equivale ao build/CI completo do projeto.

`verify:changed`, `verify` integral, tipos/lint completos, build manual, performance e Help coverage **não executados**, pois o gate de permissões continua vermelho. Nenhum budget, timeout de suíte ou asserção foi relaxado. As 15 regressões anteriores de catálogo **não foram corrigidas nem rerrodadas neste ciclo**.

## Lacunas materiais do pacote integral

Ainda exigem implementação e testes, não apenas revisão externa:

1. A fila Gmail está durável, mas a cadeia de ocorrência/prova ainda precisa ser ligada ao término comprovado do item; fila concluída sozinha não certifica produtor funcional.
2. Atribuição/status reais e primeira resposta confirmada nos caminhos existentes ainda não foram conectados à prova versionada.
3. Completar `notification_business_proof_current`, bindings child/root e `sales_event_reference_access`; endurecer `sales_worker_check` inclusive aliases conflitantes/limites/configuração.
4. Recarregar responsável atual, destinatários com RLS e acesso ao canal nas três vias de dispatch; completar links e reaproveitamento dos avisos legados. As wrappers anteriores não resolvem essa cadeia.
5. Provar equivalência RLS de **todas** as entidades antigas com usuários reais. Asserção de OID/dependência não é equivalência de autorização por si só.
6. UI/NOTIFICA-CENTRAL, catálogo e Ajuda oficial completa; fechar os 26 findings de contrato por evidência legítima.
7. Cinco cenários com JWT real por fronteira e regressões de provedor, cutoff/versão, readonly, primeira resposta e WhatsApp; SQL de Unipile não foi exercitado por este script local do widget.
8. Corrigir as 15 regressões de catálogo, concluir Playwright e os gates integrais antes de liberar o lock.

## Revisão manual e próximo resultado necessário

Revisar o diff sobre a base indicada, conferir as quatro migrações e rodar o script local somente neste draft. Não aceitar/publicar este estado. O próximo resultado deve fechar a cadeia completa acima e os gates, não simplesmente remover o lock. Nenhuma execução continua automaticamente após este registro.
