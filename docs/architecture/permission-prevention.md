# Ordem 6 — prevenção de novas lacunas de autorização

Aplica-se aos seis módulos do TechERP e às áreas compartilhadas. Não concede
permissões a cargos, não modifica registros de negócio nem amplia acessos.

## Gate obrigatório

`bun run permissions:check` é a primeira etapa de `bun run verify` e tem etapa
própria incondicional na CI de push/main e pull requests. Falhas interrompem o
job antes de build. O relatório `.verification/permissions.json` é arquivado
com a verificação técnica. Não exige credenciais do ERP ou acesso a produção.

O gate compara todos os arquivos de produção em `src/`, migrations Drizzle e
migrations Supabase: telas, APIs públicas e autenticadas, handlers, ações,
componentes, integração, configuração e SQL. Alterar um handler dentro de um
arquivo existente também muda seu hash; não basta registrar a rota inicial.
Testes e arquivos de rotas gerados ficam fora do inventário de produção.

A base inicial tem 2.823 arquivos do commit `faca56d27e3e60bc7609208f97704e3e571abb98`.
Ela é validada contra a árvore Git de origem e não pode ser regenerada para
absorver novos arquivos. Nos PRs a comparação usa a base real do evento GitHub;
em pushes usa `before`. Falta de histórico/base falha com saída não zero.
Localmente a comparação usa HEAD, ou `--base <SHA completo>` explicitamente.

O inventário é um ponto de partida, não prova de que todos os arquivos antigos
estão autorizados corretamente. Os aceites das Ordens 1–5 continuam nas suas
próprias evidências. O gate impede mudanças futuras sem declaração revisada;
não converte observações históricas em conclusões de segurança.

## Como entregar uma funcionalidade ou manutenção

1. Execute `bun run permissions:check`. Arquivos novos/alterados serão listados.
2. Em `docs/security/permission-contracts.json`, registre um contrato ou revise
   o existente: arquivos com SHA-256 atual, recurso, ações, escopos e chaves.
   Cada arquivo alterado tem exatamente um contrato vigente. A revisão deve
   abranger todas as operações do arquivo, inclusive botões novos e endpoints.
3. Cite o símbolo real do controle e a origem. Import, comentário ou string
   contendo o nome não contam. Cada `createServerFn` do arquivo precisa usar
   um controle declarado, inclusive quando já havia outro handler protegido.
   Métodos HTTP em `server.handlers` também são verificados individualmente;
   middleware comum precisa estar ligado ao objeto server real.
   Controles delegados devem ser funções reais e ter testes de negação.
4. Declare a fronteira de banco: RLS/RPC/view/policy existente ou nova. SQL novo
   identifica sua própria superfície. Uma declaração simulada em comentário,
   literal de texto ou corpo dollar-quoted não satisfaz a referência.
5. Referencie cinco testes Vitest distintos, descobertos obrigatoriamente por
   `src/**/*.test.ts`: permitido, sem chave, deny explícito, outro workspace e
   membro inativo. O nome literal precisa existir em `it`/`test`, com callback e
   asserção. Testes skipped, vazios, comentários, E2E opt-in e scripts isolados
   não são contados como evidência executada pela CI. Os testes devem exercitar
   os controles reais, não apenas comparar strings de código.
6. Rode o gate e `bun run verify`, depois `bun run build`. Uma alteração após
   a verificação invalida o fingerprint. Teste RLS/JWT no ambiente isolado
   quando a decisão de autorização ou o banco mudar; os testes unitários da CI
   não substituem esse aceite.

Para calcular um hash: `shasum -a 256 caminho/do/arquivo`. O contrato da Home é
um exemplo real: boundary autenticada no servidor, ações view/export e
agregados que revalidam seus próprios escopos no banco. Seus testes unitários
simulam erros da RPC para verificar que o handler não prossegue; os testes JWT
isolados da Ordem 5 são a evidência adicional do banco.

