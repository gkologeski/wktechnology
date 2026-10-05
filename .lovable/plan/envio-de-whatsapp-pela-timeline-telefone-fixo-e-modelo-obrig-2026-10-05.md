# Envio de WhatsApp pela timeline: telefone fixo e modelo obrigatório fora da janela

## Resultado esperado
- Quando a janela é aberta a partir de um Lead, Contato, Empresa, Negócio ou Ticket, o telefone aparece só para leitura (o número já cadastrado no registro), sem campo editável.
- Ao abrir, o sistema já verifica se passaram mais de 24 horas desde a última mensagem recebida daquele número.
  - Dentro da janela: mensagem livre e modelos ficam disponíveis, como hoje.
  - Fora da janela (ou se o cliente nunca escreveu): a opção "Mensagem livre", o campo de texto, os anexos e a IA de escrita ficam ocultos; aparece um aviso "Janela de 24 horas encerrada" e só a seleção de modelos aprovados pela Meta, com variáveis e prévia.
- Enquanto verifica, aparece um estado de carregamento e o envio fica desabilitado; se a verificação falhar, aparece um erro com opção de tentar de novo, e o servidor continua bloqueando envio livre de qualquer forma.

## Implementação
1. Nova consulta no servidor (autenticada, por workspace) que recebe o telefone e retorna `{ withinWindow, lastInboundAt }`, reaproveitando `findConversationNumber` e `isWithinServiceWindow`.
2. `SendWhatsAppDialog`:
   - nova opção `lockRecipient` (padrão desligado); com ela ligada, o telefone vira texto somente leitura e o rascunho salvo não pode trocar o número.
   - consulta da janela ao abrir; `templateRequired` passa a vir dela (e continua sendo ligado também pelo erro `TEMPLATE_REQUIRED` do servidor, como segurança extra).
   - fora da janela, escolhe automaticamente o modo modelo e esconde texto livre, anexos e escrita assistida.
3. `TimelineActionDialogs` passa `lockRecipient` ao abrir pelo registro. Outros usos do diálogo (por exemplo, envio avulso) seguem com o telefone editável.

## Fora do escopo
Sem mudanças no banco, permissões ou na Inbox.

## Validação
- Teste unitário da consulta de janela (dentro, no limite, sem mensagem recebida).
- Playwright na ficha do Negócio: telefone não editável; contato fora da janela mostra só modelos; contato dentro da janela mostra mensagem livre.
- Verificação de tipos, lint, testes e build.
