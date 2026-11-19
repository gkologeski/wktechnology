---
module_key: contracts
slug: importar-contrato
title: Importar e revisar um contrato PDF ou DOCX
summary: Importar e revisar um contrato PDF ou DOCX no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts
min_permission:
audience: internal
sort_order: 23
version: 9
is_published: true
---
# Importar e revisar um contrato PDF ou DOCX
**Para que serve:** Importar e revisar um contrato PDF ou DOCX.
**Quem pode fazer:** Gerenciamento de techcontracts.imports; finalizar exige atualização do contrato criado.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** PDF até 15 MB ou DOCX até 10 MB com texto legível.

## Passo a passo
1. Clique em **Importar contrato** e escolha **Documento em elaboração** ou **Contrato legado / já formalizado** antes de extrair.
2. Para legado, informe o motivo (mínimo 5 caracteres). Selecione o PDF ou DOCX; o original será guardado obrigatoriamente. Use **Visualizar contrato** para conferir o arquivo.
3. Clique em **Extrair com IA** e confira partes, papel da WK, valores, datas e tipo do documento. Dados extraídos são sugestões, não aceite ou prova de assinatura.
4. No modo legado, nada é criado durante a extração. Revise os campos e clique em **Criar contrato legado pendente**; a ficha permitirá conferir o PDF assinado e regularizar a situação, sem cotação, proposta ou minuta. Veja [Regularizar contrato legado](/ajuda/contracts/regularizar-contrato-legado).
5. No modo documento em elaboração, um rascunho é criado após a extração; revise e clique em **Finalizar**. Ele segue a jornada normal de novo contrato.
![Tela: Importar e revisar um contrato PDF ou DOCX, sem dados pessoais reais](/help-media/contracts/importar-contrato.webp)

## Resultado esperado
Um contrato legado pendente de conferência humana, ou um rascunho da jornada normal, conforme a escolha. A importação não comprova assinatura nem libera cobrança.

## Regras e limites
- Legado exige importar, criar, ver e editar contratos e reconhecer legado. A opção informa as permissões que faltam. Consultar evidências e regularizar exigem suas próprias chaves; a importação não as concede.
- PDF até 15 MB e DOCX até 10 MB na importação; a evidência assinada na regularização é um PDF privado de até 5 MB. O original é preservado separadamente.
- O texto do PDF é lido no servidor. PDF digitalizado pode não ter texto extraível; o legado pode ser conferido pelo PDF assinado sem fabricar corpo de minuta. DOCX mantém a formatação quando a leitura consegue recuperá-la e precisa ter pelo menos 20 caracteres extraídos.
- Texto muito longo é truncado com aviso. IA pode falhar por créditos, limites ou conteúdo inválido. Confira sempre as partes: WK como prestadora tem o cliente como contraparte; WK como contratante tem o fornecedor como contraparte. CNPJ divergente ou nome ambíguo exige revisão.
- No legado, falha de upload impede a criação. A criação e o reconhecimento pendente são uma transação; a mesma tentativa e o mesmo arquivo não geram outro contrato ao repetir após falha. Dados divergentes na repetição exigem abrir a ficha existente.
- No documento em elaboração, guardar original é opcional. Uma falha pode deixar aviso ou oferecer nova tentativa explícita/sem corpo; confira a lista antes de repetir uma operação cuja resposta se perdeu. Fechar não apaga um rascunho já criado.
- A importação de legado não decide vigência, não assina, não cria título/pagamento e não libera retenções de cobrança. A conferência ocorre na ficha.
- Rascunho com corpo vazio e original guardado pode usar **Carregar corpo do arquivo original** na aba Documento, com permissão de edição. Isso não exige importar novamente.

## Erros comuns
Contrato antigo já assinado pelo ForSign ou outro provedor: escolha **Contrato legado / já formalizado**, preserve o original e confira as referências na ficha. A importação não cria uma nova operação de assinatura; a regularização exige o PDF assinado e conferência humana. Se o contrato já possui uma operação de assinatura real no TechERP, ele permanece na jornada existente.
"Formato não suportado. Use .pdf ou .docx.": converta o arquivo.
"Rascunho salvo em Contratos. Você pode retomar quando quiser.": confira o rascunho antes de repetir a importação.

## Relacionados
- [Importar em lote](/ajuda/contracts/importar-em-lote)
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)

Provedor e identificadores de assinatura extraídos são referências a conferir, não prova de assinatura. No novo modo legado, são guardados como dados documentais, sem criar uma assinatura ativa.
