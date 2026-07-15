## Objetivo

Garantir que o PDF da cotação seja gerado obrigatoriamente em **1 única página A4 paisagem**, mesmo quando o template público tiver altura maior, animações ou regras de layout pensadas para tela.

## Plano

1. **Manter o template público intacto**
   - Não alterar o HTML salvo pelo usuário nem a visualização pública da proposta.
   - Aplicar os ajustes apenas no endpoint de PDF.

2. **Medir e compactar o conteúdo antes da impressão**
   - Injetar um script no HTML usado pelo Browserless para calcular o tamanho real do conteúdo renderizado.
   - Aplicar uma escala automática no container principal para caber dentro da área útil de uma página A4 paisagem.
   - Usar `transform: scale(...)` com origem no topo/esquerda e travar largura/altura do documento para evitar que o Chromium crie uma segunda página.

3. **Forçar geometria de página única**
   - Definir `@page { size: A4 landscape; margin: 0 }`.
   - Definir `html`, `body` e o wrapper do PDF com dimensões fixas equivalentes à página A4 paisagem.
   - Bloquear overflow vertical no documento de impressão para impedir paginação extra.

4. **Preservar legibilidade e layout**
   - Limitar a escala mínima para evitar texto excessivamente pequeno.
   - Caso o conteúdo seja muito grande para caber com boa legibilidade, ainda gerar 1 página como solicitado, priorizando a regra obrigatória de página única.
   - Manter `printBackground`, `landscape`, viewport desktop e `emulateMediaType: "screen"`.

5. **Validar a saída**
   - Gerar novamente um PDF de cotação real.
   - Conferir que o arquivo tem exatamente 1 página.
   - Conferir visualmente que os serviços/produtos, totais, observações e rodapé aparecem na mesma página.

## Arquivo esperado

- `src/routes/api/public/quotes/$token.pdf.ts`

## Fora do escopo

- Editar o template de proposta salvo no banco.
- Trocar o provedor de geração de PDF.
- Alterar regras de cotação, produtos, totais ou permissões.