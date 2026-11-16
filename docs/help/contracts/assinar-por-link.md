---
module_key: contracts
slug: assinar-por-link
title: Assinar ou recusar um documento por link
summary: Assinar ou recusar um documento por link no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /sign/$token
min_permission:
audience: internal
sort_order: 96
version: 4
is_published: true
---
# Assinar ou recusar um documento por link
**Para que serve:** Assinar ou recusar um documento por link.
**Quem pode fazer:** Destinatário do link individual de assinatura. O acesso público usa o token do link.
**Onde fica:** TechContracts > Contratos (/sign/$token).
**Antes de começar:** Receber um link válido. Não compartilhe o link individual com terceiros.

## Passo a passo
1. Abra o link recebido e leia o documento. Se houver anexos, use **Abrir contrato completo com anexos (PDF)** e confira o pacote inteiro; a tela informa a quantidade de anexos, páginas e o hash de integridade. A assinatura abrange o contrato e todos os anexos desse pacote congelado.
2. Consulte a situação dos signatários e aguarde os anteriores se houver assinatura ordenada.
3. Digite seu nome completo e marque o aceite.
4. Clique em "Assinar agora".
5. Se não concordar, escolha a recusa e informe o motivo opcional.
<!-- screenshot: Assinar ou recusar um documento por link, sem dados pessoais reais -->

## Resultado esperado
A assinatura ou recusa fica registrada no documento.

## Regras e limites
- O documento aparece com a mesma formatação do modelo do contrato (títulos, negrito, parágrafos e listas), para o cliente e para a empresa.
- Nome com pelo menos dois caracteres e aceite são exigidos pelo botão.
- Links inválidos, expirados ou documentos cancelados/rascunho não permitem assinatura.
- A ordem é conferida novamente ao assinar.
- O link e o aceite não devem ser descritos como autenticação forte ou validação criptográfica de identidade.

## Erros comuns
"Link inválido ou expirado.": peça um link válido.
"Você já assinou este documento." e "Assinatura recusada anteriormente." indicam ação já registrada.
"Assinatura indisponível.": confira a situação do documento com o responsável.

## Relacionados
- [Preparar documentos](/ajuda/contracts/gerenciar-documentos-assinatura)

## Conferir anexos antes de preparar ou enviar
Nos formulários **Preparar assinatura no TechERP** e **Enviar pelo ForSign**, o quadro **Documentos incluídos na assinatura** lista os anexos e identifica as cópias congeladas. Use **Baixar prévia do contrato e anexos** para conferir o PDF completo antes de continuar. Abrir o formulário não gera o pacote nem envia convites. A prévia exige as mesmas permissões da ficha do contrato e não consome créditos do ForSign. Se a consulta falhar, use **Tentar novamente**; uma falha não é apresentada como ausência de anexos.
