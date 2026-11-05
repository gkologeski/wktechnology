---
module_key: finance
slug: configurar-regua-cobranca
title: Configurar régua de cobrança
summary: Configurar régua de cobrança no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /settings/dunning
min_permission: techfinance.dunning.view.workspace
audience: internal
sort_order: 290
version: 1
is_published: true
---
# Configurar régua de cobrança

**Para que serve:** Configurar régua de cobrança, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.dunning`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Configurar régua de cobrança (`/settings/dunning`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Crie uma régua ou selecione uma existente.
2. Defina nome, ativa e padrão do workspace quando necessário.
3. Adicione passos com deslocamento de dias e canal: E-mail, WhatsApp, Tarefa ou Escalada.
4. Escolha template compatível ou mensagem inline; revise assunto e mensagem.
5. Salve e confira os passos; exclua somente com capacidade válida.

## Resultado esperado
Configuração da régua salva; isso não comprova envio de mensagem.

## Regras e limites
- Passos e canais disponíveis no editor não comprovam entrega operacional de cada adaptador.
- Consulte permissões separadas para ler templates.
- Não confunda mensagem WhatsApp de cobrança com template aprovado pela Meta.

### Campos e controles
Nome; ativa; padrão; passos; dias; canal; template; assunto; mensagem com variáveis exibidas, como {invoice_number}, {amount}, {days_overdue}.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Configurar régua de cobrança; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/settings.dunning.tsx; src/lib/dunning.functions.ts -->
