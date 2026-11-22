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
version: 3
is_published: true
---
# Reconhecer e regularizar um contrato legado
**Para que serve:** Registrar no sistema um contrato assinado fora dele, preservando o mesmo contrato, arquivos e vínculos.
**Quem pode fazer:** Ver exige a chave de consulta de legado; reconhecer exige a chave de reconhecimento; regularizar exige a chave de regularização. Todas também exigem acesso ao contrato, membro ativo e o workspace atual.
**Onde fica:** TechContracts > Contratos > ficha do contrato > Visão geral > painel "Contrato legado".
**Antes de começar:** Contrato importado de arquivo, o PDF original assinado e as datas reais.

## Passo a passo
1. Na ficha, clique em "Reconhecer contrato legado" e informe o motivo. Só aparece para contratos importados elegíveis.
2. No próprio painel, em "Partes do contrato", selecione a contraparte e a entidade legal WK e clique em "Salvar partes". Os campos usam os cadastros e permissões existentes, sem exigir negócio, cotação, proposta ou minuta. Se o documento já tiver sido reconhecido, confira e reconheça a nova revisão antes de anexar a evidência. Confira o documento. Um PDF escaneado não exige fabricar texto de minuta.
3. Em "Regularizar", envie o PDF original assinado. O servidor confere o arquivo e calcula o hash.
4. Informe a situação (em vigor, encerrado ou rescindido), a data da assinatura humana conferida no original, a vigência, a renovação (se houver, conferida na cláusula), a referência do documento e a justificativa.
5. Confirme a regularização.

## Resultado esperado
O mesmo contrato fica regularizado, com situação, evidência privada, trilha e prévia do PDF. Alterações posteriores só por aditivo.

## Descartar uma importação pendente
1. Abra a ficha do contrato, em Visão geral > Contrato legado.
2. Para um legado pendente em rascunho, clique em **Descartar legado pendente**.
3. Informe o motivo (5 a 2000 caracteres), marque a confirmação e clique em **Confirmar descarte**. Cancelar não grava nada.
4. Confira **Legado descartado**, a data e o motivo na trilha. O registro permanece na lista para consulta; o status jurídico anterior é preservado.

O descarte exige consulta de legados e acesso de consulta, alteração e exclusão do contrato, no workspace atual com membership ativo e sem deny. Não concede permissões a nenhum cargo. Só é aceito para legado pendente em rascunho, na revisão conferida, sem origem comercial/assinatura governada ou operação vinculada. Não descarta legados regularizados, não rescinde contratos e não altera serviços, projetos, alocações, cobranças ou pagamentos. O original, evidências e a autoria ficam preservados; não há exclusão física, reativação nem desfazer. A exclusão genérica de um legado é bloqueada: utilize esta ação na ficha. Se o documento mudou, atualize a ficha e registre a revisão antes de descartar.

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
