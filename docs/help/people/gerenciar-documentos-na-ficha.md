---
module_key: people
slug: gerenciar-documentos-na-ficha
title: Adicionar e consultar documentos na ficha
summary: Registrar documentos, anexar arquivos e consultar sua validade na pessoa.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.documents.view.own
audience: internal
sort_order: 127
version: 1
is_published: true
---
# Adicionar e consultar documentos na ficha

**Para que serve:** Registrar documentos, anexar arquivos e consultar sua validade na pessoa.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Criar depende da capacidade de criar registros para a pessoa; editar e excluir dependem da autorização do registro, não apenas da edição do perfil. Visualizar ou baixar um arquivo também passa pela autorização do documento.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Documentos (`/people/$id`).
**Antes de começar:** Separe o arquivo permitido e confira o tipo e a validade sem expor dados desnecessários.

## Passo a passo
1. Clique em "Novo documento". Escolha ou informe o Tipo e preencha Número e Emissão quando aplicável.
2. Informe Validade quando houver vencimento.
3. Use "Selecionar arquivo" e aguarde o upload terminar. Confira o arquivo anexado antes de continuar.
4. Preencha Notas e clique em "Salvar". Confira o documento na lista e seus indicadores de situação.
5. Use "Visualizar" para abrir o visualizador e "Baixar" para obter o arquivo. Documentos sem arquivo não oferecem essas ações.
6. Para atualizar metadados ou arquivo, use o lápis e salve; para excluir, use a lixeira e confirme quando autorizado.

## Resultado esperado
A tela informa "Documento adicionado" ou "Documento atualizado" e recarrega a lista.

## Regras e limites
- Arquivo de até 20 MB; o seletor aceita PDF, PNG, JPG/JPEG, WEBP, DOC e DOCX.
- Salvar requer Tipo preenchido e fica bloqueado durante upload. Um cadastro pode existir sem arquivo.
- O acesso ao arquivo é obtido por URL assinada após validação no servidor, não por endereço público permanente.
- Ao salvar, validade passada define Vencido; validade nos próximos 30 dias define A vencer. Não há comprovação aqui de notificação externa nem de recálculo diário automático.

## Erros comuns
- "Arquivo maior que 20 MB": reduza o tamanho e tente novamente.
- "Falha no upload": confira o arquivo e tente de novo; não considere o anexo concluído antes da confirmação.
- Visualizar ou Baixar indisponível: confira a existência do arquivo e a permissão do documento.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)
