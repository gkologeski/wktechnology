# Pacote 4 — Lote C1 (PLANO-PROVISAO): plano econômico, cálculo elegível e provisão gerencial

Status: **preparado e testado localmente**. Migração `0383` **não aplicada**, nada publicado. Nenhum título, conta a pagar, recorrência ou pagamento.

## Fonte do plano
- O plano completo `docs/architecture/hiring-package4-implementation.md` da branch `origin/codex/contracting-execution-finance` **não pôde ser lido**: o sandbox não permite `git fetch` e a branch não existe localmente. Seguiu-se o escopo C1 da mensagem e as auditorias dos lotes A/B. Conciliar na revisão do PR.

## SQL preparado — `docs/architecture/prepared-migrations/0383_hiring_economic_plans_provisions.sql`
- Tabelas privadas (sem grant a `authenticated`; RLS ligada): `hiring_economic_plans` (cabeçalho: versão/status), `hiring_economic_plan_versions` e `hiring_economic_plan_events` (imutáveis).
- Cada versão guarda modalidade explícita, moeda, vigência dentro do início, componentes normalizados, cláusula/seção conferida, entidade WK, contrato, hash do instrumento assinado, revisão da solicitação, condição de liberação do fornecedor e `content_hash`.
- `hiring_econ_normalize`: modalidade obrigatória (nunca herdada de `modality` da demanda); componentes com valor/taxa, vencimento em dias e fonte; entrega = versão exata de entrega desta solicitação, sem repetição; hora apenas para profissional, projetos distintos/explicitos; mensal único com `full_month` ou `calendar_days`; misto com tipos distintos, fontes distintas e, com mensal, horas restritas a projeto.
- `hiring_econ_save` (versões com justificativa, conflito otimista, idempotência por operação, lock da solicitação) e `hiring_econ_transition` (envio; aprovação/rejeição somente pelo `contract_handoff_settings.finance_user_id` atual, com chave própria, nunca autor/enviador, vinculada ao hash exato).
- `hiring_econ_proof_problem`: prova do lote B (início, revisão, assinatura íntegra) + revisão da alçada igual à do início + entidade WK ativa com CNPJ.
- `hiring_econ_compute` (privada, só leitura): entrega aceita da versão/hash precificados (competência = mês do aceite); horas = soma de `duration_seconds` de apontamentos `approved`, não importados, com `period_closing_id` em fechamento `closed`, alocação do próprio vínculo e mesmo projeto; excluídos contados à parte; mensal com dias corridos reais. Snapshot com fontes e `hash`.
- `hiring_econ_provision_preview` / `hiring_econ_provision_close`: grava em `hiring_monthly_provisions` com `kind='cost'`, `config_id NULL`, política `hiring-econ-cost-v1`; só mês encerrado, sem linhas pendentes, hash igual à prévia, revisão encadeada (`supersedes_id` = última), lock consultivo por contrato+competência. Funções e linhas legadas (ATS/receita) intactas.
- `hiring_econ_context`: valores apenas com `economics.view` + acesso ao contrato (+ pessoa para profissional); provisões listadas só com chaves de provisão.
- Chaves novas (sem grant automático): `{techpeople.hiring_requests|techcontracts.supplier_requests}.{economics.view|economics.manage|economics.approve|provisions.manage|provisions.approve}.workspace`. Provisões exigem também as chaves canônicas `techfinance.provisions.manage/approve` (inseridas com `ON CONFLICT DO NOTHING`).
- ACL: REVOKE de todas as funções para PUBLIC/anon/authenticated/service_role/writer; EXECUTE só nas 5 RPCs públicas.

## Aplicação
- `economics.functions.ts` (server functions finas via `workRpc`), `economics-types.ts` (DTOs, rótulos, espelho das regras), `economics-panel.tsx` (ações laterais), `economics-history.tsx` (histórico central), encaixados em `preparation-screen.tsx` sem alterar as interfaces A/B.
- Ajuda v10 dos dois guias (docs + catálogo oficial), preparada e não aplicada.

