---
module_key: ats
slug: gerenciar-ofertas
title: Gerenciar ofertas
summary: Aprovar, enviar para assinatura, cancelar e excluir ofertas.
article_type: howto
route_pattern: /offers
min_permission: techhire.offers.view.own
audience: internal
sort_order: 50
version: 1
is_published: true
---
# Gerenciar ofertas
**Para que serve:** Formalizar a proposta ao candidato.
**Quem pode fazer:** Quem vê ofertas. Enviar, cancelar e excluir dependem da permissão sobre a oferta.
**Onde fica:** Menu > TechHire > Contratação > Ofertas (`/offers`).
**Antes de começar:** A oferta precisa estar aprovada para envio.

## Passo a passo
1. Revise "Salário" e "Início".
2. Na aprovação, escreva o "Parecer da aprovação" e clique em "Aprovar versão" ou "Reprovar".
3. Envie a oferta aprovada para assinatura.
4. Para copiar o link, use a ação de link.
5. Para cancelar, use "Cancelar oferta" e confirme.
<!-- screenshot: ofertas -->

## Resultado esperado
"Oferta disponível para assinatura. O envio por e-mail deve ser realizado pelo canal configurado."

## Regras e limites
- Status: Rascunho, Para assinatura, Assinada, Recusada, Cancelada.
- Alterar as condições exige nova aprovação.
- Só rascunhos sem aprovação pedida podem ser excluídos.
- Excluir pede: "Excluir definitivamente?".

## Erros comuns
- "Falha na aprovação": confira sua permissão.
- "Não foi possível copiar": copie manualmente.

## Relacionados
- [Editar a ficha do candidato](/ajuda/ats/editar-ficha-candidato)
