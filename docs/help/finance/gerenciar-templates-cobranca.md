---
module_key: finance
slug: gerenciar-templates-cobranca
title: Gerenciar templates de cobrança
summary: Gerenciar templates de cobrança no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /settings/charging-templates
min_permission: techfinance.charging_templates.view.workspace
audience: internal
sort_order: 300
version: 2
is_published: true
---
# Gerenciar templates de cobrança

**Para que serve:** Gerenciar templates de cobrança, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.charging_templates`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar templates de cobrança (`/settings/charging-templates`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Crie um template ou abra um existente.
2. Informe nome, canal E-mail/WhatsApp, ativo e mensagem.
3. Para e-mail, revise o assunto.
4. Use somente as variáveis apresentadas e salve.
5. Exclua apenas quando autorizado e confira eventuais réguas que utilizam o template.

## Resultado esperado
Modelo de mensagem salvo para uso na cobrança.

## Regras e limites
- Nome e corpo são obrigatórios.
- Salvar modelo não envia cobrança nem aprova template na Meta.
- Criação, atualização e exclusão têm autorização própria por recurso/registro.

### Campos e controles
Nome; canal; ativo; assunto; mensagem. Exemplos exibidos: {customer_name}, {invoice_number}, {amount}, {due_date}.

## Erros comuns
“Preencha nome e corpo”: complete ambos os campos. Em erro de acesso, solicite revisão sem tentar contornar pela URL.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Gerenciar templates de cobrança](/help-media/finance/gerenciar-templates-cobranca.webp)
<!-- evidência: src/routes/_authenticated/settings.charging-templates.tsx; src/lib/charging-templates.functions.ts -->
