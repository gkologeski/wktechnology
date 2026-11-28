---
module_key: contracts
slug: gerar-proposta-tecnica-compra
title: Gerar proposta técnica de compra de Fábrica de Software
summary: Preparar um documento visual próprio da prestadora, conferir escopo, marcos e valores e anexar a versão ao contrato de compra.
article_type: howto
route_pattern: /contracts/$id
min_permission: techcontracts.purchase_proposals.view.workspace
audience: internal
sort_order: 32
version: 1
is_published: true
---

# Gerar proposta técnica de compra de Fábrica de Software

**Para que serve:** Usar o modelo visual de Fábrica de Software para preparar a proposta técnica da contratação de uma prestadora e incluí-la como anexo do contrato de compra. A WK é a **contratante** e a prestadora é a **contratada**.
**Quem pode fazer:** Membro ativo do workspace com acesso ao contrato e a permissão `techcontracts.purchase_proposals.view.workspace` pode consultar os documentos e valores próprios da compra. Salvar e gerar exige também `techcontracts.purchase_proposals.manage.workspace`, edição do contrato e liberação das regras de revisão/assinatura existentes. Gerenciar o catálogo exige `techcontracts.purchase_proposal_templates.manage.workspace`. Essas permissões são independentes do TechSales; nenhum cargo as recebe automaticamente.
**Onde fica:** TechContracts > Contratos > ficha de um **contrato de compra** > **Anexos do contrato** > **Proposta técnica de compra**.
**Antes de começar:** Salve o contrato de compra com a entidade legal WK e a prestadora corretas. Separe escopo, critérios de aceite, horas, valor-hora e prazos acordados com essa prestadora. A assinatura e as aprovações jurídicas devem permitir alterações no pacote.

## Passo a passo

1. Na ficha da compra, abra **Proposta técnica de compra**.
2. Em **Modelo**, selecione **Fábrica de Software — por entregas**, ou o modelo de compra disponibilizado pelo seu administrador. Confira as partes: WK como contratante e a empresa prestadora como contratada. Clique em **Usar este modelo**.
3. Em **Escopo e marcos**, preencha o título para a prestadora, o escopo técnico, o esforço em horas, o valor-hora de referência e a duração em dias úteis. Datas previstas são opcionais.
4. Em **Marcos de entrega**, clique em **Adicionar marco** para cada entrega. Informe nome, resultado esperado, critérios de aceite, horas e prazo acumulado em dias úteis. A soma das horas dos marcos precisa ser igual ao esforço acordado da compra.
5. Confira **Aceite, responsabilidades e condições**: aceite expresso da WK, responsabilidades das partes, pagamento, exclusões e garantia. Ajuste somente ao que foi efetivamente acordado.
6. Clique em **Salvar e conferir**. O sistema salva uma versão própria desta compra, sem criar uma proposta de venda.
7. Em **Conferência**, confira o resumo e clique em **Abrir prévia da proposta**. Leia todas as páginas do documento destinado à prestadora.
8. Depois de abrir e conferir a prévia, marque a confirmação das partes e condições. Clique em **Gerar documento e anexar**.
9. Em **Anexo e assinatura**, confira a versão gerada em **Conferir anexo gerado**. O documento aparece em **Anexos do contrato**. O **Histórico de versões** permite consultar versões anteriores preservadas.
10. Clique em **Voltar ao contrato**. Confira o público dos demais anexos e siga o fluxo de assinatura existente no contrato.
11. Se gerou uma versão nova, confira os anexos anteriores: remova os vínculos das versões substituídas que não devem acompanhar o próximo envio. Isso não apaga o histórico nem reescreve cópias já congeladas. Se o anexo da versão atual foi removido, use **Iniciar nova revisão** para preparar uma nova versão.

### Conferir antes da assinatura nativa ou ForSign

