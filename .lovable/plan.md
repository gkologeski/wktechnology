## Objetivo
Remover o grupo "Recrutar" do menu lateral do TechSales, pois recrutamento é responsabilidade exclusiva do módulo TechHire (ATS).

## Alteração
**Arquivo:** `src/lib/menu-config.ts` (linhas 164–178)

Remover integralmente o grupo:
```ts
{
  label: "Recrutar",
  items: [
    {
      title: "ATS",
      url: "/ats/jobs",
      icon: UsersRound,
      children: [
        { title: "Vagas", url: "/ats/jobs", icon: Briefcase },
        { title: "Candidatos", url: "/ats/candidates", icon: UsersRound },
        { title: "Workflows", url: "/settings/workflows", icon: Workflow, need: "manager" },
      ],
    },
  ],
},
```

## Por que é seguro
- O menu do TechHire (`src/lib/menu-config-ats.ts`) já expõe Vagas, Candidatos e demais funcionalidades de recrutamento.
- As rotas (`/ats/jobs`, `/ats/candidates`, `/jobs`, `/candidates`) continuam existindo e acessíveis via TechHire e via URL direta — apenas deixam de aparecer no sidebar do TechSales.
- "Workflows" (`/settings/workflows`) permanece disponível no grupo "Otimizar" do mesmo `menu-config.ts`, então não perdemos acesso a esse item.
- Após a remoção, provavelmente sobrarão imports não usados em `menu-config.ts` (`Briefcase`, possivelmente `UsersRound` — verificar se ainda é usado em outro grupo antes de remover); limpeza dos imports órfãos será feita junto.

## Fora de escopo
- Menu do TechHire (`menu-config-ats.ts`): sem alterações.
- Rotas, RBAC e navegação cross-host: sem alterações.
