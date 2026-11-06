---
module_key: crm
slug: enviar-whatsapp-pela-ficha
title: Enviar WhatsApp pela ficha
summary: Enviar uma mensagem de WhatsApp a partir da ficha do Contato ou do Lead.
article_type: howto
route_pattern: /contacts/$id
min_permission: techsales.inbox.whatsapp.view.own
audience: internal
sort_order: 160
version: 1
is_published: true
---
# Enviar WhatsApp pela ficha
**Para que serve:** Falar com o cliente pelo WhatsApp sem sair da ficha do Contato ou do Lead.
**Quem pode fazer:** Quem tem uma permissão de ver (`techsales.inbox.whatsapp.view.own/team/workspace`) e uma de criar (`techsales.inbox.whatsapp.create.own/team/workspace`). Liberar número bloqueado exige `system.whatsapp_suppressions.manage.workspace`. O servidor confere tudo de novo no envio.
**Onde fica:** Ficha do Contato (`/contacts/$id`) ou do Lead (`/leads/$id`) > barra de ações da timeline > "Enviar WhatsApp". A ação também pode estar em "Mais".
**Antes de começar:** O cadastro precisa ter telefone. Sem telefone, a ação não abre.

## Passo a passo
1. Abra a ficha do Contato ou do Lead.
2. Na barra da timeline, clique em "Enviar WhatsApp". Não confunda com "Registrar WhatsApp", que só registra uma atividade.
3. Confira o campo "Para". Ele vem do cadastro e não pode ser editado aqui.
4. Dentro da janela de 24 horas, escreva em "Mensagem" ou escolha um item em "Template (opcional)". "Mensagem livre" envia sem modelo.
5. Fora da janela, escolha um "Modelo aprovado pela Meta" e preencha as variáveis.
6. Se quiser, anexe um arquivo em "Mídia (opcional)".
7. Clique em "Enviar".
<!-- screenshot: janela Enviar WhatsApp na ficha do contato -->

## Resultado esperado
A mensagem é enviada e aparece na conversa e na timeline do cadastro.

## Regras e limites
- A janela de 24 horas conta da última mensagem **recebida** do cliente.
- Fora da janela, ou se o cliente nunca escreveu, só é possível enviar modelo aprovado pela Meta.
- O servidor confere se o modelo está aprovado, no idioma certo, com variáveis e mídia obrigatória preenchidas.
- A ficha mostra "Bloqueios de WhatsApp" quando o número foi recusado:
  - "Número sem WhatsApp (recusado pela Meta)": bloqueio de 90 dias.
  - "Aguardando nova tentativa (limite de engajamento da Meta)": espera de 7 dias; se repetir, 30 dias.
- "Liberar número" pede confirmação ("Liberar número para WhatsApp?"). O número volta a receber campanhas e sequências. Se a Meta recusar de novo, ele é bloqueado outra vez. Liberar não garante a entrega.
- Modo somente leitura bloqueia o envio.

## Erros comuns
- "A janela de 24 horas terminou. Escolha um modelo aprovado pela Meta para continuar.": escolha um modelo aprovado.
- Modelo não aprovado ou variáveis incompletas: revise o modelo e preencha todas as variáveis.
- "Não foi possível verificar bloqueios de WhatsApp deste cadastro.": recarregue a ficha.

## Relacionados
- [Gerenciar campanhas de WhatsApp](/ajuda/crm)
- [Visão geral do TechSales](/ajuda/crm)
