# Corrigir filtro de Responsável e remover o rótulo "+HubSpot"

## Causa encontrada
- Ao marcar uma pessoa, o filtro envia junto os códigos dos responsáveis do HubSpot ligados a ela (ex.: "hs:123").
- Em Empresas (e em Tickets e Tarefas de projetos), esses códigos vão parar nas colunas de usuário do TechERP. O banco recusa, e aparece "Não foi possível carregar as empresas".
- Contatos e Leads já separam os códigos, por isso lá não quebra.

## O que muda
1. **O filtro volta a funcionar em todas as grades.** Marcar uma pessoa mostra os registros dela: os que já estão em nome do usuário do TechERP e os que vieram do HubSpot em nome do responsável ligado a ele.
2. **Sai o rótulo "+HubSpot"** e a bolinha de cor diferente por origem. Cada pessoa aparece como um usuário só, sem mostrar de onde veio.
3. **A mesclagem vale pelo vínculo.** Responsável do HubSpot ligado a um usuário (em Configurações › Usuários do HubSpot, ou pelo botão "Criar usuários inativos") some da lista e passa a contar como esse usuário. Responsável ainda sem vínculo continua na lista pelo nome, dentro de Inativos, até ser ligado.
4. Não muda como os registros guardam o responsável nem nada no banco.

## Detalhes técnicos
- Criar em `src/components/owner-filter.tsx` um helper único `ownerFilterOrExpr(value, columns)` que usa `splitOwnerIds`: uuids passam por `responsibleOrExpr`; ids `hs:` viram `hubspot_owner_id.in.(...)`; sem responsável usa o ramo `includeUnassigned` existente.
- Trocar as chamadas em `companies.tsx` (lista e "selecionar todos filtrados", linhas ~264 e ~588), `tickets.tsx` e `projects.tasks.tsx` por esse helper; `contacts.tsx` e `leads.tsx` passam a usá-lo também, para não divergirem.
- Remover o tooltip "+HubSpot" e a cor por origem em `OwnerGroup`; `hasHubspot` deixa de ser usado na interface.
- Teste unitário do helper (uuid, hs:, misto, sem responsável).
- Validar: typecheck, testes, lint e navegador em /companies e /contacts marcando Guilherme e uma pessoa mesclada.