1. No quadro **Anexos do contrato**, confirme quais documentos se destinam à prestadora. Arquivos internos ficam preservados na ficha e não devem acompanhar o envio externo.
2. Se um arquivo enviado precisar acompanhar a compra, um responsável com edição do contrato e `techcontracts.esign_share.manage.workspace` deve selecionar **Compartilhar com a prestadora**, clicar em **Conferir público** e confirmar que revisou seu conteúdo.
   Se o arquivo é apenas interno, esse responsável deve manter **Somente interno** e confirmar em **Conferir público**. A escolha registrada preserva o arquivo na ficha e o retira do pacote; deixá-lo sem revisão bloqueia o novo envio.
3. Na assinatura nativa, abra **Preparar assinatura no TechERP**; na ForSign, abra **Enviar pelo ForSign**. Confira os documentos efetivamente incluídos e use a prévia completa do contrato e anexos.
4. Revise signatários, e-mails, aprovações e todas as páginas antes de confirmar o envio. Abrir ou gerar a prévia não envia convites.

## Resultado esperado

A proposta técnica visual fica disponível no contrato de compra como um documento versionado. O pacote para a prestadora reúne o contrato e os anexos autorizados para esse público, com suas versões preservadas. O fluxo de assinatura nativa ou ForSign continua responsável pela preparação, destinatários e envio.

## Regras e limites

- Horas, preço e prazo pertencem a esta **compra**. Eles podem diferir do que foi vendido ao cliente. Uma venda de Consultoria pode estar ligada a uma compra de Fábrica de Software sem transformar uma na outra.
- Preencher a proposta técnica **não altera automaticamente o valor do contrato**. Confira e regularize os valores do contrato antes da formalização.
- Quando o contrato de compra já tem um valor, o preço fechado da proposta precisa conferir com ele antes de salvar. Ajuste o acordo correto na origem; o assistente não muda o contrato por conta própria.
- O preço fechado de cada marco resulta de suas horas acordadas multiplicadas pelo valor-hora de referência da compra. Os valores de venda, margem, documentos e condições do cliente não são copiados para o material da prestadora.
- Os dados iniciais são genéricos. O modelo não traz horas, preços ou cronograma de outro negócio como se estivessem aprovados.
- Documentos de venda destinam-se ao cliente; documentos de compra, à prestadora. Um documento técnico compartilhável não pode conter condições comerciais sensíveis. A classificação de público não remove as permissões de acesso.
- Usuários técnicos sem acesso econômico não consultam os valores, os modelos nem os PDFs comerciais de compra por este assistente. Eles devem trabalhar pelo contexto técnico autorizado.
- Alterar dados produz uma nova versão. Documentos gerados e pacotes congelados não são reescritos; regras de assinatura em andamento continuam válidas.
- Gerar/anexar a proposta não inicia serviço, não representa aceite ou assinatura e não cria contas a pagar ou a receber. Execução e financeiro continuam em seus fluxos próprios e dependem das permissões correspondentes.

## Erros comuns

- **O botão não aparece:** confirme que está em uma compra, que o contrato já está salvo e que sua conta possui a permissão específica de consulta de propostas técnicas de compra.
- **Somente consulta disponível:** falta autorização de gestão/edição, há uma sessão somente leitura ou uma regra do contrato impede a operação. Não é necessário conceder acesso amplo ao TechSales.
- **Soma de horas dos marcos diferente:** ajuste as horas das entregas ou o esforço total da compra para refletir o acordo real.
- **Revisão concorrente/contrato alterado:** não substitua dados às cegas. Confira as mudanças no contrato e reabra o assistente antes de salvar a nova versão.
- **Anexo gerado, mas consulta posterior falhou:** o arquivo pode já estar anexado. Feche e reabra a proposta técnica para conferir; não crie outro documento apenas por causa da falha de atualização da tela.
- **Prévia bloqueada por público ou assinatura:** revise a classificação dos anexos e as aprovações do contrato. Não use uma proposta de venda para contornar o bloqueio de uma compra.

## Relacionados

- [Anexar cotação, proposta e arquivos ao contrato](/ajuda/contracts/anexar-documentos-ao-contrato)
- [Editar a ficha de um contrato](/ajuda/contracts/editar-contrato)
- [Assinar por link](/ajuda/contracts/assinar-por-link)
- [Assinar pelo ForSign](/ajuda/contracts/assinar-pelo-forsign)
