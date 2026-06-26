Ajustar o layout 3-colunas da página de detalhe de entidade (Negócios/Leads/Tickets/Contatos/Empresas) para que, em telas reduzidas, o conteúdo deixe de ser cortado por `truncate` nas colunas laterais.

Mudanças mínimas, somente UI:

1. `src/components/record/record-layout.tsx`
   - Elevar o breakpoint da grade 3-colunas de `xl` para `2xl` (`2xl:grid-cols-12`).
   - Entre `lg` e `2xl`, passar para 2 colunas: aside esquerdo + centro lado a lado (`lg:grid-cols-[280px_minmax(0,1fr)]`), com o aside direito ocupando largura total abaixo. Isso devolve largura útil aos painéis laterais em telas ~1000–1500px (como a do print).
   - Manter stack único em telas pequenas.

2. `src/components/properties-panel.tsx` (linha ~359)
   - Trocar `truncate` por `break-words` no valor da propriedade, permitindo quebra em múltiplas linhas em vez de cortar nomes/valores longos.

3. `src/components/record/associations-panel.tsx`
   - Em campos críticos do cartão (nome principal da empresa/contato, e-mail e telefone, linhas ~459, ~647, ~658, ~934, ~1147, ~1307, ~1316, ~1503, ~1549): substituir `truncate` por `break-words` (mantendo `line-clamp-2` onde fizer sentido para títulos).
   - Manter `truncate` apenas em rótulos secundários onde o corte é aceitável.

Sem alterar dados, queries, RLS, lógica ou densidade visual além das classes utilitárias necessárias. Light/dark mode preservados pelos tokens existentes.

Validação manual:
- Abrir `/deals/:id`, `/leads/:id`, `/tickets/:id`, `/contacts/:id`, `/companies/:id` em ~1060px, ~1280px e ≥1536px.
- Verificar que "Nome", "Valor", "Empresa", "Contato", "E-mail", "Telefone" aparecem completos (com wrap) e que nenhuma linha é truncada por reticências.