## Problema

No sidebar do TechFinance, os itens **Empresas (CNPJs)** e **Grupos empresariais** apontam para `/settings/legal-entities` e `/settings/legal-entity-groups`. Como esses paths começam com `/settings`, o `detectModuleFromPath` os trata como rota de workspace, o `AppSidebar` troca para o shell do TechERP/Configurações e o usuário sai do contexto do Finance — mesmo problema já resolvido em Produtos (migrado para `/catalog/products`).

## Solução

Espelhar o padrão de Produtos: extrair o conteúdo das duas telas para componentes reutilizáveis e expor novas rotas sob `/finance/*`, que já é reconhecido como módulo Finance. Manter as rotas antigas em `/settings/*` funcionando (retrocompatibilidade e acesso via Configurações do ERP).

### Passos

1. Extrair o corpo de `src/routes/_authenticated/settings.legal-entities.tsx` para `src/components/finance/legal-entities-page.tsx` (componente puro, sem `createFileRoute`).
2. Extrair o corpo de `src/routes/_authenticated/settings.legal-entity-groups.tsx` para `src/components/finance/legal-entity-groups-page.tsx` da mesma forma.
3. Reduzir as duas rotas de `/settings/*` a wrappers que renderizam os componentes extraídos (preserva o acesso atual pelo shell de Configurações).
4. Criar `src/routes/_authenticated/finance.legal-entities.tsx` e `src/routes/_authenticated/finance.legal-entity-groups.tsx` renderizando os mesmos componentes; cada rota define seu próprio `head()` e `PageHeader` já vem do componente compartilhado.
5. Atualizar `src/lib/menu-config-finance.ts`:
   - `Empresas (CNPJs)` → `/finance/legal-entities`
   - `Grupos empresariais` → `/finance/legal-entity-groups`
6. Não alterar `menu-config-core.ts`, permissões, RLS, server functions (`legal-entities.functions`) nem qualquer lógica de negócio.

## Fora do escopo

- Nenhuma mudança em backend, RLS, migrations ou server functions.
- Não remover as rotas `/settings/*` — apenas o menu do Finance deixa de referenciá-las.
- Nenhuma alteração visual nas telas.

## Como validar

1. No módulo TechFinance, clicar em **Empresas (CNPJs)** e **Grupos empresariais**: sidebar permanece no Finance, sem redirecionar para Configurações.
2. Acessar `/settings/legal-entities` diretamente ainda funciona (via CRM/Configurações).
3. CRUD, seleção de padrão e totais continuam operando idênticos.
