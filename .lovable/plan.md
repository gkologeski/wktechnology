# Corrigir link "Membros" do Workspace

## Diagnóstico

- O item "Membros" do menu ERP (`src/lib/menu-config-erp.ts`, linha 18) aponta para `/workspace/members`.
- Essa rota **não existe** em `src/routes/_authenticated/` (só existem `workspace.index.tsx` → redireciona para `/home`, e `workspace.modules.tsx`).
- A tela real de gestão de membros do workspace vive em `/settings/workspace-team` (`src/routes/_authenticated/settings.workspace-team.tsx`), com listagem, convites por token e remoção — é o destino usado inclusive pelo `WorkspaceMenu` do header.
- Resultado: clicar em "Membros" cai em rota inexistente (404 / tela vazia).

## Escopo

Ajuste mínimo de UI/navegação. Sem mudanças em backend, RLS, server functions ou na tela de membros.

## Alteração

**`src/lib/menu-config-erp.ts`** — trocar a URL do item "Membros":

```diff
- { title: "Membros", url: "/workspace/members", icon: Users2 },
+ { title: "Membros", url: "/settings/workspace-team", icon: Users2 },
```

## Alternativa (não recomendada agora)

Criar `src/routes/_authenticated/workspace.members.tsx` como redirect para `/settings/workspace-team`. Rejeitada: duplica caminho para a mesma tela sem benefício e mantém duas URLs para o mesmo recurso.

## Validação manual

1. Abrir o menu lateral do ERP → clicar em "Membros".
2. Deve carregar `/settings/workspace-team` com a lista de membros e o botão de convite.
3. Verificar que o item "Membros & Equipes" do `WorkspaceMenu` (header) continua funcionando (já aponta para `/settings/workspace-team`).
