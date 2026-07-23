## Objetivo
Aplicar as opções 1+2 combinadas para eliminar a percepção de duplicidade entre `/catalog/services`, `/services` e `/contracts`, deixando claro que:

- **Catálogo de Serviços** = biblioteca de templates reutilizáveis.
- **Contratos** = instrumento jurídico (dono do relacionamento com o cliente).
- **Serviços em Execução** = linhas faturáveis vinculadas a contratos (visão operacional/financeira).

O módulo "Services" deixa de ser um módulo independente no seletor de módulos e passa a ser uma visão consumida por Contratos e Financeiro. As rotas `/services` e `/services/:id` continuam existindo (nada é removido), apenas mudam de posição no menu e ganham rótulos mais claros.

## Escopo

### 1. Renomear rótulos (Opção 1)
- `src/lib/menu-config-core.ts`: "Serviços" (linha 15) → **"Catálogo de Serviços"** (mantém `/catalog/services`). "Produtos" (linha 14) → **"Catálogo de Produtos"** para simetria.
- `src/lib/menu-config-contracts.ts`: adicionar o item **"Serviços em execução"** apontando para `/services`, logo abaixo de "Contratos".
- `src/lib/menu-config-finance.ts` (se existir grupo apropriado — verificar): adicionar atalho **"Faturamento de Serviços"** para `/services` na seção de recebíveis/faturamento. Se o menu não existir estruturado, apenas manter em Contratos.
- `src/routes/_authenticated/services.index.tsx`:
  - `PageHeader.title`: "Serviços" → **"Serviços em execução"**.
  - Breadcrumb (linha 31): ajustar para "Contratos › Serviços em execução".
  - Subtítulo/descrição curta explicando que cada linha vem de um contrato.
- `src/routes/_authenticated/services.$id.tsx`: breadcrumb passa a partir de "Contratos".
- `src/routes/_authenticated/catalog.services.tsx`: PageHeader.title → **"Catálogo de Serviços"** (título e breadcrumb).

### 2. Reposicionar /services (Opção 2)
- Remover o módulo "services" do seletor de módulos do sidebar (registry) para que ele deixe de aparecer como módulo independente. Investigar `src/lib/modules/registry.ts` e remover/ocultar apenas o item de UI — sem apagar as rotas.
- Remover `"services"` de `CORE_CONSUMER_MODULES` em `menu-config-core.ts` (não precisa mais injetar Cadastros, pois deixa de ser módulo próprio).
- Arquivo `src/lib/menu-config-services.ts`: manter o arquivo por segurança (sem breaking imports) mas deixar de ser referenciado; ou apagar se nenhum outro arquivo importar. Verificar em `app-sidebar.tsx` (linha 25) e ajustar o branch `effectiveModuleId === "services"`.
- Em `contracts.$id.tsx`, o componente `ContractServices` já mostra os serviços do contrato — nenhuma mudança de dados necessária; apenas garantir que o link do card leve para `/services/:id` (visão operacional).
- Redirecionamento amigável: adicionar link "Ver todos os serviços em execução" dentro da listagem de Contratos, apontando para `/services`.

### 3. Verificações e ajustes secundários
- Ajustar textos de `EmptyState` em `/services` mencionando que serviços nascem de contratos (link "Ir para Contratos").
- Verificar se algum lugar do app rota para `activeModule=services` (deep-links de módulo). Se sim, redirecionar para `contracts`.
- Rodar `tsgo` para confirmar imports e tipagens.

## Fora do escopo
- Não haverá alteração de schema, RLS, server functions, migrations ou lógica de negócio.
- Não haverá mudança em `/services/products` além de eventual rótulo.
- Não haverá consolidação de tabelas (rejeitada anteriormente).

## Arquivos previstos
- `src/lib/menu-config-core.ts` (rótulos + remover "services" de consumers)
- `src/lib/menu-config-contracts.ts` (adicionar "Serviços em execução")
- `src/lib/menu-config-finance.ts` (adicionar atalho, se aplicável)
- `src/lib/modules/registry.ts` (ocultar módulo "services")
- `src/components/app-sidebar.tsx` (ajustar branch do módulo services)
- `src/routes/_authenticated/services.index.tsx` (título/breadcrumb/EmptyState)
- `src/routes/_authenticated/services.$id.tsx` (breadcrumb)
- `src/routes/_authenticated/catalog.services.tsx` (título)

## Validação
- `tsgo` sem erros.
- Navegar por Contratos → clicar em "Serviços em execução" → verificar título e volta para contratos.
- Verificar que o seletor de módulos não exibe mais "Services".
- Conferir que `/services` e `/services/:id` continuam acessíveis diretamente.
