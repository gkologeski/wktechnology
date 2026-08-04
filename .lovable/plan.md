# Corrigir modais que cortam o conteúdo

## Diagnóstico confirmado

O componente base `DialogContent` (`src/components/ui/dialog.tsx`) é um `grid` centralizado com `w-full max-w-lg max-h-[90vh] overflow-y-auto`, sem:

- limite de largura relativo à janela (não há `max-w-[calc(100vw-2rem)]`), então em telas menores que o `max-w-*` escolhido pelo modal (por exemplo `max-w-3xl`, `max-w-4xl`) o modal fica mais largo que a viewport e as bordas ficam fora da tela (é o que aparece na captura: rótulos cortados à esquerda e barra horizontal);
- coluna de grid que pode encolher (falta `grid-cols-[minmax(0,1fr)]` / `min-w-0`), então qualquer filho indivisível (URL longa, tabela, editor rich text, listas de pills) estica a faixa do grid além do `max-width` e força corte horizontal;
- rolagem apenas vertical no container inteiro, o que faz cabeçalho/rodapé com margens negativas (`-mx-7`) rolarem junto e reforçarem o transbordo lateral.

Três modais também usam `overflow-hidden` no `DialogContent` (visualizadores de documento/contrato e a paleta de comandos), o que corta conteúdo em vez de rolar.

## O que será feito

1. **Corrigir a base (uma alteração resolve a maioria dos casos)** em `src/components/ui/dialog.tsx`:
   - largura limitada à janela: `w-[calc(100%-2rem)] max-w-lg` + `max-w-[calc(100vw-2rem)]`;
   - coluna do grid encolhível (`grid-cols-[minmax(0,1fr)]`) para o conteúdo truncar/quebrar em vez de estourar;
   - altura segura em telas baixas e mobile (`max-h-[calc(100dvh-2rem)]`), mantendo `overflow-y-auto`;
   - impedir transbordo lateral (`overflow-x-hidden`) e permitir quebra de textos longos (URLs) com `break-words` nos blocos de texto do modal.

2. **Auditoria dos modais com classes próprias** (155 arquivos usam `DialogContent`; ~20 sobrescrevem largura/altura):
   - remover `max-h-[90vh] overflow-y-auto` redundantes onde já vêm da base;
   - nos modais largos (`max-w-3xl/4xl/5xl+`) garantir que o `max-w` continue respeitando a janela;
   - nos visualizadores de documento e contrato (`document-viewer-dialog.tsx`, `contract-file-viewer-dialog.tsx`), trocar o `overflow-hidden` externo por área interna com rolagem, preservando o layout `p-0`;
   - `command.tsx` mantém `overflow-hidden` (é o comportamento correto da paleta), apenas com a largura já limitada pela base.

3. **Casos de conteúdo largo dentro do modal**: adicionar `min-w-0` nos contêineres flex/grid e rolagem horizontal apenas onde faz sentido (tabelas, pré-visualização de documento, editor de HTML), em vez de deixar o modal crescer.

4. **Verificação visual**: revisar os modais de maior risco em 1280px e em largura mobile — envio de e-mail (o da captura), cotação/proposta, importação de contrato, visualizadores de arquivo, construtor de workflow/sequência, busca de prospects, formulários e onboarding em Configurações — confirmando que nada fica fora da tela e que a rolagem aparece dentro do modal.

## Detalhes técnicos

- Alteração principal em `src/components/ui/dialog.tsx` (`DialogContent`, `DialogHeader`, `DialogFooter`), sem mudar API nem props.
- Ajustes pontuais de classe (`min-w-0`, `break-words`, `overflow-auto` interno) nos modais listados; sem alteração de lógica, dados, RLS ou regras de negócio.
- Somente tokens e utilitários já usados no projeto; nada de cores ou tamanhos avulsos.
- Validação: `tsgo --noEmit` e inspeção visual dos modais críticos em desktop e mobile, em tema claro e escuro.
