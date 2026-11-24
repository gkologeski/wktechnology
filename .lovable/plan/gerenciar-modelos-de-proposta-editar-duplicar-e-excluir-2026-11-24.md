# Gerenciar modelos de proposta: editar, duplicar e excluir

Porte **P** — estimativa ~40 min (código + testes + Ajuda + validação no preview).

## Situação atual (conferida)
- Em Configurações › Modelos de proposta já é possível editar (clicando no modelo) e excluir (botão no rodapé do editor, com confirmação e checagem de permissão no servidor).
- **Não existe duplicar**, e as ações não aparecem na lista — só dentro do editor, o que as torna pouco visíveis.

## O que muda
1. **Menu de ações em cada modelo da lista** (botão "⋯" com nome acessível): **Editar**, **Duplicar** e **Excluir**. Cada opção fica desabilitada com o motivo quando o cargo não tiver a permissão (editar = `update`, duplicar = `create`, excluir = `delete`).
2. **Duplicar**: cria um novo modelo com o mesmo conteúdo, descrição, serviços e modelo de contrato vinculado, com o nome "<nome> (cópia)" (numerado se já existir: "(cópia 2)"). Após criar, abre a cópia no editor e mostra aviso de sucesso.
3. **Excluir**: mantém a confirmação atual ("Propostas já criadas não são afetadas") e passa a estar também na lista; o botão do editor continua.
4. **Editar**: abre o modelo no editor; se houver alterações não salvas em outro modelo, pede confirmação antes de trocar.
5. Estados: botões desabilitados e indicador durante duplicação/exclusão; erros em aviso.

## Segurança
- Duplicação feita no servidor (nova função `duplicateProposalTemplate`) com o cliente do usuário (RLS), exigindo `techsales.proposal_templates.create` e leitura do original no mesmo workspace ativo; deny prevalece. Nenhuma mudança de banco, RLS ou cargos.

## Técnico
- `src/lib/proposals/proposal-templates.functions.ts`: `duplicateProposalTemplate` (middleware `requireSalesPermission(...,"create")`, `assertSalesArea`, lê original + `proposal_template_services`, insere cópia + vínculos, nome único via helper puro `nextCopyName` em módulo separado).
- `src/lib/proposals/copy-name.ts` + teste unitário; teste da função com cenários permitido / sem chave / deny / outro workspace / inativo (mock, padrão do projeto).
- `settings.proposal-templates.tsx`: DropdownMenu por item, controle de "alterações não salvas".
- Contrato em `docs/security/permission-contracts.json` (hash), artigo `docs/help/.../manter-modelos-de-proposta-comercial.md` com bump de versão + catálogo.
- Validação: `permissions:check`, `help:coverage`, testes, build e Playwright (duplicar e excluir a cópia criada, sem alterar modelos reais).

Não será publicado sem sua autorização.
