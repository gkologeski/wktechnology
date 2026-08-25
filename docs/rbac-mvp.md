# RBAC MVP — TechERP (TechSales + TechHire)

Modelo inspirado no HubSpot: Cargos (`permission_sets`) agregam chaves granulares (`permissions`) e são atribuídos a usuários via `user_permission_sets`.

## Cargos padrão (system)

Todos criados com `is_system=true` e protegidos por trigger contra rename/delete:

| Cargo          | Escopo                           | Uso típico             |
| -------------- | -------------------------------- | ---------------------- |
| Super Admin    | Todos os módulos                 | Fundador / TI          |
| Admin          | Todos os módulos                 | Ops / Head             |
| Sales Manager  | TechSales full                   | Gerente de vendas      |
| Sales Rep      | TechSales próprio                | SDR / AE               |
| Marketing      | Campanhas + leads                | Marketing              |
| Service Rep    | Tickets                          | Suporte                |
| Recruiter      | TechHire                         | Recrutador             |
| Hiring Manager | TechHire (leitura + entrevistas) | Gestor solicitante     |
| Read-Only      | Leitura ampla                    | Auditoria / observador |

## Chaves de permissão

Formato: `<module>.<object>.<action>.<scope>` (ex: `techsales.deals.create.own`, `techhire.jobs.publish.workspace`). Ver tabela `permissions` para lista completa (56 chaves).

## Enforcement — status atual (MVP)

| Camada               | Estado      | Observação                                                                                                                                                                 |
| -------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RLS (perímetro)**  | ✅ Ativo    | Já limita acesso por workspace; policies workspace-wide continuam válidas — é a defesa real contra bypass.                                                                 |
| **UI (Cargos)**      | 🟡 Parcial  | CTAs primários gatados via `<Can permission="...">` nas listas de Deals, Contacts, Companies, Leads, Tickets e ATS Jobs.                                                   |
| **Server functions** | 🟠 Pendente | A maior parte dos CRUDs vai direto do cliente para o Supabase; `assertPermission` cobre apenas fluxos que já usam `createServerFn` (ATS scorecards, ofertas, importações). |

## Como aplicar em novas telas

```tsx
import { Can } from "@/lib/access-control/use-permissions";

<Can permission="techsales.deals.create.own">
  <Button onClick={openNew}>Criar negócio</Button>
</Can>;
```

Múltiplas chaves:

```tsx
<Can any={["techsales.deals.update.own", "techsales.deals.update.workspace"]}>
  <EditAction />
</Can>
```

Em server functions:

```ts
import { assertPermission } from "@/lib/access-control/enforce.server";

.handler(async ({ context }) => {
  await assertPermission(context.userId, "techhire.jobs.publish.workspace");
  // ...
})
```

## Como validar

1. Login como usuário sem cargo → CTAs "Criar negócio/contato/empresa/lead/ticket/vaga" ficam ocultos.
2. Atribuir cargo "Sales Rep" em `/home/access` → aparecem CTAs de TechSales, ATS continua oculto.
3. Atribuir "Read-Only" → todos os CTAs de criação ficam ocultos, listagem continua acessível.

## Riscos & próximos passos

- **RLS ainda permite escrita workspace-wide** em tabelas core (deals, contacts, companies, leads, tickets). Um usuário com acesso à API poderia burlar a UI. Próxima fase: adicionar policies que consultem `user_has_permission()` em `USING`/`WITH CHECK` das operações de escrita.
- **CTAs secundários** (Exportar, Importar, Excluir em massa, ações em linha) ainda não estão gatados por `<Can>`. Serão migrados nas próximas ondas mantendo compatibilidade com o fluxo atual `can("export")`.
- **Backfill defensivo**: usuários pré-existentes foram atribuídos a "Read-Only" para evitar downgrade acidental. Revisar em `/home/access` → Membros e reatribuir cargos reais.
