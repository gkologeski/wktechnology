## Problema

No sidebar do TechSales (CRM), o item **Captar › Formulários** aponta para `/settings/forms`. Como `/settings/*` está na lista `WORKSPACE_ROUTE_PREFIXES` (module-switcher) e é reconhecido pelo `AppSidebar` como contexto de workspace, ao clicar o layout troca para o shell do TechERP focado em **Configurações**, saindo do TechSales.

O mesmo padrão afeta o item vizinho **Pesquisas** (`/settings/surveys`).

## Objetivo

Manter o usuário dentro do TechSales ao acessar Formulários/Pesquisas a partir do menu do CRM, sem alterar a experiência do módulo ATS nem mover funcionalidade/regra de negócio.

## Abordagem (apenas UI/roteamento)

Criar aliases de rota no contexto CRM que renderizam o mesmo componente já existente em `settings.forms.tsx` e `settings.surveys.tsx`, e apontar o menu do CRM para esses aliases. As rotas em `/settings/*` continuam existindo (para quem acessa via Configurações do workspace).

### Mudanças

1. `src/routes/_authenticated/forms.tsx` (novo)
   - `createFileRoute("/_authenticated/forms")`
   - Reexporta o componente atualmente montado em `settings.forms.tsx` (extraímos o componente para um arquivo compartilhado `src/components/forms/forms-page.tsx`, ou simplesmente importamos o componente exportado).

2. `src/routes/_authenticated/surveys.tsx` (novo)
   - Mesma abordagem para `settings.surveys.tsx`.

3. `src/lib/menu-config.ts`
   - `Formulários`: `/settings/forms` → `/forms`
   - `Pesquisas`: `/settings/surveys` → `/surveys`

4. `src/routes/_authenticated/settings.forms.tsx` e `settings.surveys.tsx`
   - Mantidos, agora renderizando o mesmo componente compartilhado (sem duplicação de lógica). Nenhuma alteração de server function, RLS ou schema.

### Por que não apenas remover `/settings` de `WORKSPACE_ROUTE_PREFIXES`

Isso quebraria a intenção de trocar o sidebar quando o usuário realmente navega para Configurações do workspace (ex.: via header). O gatilho correto do sidebar é o path — então a correção é usar um path CRM-scoped no menu do CRM.

## Fora do escopo

- Nenhuma mudança em `forms.functions.ts`, RLS, permissões, migrations.
- Nenhuma mudança na sidebar de Configurações — Formulários/Pesquisas continuam lá.
- Nenhuma mudança no ATS.

## Validação

- `bunx tsgo --noEmit`
- Manual: em TechSales, clicar Captar › Formulários deve manter sidebar TechSales, breadcrumb `Início › Formulários`. Em Configurações › Formulários (via header), sidebar de Configurações permanece.
