# Itens de linha por serviço + diagnóstico da falha de permissão de exclusão

## Parte 1 — Itens de linha do negócio passam a usar Serviços

Hoje o card "Itens de linha" em `/deals/{id}` busca no catálogo de **Produtos** (`products`) e grava `deal_line_items.product_id`.

O que muda:

- O seletor "Adicionar do catálogo…" passa a buscar o **catálogo de Serviços** (`service_catalog`), mostrando nome, código, preço base e unidade.
- Ao escolher, o item de linha é preenchido com nome, preço unitário (preço base) e alíquota de imposto do serviço.
- O item passa a guardar o vínculo com o serviço do catálogo (nova coluna `service_catalog_id`), mantendo `product_id` apenas para os itens antigos já existentes (nada é apagado).
- Rótulos passam a falar "serviço": placeholder "Adicionar serviço do catálogo…", vazio "Nenhum serviço", ícone de serviço.
- Cotações/propostas seguem lendo os itens de linha do negócio, então herdam a mudança sem alteração de template.
- Nas telas de Serviços em execução, o campo "Produto" (`services.product_id`) deixa de ser oferecido na criação; o vínculo passa a ser com o catálogo de serviços (já feito na associação por contrato).

Fora de escopo: remover as telas de catálogo de produtos (`/catalog/products`, `/settings/products`) — elas continuam existindo para quem usa produtos; apenas deixam de alimentar itens de linha de negócio. Se quiser removê-las do menu, é um passo separado.

### Detalhes técnicos (parte 1)

- Migration: `ALTER TABLE public.deal_line_items ADD COLUMN service_catalog_id uuid REFERENCES public.service_catalog(id)` + `GRANT` já existentes na tabela cobrem a coluna (revisar `has_column_privilege` para `authenticated`); `product_id` fica nullable/legado.
- `src/components/deals/deal-line-items.tsx`: `addFromProduct` → `addFromCatalogService`, lendo `service_catalog` (`id, name, code, base_price, currency, tax_rate, unit`); `EntityCombobox entity="service_catalog"`, `searchColumns=["name","code","description"]`.
- `src/lib/services.functions.ts`: `createService` deixa de aceitar `productId` na UI (mantém o campo na API para compatibilidade).
- Validar: typecheck, lint, `vitest run`, e2e `deals-crud`/`quotes-smoke`.

## Parte 2 — Por que marketing@ conseguiu excluir empresa de guilherme@

Diagnóstico confirmado por consulta ao banco:

- A regra de exclusão de `companies` permite excluir quando o usuário tem `techsales.companies.manage.workspace` **ou** `techsales.companies.delete.own` com `owner_id = usuário`. Isso está correto.
- `marketing@wktechnology.com.br` **tem** `techsales.companies.manage.workspace` = verdadeiro. Portanto a exclusão de qualquer empresa do workspace é legítima pela regra atual.
- Origem da permissão excedente (duas causas somadas):
  1. O usuário está com **dois cargos** ao mesmo tempo: "Vendedor Interno" e "Vendedor". As permissões são a **união** dos cargos.
  2. Os dois cargos carregam `techsales.companies.manage.workspace` no pacote de permissões, e "Vendedor" ainda tem uma concessão explícita de `manage.workspace` no workspace.
- Efeito colateral: "Gerenciar" (manage.workspace) funciona como um super-poder que engloba excluir de todos, então marcar "Gerenciar" para um cargo de escopo próprio abre exclusão total. Além disso a regra de exclusão ignora `techsales.companies.delete.workspace`, o que torna "Gerenciar" a única forma de conceder exclusão ampla — inconsistente com a matriz.

O que será feito:

1. Correção de dados (via alteração de permissões, sem tocar em RLS): remover `manage.workspace` dos cargos "Vendedor Interno" e "Vendedor" para os recursos onde o escopo pretendido é "próprio" (a começar por `companies`), e remover a concessão explícita de `manage.workspace` de "Vendedor". Um usuário deve ficar com um único cargo por padrão — o excedente ("Vendedor" em marketing@) será apontado para você decidir se remove.
2. Ajuste da regra de exclusão de `companies` para também aceitar `techsales.companies.delete.workspace`, de modo que "Excluir / Workspace" na matriz passe a ter efeito real e "Gerenciar" deixe de ser o único caminho.
3. Aviso na matriz: ao marcar "Gerenciar", exibir texto explicando que ele engloba todas as ações naquele recurso, inclusive excluir registros de outros usuários.
4. Correção de UX importante: a exclusão negada pela regra **não gera erro** no cliente (a remoção simplesmente afeta 0 linhas), então a tela mostra "Excluído" e volta para a lista mesmo sem excluir. Passar a verificar quantas linhas foram afetadas e, quando zero, mostrar "Você não tem permissão para excluir este registro" e permanecer na tela. Aplicar ao detalhe e à lista de Empresas e ao mesmo padrão nas demais listas com exclusão em massa.

## Parte 3 — Como testar as permissões de todas as áreas

Três níveis, do mais rápido ao mais completo:

1. **Diagnóstico na tela (já existe)**: `/settings/rbac-diagnostics` — o administrador escolhe um usuário do workspace e vê as permissões efetivas por módulo/recurso/ação/escopo, com a origem (cargo, pacote, concessão, negação). Uso: confirmar antes de testar manualmente. Será ampliado com um destaque "permissões amplas" (todas as chaves `*.manage.*` e `*.workspace` do usuário) e a lista de cargos acumulados, que é exatamente o que passou desapercebido neste caso.
2. **Teste automatizado no banco (novo)**: um script de auditoria que, para cada cargo do workspace, roda a matriz completa de recurso × ação × escopo e compara com o esperado, falhando quando um cargo de escopo próprio tiver qualquer chave `manage`/`workspace`. Sai como `bun run test` (arquivo de teste) e pode ser rodado a cada mudança de permissões.
3. **Teste de ponta a ponta por persona (novo)**: cenários Playwright autenticados como um usuário de teste por cargo, tentando ler/criar/editar/excluir um registro próprio e um registro de outro dono nas áreas principais (Empresas, Contatos, Leads, Negócios, Contratos, Serviços, Financeiro, Projetos, Pessoas, ATS), esperando negação visível no registro de outro dono. Exige um usuário de teste por cargo e as credenciais em variáveis de ambiente — sem elas, os cenários ficam marcados como pendentes, não como aprovados.

### Detalhes técnicos (parte 3)

- Ampliar `src/lib/access-control/rbac-diagnostics.functions.ts` com o resumo de permissões amplas e cargos acumulados; ajustar `settings.rbac-diagnostics.tsx` para exibir.
- Novo teste `src/lib/access-control/role-scope-audit.test.ts` no padrão dos testes estáticos existentes (`action-matrix.test.ts`, `scope-matrix.test.ts`).
- Novo `tests/e2e/permissions-personas.spec.ts` reaproveitando `tests/e2e/helpers/auth.ts`.

## Ordem de execução sugerida

1. Parte 2 (correção da permissão + falso "Excluído") — é o risco de segurança ativo.
2. Parte 1 (itens de linha por serviço).
3. Parte 3 (ferramentas de teste).
