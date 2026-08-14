Ocultar botão de timer e aplicar transparência hover nos botões flutuantes de Mensageiro e I.A.

## Escopo

- Ocultar o botão flutuante de timer (`TimerWidget`) em todas as telas autenticadas, mantendo o componente disponível para reativação futura.
- Aplicar 90% de transparência (opacity 10%) nos botões flutuantes de Mensageiro (`ChatTrigger`) e I.A. (`AgentTrigger`), tornando-os 100% opacos apenas no mouse-over (`hover`), com transição suave.

## Arquivos a alterar

- `src/routes/_authenticated.tsx`
- `src/components/chat/chat-trigger.tsx`
- `src/components/ai-agent/agent-trigger.tsx`

## Abordagem técnica

- `TimerWidget`: adicionar uma constante local `showTimer = false` (com comentário explicativo) e envolver a renderização `<TimerWidget />` nessa condição no layout autenticado. Não remover o componente nem seu import, para facilitar reativação futura.
- `ChatTrigger` e `AgentTrigger`: adicionar classes Tailwind `opacity-10 hover:opacity-100 transition-opacity duration-200` no botão flutuante. Garantir que o tooltip/aria-label permaneçam acessíveis e que o badge de não lidas no mensageiro continue visível no hover.
- Preservar posições fixas, z-index e dimensões atuais.

## Fora do escopo

- Nenhuma alteração de funcionalidade, rotas, permissões, RLS, banco de dados ou server functions.
- Não alterar o `BugReportButton`, `GlobalSearch` ou outros botões flutuantes.

## Validação

- Executar `typecheck` para garantir que as alterações de TypeScript estejam corretas.
- Verificar visualmente na preview que:
  - o botão de timer não é exibido;
  - os botões de Mensageiro e I.A. aparecem com 10% de opacidade;
  - ao passar o mouse, ambos ficam 100% opacos.
