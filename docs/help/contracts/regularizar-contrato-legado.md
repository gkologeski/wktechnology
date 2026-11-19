---
module_key: contracts
slug: regularizar-contrato-legado
title: Reconhecer e regularizar um contrato legado
summary: Reconhecer um contrato importado como legado e regularizá-lo com o PDF original assinado, sem cotação, proposta, minuta ou nova assinatura.
article_type: howto
route_pattern: /contracts/$id
min_permission: techcontracts.legacy_contracts.view.workspace
audience: internal
sort_order: 220
version: 1
is_published: true
---
# Reconhecer e regularizar um contrato legado
**Para que serve:** Registrar no sistema um contrato assinado fora dele, preservando o mesmo contrato, arquivos e vínculos.
**Quem pode fazer:** Ver exige a chave de consulta de legado; reconhecer exige a chave de reconhecimento; regularizar exige a chave de regularização. Todas também exigem acesso ao contrato, membro ativo e o workspace atual.
**Onde fica:** TechContracts > Contratos > ficha do contrato > Visão geral > painel "Contrato legado".
**Antes de começar:** Contrato importado de arquivo, o PDF original assinado e as datas reais.

## Passo a passo
1. Na ficha, clique em "Reconhecer contrato legado" e informe o motivo. Só aparece para contratos importados elegíveis.
2. Complete contraparte e entidade WK pela edição normal do contrato; confira o documento. Um PDF escaneado não exige fabricar texto de minuta.
3. Em "Regularizar", envie o PDF original assinado. O servidor confere o arquivo e calcula o hash.
4. Informe a situação (em vigor, encerrado ou rescindido), a data da assinatura humana conferida no original, a vigência, a renovação (se houver, conferida na cláusula), a referência do documento e a justificativa.
5. Confirme a regularização.

## Resultado esperado
O mesmo contrato fica regularizado, com situação, evidência privada, trilha e prévia do PDF. Alterações posteriores só por aditivo.

## Regras e limites
- Contratos ativos, encerrados ou rescindidos importados podem ser reconhecidos sem voltar para rascunho; o status atual é mantido até a regularização.
- Não são aceitos contratos de solicitação de contratação, com proposta, cotação ou minuta aceita, ou com assinatura do sistema ou ForSign em curso ou concluída.
- Provedor e identificadores de assinatura extraídos do arquivo são apenas referência; não comprovam assinatura e são preservados.
- O hash comprova a integridade do arquivo, não a autenticidade jurídica.
- Vigência futura fica pendente: a regularização não antecipa operação nem cobrança.
- A regularização não cria títulos/pagamentos nem libera cobrança. Serviços e retenções de cobrança existentes são preservados; o Financeiro deve revisar qualquer liberação explicitamente.
- O original importado e o ID são preservados, inclusive enquanto pendente. A evidência assinada é um arquivo separado. Se valores, cláusulas, partes, período ou outros termos mudarem após o reconhecimento, reconheça de novo; evidências da revisão anterior ficam superadas.

## Erros comuns
"Sem permissão": peça ao administrador a chave correspondente. "Envie o PDF assinado e aguarde a confirmação do servidor": envie o PDF de novo. "Vigência futura ainda não suportada": aguarde o início. "Contrato com assinatura em curso ou concluída": preserve a evidência existente e consulte a assinatura do contrato; não apague documentos para forçar a regularização.

## Relacionados
- [Importar contrato](/ajuda/contracts/importar-contrato)
- [Importar em lote](/ajuda/contracts/importar-em-lote)
- [Editar contrato](/ajuda/contracts/editar-contrato)
