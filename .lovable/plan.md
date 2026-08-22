# Fechar pendências da Fase 4: mapa do menu, validação em preview e teste de visibilidade

Três entregas independentes.

## 1. Mapa de recursos do item "Modelos de contrato"

O teste `src/lib/menu-resources.test.ts` falha hoje em um único caso, com a mensagem
`TechContracts › Modelos de contrato (/contracts/templates)`: essa URL não tem entrada no
mapa `MENU_RESOURCES_BY_URL` de `src/lib/menu-resources.ts` (a única URL de contratos
mapeada é `/contracts`).

Correção: adicionar `"/contracts/templates": ["techcontracts.contract_templates"]`.
O recurso `contract_templates` já existe no catálogo `public.permissions`, com as chaves
`view/create/update/delete` nos escopos `own` e `workspace` — então a matriz de ações do
diagnóstico de RBAC passa a exibir esse item corretamente, sem criar permissão nova.

Nada mais muda: nenhuma configuração de menu, nenhuma visibilidade real, nenhum gate.

## 2. Validação manual em preview como membro não-admin

Sessão autenticada de preview com um membro não-admin do workspace principal, conferindo
que aparecem registros criados por outras pessoas e que nada é duplicado:

- Pipeline do TechHire (`/ats`): um único pipeline padrão, com estágios e candidaturas de
  outros recrutadores; abrir a tela duas vezes não deve criar pipeline novo.
- Vagas e Candidatos: registros de outros responsáveis visíveis.
- Scorecards, Kits de entrevista.
- Dashboards, Propriedades customizadas, Arquivos.
- Contratos e Modelos de contrato.

Em cada tela: conferir loading, empty e error states, e contar registros antes/depois de
recarregar para detectar duplicação. As evidências (URL final, contagens, screenshots)
entram no relatório. Se algo aparecer vazio ou duplicado, o defeito é corrigido apenas se
for consequência direta das fases anteriores; qualquer outro achado é reportado como
pendência.

## 3. Teste automatizado de visibilidade por permissões

Novo spec Playwright `tests/e2e/permission-visibility.spec.ts`, no mesmo padrão dos
specs de isolamento existentes (`tests/e2e/helpers/auth.ts`, skip automático sem
`E2E_USER_EMAIL`/`E2E_USER_PASSWORD`). Cobre Scorecards, Kits de entrevista e Dashboards
em dois eixos:

- **Enxerga (mesmo workspace, outro criador)**: semear linhas em `ats_scorecards` e
  `ats_interview_kits` com `workspace_id` do workspace ativo e `owner_id` de outro membro
  do mesmo workspace, e afirmar que a leitura do usuário de teste devolve essas linhas.
  Em `dashboards` a política de criação exige `owner_id = usuário logado`, então lá o
  teste semeia como o próprio usuário e valida que a leitura não depende do criador
  (linha aparece com filtro apenas por workspace).
- **Não enxerga (outro workspace)**: criar um segundo workspace do qual o usuário de
  teste **não** é membro não é possível com credenciais de usuário; então o teste segue o
  padrão já usado no projeto — cria workspace secundário, semeia lá, remove a própria
  associação de membro daquele workspace e afirma que as linhas somem da leitura. Ao
  final, limpeza de todas as linhas e workspaces criados e restauração do
  `active_workspace_id` original.

Se o segundo eixo não puder ser exercido de forma estável com credenciais de usuário, o
spec fica com o eixo positivo e um caso negativo baseado em `workspace_id` inexistente,
e a limitação é declarada no relatório em vez de simulada.

## Detalhes técnicos

- Arquivos: `src/lib/menu-resources.ts` (uma linha), novo `tests/e2e/permission-visibility.spec.ts`.
- Sem migration, sem mudança de RLS, permissões, schema, server functions ou UI.
- Validações: `bunx vitest run src/lib/menu-resources.test.ts src/lib/menu-config.test.ts`,
  `bun run typecheck`, `bun run lint` e execução do novo spec (`bun run test:e2e`), com
  registro honesto de qualquer teste que fique skipped por falta de credenciais.

## Fora de escopo

- Alterar visibilidade real de itens de menu ou o catálogo de permissões.
- Ampliar criação/edição/exclusão ou mexer em RLS além de correção apontada pela validação.
- Redesign de telas.
