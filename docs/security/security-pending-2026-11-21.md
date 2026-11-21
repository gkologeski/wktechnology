# SEGURANCA-PENDENCIAS — entrega de 21/11/2026

Porte G; previsão inicial 4–6 h. Escopo: aplicar as 16 correções ainda ativas do conjunto selecionado e a proteção de e-mail em massa já autorizada. Sem publicação, SQL, alterações de dados, grants, tipos gerados ou baseline. Não reabrir nem ignorar outros alertas.

## Implementado e escopo confirmado

- Neutralização de fórmulas nas exportações de prospecção, leads, contatos, tarefas, timesheet, sourcing e relatórios agendados; aspas e quebras de linha continuam escapadas. Números tipados e telefones E.164 puros preservados.
- Parser de PDF limitado ao bucket privado de currículos do armazenamento configurado, com URL assinada; sem destinos arbitrários, credenciais embutidas ou redirecionamento seguido.
- Variáveis de candidatos e destinatários escapadas no HTML de e-mails ATS e broadcasts. Assunto e texto simples permanecem inalterados; modelos mantêm seu HTML.
- Pixel de abertura exige assinatura vinculada à mensagem e ao escopo de abertura. Sem segredo configurado, entrega continua, mas rastreamento fica desativado; pixels antigos sem assinatura não atualizam contadores. O destinatário com capacidade válida ainda pode repetir aberturas: não é prova de identidade nem proteção contra bots de e-mail.
- Valores de busca quotados para PostgREST OR, sem mudar ilike direto. As referências mantêm cliente do usuário/RLS e passam pela checagem canônica de membro ativo/workspace antes de consultar.
- Pipeline de vaga deve pertencer ao workspace da chave de API, não ao workspace atualmente selecionado do dono. Consulta inexistente/falha bloqueia a inserção.
- Diagnóstico de falha Gmail inclui somente ID da conta, sem endereço ou texto arbitrário do provedor.

## Arquivos criados

- `src/lib/export/csv-formula.ts`
- `src/lib/postgrest-or.ts`
- `src/lib/security/cv-url.ts`
- Oito testes em `src/lib/security/`: `output-hardening`, `tracking-hardening`, `search-hardening`, `worker-hardening`, `jobs-pipeline-hardening`, `api-capability-hardening`, `email-delivery-hardening`, `cron-capability-hardening` (todos `.test.ts`).
- Este relatório.

## Arquivos alterados

- `src/components/people/timesheet-panel.tsx`, `src/components/prospecting/base-tab.tsx`
- `src/lib/ats/cv-parse-pdf.functions.ts`, `src/lib/ats/email-engine.server.ts`
- `src/lib/csv-export.ts`, `src/lib/export/export-rows.ts`
- `src/lib/email-tracking.server.ts`, `src/lib/email-broadcast/engine.server.ts`
- `src/lib/gmail-sync.functions.ts`, `src/lib/mcp/tools/search-leads.ts`
- `src/lib/message-tokens.ts`, `src/lib/scheduled-exports/engine.server.ts`, `src/lib/workflow-refs.functions.ts`
- `src/routes/_authenticated/(ats)/sourcing/analytics.tsx`
- `src/routes/api/public/email/pixel.$messageId.ts`, `src/routes/api/public/v1/ats/jobs.ts`
- `docs/security/permission-contracts.json`, `roadmap.md`

## Arquivos removidos

Quatro arquivos preparatórios de `.lovable/security-pending/`, agora substituídos pelo código efetivo. Nenhuma funcionalidade removida.

## Revisão, problemas e correções

A preparação antiga continha um import duplicado no ATS, uso potencial do valor OR quotado em ilike direto e log de erro que ainda poderia conter endereço. Foram evitados/corrigidos. A assinatura de rastreamento tinha fallback público: removido, com falha fechada e entrega preservada. A checagem de pipeline foi vinculada à chave. Contratos anteriores foram preservados byte a byte; somente novos contratos adicionados. Uma chave de fechamento ausente durante a edição do renderer foi corrigida antes das validações finais.

## Validações efetivamente executadas

- `bun run permissions:check`: aprovado, zero findings; baseline não regenerado.
- `bunx vitest run src/lib/security/*hardening.test.ts src/lib/access-control/active-workspace-boundary-ci.test.ts src/lib/access-control/sales-area-ci.test.ts src/lib/message-tokens.test.ts src/lib/workflows/engine/workflow-email.test.ts`: **74/74**, 12 arquivos. Destes, 49 testes novos. Provedores, RLS e respostas de banco simulados; nenhum e-mail ou operação real.
- ESLint direcionado aos arquivos alterados/novos: **0 erros, 10 avisos** (tamanho de arquivos, acesso direto preexistente, console e any). Sem refatoração fora do escopo.
- `git diff --check` / revisão do diff: sem erros de whitespace.
- Compilação automática da prévia: log `build OK`. Não equivale à CI integral nem ao deploy publicado.
- `bun run verify:changed --dry-run`: somente plano incremental, **não** execução do loop. Tipos/build manuais não executados; validação automática da plataforma preservada.
- `bun run perf:check`: falhou por ausência de `.verification/build.json`; não foi fabricado relatório.
- Playwright: tentativa do pixel público em localhost excedeu 30 s; confirmação via curl também excedeu 15 s sem resposta. **Não há validação visual nem conclusão E2E autenticada.**
- Docker indisponível: nenhuma suíte SQL descartável nova/real executada nesta entrega. Não afirmar validação de RLS real por testes com mocks.

## Banco, permissões, privacidade e UX

Sem migration, GRANT, configuração, credencial, dado de negócio ou schema alterados. Nove contratos novos distinguem funções puras, manutenção interna, chamadas de serviço e capacidades públicas. As evidências de capacidade/propagação de negação não certificam todo o IAM legado: serializers não conferem autoridade e os leitores existentes continuam responsáveis por RLS/campos. URLs assinadas continuam sendo verificadas remotamente pelo armazenamento. Nenhum token/segredo real usado nos testes ou registrado.

White Label, layout e ações existentes preservados. Nenhuma nova tela ou interação a documentar na Ajuda; apenas metadados da rota de analytics incluídos. Não houve auditoria visual de acessibilidade, claro/escuro ou celular nesta entrega.

## Pendências, riscos e validação manual

CI integral, testes de banco com ambiente isolado e navegador autenticado continuam pendentes por ambiente/execução não disponíveis aqui. Não confundir remediação no código com certificação global de segurança. Chat do site e os alertas já ignorados/corrigidos antes deste lote não foram alterados.

Após revisão: exportar uma lista autorizada com uma célula sintética iniciada por `=`, conferir que abre como texto; revisar e-mail em ambiente de teste com nome contendo `<`/`>`; tentar pipeline de outro workspace com chave de teste; validar PDF enviado pelo botão oficial; pixel sem assinatura deve devolver imagem sem registrar abertura. Não realizar disparos reais para estes testes.

Próximo passo recomendado: revisão independente/CI e aceite autenticado em ambiente de teste; publicação somente com autorização humana posterior.