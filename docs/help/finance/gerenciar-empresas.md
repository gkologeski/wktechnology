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
5. Para excluir, revise vínculos e a confirmação.

## Resultado esperado
Empresa cadastrada ou atualizada no workspace, com identificadores revisados.

## Regras e limites
- Razão social/nome é obrigatório.
- Empresa padrão é uma ação controlada, não autorização para administrar o workspace.
- Preenchimento de CNPJ exige revisão; não presuma correspondência automática correta.
- Exclusão pode ser bloqueada por uso ou acesso.
- A consulta de vínculos também exige leitura da pessoa jurídica pelo escopo autorizado no workspace ativo. Membro inativo, outro workspace ou deny explícito não recebem contagens por acesso direto à API.

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
