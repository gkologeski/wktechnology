# Congelar colunas Módulo, Recurso e Funcionalidade em /settings/permissions

## Objetivo

Na matriz de permissões (`/settings/permissions`), manter as três primeiras colunas identificadoras (Módulo, Recurso, Funcionalidade) sempre visíveis ao rolar horizontalmente para acessar os cargos.

## Contexto atual

O componente `src/components/access-control/permissions-matrix.tsx` já renderiza uma tabela com scroll horizontal. Apenas a coluna **Módulo** possui `sticky left-0`; as colunas **Recurso** e **Funcionalidade** rolam junto com as colunas de cargos, dificultando a leitura quando há muitos papéis.

## Escopo

- Alteração puramente de UX/UI no frontend.
- Nenhuma mudança em RLS, schema, server functions, permissões ou regras de negócio.

## Implementação

1. Atualizar `src/components/access-control/permissions-matrix.tsx`:
   - Aplicar `position: sticky` nas células de cabeçalho e corpo das colunas **Recurso** e **Funcionalidade**.
   - Definir `left` progressivo de acordo com as larguras acumuladas das colunas anteriores:
     - Módulo: `left-0` (largura mínima ~110px)
     - Recurso: `left-[110px]` (largura mínima ~160px)
     - Funcionalidade: `left-[270px]` (largura mínima ~150px)
   - Ajustar `z-index` para que o empilhamento respeite a ordem das colunas (Módulo > Recurso > Funcionalidade > conteúdo rolável).
   - Garantir `background-color` sólido (`bg-muted` no cabeçalho, `bg-background` no corpo) para cobrir o conteúdo que passa por baixo.
   - Preservar bordas direitas (`border-r`) para manter a separação visual entre colunas congeladas e roláveis.
   - Manter responsividade e comportamento dark mode (usar tokens semânticos existentes).

2. Verificar se as larguras mínimas das colunas estão alinhadas entre `<th>` e `<td>` para evitar deslocamento do sticky.

## Validação

- Executar typecheck (`bun run typecheck` ou equivalente disponível).
- Validar visualmente via preview/Playwright que, ao rolar a tabela para a direita, as colunas Módulo, Recurso e Funcionalidade permanecem fixas e legíveis.
- Verificar light e dark mode.

## Arquivos alterados

- `src/components/access-control/permissions-matrix.tsx`
