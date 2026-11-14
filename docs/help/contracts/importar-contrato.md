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
version: 6
is_published: true
---
# Importar e revisar um contrato PDF ou DOCX
**Para que serve:** Importar e revisar um contrato PDF ou DOCX.
**Quem pode fazer:** Gerenciamento de techcontracts.imports; finalizar exige atualização do contrato criado.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** PDF até 15 MB ou DOCX até 10 MB com texto legível.

## Passo a passo
1. Clique em "Importar contrato" e selecione o arquivo.
2. Revise a opção de guardar o original; use "Visualizar contrato" se desejar.
3. Clique em "Extrair com IA".
4. Revise os campos extraídos no rascunho.
5. Clique em "Finalizar" para atualizar o rascunho e abrir a ficha.
![Tela: Importar e revisar um contrato PDF ou DOCX, sem dados pessoais reais](/help-media/contracts/importar-contrato.webp)

## Resultado esperado
Rascunho criado na extração e atualizado após a finalização.

## Regras e limites
- O texto do arquivo preenche o corpo do contrato: DOCX mantém a formatação; PDF vira parágrafos simples (PDF digitalizado, sem texto, deixa o corpo em branco). Revise o corpo antes de enviar.
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

> Dados de assinatura eletrônica (provedor e identificadores) lidos do arquivo não são gravados na importação: eles só são preenchidos pelo próprio fluxo de assinatura do sistema.

> Se o texto do arquivo for muito longo, o corpo é truncado com um aviso; se não puder ser lido ou gravado, o rascunho é criado mesmo assim e o arquivo original continua disponível. Mensagens de erro indicam a etapa que falhou (IA, envio do arquivo, leitura ou gravação).
