# Edição em massa estilo HubSpot + sugestão de substatus com IA

Duas entregas independentes, ambas dentro dos padrões atuais (design system TechHire, RBAC/RLS inalterados).

## 1. Edição em massa no padrão HubSpot

Hoje o diálogo lista todos os campos com checkbox, um abaixo do outro. Passa a funcionar como o HubSpot:

- **Um combo único "Propriedade a atualizar"**, com busca ("Pesquisar") e **agrupamento por categoria** (ex.: "Propriedades de vendas", "Informações do negócio", "Campos de sistema e integração"), usando `Command` + `Popover` já existentes.
- Ao escolher a propriedade, aparece **apenas o editor daquele campo** (texto, moeda, data, select, switch, referência) reaproveitando o `FieldEditor`/`BulkRefPicker` atuais.
- **Campos dependentes**: quando a propriedade escolhida depende de outra, o diálogo mostra as duas em cascata, com aviso explicativo (mesmo texto-guia do HubSpot):
  - Etapa do negócio/lead → exige escolher **Pipeline** e depois **Etapa** (opções filtradas pelo pipeline).
  - Substatus → exige **Pipeline** + **Etapa**, e lista só os substatus ativos daquela etapa.
  - Motivo de perda → só habilitado quando a etapa escolhida é do tipo perdido.
- Botão **"Adicionar outra propriedade"** para editar mais de um campo na mesma ação (mantém o comportamento em lote atual e a confirmação em duas etapas).
- Mantidos: validação de campos obrigatórios, guarda de alias (`findAliasConflict`), bloqueio de colunas negadas, mensagens de RLS ("nenhum registro alterado / X de Y"), estados de loading/erro/vazio e `aria-live` do resumo.

## 2. Sugerir substatus com IA por etapa

No editor de pipelines (Configurações → Pipelines), o botão "Sugerir" de cada etapa passa a ter duas opções:

- **Sugestões padrão** (comportamento atual, sem custo).
- **Sugerir com IA**: envia contexto da etapa (nome, identificador, tipo, pipeline, substatus já existentes e módulo) e recebe uma proposta com:
  - nomes/rótulos em pt-BR,
  - descrição curta de cada substatus,
  - **ordem sugerida** (inclusive reordenando os substatus que já existem),
  - marcação de qual seria o padrão.
- A proposta abre em **painel de revisão** antes de gravar: o gestor marca/desmarca itens, edita nomes e confirma. Nada é criado ou reordenado sem confirmação humana.
- Aplicar a proposta cria os novos substatus e chama a reordenação existente; duplicados por nome são ignorados.
- Estados: carregando, erro do provedor (mensagem clara, sem esconder falha), sem sugestões. Botão visível só para quem pode gerenciar pipelines.

## Detalhes técnicos

- `src/components/grid/bulk-edit-fields-dialog.tsx`: reescrito para o modelo "linhas de propriedade" (`{ field, value }[]`) com combobox agrupado; catálogo continua vindo de `getEntityFieldCatalog`, e a aplicação continua em `bulkUpdateEntity` (sem mudança de contrato do servidor).
- Novo `src/lib/grid/bulk-edit-dependencies.ts`: mapa declarativo de dependências (campo → campos-pai e função de filtro das opções), consumido só pela UI.
- Agrupamento: derivado de `EntityFieldDef` (`system` + prefixo/domínio do campo), sem alterar o servidor.
- Substatus/etapas: reuso de `usePipelineSubstatuses`, `substatusesForStage` e das queries de pipelines já existentes.
- IA: nova server function em `src/lib/pipelines/substatus-ai.functions.ts` + handler que chama o Lovable AI Gateway (saída estruturada validada com zod); segredo lido dentro do handler. Nenhum dado sensível enviado — apenas nomes de etapa/substatus.
- Novo `src/components/pipelines/substatus-ai-suggest-dialog.tsx` para a revisão da proposta.
- Validação: `bun run typecheck` (tsgo), `bun run lint`, e verificação visual com Playwright em 1280px e 768px nos dois fluxos.
