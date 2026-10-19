# Foto dos contatos do público disparado hoje (19/10)

## Situação
- 133 contatos receberam WhatsApp de campanhas hoje no workspace WK. Nenhum deles tem foto.

## O que será feito
1. Rodar o enriquecimento com a Apollo **só para buscar a foto** desses 133 contatos. Os outros campos do cadastro (cargo, telefone, e-mail, empresa) não mudam.
2. Quando a Apollo devolver uma foto do LinkedIn, ela é copiada para o armazenamento privado e aplicada como "Foto obtida do LinkedIn". Fotos manuais nunca são trocadas (hoje nenhum dos 133 tem).
3. Se a Apollo não tiver foto, ou o link estiver expirado, o contato fica como está, com as iniciais.
4. Nenhuma mensagem é enviada e nada é publicado.

## Custo
- Cada contato consultado gasta 1 crédito da Apollo. São até 133 créditos. Contatos sem LinkedIn ou sem e-mail podem não ter retorno.

## Validação e relatório
- Antes e depois: contagem de contatos com foto.
- Relatório com quantos ganharam foto, quantos não tinham foto na Apollo e quantos falharam, com o motivo.
- Conferir no navegador 2 ou 3 contatos na Inbox e na lista.

## Detalhes técnicos
- Público: `contact_id` distintos de `whatsapp_campaign_recipients` com `sent_at` a partir de 19/10 00:00 BRT, em campanhas do workspace `184b9435-…`.
- Execução em lotes de 10 via `people/bulk_match` (gateway Apollo), sem `reveal_phone_number`. O resultado passa por `applyLinkedinPhoto` (`person-photo.server.ts`), que respeita `photo_source`. Nenhum outro campo é gravado.
