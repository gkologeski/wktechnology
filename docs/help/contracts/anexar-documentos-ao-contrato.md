---
module_key: contracts
slug: anexar-documentos-ao-contrato
title: Anexar cotação, proposta e arquivos ao contrato
summary: Vincular documentos de venda, gerar proposta técnica própria da compra, revisar o público dos arquivos e conferir o pacote antes da assinatura nativa ou ForSign.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 31
version: 3
is_published: true
---

# Anexar cotação, proposta e arquivos ao contrato

**Para que serve:** Incluir documentos no contrato, separar os anexos internos dos destinados ao cliente ou à prestadora e conferir o PDF completo antes de enviar para assinatura.
**Quem pode fazer:** Membro ativo do workspace com o módulo TechContracts e as mesmas permissões das ações já existentes na ficha: editar o contrato (`techcontracts.contracts.update`) para vincular, enviar ou remover anexos. Conferir o público de um anexo exige também `techcontracts.esign_share.manage.workspace` e autorização do contrato. Baixar a prévia para assinatura exige edição do contrato **e** gestão de evidências de assinatura (`techcontracts.signature_evidence.manage`). Cotações e propostas só aparecem para quem tem acesso a elas. A proposta técnica própria de compra exige as permissões específicas descritas no [guia de compra](/ajuda/contracts/gerar-proposta-tecnica-compra).
**Onde fica:** TechContracts > Contratos > ficha do contrato > quadro **Anexos do contrato**.
**Antes de começar:** Salve o contrato e confira sua finalidade e as partes. Na venda, a WK fornece para o cliente; na compra, a WK contrata a prestadora. Cotações e propostas de venda só aparecem na venda correspondente e conforme o seu acesso.

## Passo a passo

![Quadro Anexos do contrato na ficha, com o seletor de cotação ou proposta, os botões Vincular documento e Enviar arquivo, um arquivo de teste anexado e o botão Baixar prévia para assinatura](/__l5e/assets-v1/d37a1edb-e192-482b-ba52-8c1dc30e8923/contrato-anexos-ficha.png)

_Quadro **Anexos do contrato**. Neste exemplo o contrato de teste não tinha cotação nem proposta vinculada; por isso aparece o aviso "Nenhuma cotação ou proposta vinculada..." e só um arquivo enviado (anexo-qa.pdf)._

### Vincular uma cotação

Este seletor é destinado aos contratos de **venda**. Na compra de Fábrica de Software, use a proposta técnica própria descrita abaixo.

1. Clique em **Escolher cotação ou proposta**.
2. Selecione a cotação desejada.
3. Clique em **Vincular documento**.
4. Confira se a cotação apareceu na lista de anexos.
5. Use **Ver cotação** para abrir e conferir o conteúdo.

### Vincular uma proposta

1. No mesmo seletor **Escolher cotação ou proposta**, selecione a proposta desejada.
2. Clique em **Vincular documento**.
3. Confira se a proposta apareceu na lista.
4. Use **Ver proposta** para conferir.

### Enviar outro arquivo

1. Clique em **Enviar arquivo** e selecione o arquivo no computador.
2. Aguarde a confirmação do envio.
3. Confira o nome na lista e use **Baixar** para abrir o arquivo.
4. O arquivo novo começa como **Somente interno**. Se ele deve acompanhar o envio, um responsável autorizado deve selecionar **Compartilhar com o cliente** (venda) ou **Compartilhar com a prestadora** (compra), clicar em **Conferir público** e confirmar que revisou o conteúdo.
5. Use **Documento técnico compartilhável** somente para material técnico sem condições comerciais sensíveis. Documentos comerciais sensíveis não permitem essa classificação.
6. Se o arquivo deve ficar apenas na ficha, mantenha **Somente interno** e clique em **Conferir público** para registrar essa escolha. Um arquivo ainda sem revisão bloqueia um novo envio; um arquivo expressamente interno fica preservado e não acompanha a assinatura.

Formatos aceitos: PDF, DOCX, XLSX, JPG, PNG e TXT, até 20 MB por arquivo.

### Gerar a proposta técnica de uma compra

1. No contrato de compra, clique em **Proposta técnica de compra**.
2. Escolha o modelo visual de Fábrica de Software, preencha escopo, marcos, horas, preço e prazo próprios da prestadora.
3. Use **Salvar e conferir**, abra a prévia, confirme a revisão e clique em **Gerar documento e anexar**.
4. Confira a versão gerada na ficha. Consulte o [passo a passo completo](/ajuda/contracts/gerar-proposta-tecnica-compra).

O documento da prestadora não recebe automaticamente os valores ou as condições vendidos ao cliente. A proposta da compra não altera o valor do contrato nem cria movimentação financeira.

