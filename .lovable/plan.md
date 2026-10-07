# Fazer a visualização do canvas se mover (arrastar e trackpad)

## Problema
No canvas dos protótipos (1, 2 e 3, inclusive na etapa Fluxo do wizard), dá para mover os blocos, mas não a visualização.

## Causa (conferida em `flow.tsx`)
- O arraste da visualização só começa quando o clique cai exatamente no fundo do canvas. Quase toda a área visível é coberta pela camada interna do desenho (`ap-canvas-world`) e pelas linhas, então o clique cai nelas e é ignorado.
- Não há nenhum tratamento de rolagem/trackpad (evento `wheel`), por isso o gesto de dois dedos não faz nada.
- O arraste também não encerra em `pointercancel` e não libera a captura do ponteiro.

## Correção (só no protótipo, `src/components/agents/prototypes/flow.tsx` + CSS)
1. Arrastar a visualização ao clicar em qualquer área vazia: começa o arraste exceto quando o alvo está dentro de um bloco, botão, minimapa ou barra de ferramentas (`closest('.ap-node, button, .ap-minimap, .ap-flow-tools')`). Cursor `grab`/`grabbing` e `touch-action: none` no canvas.
2. Trackpad/roda: listener `wheel` nativo com `passive: false` e `preventDefault`:
   - dois dedos (deltaX/deltaY) movem a visualização;
   - pinça ou Ctrl/Cmd + roda aplica zoom centrado no ponteiro (limites 0,2–1,5).
3. Encerrar arraste em `pointerup`/`pointercancel`, liberando a captura.
4. Teclado: setas movem a visualização quando o canvas está focado (acessibilidade).

## Verificação
Playwright nas três rotas, incluindo a etapa Fluxo do wizard: arrastar o fundo e simular `mouse.wheel` e altera o deslocamento; arrastar bloco continua movendo só o bloco; screenshots antes/depois inspecionadas. Lint direcionado e testes do protótipo.
