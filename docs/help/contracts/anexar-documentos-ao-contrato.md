---
module_key: contracts
slug: anexar-documentos-ao-contrato
title: Anexar cotação, proposta e arquivos ao contrato
summary: Vincular cotação ou proposta, enviar arquivos e conferir a prévia do pacote antes de preparar a assinatura no TechERP ou enviar pelo ForSign.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 31
version: 2
is_published: true
---
# Anexar cotação, proposta e arquivos ao contrato
**Para que serve:** Incluir no contrato a cotação, a proposta ou outros arquivos que farão parte do pacote de assinatura, e conferir o PDF completo antes de enviar.
**Quem pode fazer:** Membro ativo do workspace com o módulo TechContracts e as mesmas permissões das ações já existentes na ficha: editar o contrato (`techcontracts.contracts.update`) para vincular, enviar ou remover anexos. Baixar a prévia para assinatura exige edição do contrato **e** gestão de evidências de assinatura (`techcontracts.signature_evidence.manage`). Cotações e propostas só aparecem para quem tem acesso a elas.
**Onde fica:** TechContracts > Contratos > ficha do contrato > quadro **Anexos do contrato**.
**Antes de começar:** Salve o contrato e confirme que ele pertence ao cliente e ao negócio corretos. Cotações e propostas só aparecem quando estão vinculadas a este contrato ou ao seu negócio.

## Passo a passo

![Quadro Anexos do contrato na ficha, com o seletor de cotação ou proposta, os botões Vincular documento e Enviar arquivo, um arquivo de teste anexado e o botão Baixar prévia para assinatura](/__l5e/assets-v1/d37a1edb-e192-482b-ba52-8c1dc30e8923/contrato-anexos-ficha.png)

*Quadro **Anexos do contrato**. Neste exemplo o contrato de teste não tinha cotação nem proposta vinculada; por isso aparece o aviso "Nenhuma cotação ou proposta vinculada..." e só um arquivo enviado (anexo-qa.pdf).*

### Vincular uma cotação
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

Formatos aceitos: PDF, DOCX, XLSX, JPG, PNG e TXT, até 20 MB por arquivo.

### Conferir a prévia na ficha
1. Clique em **Baixar prévia para assinatura**.
2. Abra o PDF completo e confira **todas as páginas**: valores, datas, conteúdo do contrato e cada anexo.
3. As versões da cotação e da proposta são **congeladas na preparação** do envio e aparecem como **Cópia congelada**. Alterações posteriores na cotação ou na proposta de origem **não** são incorporadas automaticamente ao pacote já preparado.
4. Gerar a prévia não envia convites nem consome créditos do ForSign.

### Assinatura no TechERP (nativa)

![Formulário Preparar assinatura do contrato com o quadro Documentos incluídos na assinatura listando 1 anexo e o botão Baixar prévia do contrato e anexos](/__l5e/assets-v1/d89f111b-0c20-4632-ad50-7014f08180af/contrato-assinatura-nativa.png)

*Formulário **Preparar assinatura do contrato**, com o quadro **Documentos incluídos na assinatura**.*

1. Na ficha, clique em **Preparar assinatura no TechERP**.
2. No formulário **Preparar assinatura do contrato**, confira o quadro **Documentos incluídos na assinatura**: quantidade, nomes e tipos dos anexos.
3. Clique em **Baixar prévia do contrato e anexos** e revise o PDF.
4. Confira os signatários e os e-mails.
5. Conclua a preparação e, no mesmo painel, confira e envie os convites.

### Envio pelo ForSign

![Formulário Enviar pelo ForSign com o aviso de consumo de créditos, o quadro Documentos incluídos na assinatura e o botão Baixar prévia do contrato e anexos](/__l5e/assets-v1/9760864f-e4df-4ca0-8b56-a3b93735f6c6/contrato-forsign.png)

*Formulário **Enviar pelo ForSign**. A integração ForSign precisa estar conectada.*

1. Na ficha, clique em **Enviar pelo ForSign**.
2. Confira o quadro **Documentos incluídos na assinatura**.
3. Clique em **Baixar prévia do contrato e anexos** e revise o PDF.
4. Confira os signatários.
5. Confirme o envio. Somente o envio efetivo consome créditos do ForSign.

### Checklist antes de enviar
- [ ] Todos os anexos esperados aparecem em **Documentos incluídos na assinatura**.
- [ ] A prévia foi aberta e todas as páginas foram conferidas.
- [ ] Valores, datas e partes do contrato estão corretos.
- [ ] CONTRATANTE e CONTRATADO estão preenchidos, com e-mails corretos.
- [ ] Testemunhas incluídas sabem que precisarão assinar.

## Resultado esperado
Os anexos aparecem na ficha e no quadro **Documentos incluídos na assinatura**, e o PDF da prévia mostra o contrato seguido de cada anexo. No envio, o pacote vai completo para assinatura, com as cópias congeladas.

## Regras e limites
- CONTRATANTE e CONTRATADO são obrigatórios. Testemunhas são opcionais; ao incluir uma, a assinatura dela é exigida para concluir o documento. Cada participante recebe seu próprio link.
- As cotações e propostas disponíveis dependem do vínculo com o contrato ou o negócio e da sua permissão de acesso.
- Remover um vínculo retira o anexo do contrato, mas preserva a cotação ou a proposta original.
- Abrir o formulário de assinatura não gera o pacote nem envia convites.

## Erros comuns
- **Falha ao carregar os documentos:** use **Tentar novamente**. Uma falha não significa que não há anexos; não prossiga se faltar algum anexo esperado.
- **Cotação ou proposta não aparece no seletor:** confira se ela está vinculada ao contrato ou ao negócio e se você tem acesso a ela.
- **Arquivo recusado:** confira o formato e o limite de 20 MB.

## Relacionados
- [Editar a ficha de um contrato](/ajuda/contracts/editar-contrato)
- [Assinar por link](/ajuda/contracts/assinar-por-link)
- [Assinar pelo ForSign](/ajuda/contracts/assinar-pelo-forsign)
