# LIGA-EXTENSO — Ligações no menu da Inbox + valores por extenso no contrato

Porte: M · Estimativa: ~2h a 2h30 (implementação + testes + Ajuda + permissões).

## 1. Ligações no menu da Inbox (como WhatsApp e E-mail)
Hoje a Inbox unificada só tem um filtro "Ligações"; não existe a página própria no menu lateral.
- Nova página **Inbox › Ligações** (`/inbox/ligacoes`), no mesmo casco das páginas de WhatsApp/E-mail/LinkedIn.
- Lista de ligações (mais recentes primeiro, busca, filtro por responsável/estado) e, ao abrir, o cartão completo: duração, resumo, áudio, transcrição e reunião marcada, com atalho para a ficha do Lead/Contato e para a conversa de WhatsApp.
- Item "Ligações" no menu da Inbox (ícone de telefone) e no submenu da Inbox lateral.
- Somente leitura (ligações não têm "responder"); estados de carregando, vazio e erro.
- Permissão: nova chave `techsales.inbox.calls.view` cadastrada em Permissões; servidor e regras do banco filtram pelo workspace/escopo, iguais ao WhatsApp. Testes: permitido, sem chave, negado, outro workspace, inativo.
- Artigo da Ajuda para a nova tela.

## 2. Valores por extenso no modelo de contrato
Novas variáveis no catálogo (grupo Contrato):
- `{{contract.total_value_extenso}}` → "dezoito mil, oitocentos e setenta reais"
- `{{contract.monthly_value_extenso}}` → idem para o valor mensal
- Centavos: "… reais e cinquenta centavos"; zero/vazio fica em branco.
Uso no exemplo: `{{contract.total_value}} ({{contract.total_value_extenso}}), correspondente ao valor de {{contract.monthly_value}}`.
- Preenchidas no preview, na geração do documento e na importação de modelos por IA.
- Teste com valores concretos (18.870,00; 1.000.001,50; 0,99; 100; 21).
- Atualizar artigo da Ajuda de variáveis de modelo.

## Detalhes técnicos
- Conversor puro `src/lib/format/currency-words-ptbr.ts` + teste; ligado em `template-tokens.ts` e no merge (`template-merge.server.ts`, `templates.functions.ts`).
- Ligações: reutilizar mensagens `provider='voice'` e `CallInboxCard`; leitura via server fn autenticada com gate de permissão; rota `inbox.ligacoes.tsx`, entrada em `menu-config.ts` e `inbox-workspace.tsx`.
- Sem mudança de schema além do cadastro da permissão.
