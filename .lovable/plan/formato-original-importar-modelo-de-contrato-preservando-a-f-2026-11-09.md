# FORMATO-ORIGINAL — Importar modelo de contrato preservando a formatação

Porte M · estimativa 2–3 h (inclui testes e artigo da Ajuda; publicação depois de validar)

## Problema (confirmado no código)
1. O arquivo .docx é convertido com a configuração padrão do leitor de Word, que descarta alinhamento (centralizado/justificado), recuos, espaçamento, tamanhos de fonte e estilos de título personalizados.
2. A instrução da IA proíbe qualquer atributo de estilo e pede "HTML simples e limpo" — então mesmo o que sobra é reescrito sem formatação.
3. No PDF, a IA recebe só o conteúdo e reconstrói o texto, sem orientação de layout.

## O que muda
- **Word (.docx):** a conversão passa a ler, parágrafo a parágrafo, alinhamento, recuo de primeira linha/esquerda, espaçamento, negrito/itálico/sublinhado, tamanho de fonte, títulos personalizados, listas numeradas (com numeração original) e tabelas com bordas. Isso vira HTML com estilos seguros.
- **IA só troca dados por variáveis:** para .docx, a IA deixa de reescrever o documento; recebe o HTML já formatado e devolve apenas a lista de substituições (trecho original → variável). O sistema aplica as trocas no HTML preservado. Resultado: formatação 100% do original e menor risco de perder cláusulas.
- **PDF:** a IA passa a ser instruída a reproduzir alinhamento, títulos, numeração e tabelas com o mesmo conjunto de estilos seguros (melhor esforço — PDF não guarda estrutura como o Word). O diálogo avisa que .docx dá fidelidade maior.
- **Segurança:** um filtro mantém apenas estilos permitidos (text-align, margin/padding, text-indent, line-height, font-size, font-weight, font-style, text-decoration, border em tabelas) e remove scripts, eventos e qualquer outro atributo.
- **Editor, visualização e PDF do contrato:** garantir que esses estilos permitidos não sejam descartados ao abrir/editar o modelo nem ao gerar o contrato/PDF (verificar e ajustar o sanitizador usado por eles).
- Modelos já importados não são alterados; basta reimportar para obter a formatação.

## Fora do escopo
Fontes específicas (família), cabeçalho/rodapé, imagens/logos e quebras de página do Word — podem entrar numa segunda entrega se desejado.

## Detalhes técnicos
- `import-contract-template-dialog.tsx`: `mammoth.convertToHtml` com `styleMap` + leitura direta do `document.xml` (JSZip já disponível via mammoth) para `w:jc`, `w:ind`, `w:spacing`, `w:sz`, numeração; ou `transformDocument` para preservar `alignment`.
- `template-import.server.ts`: novo modo "tokenize" (entrada HTML, saída `suggestions`) + aplicação determinística das substituições com escape; prompt do PDF atualizado.
- Novo `src/lib/contracts/template-html-sanitize.ts` (allowlist de tags/estilos) + testes Vitest (preserva alinhamento/recuo; remove `onclick`, `<script>`, `url()`/`expression`).
- Permissões: reutiliza `techcontracts.contract_templates.create.*` (mesma ação); atualizar hashes em `permission-contracts.json`, sem regenerar baseline.
- Ajuda: atualizar artigo de importação de modelos (bump de versão) + catálogo oficial.
- Validação: testes, `permissions:check`, `help:coverage`, Playwright importando um .docx de exemplo com texto centralizado/justificado e conferindo o preview.