O catálogo `permission-key-catalog.json` contém 2.741 nomes, conferidos com a
produção em 25/10/2026, sem usuários/grants. Chaves referenciadas precisam
existir e corresponder ao recurso/ação/escopo declarados. Nova chave exige
registro literal em migration nova e vínculo em `additions`; não retire chave
existente sem uma frente própria de compatibilidade. O gate não concede chaves.

Migração histórica alterada ou removida é erro. Use outra migração. Remoção de
código precisa do hash original e justificativa de impacto em `retired`.

## Exceções

Tipos públicos, pessoais, de plataforma, serviço ou internos exigem motivo,
controle real, fronteira do banco, testes e mecanismo explícito: identidade ou
capacidade, alcance, revogação e `review_by` válido. Para token público, os
cenários sem chave/deny correspondem a token ausente/inválido ou revogado.
Prazo de revisão vencido reprova o gate; não significa revogação automática do
serviço em produção. A validade real dos tokens continua na implementação.

Mudança apenas de apresentação pode usar `kind: presentation`, sem chave ou
recurso de negócio. É recusada se declarar rota/server function, acesso a dados
ou eventos de UI. Essa exceção evita inventar testes de autorização para texto
estático; não pode encobrir ações ou campos sensíveis.

## Limites e manutenção do gate

Análise estática valida vínculos e evidências, não prova matematicamente o
comportamento de uma função ou a suficiência de um teste. Um teste tautológico
não se torna evidência útil por passar no parser: a revisão do contrato precisa
avaliar sua intenção e as asserções. Testes de mutação do próprio gate verificam
que regressões conhecidas são recusadas.

A configuração da CI é lida como YAML e o runner de verify por AST: comentários
não simulam etapas reais, o gate não pode ser condicional/continue-on-error e
precisa vir antes de verify/build. O job E2E opcional permanece separado.
Proteções do GitHub são configuração remota, não efeito automático do YAML;
seu estado e exceções devem constar no aceite operacional da Ordem 6.
Não tratar um push/merge permitido por bypass como aprovação dos testes.

## Política remota escolhida pelo responsável

O usuário escolheu manter a sincronização direta do Lovable e permitir exceção
administrativa explícita. A configuração é um ruleset ativo somente para
`refs/heads/main`, com `Full verification and performance` do GitHub Actions
como check obrigatório e branch atualizada para merges comuns. Os bypasses são
somente `Repository admin` e o app já instalado `lovable.dev`, em modo Always.
Nenhum novo usuário/app recebe permissão de repositório com essa configuração.
Esses dois atores podem sincronizar diretamente; a CI ainda registra o resultado
normalmente, mas a regra não impede seu push por falha do check. Isso é uma
exceção escolhida, não garantia de bloqueio absoluto de toda publicação.
O relatório operacional registra o ID e a leitura efetiva do ruleset após salvar.

## PostgreSQL descartável obrigatório na CI

`permission-postgres-ci.test.ts` executa as funções reais de autorização e as políticas das migrações 0239, 0240, 0242, 0243, 0244, 0245, 0246, 0247, 0248, 0249 a agregação do painel de vendas da 0250 e o histórico relacionado da 0251 em PostgreSQL oficial fixado por digest, com registros sintéticos. Os sessenta e um cenários cobrem autorização, ausência de chave, deny, workspace estrangeiro, membro inativo, escopo próprio/equipe, colunas de credenciais e modo somente leitura. Faz parte do job obrigatório existente; Docker local precisa estar em execução. Ausência do Docker falha o teste, nunca gera skip verde. Nenhuma URL de banco configurada é usada. As claims são fixtures SQL, sem autenticação GoTrue; os aceites com JWT real e navegador continuam separados. `.verification/sql-rls.json` só fica completo após todos os cenários e a limpeza do contêiner. O fingerprint inclui `tests/fixtures`.
