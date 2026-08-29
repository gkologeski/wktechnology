# Padronizar a barra de ações em massa em todo o sistema

O padrão aprovado (usado hoje em Negócios) é a barra flutuante fixa no rodapé, centralizada, sempre visível durante a rolagem. Ela vive em `src/components/bulk-action-bar.tsx` e já é aplicada em todas as telas que usam `GridBulkBar` (Leads, Negócios, Tarefas em grid, Projetos, Serviços, Propostas, Documentos, Benefícios, Ofertas, Vagas, Candidatos, Financeiro, Incidentes, Chamados, NFS-e, pipeline ATS, `EntityList`).

O que ainda **não** segue o padrão são barras/linhas de seleção próprias, escritas manualmente dentro de cada tela.

## Telas com barra própria a padronizar

| Tela / arquivo | Situação atual |
| --- | --- |
| Contratos — `src/components/contracts/contracts-bulk-bar.tsx` | Caixa inline (`border bg-muted/40`) dentro do fluxo da página |
| Negócios (tabela HubSpot) — `src/components/deals/deals-hubspot-table.tsx` | Contagem + ações no cabeçalho da tabela |
| Contatos — `src/routes/_authenticated/contacts.tsx` | Bloco inline na toolbar |
| Empresas — `src/routes/_authenticated/companies.tsx` | Bloco inline na toolbar |
| Tarefas — `src/routes/_authenticated/tasks.tsx` | Bloco inline na toolbar |
| Chamados (aba Tabela) — `src/routes/_authenticated/tickets.tsx` | Faixa inline acima da tabela |
| Timesheet — `src/components/people/timesheet-panel.tsx` | Barra `sticky top-2` |

## O que será feito

1. Em cada tela acima, substituir a marcação própria por `BulkActionBar`, mantendo exatamente as mesmas ações, rótulos, permissões e confirmações que já existem hoje — só a apresentação muda.
2. Preservar contagem de selecionados, botão de limpar seleção e, onde já existir, o "Selecionar todos os N registros" (Tarefas, Contatos, Empresas).
3. Manter as ações extras específicas de cada tela (ex.: mover etapa, gerar contrato, importar) como `children` da barra.
4. Contratos: `contracts-bulk-bar.tsx` passa a renderizar `BulkActionBar` internamente, sem mudar sua API — as telas que o usam não precisam de alteração.
5. Não serão alteradas as toolbars de Hunting (Busca/Capturas): ali a seleção faz parte de um fluxo de importação com botão único no cabeçalho, não de uma barra de ações em massa.

## Notas técnicas

- Apenas UI/apresentação: nenhuma mudança de schema, migrations, RLS, permissões, regras de negócio ou funções de servidor.
- Cuidado com sobreposição: a barra é `fixed bottom-4 z-40`; onde houver rodapé/paginação fixa, garantir que não cubra controles (adicionar espaçamento inferior quando necessário).
- Acessibilidade preservada: `aria-label` no botão de limpar, foco visível, rótulos em PT-BR, responsividade e dark mode via tokens semânticos.

## Validação

`bunx tsgo --noEmit`, ESLint nos arquivos alterados, `bun run test` e verificação visual em Contratos, Contatos, Empresas, Tarefas, Chamados e Timesheet selecionando registros.
