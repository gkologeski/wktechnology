---
module_key: contracts
slug: importar-modelo
title: Importar um modelo de contrato
summary: Importar um modelo de contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/templates
min_permission:
audience: internal
sort_order: 62
version: 3
is_published: true
---
# Importar um modelo de contrato
**Para que serve:** Importar um modelo de contrato.
**Quem pode fazer:** Criação de techcontracts.contract_templates.
**Onde fica:** TechContracts > Contratos (/contracts/templates).
**Antes de começar:** Arquivo PDF ou DOCX com texto legível.

## Passo a passo
1. Clique em "Importar modelo".
2. Informe um nome se desejar.
3. Selecione o arquivo PDF ou DOCX.
4. Aguarde a extração e a sugestão de variáveis.
5. Abra o rascunho criado e revise seu conteúdo antes de publicar.
![Tela: Importar um modelo de contrato, sem dados pessoais reais](/help-media/contracts/importar-modelo.webp)

## Resultado esperado
"Modelo criado como rascunho. Revise as variáveis sugeridas."

## Regras e limites
- PDF: até 15 MB. DOCX: até 10 MB.
- A formatação original é preservada: títulos, alinhamento (centralizado/justificado), recuos, espaçamento, negrito/itálico/sublinhado, tamanho da fonte, numeração das cláusulas e tabelas.
- No .docx o texto é mantido exatamente como no arquivo; a IA apenas troca os dados das partes por variáveis. Trechos que não puderam ser trocados aparecem na descrição do rascunho.
- No PDF a formatação é reproduzida pela IA (melhor esforço); prefira o .docx para maior fidelidade.
- Não são importados: família da fonte, cabeçalho/rodapé, imagens/logos e quebras de página.
- Modelos já importados não mudam; importe novamente para obter a formatação.
- A importação não publica o modelo. Sugestões de variáveis exigem revisão humana.

## Erros comuns
"Formato não suportado. Envie .pdf ou .docx.": converta o arquivo.
"Não foi possível extrair o texto do .docx.": revise o documento de origem.

## Relacionados
- [Editar e publicar modelo](/ajuda/contracts/editar-publicar-modelo)
