# Aba recolhível na lateral direita (Conversa, IA, Chamado)

Porte: P/M · Estimativa: ~40 min.

## O que muda
- Os três botões redondos do canto inferior direito (Mensageiro, Assistente IA, Abrir chamado) somem dali. Também sai o timer, que fica perto deles. Assim nada mais cobre os botões das telas.
- No lugar entra uma **aba fina e vertical presa à borda direita**, no meio da altura da tela, com cerca de 28 px de largura. Ela mostra só um ícone de seta e, se houver mensagens não lidas, um número vermelho.
- Ao clicar, a aba abre um pequeno painel vertical colado à borda, no estilo da barra do LinkedIn. Cada uma das 3 opções aparece com ícone e nome:
  - **Mensagens**, com o contador de não lidas;
  - **Assistente IA**;
  - **Abrir chamado**.
- Escolher uma opção abre a mesma janela de hoje e recolhe a aba. A aba também fecha ao clicar fora, ao apertar Esc ou ao clicar de novo nela.
- A aba fica sempre visível, sem a transparência atual que deixava os botões quase invisíveis.
- Os atalhos de teclado continuam funcionando, e quem não tem acesso ao mensageiro não vê essa opção.
- No celular, a aba fica na mesma posição.

## Fora do escopo
O comportamento das janelas de Mensagens, IA e Chamado não muda. O timer continua onde está.

## Detalhes técnicos
- Novo `src/components/floating-dock/side-dock.tsx`: aba `fixed right-0 top-1/2 -translate-y-1/2 z-50`, com o painel usando tokens semânticos (`bg-card`, `border`, `shadow`), `aria-expanded` e foco visível.
- Os componentes `ChatTrigger`, `AgentTrigger` e `BugReportButton` deixam de desenhar o botão próprio e passam a expor só o estado de abrir/fechar e o drawer/dialog. O dock chama cada um por um pequeno contexto (`SideDockProvider`), preservando a permissão do chat e a contagem de não lidos.
- O `AgentTrigger` hoje é montado em `__root.tsx` e os outros dois em `_authenticated.tsx`. Unificar a renderização da aba no layout autenticado e manter o atalho global da IA.
- O hash dos contratos de permissão dos arquivos tocados é atualizado. Depois: `permissions:check`, eslint e teste no navegador (abrir a aba e cada uma das 3 opções).
