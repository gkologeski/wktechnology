---
module_key: crm
slug: controlar-campanhas-bloqueios-whatsapp
title: Controlar campanhas e entender bloqueios de números
summary: Iniciar, pausar, editar e duplicar campanhas e entender supressões de telefones.
article_type: howto
route_pattern: /campaigns/whatsapp
min_permission: techsales.marketing.campaigns.view.workspace
audience: internal
sort_order: 311
version: 1
is_published: true
---
# Controlar campanhas e entender bloqueios de números
**Para que serve:** Controlar campanhas e entender por que números ficam fora do envio.
**Quem pode fazer:** Gestor+ ou `techsales.marketing.campaigns.view.workspace`/`.manage.workspace`, mais a permissão de cada alteração.
**Onde fica:** Menu > TechSales > Captar > Campanhas WhatsApp (`/campaigns/whatsapp`).
**Antes de começar:** Confira estado e contadores.

## Passo a passo
1. Clique em "Iniciar".
2. Para interromper, clique em "Pausar".
3. Em rascunho ou pausada, clique em "Editar" e "Salvar alterações".
4. Para reaproveitar, use "Duplicar".
5. Para excluir, use "Excluir" e confira nome e quantidade.
6. Confira enviadas, falhas e ignoradas por regras.
<!-- screenshot: campanha com contadores e ações -->

## Resultado esperado
A campanha muda de estado; "Duplicar" cria rascunho novo.

## Regras e limites
- Editar só em rascunho ou pausada. Pause antes de excluir.
- Excluir não apaga mensagens enviadas.
- Erro Meta `131026` (sem WhatsApp): bloqueio de 90 dias.
- Erro `131049` (engajamento): espera de 7 dias; na repetição, 30 dias.
- Com e sem nono dígito contam como o mesmo número.
- A seleção automática tenta outro celular válido e pula bloqueados.
- Liberação manual fica na ficha do Contato/Lead, não nesta tela.

## Erros comuns
- "Só é possível editar campanhas em rascunho ou pausadas".
- "Pause a campanha antes de excluir".
- "Não foi possível verificar bloqueios de WhatsApp.": tente de novo.
- "Aguardando nova tentativa (limite de engajamento da Meta)": aguarde.

## Relacionados
- [Criar uma campanha de WhatsApp](/ajuda/crm/criar-campanha-whatsapp)
- [Atender conversas de WhatsApp](/ajuda/crm/atender-conversas-whatsapp)
