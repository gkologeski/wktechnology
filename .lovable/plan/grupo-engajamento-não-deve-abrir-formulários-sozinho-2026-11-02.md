# Grupo "Engajamento" não deve abrir Formulários sozinho

## Causa (confirmada no código)
Na tela de Configurações, ao clicar num grupo (Engajamento, Integrações…), o sistema abre automaticamente a 1ª opção do grupo. Em Engajamento a 1ª é "Formulários", por isso cai em `/settings/forms`. Não é erro de rota — é o comportamento programado, que confunde.

## O que muda
- Clicar num grupo passa a mostrar uma **visão do grupo**: uma grade com todas as opções dele (ícone, nome), sem abrir nenhuma.
- Você escolhe a opção (ex.: "Lembretes de reunião (WhatsApp)") nos botões do topo ou na grade.
- Se você já estiver numa página daquele grupo, nada muda.
- Celular, busca e permissões continuam iguais (só aparecem opções que você pode ver).

## Detalhes técnicos
- `src/routes/_authenticated/settings.tsx`: remover o `navigate(section.tabs[0].to)` do clique no grupo; quando `groupOverride` aponta para grupo que não contém a página atual, renderizar grade de `visibleTabs` (Links com tokens semânticos) no lugar do `<Outlet />`.
- Só apresentação; sem dados, rotas ou permissões novas (classificação de apresentação no contrato, se o hash exigir).
- Verificação: `permissions:check` e Playwright (clicar Engajamento → ver grade, sem ir para /settings/forms; clicar Lembretes → abre a tela).

## Porte e tempo
P — cerca de 10 a 15 minutos.