## Validações executadas
- `bun run permissions:check`: único achado é o preexistente `src/integrations/supabase/types.ts` (não regenerado).
- `economics-postgres.test.ts`: 50/50 em PostgreSQL descartável (cinco cenários para salvar, enviar, decidir, ver, prévia e fechamento; chave canônica TechFinance; acesso privado; modalidade explícita; mensal/pró-rata; misto e dupla contagem; hora só profissional; versão exata de entrega e versão alterada; Financeiro configurado e autoaprovação; hash/conflito/idempotência/concorrência; alçada e assinatura; ver-como; horas aprovadas/fechadas/não importadas; fechamento só de mês encerrado, fontes desatualizadas, revisões encadeadas imutáveis, fechamento concorrente; provisão do fornecedor isolada por contrato; tabelas não legíveis diretamente).
- Mutações temporárias (remover checagem do Financeiro configurado; aceitar fechamento reaberto) fizeram os testes correspondentes falharem; SQL restaurado.
- `economics-presentation` 4/4, `hardcode-guard`, `date-field-guard`, `email-field-guard`, `help-catalogue`, `help:coverage` 254/254, `bun run typecheck`, ESLint direcionado (0 erros).
- Não executados: `verify`/`verify:changed`, build, Playwright, aplicação em banco real.

## Limitações
- A tabela de provisões usa a política RLS legada: detentores das chaves canônicas de provisões/tarifas/vínculo podem ler linhas `cost` de profissionais; linhas de fornecedor só pelo RPC.
- Competência da entrega é o mês do aceite; vencimento é informativo (C2 gera títulos).
- `also_client_acceptance` continua bloqueado pela 0374; não foi destravado.
- Fixture de horas/fechamento reproduz colunas de produção (0174) sem as funções de TechProjects.

## Revisão independente local (19/11)

- Regras atuais de campo oculto/mascarado de contrato, valores financeiros, tarifas e remuneração da pessoa são preservadas. Escrever exige também leitura econômica; fechamento preserva as chaves canônicas de consultar, preparar e aprovar provisão.
- A aprovação econômica precisa continuar autorizada pelo Financeiro vigente; retentativas exigem payload/origem exatos e fechamento repetido idêntico retorna a mesma linha imutável.
- Horas conferem pessoa, alocação/contrato/projeto, período, aprovação e o snapshot real do fechamento (id, revisão, segundos, usuário, projeto e data). Importações travadas/reabertas ou fontes incoerentes ficam fora. Fontes elegíveis sem acesso RLS bloqueiam o cálculo, sem falso zero. O acesso do chamador é resolvido em lote, preservando RLS, em vez de consultar permissões por apontamento.
- A competência da entrega usa seu período de execução; o aceite libera o valor, sem deslocar o trabalho ao mês do aceite tardio. Competência sem linhas não fecha provisão. Moeda precisa ser a do instrumento e preço fechado tem precisão monetária explícita.
- As novas linhas privadas de custo têm política restritiva adicional na tabela canônica. RPCs legadas mantêm seus gates anteriores e então encaminham somente contratos desta nova origem para o plano econômico; não geram uma segunda provisão por tarifas antigas.
- **66/66 testes** locais: 62 SQL + 4 de apresentação. Incluem campos privados, papel financeiro atual, repetição exata, fontes de fechamento corrompidas/inacessíveis, competência de aceite tardio e os adaptadores legados. Cálculo de 200 fontes passou sob `statement_timeout=4s` em PostgreSQL descartável.
- Preflight A+B+C1 no banco real, revertido: política restritiva nova, guardas dos adaptadores antigos, função de leitura de fontes sob o writer sem BYPASSRLS e privilégio CREATE restabelecido ao estado anterior. Sem persistência operacional.
