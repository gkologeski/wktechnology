---
module_key: contracts
slug: assinar-pelo-forsign
title: Enviar contratos para assinatura pelo ForSign
summary: Conectar o ForSign, enviar a versão atual do contrato, acompanhar quem assinou e receber o PDF assinado como evidência.
article_type: howto
route_pattern: /settings/integrations/forsign
min_permission: techcontracts.forsign_settings.manage.workspace
audience: internal
sort_order: 97
version: 6
is_published: true
---
# Enviar contratos para assinatura pelo ForSign
**Para que serve:** Usar a conta ForSign da empresa sem sair do TechERP: o contrato vai para o ForSign, os assinantes recebem o convite do ForSign e o PDF assinado volta sozinho como evidência da versão enviada.
**Quem pode fazer:** Configurar exige "Configurar integração ForSign". Enviar e cancelar exigem "Enviar contratos pelo ForSign" e "Gerenciar evidências de assinatura". Ver o andamento segue a permissão de ver as evidências de assinatura do contrato. Nenhuma dessas permissões é dada automaticamente.
**Onde fica:** Configurações > Integrações > ForSign; e no contrato (e na etapa Contrato do negócio), no quadro "Assinaturas do contrato" > ForSign.
**Antes de começar:** Ter a chave da API do ForSign (painel do ForSign > Configurações > Desenvolvedor > Configurações) e créditos no plano.

## Passo a passo — configurar (uma vez)
1. Abra Configurações > Integrações > ForSign.
2. Cole a chave da API e clique em "Salvar e testar". O selo deve mostrar "Conectado".
3. Copie o "Endereço do webhook".
4. No ForSign, em Configurações > Desenvolvedor > Webhooks, crie um webhook com esse endereço para cada ação: Documento assinado, Operação concluída, Documento pronto e Atualização da operação.
5. Copie o segredo gerado pelo ForSign, cole em "Segredo do webhook" e salve.

## Passo a passo — enviar um contrato
1. Abra o contrato e vá até "Assinaturas do contrato".
2. No quadro ForSign, clique em "Enviar pelo ForSign".
3. Informe nome, e-mail, CPF (opcional) e papel do signatário do cliente e do signatário da WK. Adicione testemunhas se precisar.
4. Clique em "Enviar". O TechERP gera o PDF da versão atual do contrato e o ForSign envia os convites por e-mail.
5. Acompanhe a situação de cada assinante no quadro. "Atualizar situação" consulta o ForSign na hora.
6. Para desistir, use "Cancelar envio" e informe o motivo (os créditos só voltam se ninguém tiver assinado).

## Resultado esperado
Quando todos assinam, o PDF final do ForSign (com a trilha de auditoria) é guardado no arquivo privado de evidências e aparece como "Documento externo atestado · Versão atual", com a referência "ForSign · operação N". O contrato não é ativado sozinho: siga com a ativação ou com o seu fluxo de automação.

## Regras e limites
- Só uma remessa ativa por versão do contrato. Se o contrato mudar depois do envio, o PDF assinado não vale para a nova versão: o envio fica como "Versão não vigente" e é preciso enviar de novo.
- Sem webhook, o TechERP confere os envios pendentes a cada 2 minutos.
- O PDF enviado tem o texto e os títulos do contrato em layout simples (A4); tabelas e imagens do modelo não são reproduzidas.
- Para automações, o fim da assinatura gera uma atualização do contrato com o campo forsign_status mudando para "signed".
- O fluxo "Preparar assinatura no TechERP" e "Registrar assinatura externa" continuam disponíveis.

## Erros comuns
- "Chave da API do ForSign inválida": gere ou copie de novo a chave no painel do ForSign.
- "Sem créditos no plano do ForSign": recarregue o plano no ForSign.
- O envio ficou em "Falhou": leia a mensagem no quadro, corrija (por exemplo e-mail inválido) e envie de novo.

## Relacionados
- Assinar ou recusar um documento por link
- Registrar assinatura externa de um contrato

## Seleção dos signatários
Escolha contatos para CONTRATANTE e CONTRATADO. A pesquisa por nome/e-mail permite cadastrar um contato no mesmo contexto, com os acessos de contatos. Testemunhas são opcionais antes do envio; todas as incluídas precisam assinar. Inclua outros papéis quando necessário. O TechERP conserva a lista enviada e só registra a evidência quando o ForSign comprova todos os participantes dessa lista, sem omissões. Máximo de dez participantes no ForSign.

## Envio para todos ao mesmo tempo

- O TechERP envia o convite a todos os assinantes ao mesmo tempo, sem ordem de assinatura.
- No quadro ForSign, cada pessoa aparece como "Convite enviado — aguardando assinatura", "Na fila" (só em envios antigos feitos em ordem) ou "Assinou".

## Como ler a situação no quadro

Cada linha traz um ícone antes do nome, e a cor do rótulo repete o mesmo código em qualquer módulo:

- Círculo verde com visto: a pessoa assinou (e o horário aparece junto).
- Relógio em amarelo: o convite foi enviado e a pessoa ainda não assinou.
- Círculo tracejado em cinza: está na fila, ou a remessa é de uma versão anterior do contrato.
- X em vermelho: assinatura cancelada, remessa expirada ou com falha.
- Olho: o signatário abriu o documento mas ainda não assinou (aparece no fluxo nativo do TechERP).
- No alto do quadro, o selo da remessa mostra a situação geral e o contador "X de Y assinaram".

O ícone é apenas um reforço visual: o texto ao lado continua sendo o que define a situação, e nada
disso altera quem pode enviar, assinar ou ver o contrato.
- Se o ForSign registrar um envio em ordem, o quadro mostra um aviso.

## Anexos no envio
Inclua as cotações, propostas e arquivos em **Contrato > Documento > Anexos do contrato**. Use **Baixar prévia para assinatura** para revisar o PDF completo. O ForSign recebe o pacote inteiro, com o contrato e todos os anexos, em vez de apenas o corpo principal. Falhas na conversão ou na integridade de qualquer anexo bloqueiam a operação, sem enviar convites incompletos. A cópia enviada permanece congelada; revisões posteriores na origem comercial não alteram esse contrato assinado.

## Conferir anexos antes de preparar ou enviar
Nos formulários **Preparar assinatura no TechERP** e **Enviar pelo ForSign**, o quadro **Documentos incluídos na assinatura** lista os anexos e identifica as cópias congeladas. Use **Baixar prévia do contrato e anexos** para conferir o PDF completo antes de continuar. Abrir o formulário não gera o pacote nem envia convites. A prévia exige as mesmas permissões da ficha do contrato e não consome créditos do ForSign. Se a consulta falhar, use **Tentar novamente**; uma falha não é apresentada como ausência de anexos.
