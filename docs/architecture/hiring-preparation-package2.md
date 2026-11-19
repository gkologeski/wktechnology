# SOLICITA-PREPARA — pacote 2

Porte G; previsão inicial 3–5 h. Código preparado para revisão, **não publicado**.

## Escopo e arquitetura
- `/people/hiring-requests`: profissionais CLT/PJ/freelance; finalidade cliente/interno/gestão compartilhada.
- `/contracts/supplier-requests`: empresa fornecedora canônica, contato opcional da mesma empresa; WK compradora. Não altera `provider`/`client` de contratos existentes.
- Título, justificativa/escopo, área, entidade legal WK e vínculos opcionais reais. Sem vaga/candidato/negócio fictício.
- Preparação somente: draft/ready/cancelled, revisão otimista, idempotência e histórico imutável. Nenhuma aprovação ou efeito operacional.
- Área Técnica sem aprovador permanece sem aprovador. Pronta não autoriza recrutamento antes da assinatura.
- RPC de escrita pertence a papel NOLOGIN/NOBYPASSRLS que herda authenticated. Consultas canônicas permanecem sob RLS do usuário; nenhum cliente administrativo lê entidades.
- Sem campos de salário/orçamento/documentos pessoais. JSON desconhecido é rejeitado. Vínculos só retornam id/nome em buscas limitadas.

## Migração — NÃO APLICADA
Arquivo versionado preparado: `docs/architecture/prepared-migrations/0373_hiring_requests.sql`.
Fora do journal e do diretório de aplicação automática, intencionalmente. Após revisão, aplicar seu conteúdo pelo mecanismo oficial de migration; conferir numeração disponível e gerar tipos. Não alterar migrations históricas.
Tabelas novas têm GRANT antes de RLS; FKs e gatilho invoker validam visibilidade e workspace de cada origem. Nenhum preset/cargo recebeu novas permissões.

## Matriz Permissões × Telas × Ações
| Tela | Recurso | Ações | Escopo |
|---|---|---|---|
| Profissionais | techpeople.hiring_requests | view/create/update | workspace |
| Cancelamento profissional | techpeople.hiring_requests.cancel | update | workspace |
| Fornecedores | techcontracts.supplier_requests | view/create/update | workspace |
| Cancelamento fornecedor | techcontracts.supplier_requests.cancel | update | workspace |

UI nega sem chave; servidor chama `hiring_preparation_access`; RLS/RPC repetem membership ativo, workspace ativo e resolvedor com deny. Cancelamento não edita outros campos. Catálogo e permission-contracts incluem chaves preparadas e hashes; baseline preservado. Admin mantém somente o bypass pré-existente do resolvedor (deny ainda prevalece).

## Arquivos
Criados: dois arquivos de rota acima; `src/lib/hiring/requests/{AGENTS.md,types.ts,boundary.server.ts,requests.functions.ts,preparation-screen.tsx,boundary.test.ts,preparation-postgres.test.ts}`; `src/components/hiring-requests/{AGENTS.md,preparation-form.tsx}`; fixture `tests/fixtures/hiring-preparation.sql`; migração preparada; este relatório; dois artigos `docs/help/people/preparar-solicitacao-contratacao.md` e `docs/help/contracts/preparar-contratacao-fornecedor.md`.
Alterados: menus People/Contracts, breadcrumb-labels, official-catalogue.json (somente os dois novos artigos), permission-contracts.json, permission-key-catalog.json e roadmap.md. routeTree.gen.ts atualizado automaticamente pelo roteador, não editado manualmente.
Removidos: nenhum.
Ajuda: fontes e catálogo oficiais v1 preparados; **não aplicada no banco** antes da revisão.

## Revisão e correções
- Corrigido tipo da projeção dinâmica dos pickers.
- Corrigida chave granular de cancelamento (ação update do catálogo).
- Cancel-only não pode modificar conteúdo; idempotência exige payload idêntico.
- Corrigida inicialização nativa PostgreSQL no sandbox (caminho real do binário) e envio de JSON na prova local.
- Somente este pacote foi alterado. Não foi corrigido/regenerado o baseline nem contratos pendentes de WhatsApp.

