# Agrupar as pills de variáveis por entidade

Hoje as pills de variáveis aparecem em uma faixa contínua, separadas apenas por uma barra vertical fina. Como grupos diferentes têm campos com o mesmo rótulo (três pills "Nome": do registro, da Empresa e do Contato principal), não há como saber a que entidade cada uma pertence.

## O que muda

No bloco de variáveis abaixo dos campos de texto:

- Cada grupo passa a ser um bloco próprio, empilhado verticalmente.
- Acima das pills do grupo aparece o nome do grupo/entidade (ex.: "Registro", "Empresa (do gatilho)", "Contato principal (do gatilho)", "Passos anteriores", "Variáveis do fluxo"), com a mesma formatação tipográfica do rótulo "Variáveis:" atual (mesmo tamanho, peso e cor suave).
- Após as pills de cada grupo, uma linha horizontal separa o bloco do próximo; o último grupo não recebe linha.
- O rótulo "Variáveis:" continua no topo, como cabeçalho do conjunto.
- As barras verticais entre grupos deixam de exister.
- Pills sem grupo definido continuam funcionando, renderizadas sem cabeçalho.

Comportamento de clique/inserção, tooltips com o token cru, foco visível e acessibilidade permanecem iguais.

## Detalhes técnicos

- `src/components/ui/token-pills.tsx`: trocar o layout de uma linha (`flex flex-wrap` único) por uma coluna de grupos; cada grupo com cabeçalho de texto e `border-b` (via classe de token semântico `border-border`) exceto o último. Usar apenas tokens semânticos existentes, sem cores avulsas.
- Nenhuma alteração em catálogos de tokens, no motor de workflows, em schema, RLS ou regra de negócio. Como o componente é compartilhado (workflows, e-mail, WhatsApp, ATS), o novo agrupamento vale para todas as superfícies que já usam grupos.

## Como validar

1. Em `/settings/workflows`, abrir um passo "criar Contrato" com gatilho em Negócios e conferir os blocos "Registro", "Empresa (do gatilho)" e "Contato principal (do gatilho)" com títulos e linhas separadoras.
2. Clicar em uma pill de cada bloco e confirmar que o token correto é inserido no cursor.
3. Conferir light/dark mode e responsividade em largura estreita.
