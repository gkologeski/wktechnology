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
version: 6
is_published: true
---
# Editar a ficha de um contrato
**Para que serve:** Editar a ficha de um contrato.
**Quem pode fazer:** Leitura e capacidade de atualização de techcontracts.contracts para o registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Abrir o contrato correto e conferir a versão salva.

## Etapas e próximo passo
No topo da ficha aparecem as etapas (Rascunho → Revisão e aprovação → Assinatura → Ativo → Renovação ou encerramento) e o quadro "Próximo passo", com a ação principal da situação atual:
- Rascunho: "Enviar para aprovação" — liberado quando vigência, valor total e corpo estão preenchidos; abre a aba "Aprovações e assinatura".
- Em revisão: "Ver aprovações pendentes".
- Aguardando assinatura: "Acompanhar assinatura"; "Ativar contrato" exige a permissão de ativação.
- Ativo: "Registrar medição" ou "Adicionar aditivo"; a 30 dias do término, "Renovar".
Botões desabilitados mostram o motivo (ex.: "Sem permissão"). Fluxo do contrato, Medições, Visualizar arquivo original e Excluir ficam em "Mais ações".

## Passo a passo
1. Abra o contrato pela lista. O conteúdo fica nas abas Visão geral, Documento, Aprovações e assinatura, Aditivos e vínculos e Histórico.
2. Edite "Título", "Tipo", "Tipo de documento", "Contrato principal" quando for aditivo, e "Valor total".
3. Revise "Início", "Fim", "Renovação automática" e "Aviso prévio (dias)".
4. Na aba "Documento", em "Cláusulas / corpo do contrato", edite o texto no editor formatado (negrito, alinhamento, listas e tabelas), com rolagem própria; clique em Salvar para gravar.
5. Clique em "Salvar" e aguarde "Contrato atualizado.".
6. Use "Mais ações" › "Visualizar arquivo original" para abrir o arquivo original quando essa ação estiver disponível.
![Tela: Editar a ficha de um contrato, sem dados pessoais reais](/help-media/contracts/editar-contrato.webp)

## Anexos do contrato
Na aba Documento, use **Anexos do contrato**. Escolha uma cotação ou proposta do mesmo negócio e clique em **Vincular documento**, ou use **Enviar arquivo** para um PDF, DOCX, XLSX, JPG, PNG ou TXT de até 20 MB. É possível incluir vários anexos, um de cada vez.

Antes da preparação, os vínculos comerciais exibem o documento atual da origem; depois, **Ver cópia anexada** abre o PDF congelado. Os dois casos exigem leitura desse documento além da leitura do contrato. Arquivos enviados ficam privados. Para incluir ou remover anexos é necessário poder atualizar o contrato. Remover o vínculo não exclui a cotação/proposta original.

Todos os anexos acompanham o contrato na assinatura nativa e no ForSign. Na preparação é gerado um pacote PDF com o contrato, os anexos e o manifesto de integridade; essa cópia fica congelada. O signatário da assinatura nativa recebe acesso ao PDF completo no mesmo link de assinatura. No ForSign, o PDF completo é enviado como documento da operação.

Use **Baixar prévia para assinatura** para conferir o conteúdo antes de enviar; a ação exige também a permissão de gerenciar evidências de assinatura. DOCX e XLSX são convertidos para PDF pelo serviço de conversão; PDFs protegidos ou arquivos que não puderem ser convertidos bloqueiam o envio, sem omitir anexos. Limites: até 30 anexos, 50 MB no total e 2.000 páginas por pacote.

Adicionar/remover anexos muda a versão do contrato para assinatura e exige uma nova preparação. A prévia/preparação congela também o PDF de cada cotação e proposta vinculada: alterações futuras na origem não modificam essa cópia nem invalidam o contrato assinado. Para incluir uma revisão posterior, remova o vínculo e selecione o documento novamente antes de preparar a nova assinatura. Pacotes já enviados permanecem imutáveis. Cotações/propostas de origem não são alteradas nem publicadas ao serem vinculadas.

## Resultado esperado
Alterações persistidas na ficha.

## Regras e limites
- O editor formatado grava o corpo em HTML.
- "Detalhes extraídos" exibe informações disponíveis em leitura; não torna todos os campos extraídos editáveis.
- Campos alterados localmente só são gravados após salvar.
- Conteúdo, partes e condições alterados podem exigir nova evidência de assinatura.
- Status e aprovação têm regras próprias.

## Erros comuns
"Contrato não encontrado.": use "Voltar". Salvar desabilitado: confira acesso, gravação em andamento ou principal ausente no aditivo.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)