## Validações efetivamente executadas
- `bunx vitest run src/lib/hiring/requests/preparation-postgres.test.ts`: 14 passaram após correções; primeiras tentativas falharam na inicialização local/JSON, não contam como verdes.
- `bun run verify:changed` com nove alvos explícitos de requests/form/rotas/testes: segundo ciclo **passou** (tipos nativos do projeto, lint direcionado, 19 testes). Primeiro ciclo falhou na formatação do teste novo; corrigido. Dois avisos max-lines permanecem.
- `bun run permissions:check`: **falhou**, 13 achados preexistentes em arquivos de WhatsApp. Nenhum achado restante neste pacote; não equivale a gate global aprovado.
- `bun run help:coverage`: **254/254**, 436 artigos.
- `bun scripts/help-catalogue.ts`: gerou catálogo; diff conferido, somente dois artigos novos.
- `bunx prettier --write` nos arquivos novos e menus/breadcrumb; ESLint direcionado sem erros.
- `bun run perf:check`: **falhou** por `.verification/build.json` ausente.
- Montagem/tipos automática da prévia: última entrada conferida **build OK**.
- Playwright via Python: **não validado**; localhost:8080 não respondeu antes do timeout de 30 s. Nenhum resultado visual ou transacional pode ser declarado.
- `verify` global/build manual não executados; compilação e tipos são supervisionados pela plataforma. Não há certificado global/CI nesta entrega.

## Testes e limites da evidência
SQL real usa PostgreSQL oficial descartável, sem URL configurada. Resolvedores principais são carregados dos arquivos versionados; tabelas/policies de origem são fixtures sintéticas. Exercita permitido, sem chave, deny, workspace estrangeiro, inativo, estados, revisão, duas corridas, idempotência, imutabilidade, privilégios e campos financeiros. Não é login GoTrue, REST real ou prova de todas as policies canônicas de produção. Os cinco testes de boundary complementares provam falha fechada do servidor, mas não substituem SQL.

## UX, segurança e pendências
White Label/Essential e CSS global intactos. Componentes oficiais, labels, estados loading/empty/error, confirmação destrutiva, busca com debounce e paginação. Validação visual claro/escuro/mobile, fluxo autenticado criar→editar→ler no navegador e acesso direto/API com JWT real **pendentes**, impedidos pela prévia indisponível e migração deliberadamente não aplicada.
Histórico mostra escopo/status por revisão; demais vínculos permanecem no snapshot, sem comparação visual completa. Avisos de tamanho (tela e prova SQL) permanecem; não implicam teste aprovado de ergonomia.
Não foram criados dados operacionais, enviados convites/mensagens, configurados aprovadores ou alteradas políticas/buckets existentes. Não há segredo no código novo.

## Validação manual após revisão
1. Aplicar somente a migração preparada em ambiente isolado; conferir papel NOLOGIN/NOBYPASSRLS e revogações.
2. Conceder explicitamente chaves a contas de teste, não a todos os cargos.
3. Abrir ambas as URLs; criar rascunho com cadastros reais do ambiente isolado, salvar/reabrir, marcar pronta, editar e cancelar; conferir histórico.
4. Abrir a mesma revisão em duas sessões e salvar: apenas uma deve vencer; repetir mesma operação não deve duplicar.
5. Testar sem chave, deny, outro workspace e inativo por URL e RPC/REST; tentar vínculo estrangeiro e entidade legal divergente.
6. Testar mobile/desktop, claro/escuro/Essential e teclado; aplicar apenas os dois artigos via mecanismo editorial após aceite.

Próximo passo recomendado: revisão independente desta migração e matriz; depois aceite transacional isolado/CI. Não aplicar ou publicar automaticamente. Aprovações/formalização/execução continuam fora do escopo.
