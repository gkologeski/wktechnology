## Contexto

Diagnóstico das duas telas dos prints identificou:

1. **Rótulos inconsistentes** para as mesmas rotas (Home diz "Membros/Times/Papéis e permissões", sidebar de Settings diz "Equipe do workspace/Usuários/Permissões").
2. **Card "Equipes (grupos)"** existe na sidebar mas falta na Home.
3. **Duplicidade funcional real** entre `/settings/workspace-team` e `/settings/teams` — dois sistemas paralelos de gestão de membros (token-invite vs auth-invite).
4. **Sobreposição** entre `/settings/roles` (perfis legado) e `/home/access` (Controle de Acesso TechERP) — dois motores de permissão coexistindo.

## Escopo desta rodada

Apenas mudanças de **rotulagem e navegação**. Zero mudança funcional, de RLS, schema, server functions ou lógica de negócio.

Decisões maiores (consolidar workspace-team↔teams; migrar roles→access) ficam fora deste plano por dependerem de migração de dados / decisão de produto.

## Alterações

### 1. Padronizar rótulos entre Home e Sidebar de Settings

Arquivo: `src/routes/_authenticated/settings.tsx` (seção "Pessoas & Acesso", linhas ~186–189).

| Rota | Rótulo atual (sidebar) | Novo rótulo | Descrição/tooltip nova |
|---|---|---|---|
| `/settings/workspace-team` | Equipe do workspace | **Membros** | "Convites por link e acessos do workspace" |
| `/settings/teams` | Usuários | **Usuários (admin)** | "Gestão avançada: perfis, telefone, limites de plano" |
| `/settings/user-groups` | Equipes (grupos) | **Times** | "Grupos operacionais de usuários" |
| `/settings/roles` | Permissões | **Papéis e permissões** | (mantém rota, só renomeia) |

Rationale para diferenciar "Membros" vs "Usuários (admin)": até a consolidação futura, os rótulos precisam sinalizar por que existem duas telas. "Membros" = fluxo padrão de convite/remoção; "Usuários (admin)" = tela avançada com limites de plano, edição de perfil e matriz de permissões.

Também trocar o título interno da página `/settings/teams` (`src/routes/_authenticated/settings.teams.tsx` linha 284) de "Usuários" para "Usuários (admin)".

### 2. Atualizar cards da Home

Arquivo: `src/routes/_authenticated/home.index.tsx` (seção "Pessoas", linhas ~196–202).

Trocar de 4 para 5 cards, com rótulos e descrições alinhados aos da sidebar:

```text
- Membros              → /settings/workspace-team   (Convites e acessos)
- Usuários (admin)     → /settings/teams            (Gestão avançada e limites)
- Times                → /settings/user-groups      (Grupos operacionais)   ← NOVO
- Papéis e permissões  → /settings/roles            (Admin, gestor, membro)
- Controle de Acesso   → /home/access               (Cargos, pacotes, matriz)
```

Ícones sugeridos (usar os já importados no arquivo): `UsersRound` (Membros), `Users2`/`UserCog` (Usuários admin), `Users` (Times), `ShieldCheck` (Papéis), `Shield` (Controle de Acesso).

### 3. Atualizar menu ERP

Arquivo: `src/lib/menu-config-erp.ts` linha 18 — o item já foi corrigido para `/settings/workspace-team`; apenas renomear label de "Membros" (já está) para permanecer coerente com o rótulo unificado — sem mudança se já bate.

## Fora do escopo (documentado para próximos passos)

Nenhum destes itens será executado agora — apenas registrados como pendências:

1. **Consolidar `/settings/workspace-team` e `/settings/teams`**: portar as features únicas do workspace-team (revoke de convite, reassign-on-remove, token-link invite) para dentro de `/settings/teams` e deprecar workspace-team. Requer decisão sobre modelo de convite unificado (token vs auth.admin).
2. **Migrar dados de `access_profiles` → `job_roles`/`permission_sets`** e depois esconder/remover `/settings/roles`. Requer script de migração e validação de atribuições existentes.
3. Revisar se o `WorkspaceMenu` header e o `global-search/commands.ts` precisam dos mesmos rótulos unificados (verificar após aprovação).

## Validação manual

1. Abrir `/home` → seção "Pessoas" deve mostrar 5 cards na ordem acima, com rótulos coincidindo com a sidebar.
2. Abrir qualquer rota `/settings/*` → sidebar "Pessoas & Acesso" deve exibir Membros / Usuários (admin) / Times / Papéis e permissões.
3. Clicar em "Times" (Home ou sidebar) → cai em `/settings/user-groups`.
4. Clicar em "Usuários (admin)" → cai em `/settings/teams` com o mesmo título na página.
5. Nenhuma tela deve ter perdido funcionalidade — apenas texto de rótulo mudou.

## Riscos

- Baixo. Só strings de UI. Sem impacto em RLS, queries ou server functions.
- Usuários acostumados aos rótulos antigos podem estranhar por 1 sessão — mitigado pelas descrições explicativas nos cards.
