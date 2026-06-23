## Problema

O painel de Associações ficou apertado e visualmente quebrado:

- Nomes truncados muito cedo ("LRB S...", "Leand...") porque avatar + nome + 2 ícones disputam ~260px.
- Labels longos ("Nome de domínio da empresa:", "Número de telefone:") quebram em 2 linhas e empurram o valor para fora — o ícone de copiar aparece sozinho na linha seguinte.
- "Adicionar rótulo de associação" em vermelho, centralizado e quebrado em 3 linhas parece um erro, não uma ação secundária.
- Badge "Principal" ocupa uma linha inteira logo abaixo do nome.
- Ações (olho + "...") competem com o nome em vez de ficarem discretas.
- Rodapé "Exibir todas as Empresas associadas" aparece cortado contra a borda do card.

## Redesign proposto (somente `src/components/record/associations-panel.tsx`)

Reorganizar cada card de entidade associada num layout vertical limpo, ao estilo HubSpot/Attio, sem mudar dados nem lógica de fetch.

**1. Cabeçalho do card**
- Linha 1: avatar (32px, `shrink-0`) + nome em `font-medium` com `truncate` ocupando `min-w-0 flex-1` + ações compactas (olho, "...") como `ghost icon-sm`, só visíveis em `group-hover` para reduzir ruído.
- Linha 2 (logo abaixo do nome, recuada à altura do texto): badge "Principal" como `Badge variant="secondary"` pequeno (`text-[10px]`), inline, sem ocupar linha cheia.
- Cargo/empresa do contato em `text-xs text-muted-foreground truncate` logo abaixo.

**2. Detalhes (DetailRow refeito)**
- Trocar layout label-em-cima/valor-ao-lado por **label discreto + valor em destaque empilhados**:
  ```
  E-MAIL
  comercial@z3ttagroup.com.br        [copy]
  ```
- Label: `text-[10px] uppercase tracking-wide text-muted-foreground`.
- Valor: `text-sm text-foreground truncate` + botão copy `icon-xs ghost` à direita, alinhado por `flex items-center justify-between gap-2`.
- Encurtar labels: "Domínio" (em vez de "Nome de domínio da empresa"), "Telefone", "Celular", "E-mail".
- Esconder linhas com valor vazio em vez de mostrar "—" (reduz altura morta).

**3. Rótulo de associação**
- Substituir o link vermelho centralizado por um botão `ghost size="sm"` discreto, alinhado à esquerda, com ícone `Tag` + texto "Adicionar rótulo" em `text-xs text-muted-foreground`. Sem cor vermelha.

**4. Rodapé "Exibir todos"**
- Mover para fora do card de item, como link único da seção, alinhado à esquerda com ícone `ArrowRight` pequeno, `text-xs text-primary hover:underline`. Sem borda, sem ocupar largura total cortada.

**5. Densidade e espaçamento**
- Padding do card: `p-3` (era apertado demais com ações dentro).
- Separador `border-t border-border/50` entre header e details.
- `space-y-2` entre DetailRows.
- `group` no card raiz para revelar ações no hover.

**6. Tokens**
- Usar apenas tokens semânticos (`text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`, `bg-card`). Remover qualquer cor vermelha hardcoded dos labels/ações.

## Fora do escopo

- Lógica de fetch, queries Supabase, mutations de unlink, navegação — intocados.
- Layout do `RecordLayout` e dos outros painéis (Sobre, Timeline, Hierarquia) — intocados.

## Validação

Após o build, abrir `/deals/...`, `/contacts/...` e `/companies/...` e confirmar:
- Nomes "LRB Solution" e "Leandro Borges" aparecem inteiros (ou truncam apenas em telas muito estreitas).
- Labels não quebram em 2 linhas; valor + copy ficam na mesma linha.
- "Adicionar rótulo" some do destaque vermelho.
- Ações (olho/menu) aparecem só no hover do card.
- "Exibir todos os Contatos associados" cabe na largura sem cortar.
