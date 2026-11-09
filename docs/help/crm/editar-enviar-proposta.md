---
module_key: crm
slug: editar-enviar-proposta
title: Editar e enviar uma proposta
summary: Revisar a proposta, solicitar aprovação e disponibilizar link público e PDF.
article_type: howto
route_pattern: /proposals/$id
min_permission:
audience: internal
sort_order: 203
version: 3
is_published: true
---
# Editar e enviar uma proposta
**Para que serve:** Preparar o documento comercial, registrar a aprovação interna e disponibilizar a proposta ao cliente.
**Quem pode fazer:** Membros ativos com acesso à proposta. Editar exige atualização em `techsales.proposals`. Compartilhar e baixar PDF exigem `techsales.proposal_share`; enviar exige `techsales.proposal_send`.
**Onde fica:** Menu > TechSales > Propostas > Proposta (`/proposals/$id`).
**Antes de começar:** Confira o status e se a proposta está marcada como "Travada".

## Passo a passo
1. Clique em "Editar" para abrir o assistente, quando a proposta não estiver travada.
2. Revise "Título *", "Responsável" e "Validade".
3. Confira os itens e o campo "Valor total da proposta".
4. Revise o modelo e o conteúdo. Avance pelas etapas e clique em "Salvar proposta".
5. Para revisão interna de um rascunho, clique em "Enviar para aprovação".
6. Escolha "Revisor", preencha "Comentário" se necessário e clique em "Enviar para revisão".
7. Para enviar ao cliente, clique em "Enviar ao cliente aprovar por e-mail": confira o remetente (sua conta conectada), o destinatário (preenchido com o contato da proposta e editável), Cc, assunto e mensagem, e clique em "Enviar". O e-mail leva o botão "Ver e aprovar proposta".
   Alternativa: clique em "Copiar link para cliente aprovar" para selar a proposta e copiar o link (por exemplo, para WhatsApp).
8. Use "Copiar link" para compartilhar o endereço público ou "Baixar PDF" para obter o documento.
![Tela: proposta com status, versão, Editar, Copiar link, Baixar PDF e Enviar ao cliente](/help-media/crm/editar-enviar-proposta.webp)

## Resultado esperado
A edição atualiza a proposta. A solicitação de revisão mostra "Aprovação solicitada.". O envio mostra "Proposta enviada e selada.". A cópia mostra "Link copiado.".

## Regras e limites
- "Editar" não aparece para uma proposta travada.
- A solicitação de aprovação fica disponível para rascunhos não travados.
- O revisor precisa de permissão de aprovação. Você não pode aprovar a própria solicitação.
- "Enviar ao cliente aprovar por e-mail" e "Copiar link para cliente aprovar" aparecem para propostas em rascunho ou aprovadas, conforme a permissão `techsales.proposal_send`. O e-mail sai pela sua conta de e-mail conectada e fica no histórico do negócio; só depois do envio a proposta é selada como "Enviada". Se o e-mail falhar, a proposta não muda de status. Sem conta conectada, a janela oferece o atalho para conectar.
- O cliente só consegue aprovar ou recusar pelo link depois que a proposta estiver "Enviada".
- Os itens não são alterados no assistente. Edite a cotação ou os itens de linha do negócio de origem.
- Compartilhe o link público e o PDF apenas com os destinatários pretendidos.

## Erros comuns
- "Informe o título.": preencha "Título *".
- "Não foi possível carregar a proposta.": clique em "Tentar novamente".
- "A origem não tem itens de linha.": confira a cotação ou o negócio de origem.
- Se "Enviar para revisão" estiver desabilitado, selecione um revisor.

## Relacionados
- [Gerenciar propostas](/ajuda/crm/gerenciar-propostas)
- [Gerenciar cotações e gerar propostas](/ajuda/crm/gerenciar-cotacoes)


## Condições para o contrato

No passo **Dados** informe **Parcelas**, **Dia de vencimento** e **Vigência do contrato (dias)** — a vigência vem com 90 dias por padrão. Esses campos só ficam editáveis para quem pode alterar propostas. Ao gerar o contrato a partir da proposta aceita, eles são copiados automaticamente.
