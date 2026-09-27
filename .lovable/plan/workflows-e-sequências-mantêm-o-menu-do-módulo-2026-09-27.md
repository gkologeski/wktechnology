# Workflows e Sequências mantêm o menu do módulo

## Problema
Hoje, quando você abre qualquer página que começa com `/settings`, o sistema troca o menu lateral do módulo pelo menu genérico do Workspace. É isso que acontece com Workflows e Sequências. Por isso "Configurações" fica aceso, e não o item que você clicou.

## O que muda
- Abrir **Workflows** ou **Sequências** (inclusive editor, execuções e subpáginas) passa a manter o menu do módulo ativo (ex.: TechSales), com o item correspondente aceso.
- As demais páginas de Configurações continuam abrindo o menu do Workspace, como hoje.
- Endereços, permissões, conteúdo das telas e o menu interno de Configurações não mudam.

## Detalhes técnicos
- `src/lib/menu-config-erp.ts`: adicionar `MODULE_PRESERVING_PREFIXES = ["/settings/workflows", "/settings/sequences"]`; `isWorkspacePathname` retorna `false` quando o caminho casa com um desses prefixos (exato ou subcaminho).
- `src/lib/modules/active-module.ts`: conferir que a detecção por caminho não reclassifica essas rotas como "workspace"; se reclassificar, aplicar a mesma exceção para manter a preferência do usuário.
- Teste unitário em `menu-config` cobrindo `/settings/workflows`, `/settings/workflows/<id>`, `/settings/sequences` (preservam) e `/settings/teams` (continua workspace).
- Validação: typecheck, lint, testes e Playwright abrindo Workflows a partir do TechSales para confirmar o item aceso no menu do módulo.
