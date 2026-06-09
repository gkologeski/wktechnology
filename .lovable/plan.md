## Objetivo

Padronizar a navegação do app com a direção escolhida (painéis arredondados com leve glass, busca no topo, agrupamento em cards com cabeçalho de seção, item ativo destacado e ícones em cada item) — aplicando a mesma linguagem nas duas sidebars: principal do app e Configurações.

## Mudanças

### 1. Sidebar principal (`src/components/app-sidebar.tsx`)

- Manter shadcn `Sidebar collapsible="icon"` (não quebra rotas nem o trigger).
- Estilizar o container com cantos arredondados (`rounded-3xl`), borda sutil e sombra suave (m-2 para destacar do fundo).
- Header: bloco da marca WK + campo de busca (já existe `global-search-trigger` — reaproveitar como botão de busca).
- Grupos (`Trabalhar`, `Analisar`, `Engajar`): título uppercase em `text-[10px] font-bold tracking-widest text-muted-foreground`.
- Itens (`SidebarMenuButton`): adicionar ícone lucide à esquerda, label, e quando ativo: fundo `bg-primary/10`, texto `text-primary font-semibold` e barra vertical `w-1.5 h-6 bg-primary rounded-full` à direita.
- Rodapé fixo com cartão de perfil clicável (avatar + nome + papel) levando ao menu da conta.

### 2. Layout de Configurações (`src/routes/_authenticated/settings.tsx`)

- Reagrupar as 7 seções atuais em 3 grandes blocos coerentes com a direção escolhida:
  - **Minha conta** → Perfil, Conexão de email, Segurança (2FA).
  - **Organização** → Workspace + Estrutura CRM + Automação (cada subseção renderizada como sub-cabeçalho dentro do mesmo card).
  - **Gestão** → Pessoas & Acesso, Segurança, Integrações.
- Cada bloco vira um `<section>` com cabeçalho uppercase + um card `bg-card border rounded-2xl p-3 shadow-sm` contendo os links.
- Topo da sidebar: título "Configurações" com ícone de engrenagem + subtítulo + `Input` de busca que filtra os itens por label (filtragem client-side em estado local).
- Item ativo: `bg-muted/60 border border-border shadow-sm text-primary`. Itens normais: ícone cinza que muda para `text-primary` no hover.
- Cada link recebe um ícone lucide adequado (mapa nome→ícone definido no próprio arquivo).
- Manter o `Select` mobile com a mesma reorganização (3 grupos).

### 3. Tokens / estilo

- Não introduzir cores novas — usar tokens existentes (`--primary`, `--muted`, `--border`, `--card`, `--card-foreground`).
- Reaproveitar fonte atual (Inter já carregada via `<link>` em `__root.tsx`). Nenhuma alteração em `src/styles.css`.

## Detalhes técnicos

- Arquivos editados:
  - `src/components/app-sidebar.tsx` — reestilizar header/itens/footer; adicionar ícones nos itens existentes; manter rotas e permissões.
  - `src/routes/_authenticated/settings.tsx` — substituir o array `sections` por um modelo com `icon` por tab; redesenhar render do sidebar desktop; adicionar estado de busca; manter `Select` mobile.
- Sem mudanças de backend, rotas, RLS ou dados. Sem novas dependências (lucide e shadcn já em uso).
- Sem alteração nas demais páginas; apenas os dois componentes acima.

## Fora de escopo

- Não recolher/abrir grupos como accordion (a direção escolhida mantém todos abertos).
- Não criar sistema de favoritos fixáveis.
- Não mexer em outras rotas, no editor de cotação, ou em estilo global.
