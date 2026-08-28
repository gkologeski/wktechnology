# Configurações: ao trocar de grupo, a 1ª opção ganha o foco

## Objetivo
Em `/settings` (desktop), hoje clicar numa aba de grupo apenas troca os chips exibidos — a página aberta continua sendo a anterior (de outro grupo), sem nenhum chip ativo. O comportamento esperado: ao trocar de grupo, navegar automaticamente para a **primeira opção** do grupo, que passa a ser o item em foco.

## Mudança (arquivo único)

**`src/routes/_authenticated/settings.tsx`**
- No `onClick` das abas de grupo, substituir o simples `setGroupOverride(label)` por:
  1. `setGroupOverride(label)` (mantém o grupo escolhido);
  2. `navigate({ to: primeiroItemVisivelDoGrupo })` — o primeiro item permitido daquele grupo (respeitando `canSee`/permissões), pois os chips ativos (`isActive`/`aria-current`) acompanham a rota.
- Com isso, o chip da 1ª opção fica ativo imediatamente e o conteúdo (`<Outlet />`) carrega a página correspondente.
- Caso o usuário já esteja numa página daquele grupo, manter a página atual (não forçar a 1ª) — evita "pulo" indesejado ao re-clicar no grupo ativo.
- Busca e seletor mobile: sem alteração.

## Fora de escopo
Sem mudanças de rotas, permissões, dados, schema ou em outras telas.

## Validação
- `bunx tsgo --noEmit` e ESLint no arquivo alterado.
- Verificação visual (Playwright): abrir `/settings/pipelines`, clicar em outro grupo e confirmar que a 1ª opção é carregada e marcada como ativa; re-clicar no grupo atual não muda a página.
