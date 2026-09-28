# Contratos: grade completa, filtros laterais e tela de fluxo + redesign de Workflows

Trabalho dividido em 4 fases, cada uma implementada, revisada e validada antes da próxima. Não muda banco, RLS, permissões, regras de negócio nem a execução das automações. Nada é removido.

## Fase 1 — Grade de Contratos igual às entidades

- **Ordem das colunas salva:** reordenar no seletor "Colunas" passa a mudar a ordem real da tabela (também no modo agrupado), com preferência salva por usuário, como em Empresas.
- **Painel lateral de filtros:** os filtros atuais (Tipo, Status, Empresa, Contratante, Responsável, Início, Término) saem do botão "Filtros" e vão para o painel lateral recolhível das entidades. Os chips de filtros ativos e o "Limpar filtros" continuam. No celular, o painel abre como gaveta.
- **Paridade com as entidades padrão:** conferir e completar na barra de seleção: selecionar página/todos os N resultados, editar campos em massa, atribuir responsável, exportar (CSV/JSON/Excel, incluindo seleção de "todos"), excluir com confirmação e checagem de permissão, criar atividade em massa. Ações já existentes (status, padronizar títulos) permanecem.
- **Layout:** títulos longos com truncamento e dica ao passar o mouse, para reduzir a rolagem lateral.

## Fase 2 — Tela "Fluxo do contrato"

Nova página dentro do registro de contrato (e acessível a partir do negócio) mostrando a jornada completa em linha do tempo:

```text
Negócio -> Proposta/Cotação -> Aprovação -> Minuta do contrato -> Revisão/Aditivos -> Assinatura -> Contrato ativo
```

- Cada etapa mostra status (concluída, em andamento, pendente), data, responsável e link para o registro.
- Etapas usam apenas dados que já existem (negócio vinculado, propostas, cotações, status do contrato, documentos de assinatura, aditivos). Etapa sem dados aparece como "Não iniciada", sem inventar informação.
- Somente leitura nesta fase; ações continuam nas telas atuais.
- Estados de carregamento, vazio e erro; desktop e celular; claro e escuro.

## Fase 3 — Redesign de Workflows (proposta aprovada, Opção C)

Completa o que ainda falta, sem alterar a execução:
- **Canvas:** cards compactos com ícone, nome amigável, resumo e status; menu "..." no lugar das lixeiras soltas; ramificações com nome, condição e quantidade de ações; sem IDs.
- **Configuração guiada** em página com caminho "Workflow > Ramo > Ação": resumo no topo, grupos recolhíveis (Informações principais, Condições comerciais, Vigência, Relacionamentos, Assinatura, Avançado), "Campos configurados" + "Adicionar campo" com busca, indicadores de configurados/pendências — estendido a todas as ações, não só contratos.
- **Variable Picker** em todos os campos que hoje usam chips, com nomes de negócio (ex.: Empresa -> Nome).
- **Modo simples/avançado:** IDs, variáveis brutas e campos internos aparecem só no avançado.

## Fase 4 — Validação e relatório

Typecheck, lint, testes, build e verificação visual em desktop e celular (ordenar, reordenar colunas, filtrar pelo painel, selecionar, exportar, abrir fluxo do contrato, configurar uma ação de workflow sem publicar). Relatório final completo, incluindo o da tradução das variáveis.

## Detalhes técnicos

- Reuso de `hubspot-shell` (`FiltersSidebar`, `FilterGroup`, `CheckboxFilter`), `useGridColumns` (ordem), `GridBulkBar`/`BulkActionBar`, `BulkEditFieldsDialog`, `BulkAssignDialog`, `BulkCreateActivityDialog`, `ExportMenuButton`, `deleteRowsGuarded`.
- Exportar "todos os N" busca as páginas via `listContractsPaged` existente.
- Fluxo do contrato: nova rota `/_authenticated/contracts/$id/flow` com leitura por queries já autorizadas pela RLS; sem nova server function que ignore permissões.
- Workflows: somente componentes de apresentação do builder; formato salvo do workflow e motor inalterados.
