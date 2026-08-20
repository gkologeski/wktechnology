# docs/architecture

Documentação de arquitetura do TechERP voltada a agentes de IA e novos
desenvolvedores. Ponto de entrada: `CLAUDE.md` na raiz do repositório.

| Documento | Leia quando |
| --- | --- |
| [overview.md](./overview.md) | precisa entender módulos, rotas e fluxos de negócio |
| [data-model.md](./data-model.md) | vai tocar banco, migrations, queries ou tipos |
| [security-rbac.md](./security-rbac.md) | vai mexer em acesso, RLS, permissões ou rotas públicas |
| [server-functions.md](./server-functions.md) | vai criar/alterar lógica de servidor, API ou webhook |
| [frontend-conventions.md](./frontend-conventions.md) | vai criar/alterar tela, grid, kanban ou formulário |
| [integrations.md](./integrations.md) | vai mexer em IA, enriquecimento, e-mail, calendário ou MCP |
| [workflows-automation.md](./workflows-automation.md) | vai mexer em automação, eventos ou cron |
| [testing-and-ops.md](./testing-and-ops.md) | vai validar, testar ou operar o sistema |

Documentos complementares fora deste diretório estão listados no fim de
`CLAUDE.md`. Nada aqui duplica o design system — para UI, use
`docs/techhire-design-system.md` e `docs/new-screen-ux-ui-checklist.md`.
