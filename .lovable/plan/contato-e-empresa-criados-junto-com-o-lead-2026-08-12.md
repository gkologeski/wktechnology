# Contato e empresa criados junto com o Lead

## Situação atual (verificada no banco)

- 5.813 leads no total
- 5.790 sem contato vinculado (`converted_contact_id` vazio)
- 171 sem empresa vinculada (82 deles têm nome de empresa preenchido)

Hoje o contato/empresa só nascem em fluxos posteriores (conversão do lead, qualificação).
Existem vários pontos que criam lead (modal de criação, API pública, formulários públicos,
MCP, agente de IA, onboarding guiado, importação de prospecção, importação HubSpot,
agendamento e workflows) e nenhum deles cria os registros relacionados.

## O que muda

### 1. Regra única de vínculo

Passa a existir uma regra central "garantir empresa e contato do lead", aplicada
imediatamente após a criação de qualquer lead:

- **Empresa**: se o lead já tem empresa vinculada, nada muda. Senão, procura uma empresa
  existente do mesmo workspace pelo nome (sem diferenciar maiúsculas) e reaproveita; se não
  existir e houver nome informado, cria a empresa. Sem nome de empresa, nada é criado.
- **Contato**: se o lead já tem contato vinculado, nada muda. Senão, procura contato
  existente do workspace pelo e-mail (ou telefone, quando não houver e-mail) e reaproveita;
  se não existir, cria o contato com nome, sobrenome, e-mail, telefone, cargo e empresa
  vinculada do lead.
- Os registros criados herdam workspace, responsável e proprietário do lead.
- O lead recebe `company_id` e `converted_contact_id`; o contato recebe `company_id`.
- Nunca duplica: se o vínculo já existe, a rotina é inofensiva.

Falha ao criar contato/empresa não impede a criação do lead — o lead é criado e a falha
aparece como aviso, para não travar formulários públicos e integrações.

### 2. Levantamento e criação retroativa (todos os leads)

Executo agora, no banco, a criação retroativa para todos os leads sem vínculo, com a mesma
regra acima (reaproveitando empresas/contatos já existentes por nome e por e-mail, sem
duplicar). Ao final informo os números: empresas criadas, empresas reaproveitadas,
contatos criados, contatos reaproveitados e leads que continuaram sem empresa por não ter
nome informado.

### 3. Efeito nas telas existentes

- Detalhe do lead passa a mostrar Empresa e Contato relacionados desde a criação.
- A qualificação continua funcionando igual, mas agora quase sempre encontra os registros
  já vinculados em vez de criá-los.
- Conversão do lead (`convertLead`) passa a reaproveitar o contato/empresa já vinculados
  em vez de criar novos, evitando duplicidade.

## Detalhes técnicos

- Novo `src/lib/leads/lead-relations.ts`: função pura `ensureLeadRelations(client, lead)`
  com a lógica de busca/criação/vínculo, reutilizável no cliente (RLS do usuário) e no
  servidor.
- Novo `src/lib/leads/lead-relations.functions.ts`: server function
  `ensureLeadRelationsFn` com `requireSupabaseAuth`, para fluxos server-side (MCP, agente
  de IA, workflows, agendamento, formulários e API pública usam o client apropriado do
  próprio fluxo).
- Chamada adicionada após o insert em:
  - `src/components/leads/create-lead-dialog.tsx`
  - `src/routes/api/public/v1/leads.ts`
  - `src/routes/api/public/forms/$slug.submit.ts`
  - `src/lib/mcp/tools/create-lead.ts`
  - `src/lib/ai-agent/tools.functions.ts`
  - `src/routes/_authenticated/onboarding.$entity.tsx`
  - `src/lib/prospecting.functions.ts` (criação/importação de prospects em lead)
  - `src/lib/hubspot.functions.ts` e `src/lib/integrations/hubspot.functions.ts`
  - `src/lib/booking/engine.server.ts`
  - `src/lib/workflows/engine.server.ts` (ação de criar lead)
- `src/lib/lead-convert.ts`: usa `lead.company_id` / `lead.converted_contact_id` quando já
  existirem, criando apenas o que falta.
- `src/components/prospecting/qualification-entity-fields.tsx`: mantém o comportamento
  atual, mas passa a delegar a criação/vínculo ao helper compartilhado (remove a lógica
  duplicada).
- Backfill: script SQL idempotente executado por migração de dados (apenas INSERT/UPDATE em
  `companies`, `contacts` e `leads`), em lotes, casando por `lower(btrim(name))` para
  empresa e `lower(btrim(email))` para contato, dentro do mesmo `workspace_id`.
- Sem alteração de schema, RLS, autenticação ou permissões.
- Sem alteração visual; tokens, estados e componentes atuais preservados.

## Como validar

1. Criar um lead novo com empresa e e-mail: no detalhe do lead, Empresa e Contato já
   aparecem vinculados.
2. Criar outro lead com o mesmo e-mail/empresa: reaproveita os registros, sem duplicar.
3. Criar lead sem empresa: contato criado, empresa não.
4. Abrir leads antigos (ex.: os 171 sem empresa) e confirmar os vínculos após o backfill.
5. Qualificar um lead: blocos de Empresa/Contato já carregam o registro vinculado.
