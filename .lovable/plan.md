## Problema

Na sidebar atual, **Inbox unificada**, **Inbox de Email**, **Inbox de WhatsApp** e **Chat ao vivo** aparecem como itens irmãos no mesmo nível visual. Não existe pista de que os 3 últimos são canais que alimentam a Inbox unificada — todos parecem rotas independentes. O destaque vermelho do "ativo" piora a leitura, porque dois itens podem ficar vermelhos ao mesmo tempo (pai + filho) sem relação visível.

Mesmo padrão se repete em outros grupos: **Calendários/Agendamentos** sob Reuniões, **Campanhas Email/WhatsApp** soltas em Captar, **Filas de tarefas** sob Tarefas, etc. A solução de hierarquia deve servir para todos.

## 3 Propostas

### Proposta A — Submenu recolhível (disclosure clássico)

Item pai ganha um chevron (`›` → `⌄`). Ao clicar, expande os filhos indentados com uma guia vertical fina à esquerda.

```text
📥 Inbox                      ⌄
 │  ✉  Email
 │  💬 WhatsApp
 │  💭 Chat ao vivo
📅 Reuniões                   ›
```

- Pai vira agrupador (rota = primeiro filho, ou a "unificada").
- Estado expandido persiste por grupo; abre automaticamente se a rota ativa for filha.
- Ativo: só **um** item destacado por vez (o filho). Pai recebe marcador discreto ("●" no chevron) quando algum filho está ativo.
- **Prós:** padrão universal (VSCode, Gmail, Linear), economiza espaço, escala para 5+ filhos.
- **Contras:** 1 clique a mais para chegar nos canais; precisa lógica de auto-expand.

### Proposta B — Seção indentada sempre visível com guia vertical

Filhos ficam **sempre** visíveis, indentados sob o pai, conectados por uma linha vertical sutil (`border-l`) — sem clique para expandir.

```text
📥 Inbox unificada
   │ ✉  Email
   │ 💬 WhatsApp
   │ 💭 Chat ao vivo
📅 Reuniões
   │ 🗓 Calendários
   │ 📆 Agendamentos
```

- Pai é clicável (rota própria, ex: `/inbox`).
- Indent de ~16px + `border-l border-border/60` + tipografia ligeiramente menor nos filhos (`text-[13px] text-muted-foreground`).
- Ativo: filho ganha destaque cheio; pai ganha um "tick" no border-left quando um filho está ativo.
- **Prós:** zero cliques extras, hierarquia óbvia de relance, ótimo para grupos pequenos (2–4 filhos).
- **Contras:** ocupa mais altura; ruim se um pai tiver 8+ filhos.

### Proposta C — Pai como aba/cabeçalho + filhos como chips

O pai vira um **cabeçalho de subseção** dentro do grupo (tipografia diferente, sem ícone grande), e os filhos viram **chips/pills horizontais** logo abaixo.

```text
RELACIONAR
─────────────────────────
INBOX
[ Unificada ] [ Email ] [ WhatsApp ] [ Chat ]

AGENDA
[ Reuniões ] [ Calendários ] [ Booking ]
```

- O pai não é mais um item navegável — é um rótulo de família.
- Filhos viram pílulas compactas que cabem em 1–2 linhas.
- Ativo: pílula com fundo `primary/10` + borda; outras com `bg-muted`.
- **Prós:** comunica "estes pertencem juntos" mais forte que indentação; ótimo para filtros/canais; visual moderno (Notion, Linear).
- **Contras:** quebra o padrão "lista vertical" da sidebar — exige reformatar o componente; ruim se sidebar estiver colapsada (modo ícone).

## Recomendação

**Proposta A (submenu recolhível)** é a mais segura: resolve o problema, mantém o componente Sidebar atual (shadcn já suporta `SidebarMenuSub`), funciona no modo colapsado (ícone), e escala para todos os outros grupos com hierarquia (Reuniões, Tarefas, Campanhas).

**Proposta B** é boa se quisermos zero atrito — recomendada se a maioria dos pais tem ≤4 filhos (que é o caso atual).

**Proposta C** é a mais expressiva visualmente mas a mais arriscada — vale só se quiser repensar a sidebar inteira.

## Próximo passo

Me diga qual proposta seguir (A, B ou C). Em seguida eu:
1. Estendo o tipo `SidebarItem` em `src/lib/menu-config.ts` para aceitar `children?: SidebarItem[]`.
2. Reagrupo os itens afetados (Inbox + canais, Reuniões + Calendários/Agendamentos, Tarefas + Filas, Campanhas Email/WhatsApp).
3. Atualizo `AppSidebar` para renderizar o padrão escolhido, com auto-expand quando rota filha estiver ativa e destaque "ativo" único.
