---
module_key: finance
slug: gerenciar-empresas
title: Gerenciar empresas e CNPJs
summary: Gerenciar empresas e CNPJs no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/legal-entities
min_permission: techfinance.legal_entities.view.workspace
audience: internal
sort_order: 160
version: 3
is_published: true
---
# Gerenciar empresas e CNPJs

**Para que serve:** Gerenciar empresas e CNPJs, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.legal_entities`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar empresas e CNPJs (`/finance/legal-entities`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Use Nova empresa para cadastrar razão social e demais identificadores.
2. Informe código, nome fantasia, CNPJ, IE, IM e situação ativa.
3. Edite ou defina a empresa padrão quando tiver autorização por registro.
4. No preenchimento de CNPJs, revise candidatos, escolha registros e valide os documentos antes de aplicar.
5. Busque por nome, código ou CNPJ e filtre Todas, Ativas ou Inativas.
6. Para desativar ou reativar, use o ícone de energia e confirme; os lançamentos e históricos são preservados.
7. Para excluir, revise vínculos e a confirmação. Havendo registros, a exclusão é bloqueada e é possível desativar em vez disso.

## Resultado esperado
Empresa cadastrada ou atualizada no workspace, com identificadores revisados.

## Regras e limites
- Razão social/nome é obrigatório.
- Empresa padrão é uma ação controlada, não autorização para administrar o workspace.
- Preenchimento de CNPJ exige revisão; não presuma correspondência automática correta.
- A empresa padrão não pode ser desativada ou excluída antes de escolher outra padrão ativa.
- Novas atribuições recusam CNPJs inativos ou de outro workspace; edições que mantêm o vínculo histórico continuam permitidas.
- Filtros históricos mostram também empresas inativas. Os totais são agregados no banco sob o acesso do usuário, sem truncar a lista de lançamentos.

### Campos e controles
Código; razão social; nome fantasia; CNPJ; IE; IM; ativa.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Gerenciar empresas e CNPJs](/help-media/finance/gerenciar-empresas.webp)
<!-- evidência: src/components/finance/legal-entities-page.tsx; src/components/finance/legal-entity-cnpj-fill-dialog.tsx -->