### Conferir a prévia na ficha

1. Clique em **Baixar prévia para assinatura**.
2. Abra o PDF completo e confira **todas as páginas**: valores, datas, partes, conteúdo do contrato e cada anexo destinado a esse público. Arquivos internos não acompanham o envio externo.
3. As versões da cotação e da proposta são **congeladas na preparação** do envio e aparecem como **Cópia congelada**. Alterações posteriores na cotação ou na proposta de origem **não** são incorporadas automaticamente ao pacote já preparado.
4. Gerar a prévia não envia convites nem consome créditos do ForSign.

### Assinatura no TechERP (nativa)

![Formulário Preparar assinatura do contrato com o quadro Documentos incluídos na assinatura listando 1 anexo e o botão Baixar prévia do contrato e anexos](/__l5e/assets-v1/d89f111b-0c20-4632-ad50-7014f08180af/contrato-assinatura-nativa.png)

_Formulário **Preparar assinatura do contrato**, com o quadro **Documentos incluídos na assinatura**._

1. Na ficha, clique em **Preparar assinatura no TechERP**.
2. No formulário **Preparar assinatura do contrato**, confira o quadro **Documentos incluídos na assinatura**: quantidade, nomes e tipos dos anexos.
3. Clique em **Baixar prévia do contrato e anexos** e revise o PDF.
4. Confira os signatários e os e-mails.
5. Conclua a preparação e, no mesmo painel, confira e envie os convites.

### Envio pelo ForSign

![Formulário Enviar pelo ForSign com o aviso de consumo de créditos, o quadro Documentos incluídos na assinatura e o botão Baixar prévia do contrato e anexos](/__l5e/assets-v1/9760864f-e4df-4ca0-8b56-a3b93735f6c6/contrato-forsign.png)

_Formulário **Enviar pelo ForSign**. A integração ForSign precisa estar conectada._

1. Na ficha, clique em **Enviar pelo ForSign**.
2. Confira o quadro **Documentos incluídos na assinatura**.
3. Clique em **Baixar prévia do contrato e anexos** e revise o PDF.
4. Confira os signatários.
5. Confirme o envio. Somente o envio efetivo consome créditos do ForSign.

### Checklist antes de enviar

- [ ] Todos os anexos externos esperados aparecem em **Documentos incluídos na assinatura**; os internos continuam apenas na ficha.
- [ ] Cada arquivo foi conferido para o público correto, preservando a separação entre cliente e prestadora.
- [ ] A prévia foi aberta e todas as páginas foram conferidas.
- [ ] Valores, datas e partes do contrato estão corretos.
- [ ] CONTRATANTE e CONTRATADO estão preenchidos, com e-mails corretos.
- [ ] Testemunhas incluídas sabem que precisarão assinar.

## Resultado esperado

Os arquivos ficam preservados na ficha. Os anexos revisados para o público correto aparecem no pacote, e o PDF da prévia mostra o contrato e esses anexos. No envio, as versões incluídas ficam congeladas.

## Regras e limites

- CONTRATANTE e CONTRATADO são obrigatórios. Testemunhas são opcionais; ao incluir uma, a assinatura dela é exigida para concluir o documento. Cada participante recebe seu próprio link.
- As cotações e propostas disponíveis dependem do vínculo com o contrato ou o negócio e da sua permissão de acesso.
- Na compra, o seletor de documentos de venda não é oferecido. Use o documento próprio da prestadora ou envie o arquivo correspondente.
- Classificar um arquivo não amplia o acesso de um usuário ao contrato nem permite compartilhar condições comerciais da outra parte.
- Remover um vínculo retira o anexo do contrato, mas preserva a cotação ou a proposta original.
- Abrir o formulário de assinatura não gera o pacote nem envia convites.

## Erros comuns

- **Falha ao carregar os documentos:** use **Tentar novamente**. Uma falha não significa que não há anexos; não prossiga se faltar algum anexo esperado.
- **Cotação ou proposta não aparece no seletor:** confira se ela está vinculada ao contrato ou ao negócio e se você tem acesso a ela.
- **Arquivo recusado:** confira o formato e o limite de 20 MB.
- **Arquivo não entrou no pacote:** confira se foi revisado para o cliente ou a prestadora corretos. Arquivos internos ficam disponíveis na ficha; arquivos com público incompatível ou sem revisão precisam ser conferidos antes do envio.

## Relacionados

- [Editar a ficha de um contrato](/ajuda/contracts/editar-contrato)
- [Gerar proposta técnica de compra de Fábrica de Software](/ajuda/contracts/gerar-proposta-tecnica-compra)
- [Assinar por link](/ajuda/contracts/assinar-por-link)
- [Assinar pelo ForSign](/ajuda/contracts/assinar-pelo-forsign)
