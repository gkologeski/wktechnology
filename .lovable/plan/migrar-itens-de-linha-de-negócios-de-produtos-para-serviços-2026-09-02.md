# Migrar itens de linha de Negócios de "produtos" para Serviços

## Diagnóstico (verificado no banco e no código)

- A entidade **Produtos foi removida**: não existe mais `public.products`, e
  `deal_line_items` não tem mais `product_id`. As colunas atuais já são as novas:
  `service_catalog_id`, `contracting_preset_id`, `job_profile_id`, `seniority`, `unit`.
- O editor de itens de linha (`src/components/deals/deal-line-items.tsx`) já
  seleciona serviço do catálogo, cargo e senioridade — a interface está pronta.
- O problema é **dado legado**: de **506** itens de linha, apenas **2** têm
  `service_catalog_id`. Os outros **504** (em 352 negócios) são texto livre vindo
  do HubSpot, com nomes como "Fábrica de Software (Delphi)" (26), "Consultoria
  Técnica" (28), "Desenvolvedor Delphi Senior" (25), "Análise de Negócios II" (15),
  "Hunting" (12).
- Catálogo atual tem **6 linhas de serviço**: Outsourcing de TI, Fábrica de
  Software, Consultoria Técnica, Hunting de TI, BPO Administrativo/Financeiro,
  Recursos Humanos (BPO).
- Existem **249 cargos** em `job_profiles`, porém **sem** `service_catalog_id` e
  **sem** `seniority` preenchidos.
- Teste de casamento automático: dos **194 nomes distintos**, **77** casam com um
  cargo existente depois de remover a senioridade do fim do nome; **117** não
  casam e precisam de regra ou revisão.

Conclusão: não é migração de schema, é **classificação de dados** com revisão humana.

## Proposta

### Etapa 1 — Tela de migração assistida (Configurações > Migração de itens de linha)

Uma tela de mapeamento, no padrão de lista do design system, que:

1. lista os nomes distintos de itens sem serviço, com quantidade de itens,
   quantidade de negócios e valor total envolvido;
2. mostra a sugestão automática por linha: **serviço**, **cargo** e **senioridade**;
3. permite corrigir qualquer sugestão em seletores (mesmo padrão do editor de itens);
4. permite marcar linhas como "ignorar" (ex.: itens avulsos que não são serviço);
5. aplica em lote apenas os nomes revisados/aprovados, com contagem antes/depois.

Nada é gravado sem o usuário aprovar; a aplicação é idempotente (só toca itens
com `service_catalog_id` nulo).

### Etapa 2 — Regras de sugestão automática

- **Senioridade** extraída do fim do nome: Júnior/JR, Pleno/PL, Sênior/SR,
  Especialista, Trainee; "I/II/III" viram nível quando o resto casa com um cargo.
- **Cargo**: casamento exato pelo nome sem senioridade (77 nomes), depois
  casamento por similaridade (trigram) contra os 249 cargos, com limite mínimo de
  confiança — abaixo disso a linha fica "sem sugestão" para escolha manual.
- **Serviço** por palavra-chave, na ordem:
  - contém "Fábrica de Software" → Fábrica de Software;
  - contém "Consultoria"/"Diagnóstico"/"Mockup" → Consultoria Técnica;
  - contém "Hunting"/"Recrutamento" → Hunting de TI;
  - cargos técnicos de TI (Desenvolvedor, QA, DBA, Tech Lead, Analista de
    Sistemas, PO, Scrum Master…) → Outsourcing de TI;
  - cargos administrativos/financeiros → BPO Administrativo/Financeiro;
  - cargos de RH → Recursos Humanos (BPO);
  - nenhuma regra → sem sugestão.
- "Análise de Negócios I/II/III" mapeia para o cargo Analista de Negócios com
  senioridade Júnior/Pleno/Sênior, em Consultoria Técnica — confirmável na tela.

### Etapa 3 — Enriquecer o cadastro de cargos

Preencher `job_profiles.service_catalog_id` (e senioridade quando o nome do cargo
já a contém) a partir das mesmas regras, para que novos negócios já sugiram
serviço automaticamente ao escolher o cargo. Também é revisável na mesma tela.

### Etapa 4 — Evitar recaída

- No editor de itens de linha, tornar o serviço **obrigatório** para novos itens
  (itens antigos continuam salvando sem quebrar).
- Na importação/sincronização do HubSpot, aplicar as mesmas regras de sugestão ao
  criar itens de linha, deixando o item marcado como "a revisar" quando não houver
  sugestão confiável.

### Etapa 5 — Relatórios

Com `service_catalog_id` preenchido, os agrupamentos por serviço em Negócios e
Contratos passam a cobrir a base histórica; a aba **Base** de `/prospecting`
(filtro por serviço) deixa de perder os 504 itens legados.

## O que NÃO muda

- Nenhuma coluna nova, nenhum `DROP`, nenhuma mudança de RLS, GRANT ou permissão.
- Nenhum valor financeiro dos itens (`quantity`, `unit_price`, descontos, impostos)
  é alterado — só a classificação (serviço/cargo/senioridade/unidade quando vazia).
- Nenhum item já classificado é sobrescrito.

## Detalhes técnicos

- Novo módulo `src/lib/catalog/line-item-classify.ts`: funções puras
  `parseSeniority(name)`, `suggestServiceForName(name, catalog)` e
  `matchJobProfile(name, profiles)`; cobertas por testes unitários.
- Novas server functions em `src/lib/catalog/line-item-migration.functions.ts`:
  `listUnmappedLineItemNames()` (agrega nomes, contagens e valores) e
  `applyLineItemMapping(entries)` (update em lote por `name`, condicionado a
  `service_catalog_id is null`, respeitando `workspace_id` e RLS).
- Tela em `src/components/catalog/line-item-migration-page.tsx` + rota
  `src/routes/_authenticated/catalog.line-item-migration.tsx`, usando `PageHeader`,
  `FilterBar`, `DataTable`, `EmptyState`, `Skeletons` e `StatusBadge`, com estados
  de loading/vazio/erro, foco visível, responsividade e dark mode.
- Similaridade usa o `pg_trgm` já instalado; nenhuma dependência nova.
- Validações previstas: `bun run typecheck`, `bun run lint`, `bun run test` e
  conferência por consulta (`count` de itens sem serviço antes/depois).

## Como validar manualmente

1. Abrir a tela de migração: ver os 194 nomes com sugestões e contagens.
2. Aprovar um grupo pequeno (ex.: "Consultoria Técnica") e conferir os itens do
   negócio já classificados, sem alteração de valores.
3. Filtrar a aba Base de `/prospecting` por Consultoria Técnica e ver os clientes
   históricos aparecendo.
