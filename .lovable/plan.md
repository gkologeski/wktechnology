# Exportar selecionados em CSV, JSON ou XLSX

Hoje a barra flutuante de ações em massa exporta apenas CSV, com um botão único ("Exportar selecionados"). A proposta é transformar esse botão em um menu de formatos, disponível em todas as entidades que usam a barra.

## Comportamento

- Na barra flutuante, o botão "Exportar" passa a abrir um menu com três opções: CSV, JSON e Excel (XLSX).
- Exporta exatamente os registros selecionados (inclui a seleção de "todos os N registros" quando usada).
- Quando há mais selecionados do que carregados na tela (quadros paginados), os dados faltantes continuam sendo buscados antes de gerar o arquivo.
- Se algum registro estiver fora do acesso do usuário, segue o aviso atual informando quantos foram exportados.
- Nome do arquivo por entidade e data, ex.: `negocios-2026-09-14.xlsx`.
- Estados: botão desabilitado durante a geração, rótulo "Exportando…", erro em toast, foco visível, rótulos em PT-BR, dark mode via tokens.

## Onde aparece

Todas as telas que usam a barra padrão (`GridBulkBar`): Leads, Negócios, Contatos, Empresas, Tarefas, Projetos, Serviços, Propostas, Chamados, Financeiro, Contratos, Vagas, Candidatos, Ofertas, Pessoas, Documentos, Benefícios, Incidentes, NFS-e e os quadros Kanban.

As barras próprias que ainda têm exportação separada (Contatos, Empresas, Tarefas, Financeiro, `EntityList`) passam a usar o mesmo menu, para o comportamento ficar igual em todo o sistema.

## Detalhes técnicos

- Novo módulo `src/lib/export/export-rows.ts` com `exportRows(rows, { filename, format })`, gerando CSV (mantendo o formato atual compatível com Excel), JSON identado e XLSX.
- Novo componente `src/components/export-menu-button.tsx`: botão + `DropdownMenu` com os três formatos, reutilizável nas barras e nas toolbars.
- XLSX: adicionar a dependência SheetJS (`xlsx`), usada apenas no cliente e importada de forma dinâmica (`await import`) para não pesar o bundle inicial.
- `GridBulkBar` mantém a prop `csvEnabled` (passa a habilitar/desabilitar o menu inteiro) para não quebrar chamadas existentes.
- Sem alteração de schema, RLS, permissões, server functions ou regras de negócio — a leitura continua pelos mesmos caminhos já autorizados.

## Validação

`bun run typecheck`, ESLint nos arquivos alterados, `bun run test`, e conferência manual em Negócios e Contatos: selecionar registros, exportar nos três formatos e abrir os arquivos.
