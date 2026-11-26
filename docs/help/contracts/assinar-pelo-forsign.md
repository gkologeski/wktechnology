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
version: 10
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
3. Confira os representantes sugeridos automaticamente para CONTRATANTE e CONTRATADO (com a razão social de cada empresa no cabeçalho) e ajuste com "Trocar" se necessário. Informe CPF (opcional) e adicione testemunhas se precisar.
4. Confira o quadro **Posicionamento das assinaturas e rubricas**, que indica para cada pessoa se o local da assinatura foi **identificado** no contrato ou se será incluída uma **página de assinaturas adicionada**.
5. Clique em "Enviar". O TechERP gera o PDF com as marcas invisíveis de assinatura e rubrica em todas as páginas (incluindo anexos) e o ForSign envia os convites por e-mail.
6. Acompanhe a situação de cada assinante no quadro. "Atualizar situação" consulta o ForSign na hora.
7. Para desistir, use "Cancelar envio" e informe o motivo (os créditos só voltam se ninguém tiver assinado).

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
- [Anexar cotação, proposta e arquivos ao contrato](/ajuda/contracts/anexar-documentos-ao-contrato)
- Assinar ou recusar um documento por link
- Registrar assinatura externa de um contrato

## Seleção dos signatários
Quem assina eletronicamente é sempre uma pessoa física (representante legal de cada empresa ou o próprio contratado PF); a razão social e o CNPJ das empresas já constam no contrato. Ao abrir o envio pelo ForSign ou a assinatura no TechERP, o sistema exibe a razão social no cabeçalho de cada papel e sugere automaticamente os contatos representantes conforme o tipo do contrato (em compras, CONTRATANTE é a entidade da empresa e CONTRATADO é o fornecedor; em vendas, o inverso), usando os contatos visíveis no seu acesso. Use "Trocar" para selecionar outra pessoa ou pesquise por nome/e-mail (com opção de cadastrar contato no mesmo contexto, respeitando os acessos de contatos). Testemunhas são opcionais antes do envio; todas as incluídas precisam assinar. Inclua outros papéis quando necessário. O TechERP conserva a lista enviada e só registra a evidência quando o ForSign comprova todos os participantes dessa lista, sem omissões. Máximo de dez participantes no ForSign.

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

## Posicionamento automático das assinaturas e rubricas
- O TechERP identifica automaticamente os espaços de assinatura no texto do contrato (linhas `_________` ou marcações `(assinatura eletrônica)` associadas a CONTRATANTE, CONTRATADA, testemunhas e outros papéis) e posiciona a assinatura de cada signatário por tag na API do ForSign.
- Quando não há espaço suficiente no texto ou existe ambiguidade entre papéis, o sistema adiciona automaticamente uma **Página de Assinaturas** ao final do PDF com uma linha rotulada para cada signatário pendente — sem nunca trocar um signatário de lugar.
- No formulário **Enviar pelo ForSign**, o quadro **Posicionamento das assinaturas e rubricas** informa para cada pessoa **Local da assinatura: identificado** ou **Local da assinatura: página de assinaturas adicionada** conforme os signatários escolhidos.
- As **rubricas** de todos os signatários são posicionadas automaticamente lado a lado no rodapé de **todas as páginas** do PDF enviado, inclusive nas páginas dos anexos incluídos no pacote de assinatura.
- A consulta do posicionamento usa exatamente as mesmas permissões do envio pelo ForSign (`techcontracts.forsign.manage.workspace` e `techcontracts.signature_evidence.manage.workspace`) e não consome créditos.

## Avisar a equipe após a conclusão

O evento **Assinatura concluída** está disponível em **Central de notificações > Regras** para um Workflow autorizado de contratos. Ele exige a confirmação válida de conclusão da assinatura da versão atual; data preenchida ou contrato Ativo não bastam. Assinatura parcial e evidência cancelada, revogada ou de outra versão não comprovam a conclusão atual.

Escolher o evento abre um rascunho desativado no construtor existente. Confira destinatários, condições e canais, salve e revise antes de publicar e ativar. A notificação não envia outro convite, não repete a assinatura e não ativa serviço ou cobrança. O preset legado de assinatura e os Workflows existentes são preservados.

Os destinatários precisam estar ativos no mesmo workspace e ter leitura atual da origem. O conteúdo externo é neutro; a evidência e o documento permanecem na ficha autorizada. Consulte [Usar a central de notificações](/ajuda/core/usar-central-de-notificacoes).
