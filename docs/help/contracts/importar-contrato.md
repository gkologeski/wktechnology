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
version: 8
is_published: true
---
# Importar e revisar um contrato PDF ou DOCX
**Para que serve:** Importar e revisar um contrato PDF ou DOCX.
**Quem pode fazer:** Gerenciamento de techcontracts.imports; finalizar exige atualização do contrato criado.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** PDF até 15 MB ou DOCX até 10 MB com texto legível.

## Passo a passo
1. Clique em "Importar contrato" e escolha o tipo: "Documento em elaboração" ou "Contrato legado / já formalizado". A escolha é obrigatória antes de extrair.
1. Para legado, informe o motivo (mínimo 5 caracteres) e selecione o arquivo.
2. Revise a opção de guardar o original; use "Visualizar contrato" se desejar.
3. Clique em "Extrair com IA".
4. Revise os campos extraídos no rascunho.
5. Clique em "Finalizar" para atualizar o rascunho e abrir a ficha.
![Tela: Importar e revisar um contrato PDF ou DOCX, sem dados pessoais reais](/help-media/contracts/importar-contrato.webp)

## Resultado esperado
Rascunho criado na extração e atualizado após a finalização.

## Regras e limites
- O texto do arquivo preenche o corpo do contrato: DOCX mantém a formatação; PDF vira parágrafos simples (PDF digitalizado, sem texto, deixa o corpo em branco). Revise o corpo antes de enviar.
- O texto do PDF é lido no servidor, junto com a leitura pela IA, sem depender do navegador. Se não for possível, o aviso explica o motivo (por exemplo, PDF digitalizado sem texto).
- Rascunho importado com o corpo vazio: na aba Documento, use "Carregar corpo do arquivo original" para ler o arquivo guardado e preencher o corpo, sem importar de novo. Só aparece em rascunhos com o arquivo original e exige permissão de edição do contrato.
- A extração exige permissão de gerenciamento de importações; o diálogo bloqueia a chamada quando o acesso está ausente. As verificações do servidor e do banco continuam obrigatórias.
- O rascunho é criado antes da revisão. Cancelar ou fechar não o apaga.
- "Voltar" retorna ao upload; não é desfazer a criação.
- DOCX precisa ter pelo menos 20 caracteres de texto extraído.
- Falha ao guardar o original pode permitir continuar com aviso; não é transação única.
- Extração por IA exige revisão e pode falhar por créditos, limites ou conteúdo inválido.
- Conseguir importar não garante permissão para finalizar a atualização.

## Erros comuns
"Formato não suportado. Use .pdf ou .docx.": converta o arquivo.
"Rascunho salvo em Contratos. Você pode retomar quando quiser.": confira o rascunho antes de repetir a importação.

## Relacionados
- [Importar em lote](/ajuda/contracts/importar-em-lote)
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)

> Provedor e identificadores de assinatura lidos do arquivo são apenas referência extraída, a conferir. Nunca comprovam assinatura; a revisão da importação não os grava como assinatura ativa.

> Se o texto do arquivo for muito longo, o corpo é truncado com um aviso; se não puder ser lido ou gravado, o rascunho é criado mesmo assim e o arquivo original continua disponível. Mensagens de erro indicam a etapa que falhou (IA, envio do arquivo, leitura ou gravação).

## Contrato legado / já formalizado
- Use para contratos assinados fora do sistema. Não pede cotação, proposta, minuta nem nova assinatura e não libera cobranças.
- Exige permissão para importar contratos, criar, ver e editar contratos e reconhecer contrato legado. Sem alguma delas, a opção aparece desabilitada com o que falta.
- O original é guardado obrigatoriamente. Se o envio do arquivo falhar, nada é criado.
- Nada é gravado antes da revisão: depois de extrair, revise os campos e clique em "Criar contrato legado pendente". O contrato fica pendente de regularização.
- Se a criação falhar, use "Tentar novamente": a mesma tentativa e o mesmo arquivo são reaproveitados, sem duplicar. Não há nova tentativa automática nem gravação sem corpo.
- Se a tela avisar que o reconhecimento não foi confirmado, abra a ficha e confira; não reimporte.
- A regularização (PDF original assinado, situação, datas e confirmação humana) é feita na ficha. Veja [Regularizar contrato legado](/ajuda/contracts/regularizar-contrato-legado).

## Documento em elaboração
- O rascunho é gravado logo após a extração. Se a gravação falhar, "Tentar novamente" reaproveita a mesma tentativa; "Gravar sem o corpo" só ocorre quando você escolhe.
