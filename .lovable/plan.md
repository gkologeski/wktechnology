# NOTIFICA-CENTRAL — procedimento de publicação (auditoria somente leitura)

Porte P, estimativa 30–60 min de janela operacional após merge do PR #49 com CI verde.

## Estado verificado agora
- Sandbox em `b133f8571` (merge PR #48). PR #49 e arquivos 0391–0401 ainda NÃO estão no sandbox.
- Journal local termina em `0390_hiring_origin_context` (when `1795047517000`).
- Chamadas `triggerTickNow`: `src/lib/workflows.functions.ts`, `settings.workflows.tsx`, `leads.$id.tsx`.

## Restrições reais
- Não existe na hospedagem modo manutenção/drain nem troca atômica banco+código. A publicação substitui o código sem janela controlada; prévia e publicação usam o mesmo banco.
- A ferramenta de migração aplica TODOS os arquivos pendentes do journal em ordem, filtrando por `when` maior que o último `created_at` aplicado; não aplica subconjunto. Não reaplica 0001–0390 se o journal estiver íntegro.
- Cron jobs são gerenciados por SQL (`cron.alter_job`/unschedule) ou UI Database → Jobs; pausar é ação de escrita fora desta auditoria.
- Chamadas inline `triggerTickNow` no código antigo publicado continuam ativas até o novo deploy terminar; só param via flag no banco lida pelo motor ou pelo próprio deploy.

## Procedimento disponível (quando autorizado)
1. Merge PR #49 com CI verde; confirmar sandbox no novo HEAD e presença de 0391–0401 com `when` > `1795047517000`, estritamente crescentes (`drizzle-kit check` sem avisos de ordem).
2. Conferir no banco `drizzle.__drizzle_migrations`: máximo `created_at` = `1795047517000`, 0391+ ausentes; registrar SHA-256 dos 11 arquivos.
3. Contenção do motor velho: `cron.alter_job(313, active := false)` e `(314, ...)` (registrar estado anterior). Para callers inline, só há contenção se uma 0391+ ou flag existente fizer o tick recusar trabalho; caso contrário aceitar janela curta ou ordenar deploy antes.
4. Aplicar 0391–0401 numa única chamada da ferramenta de migração (transação própria, journal atualizado); conferir 11 linhas novas e hashes.
5. Tipos: regenerar só se o PR não os trouxer coerentes; se mudar, atualizar hash em `permission-contracts.json` e nova CI antes de publicar.
6. Publicar; confirmar `build-info.json` com hash esperado nos domínios.
7. Reativar jobs 313/314 (ou os sucessores do novo motor), validar ticks, `workflow_runs` e canais ainda desativados.

## Pendências
- Ler os SQL 0391–0401 após sincronização para confirmar ordem, compatibilidade com código antigo e se algum depende dos jobs pausados.
