# Contratos: associar serviço do catálogo (sem criar serviço no contrato)

## Objetivo

No detalhe do contrato (`/contracts/{id}`, card "Serviços"), remover a criação livre de serviço. O usuário passa a **apenas associar um serviço já existente no catálogo de serviços** ao contrato, definindo apenas os parâmetros comerciais daquela associação.

## Como fica na tela

- O botão "Adicionar" passa a ser "Associar serviço".
- O diálogo "Associar serviço ao contrato" mostra:
  - busca/seleção do serviço no catálogo (nome, código, tipo, preço base);
  - após escolher, campos comerciais editáveis: quantidade, preço unitário (pré-preenchido com o preço base), tipo de cobrança, cadência (quando recorrente), início e fim;
  - nome e descrição vêm do catálogo e não são editáveis no contrato.
- Sem digitação de nome livre: não é possível inventar um serviço ali.
- Se o catálogo estiver vazio (ou o serviço não existir), o diálogo mostra um estado vazio com link para o cadastro de serviços do catálogo, onde o serviço deve ser criado primeiro.
- Estados de carregando, vazio e erro, foco visível, rótulos acessíveis, responsivo e dark mode, usando os componentes oficiais (Dialog, Command/EntityCombobox, CurrencyInput, Button, Badge).

## Escopo

- Somente o fluxo dentro do contrato muda. A tela de Serviços em execução (`/services`), a ativação, o faturamento e o catálogo continuam iguais.
- Nenhuma alteração de schema, RLS, autenticação ou regra de negócio de billing.

## Detalhes técnicos

Arquivos:

- `src/components/services/contract-services.tsx`: trocar `QuickCreateServiceDialog` por novo `LinkCatalogServiceDialog`; renomear a ação para "Associar serviço".
- Novo `src/components/services/link-catalog-service-dialog.tsx`: seleção do item de `service_catalog` + parâmetros comerciais; componente apresentacional, consumindo server functions via `useServerFn`.
- `src/lib/services.functions.ts`: nova server fn `linkCatalogServiceToContract` (middleware `requireSupabaseAuth`, mesma permissão `techservice.services.create.own`) que:
  1. carrega o item do catálogo (`service_catalog`, `active = true`) e o contrato (`role`, `currency`);
  2. insere em `services` com `name`/`description` vindos do catálogo, `quantity`/`unit_price`/`type`/`cadence`/datas vindos do formulário, `status = 'pending'`;
  3. guarda a origem em `metadata.service_catalog_id` (sem migration, pois `services.metadata` já é `jsonb`).
     Também uma server fn de listagem `listCatalogServiceOptions` (leitura de `service_catalog` ativa, pelo cliente autenticado — RLS aplicada), espelhando `listTemplateServiceOptions`.
- `src/components/services/quick-create-service-dialog.tsx`: removido do fluxo de contrato. `createService` permanece na API para não quebrar testes/consumidores, mas deixa de ser chamado pela UI de contrato.

Validações a rodar: typecheck, lint, build e os testes de autorização (`services-kb-authorization`).

## Fora de escopo

- Criar/editar itens do catálogo de serviços (segue na tela de catálogo).
- Alterar os "Serviços vinculados" dos modelos de contrato.
