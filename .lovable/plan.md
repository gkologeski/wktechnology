# Edição em massa nos grids das entidades

## Objetivo

Permitir selecionar vários registros em qualquer grid de entidade e alterar
campos de uma vez, com os mesmos campos que já ficam disponíveis no seletor
dinâmico de colunas (catálogo de campos da entidade), não só uma lista fixa.

## Situação atual (verificada)

- Existe `BulkEditDialog` (`src/components/bulk-edit-dialog.tsx`), mas ele só
  aceita uma lista de campos escrita à mão por tela (`bulkEditFields`).
- `GridBulkBar` (barra de ações em massa) já oferece editar em massa, mas está
  em uso em 10 telas: Serviços, Candidatos, Vagas, Ofertas, Propostas, Projetos,
  Tarefas de projeto, Pessoas, Benefícios, Incidentes, Documentos e Financeiro.
- Os grids centrais do TechSales — Leads, Contatos, Empresas, Negócios e
  Tarefas — têm barra própria com excluir/enriquecer e **não** têm edição em massa.
- Já existe catálogo dinâmico de campos por entidade
  (`get_entity_field_catalog` + `src/lib/entity-fields.functions.ts`) com tipo,
  opções de select, referências (empresa/contato/usuário), obrigatoriedade e
  marcação de campo de sistema — é a base natural para os campos editáveis.
- A atualização em massa hoje é feita direto do navegador com `update` genérico
  por nome de tabela.

## O que será feito

### 1. Diálogo de edição em massa dinâmico

Novo diálogo que carrega o catálogo de campos da entidade e permite:

- buscar o campo pelo nome (mesma lista do seletor de colunas);
- marcar quais campos serão sobrescritos (só os marcados são enviados);
- editar conforme o tipo: texto, texto longo, número, moeda (máscara BRL),
  data, sim/não, seleção com opções do catálogo e seletor com busca por nome
  para campos de referência (empresa, contato, usuário, etapa);
- limpar um campo (definir vazio), bloqueando essa opção em campos obrigatórios;
- campos de sistema/integração ficam em um bloco recolhido, fora do caminho.

Antes de aplicar, o diálogo mostra um resumo ("3 campos serão alterados em
128 registros") e pede confirmação.

### 2. Aplicação no servidor, com validação

A gravação passa a ocorrer em server function autenticada que valida a
entidade, valida cada campo contra o catálogo (nome e tipo permitidos),
converte os valores e aplica o update apenas nos IDs selecionados, sempre sob
a RLS do usuário. O resultado informa quantos registros foram realmente
alterados e avisa quando a permissão bloqueou parte da seleção.

### 3. Padronização nos grids

- Leads, Contatos, Empresas, Negócios e Tarefas passam a ter o botão
  "Editar em massa" na barra de seleção existente, sem remover as ações atuais.
- As telas que já usam `GridBulkBar` passam a usar o catálogo dinâmico,
  mantendo os campos declarados hoje no topo da lista.
- Onde existe "selecionar todos os resultados do filtro", a edição em massa
  respeita a mesma seleção.

### 4. Pós-edição

Invalidação automática das queries do grid e do detalhe (padrão já usado nas
exclusões), com contagem no toast e limpeza da seleção.

## Detalhes técnicos

- Novos arquivos: `src/components/grid/bulk-edit-fields-dialog.tsx` (UI),
  `src/lib/grid/bulk-edit.functions.ts` (server fn `bulkUpdateEntity`) e
  `src/lib/grid/bulk-edit-fields.ts` (normalização/validação de valores,
  compartilhada e sem dependência de UI).
- Reuso: `useEntityFieldCatalog`, renderizadores de campo de
  `src/components/workflows/extra-fields-editor.tsx`, `FkPicker`,
  `CurrencyInput` e `deniedIfUnaffected`/`rls-denied`.
- `GridBulkBar` ganha prop opcional `bulkEditEntity` (tabela/entidade do
  catálogo); `bulkEditFields` continua funcionando para não quebrar telas.
- Sem mudanças de schema, RLS ou permissões: a validação de campo é uma camada
  extra sobre a RLS, que permanece a fonte de verdade.
- Validação: `bunx tsgo --noEmit`, `bun run lint` e teste manual via navegador
  em um grid do TechSales e um do TechHire.

## Fora de escopo

Importação/atualização em massa via CSV, edição em massa de campos
personalizados (`custom_fields`) e edição em massa em telas Kanban.
