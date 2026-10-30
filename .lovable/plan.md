# Dashboard do TechProjects lento

Estimativa: porte M, 1 h a 1 h 30.

## Diagnóstico ainda não confirmado
A tela faz duas buscas: o resumo geral (`getProjectDashboard`, aba Visão geral) e as visões por perfil (`project_dash_*`). Ainda não medi qual delas demora, nem se o problema está no banco. O primeiro passo é medir; nenhuma causa é dada como certa antes disso.

## Passos
1. Medir com a sua conta (navegador + tempo de cada busca) qual parte demora e quanto.
2. No banco, rodar a análise de execução das funções lentas com o seu período padrão e ver onde o tempo vai: varredura de apontamentos (105 mil+), conferência de permissão por linha ou agregação.
3. Corrigir a maior causa, sem mudar quem vê o quê:
   - índice que falta para workspace + data / projeto, ou
   - conferência de permissão calculada uma vez por consulta (mesmo padrão já usado em Pessoas/Chat/Vendas), ou
   - na tela, evitar buscas repetidas/em cascata.
4. Conferir que os números do painel são os mesmos antes e depois.
5. Medir de novo e testar no navegador.

## Regras mantidas
- Mesma visibilidade (RLS, negações, membership ativo).
- Mudança de banco via migração nova, com contrato de permissões atualizado.
- Nada publicado sem seu aceite.

## Técnico
Arquivos prováveis: `src/routes/_authenticated/projects.dashboard.tsx`, `src/lib/projects/*dashboard*`, funções `project_dashboard_summary` / `project_dash_vis` / `project_dash_*`. Validação: `EXPLAIN (ANALYZE, BUFFERS)`, comparação de totais, testes de dashboard existentes, Playwright.
