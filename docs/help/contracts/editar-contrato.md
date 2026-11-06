---
module_key: contracts
slug: editar-contrato
title: Editar a ficha de um contrato
summary: Editar a ficha de um contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 30
version: 1
is_published: true
---
# Editar a ficha de um contrato
**Para que serve:** Editar a ficha de um contrato.
**Quem pode fazer:** Leitura e capacidade de atualização de techcontracts.contracts para o registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Abrir o contrato correto e conferir a versão salva.

## Passo a passo
1. Abra o contrato pela lista.
2. Edite "Título", "Tipo", "Tipo de documento", "Contrato principal" quando for aditivo, e "Valor total".
3. Revise "Início", "Fim", "Renovação automática" e "Aviso prévio (dias)".
4. Em "Cláusulas / corpo do contrato", edite o texto quando necessário.
5. Clique em "Salvar" e aguarde "Contrato atualizado.".
6. Use "Visualizar" para abrir o arquivo original quando essa ação estiver disponível.
<!-- screenshot: Editar a ficha de um contrato, sem dados pessoais reais -->

## Resultado esperado
Alterações persistidas na ficha.

## Regras e limites
- Corpo é campo de texto/HTML, não editor rico.
- "Detalhes extraídos" exibe informações disponíveis em leitura; não torna todos os campos extraídos editáveis.
- Campos alterados localmente só são gravados após salvar.
- Conteúdo, partes e condições alterados podem exigir nova evidência de assinatura.
- Status e aprovação têm regras próprias.

## Erros comuns
"Contrato não encontrado.": use "Voltar". Salvar desabilitado: confira acesso, gravação em andamento ou principal ausente no aditivo.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)
