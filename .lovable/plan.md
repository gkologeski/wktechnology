## Objetivo

Substituir os três itens genéricos "Criar/Atualizar/Excluir registro (qualquer módulo)" da biblioteca de ações do Workflow Builder por uma navegação em dois níveis, agrupada por módulo, com rótulos amigáveis por entidade (ex.: "Criar Projeto", "Criar Registro de Contas a Pagar", "Criar Serviço").

## Escopo

Somente UI/apresentação do picker de ações e labels. Não altera engine, tipos de ação, RLS, migrations, nem o `GenericRecordForm` (que continua sendo o form de edição do passo, apenas com `table` já pré-selecionado).

## Mudanças

### 1. `src/lib/workflows/types.ts`
- Adicionar um catálogo `RECORD_ACTION_MODULES` que agrupa por módulo as tabelas graváveis com rótulos específicos em pt-BR (usando singular e nomes de negócio):
  - **Vendas:** Lead, Contato, Empresa, Negócio, Cotação, Proposta
  - **Atendimento:** Ticket
  - **Recrutamento (ATS):** Vaga, Candidato, Aplicação, Entrevista
  - **Projetos:** Projeto, Tarefa de projeto, Marco de projeto
  - **Contratos e catálogo:** Contrato, Produto, Serviço
  - **Financeiro:** Lançamento financeiro (contas a pagar/receber), Pagamento bancário, Fatura de cliente, Fatura de assinatura, Plano recorrente
  - **Atividades:** Atividade
- Nota: como `financial_entries` cobre tanto pagar quanto receber via campo `direction`, será listado como "Lançamento financeiro" (o form já expõe o campo `direction` via catálogo). Não vamos criar duas ações separadas por direção.

### 2. `src/components/workflows/workflow-builder.tsx`
- Ajustar `ActionLibraryPanel`:
  - Manter as demais categorias como estão.
  - Remover o card único "Registros (qualquer módulo)".
  - No lugar, renderizar uma seção "Registros" com submenus expansíveis por módulo. Cada módulo lista suas entidades e, ao clicar em uma entidade, abre um mini-picker inline com três botões: **Criar**, **Editar**, **Excluir**.
  - Interação: clique único cai no módulo → clique na entidade expande as 3 operações → clique na operação chama `onPick` com o tipo (`create_record`/`update_record`/`delete_record`) e a `table` alvo.
- Estender `onPick` para aceitar opcionalmente uma `table` pré-selecionada:
  - `addAction` já cria a ação via `defaultActionOfType`; ajustar para aceitar override e injetar `table` no passo recém-criado antes de `insertStep`.
- Ícones: usar os ícones dos módulos de `src/lib/modules/registry.ts` (Briefcase, Users, Kanban, FileText, Package, DollarSign) para os grupos e um ícone neutro para cada linha.

### 3. Sem mudança em `GenericRecordForm`
- O form continua sendo aberto normalmente ao selecionar o passo; a diferença é que a tabela já vem preenchida e o catálogo de campos aparece imediatamente. O select de tabela permanece disponível caso o usuário queira trocar.

## Fora de escopo (registrado como follow-up)

- "Associar Projeto ao Serviço" (associação Projeto↔Serviço) exige uma associação declarada em `ENTITY_ASSOCIATIONS` para a ação `associate_records`. Hoje não existe esse mapeamento e o `services` não é uma entidade de trigger. Fica como pendência separada; se quiser, faço em plano dedicado depois deste.

## Validação manual

1. `/settings/workflows` → editar workflow → adicionar passo → biblioteca deve mostrar módulos com entidades e as três operações.
2. Escolher "Projetos → Projeto → Criar" cria passo com título "Criar registro (qualquer módulo)" e o `GenericRecordForm` abre com `table=projects` e campos do catálogo carregados.
3. Escolher "Financeiro → Lançamento financeiro → Criar" abre form com campo `direction` (pagar/receber), `amount`, `due_at`, `legal_entity_id`, etc.
4. Testar Editar/Excluir: form pede `target_id` com suporte a tokens.
5. Verificar que categorias antigas (CRM, ATS, Criar registro, Comunicação, etc.) continuam funcionando inalteradas.
