# Fase 0 — Inventário da Área de Ajuda e Treinamento

Esta entrega executa **somente a Fase 0**. Nenhum artigo, tabela, rota ou tela é criado. Ao final, paro e peço sua aprovação para a Fase 1.

**Porte:** M. **Estimativa:** 2h30–3h30 (318 arquivos de rota, 10 arquivos de menu, permissões e políticas a cruzar).

## O que será entregue

Um único arquivo novo: `docs/help/inventario.md`, com:

1. **Módulos reais** — derivados dos menus (`src/lib/menu-config*.ts`, `VERTICAL_MODULE_LIST`) e do roteamento. Para cada um: nome no menu, rota base e permissão que libera o item.
2. **Telas por módulo** — toda rota de tela: caminho, propósito em uma linha e componente principal.
3. **Funcionalidades por tela** — CRUD, filtros, visões salvas, importação/exportação, ações em massa, automações, integrações (HubSpot, WhatsApp/Meta, e-mail, webhooks, chaves de API, assinatura eletrônica), campos obrigatórios e regras visíveis.
4. **Permissões por funcionalidade** — ver/criar/editar/excluir, a partir de `user_can_act`, catálogo `permissions`, `field_permission_rules`, papéis e políticas RLS.
5. **Telas expostas ou candidatas ao cliente** — portal, proposta pública, careers, kb, oferta, entrevista, projetos.
6. **Lacunas** — telas sem item de menu, rotas órfãs, recursos atrás de flag.
7. **Tabela resumo** — módulo | nº de telas | nº de funcionalidades.

Itens de comportamento duvidoso ficam marcados **[CONFIRMAR]**.

## Fatos já verificados que afetam fases seguintes

- **`tests/access-audit/` não existe** no repositório. A Fase 1 pede um teste "no mesmo estilo" e o critério roda `tests/access-audit/access-audit.sql`. Isso vai como lacuna no inventário. Na Fase 1 vou propor criar a auditoria ou usar o `permissions:check` atual — você decide.
- A regra geral sobre mockup está no `AGENTS.md` da raiz. O guia da Ajuda vai seguir o mesmo formato lá (Fase 1).
- Rotas técnicas (`api/public/**`, redirecionamentos) não contam como telas, mas são listadas à parte.
