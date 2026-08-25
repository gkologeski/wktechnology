# Enriquecimento Apollo.io ao abrir a qualificação

Ao abrir o modal de qualificação, o sistema busca dados no Apollo.io e sugere o preenchimento dos campos do bloco "Dados do Lead" (e dos blocos de Empresa/Contato, quando configurados).

## Estratégia de enriquecimento (cascata em 3 passos)

```text
1) Descobrir o DOMÍNIO
   site do lead/empresa  ->  domínio do e-mail corporativo
   -> Apollo /mixed_companies/search (nome da empresa) -> primary_domain
2) Enriquecer a EMPRESA pelo domínio
   Apollo /organizations/enrich (domain) -> setor, tamanho, telefone,
   site, LinkedIn, cidade/estado/país, receita estimada
3) Enriquecer a PESSOA com nome + domínio
   Apollo /people/match (first_name, last_name, domain) -> e-mail, telefone,
   cargo, LinkedIn
```

Por que assim: `organization_name` é ambíguo (homônimos, razão social vs. nome fantasia); o domínio é chave única e eleva muito a taxa de acerto do `people/match`. Se o passo 1 falhar, ainda tentamos `people/match` por nome + nome da empresa (comportamento atual) como fallback.

Melhorias sugeridas incluídas:

- Se o lead/empresa tiver CNPJ, resolver razão social/site pela BrasilAPI (já integrada) antes do Apollo — melhora a busca do domínio em empresas brasileiras.
- Se o lead tiver LinkedIn, usar direto no `people/match` (maior precisão, ignora os passos 1–2 para a pessoa).
- Cache por lead: o resultado é gravado e reaproveitado; a abertura do modal não gasta crédito novamente. Botão "Enriquecer novamente" força nova consulta.

## Comportamento na tela

- Ao abrir o modal, um chip discreto "Enriquecendo com Apollo…" aparece no topo dos blocos de campos.
- Campos **vazios** são preenchidos automaticamente com o valor sugerido e marcados com um selo "Apollo".
- Campos **já preenchidos** nunca são sobrescritos: aparece uma sugestão ao lado com ação "Usar".
- Nada é gravado no banco pelo enriquecimento em si: os valores entram no formulário e só persistem ao salvar rascunho ou concluir a qualificação (regra atual mantida).
- Ao salvar o Lead (rascunho ou conclusão da qualificação), todos os campos enriquecidos são gravados de uma vez: os do Lead no registro do lead, os da Empresa no registro da empresa vinculada e os do Contato no contato vinculado — mesmo que o campo não esteja visível em nenhum bloco configurado. Campos já preenchidos continuam intactos (só vazios recebem o valor do Apollo, ou o valor que o usuário aceitou com "Usar"). Se a empresa/contato ainda não existir no lead, o vínculo não é criado automaticamente e esses dados ficam apenas no lead + histórico do enriquecimento.
- Estados tratados: sem integração configurada (aviso curto, sem erro), sem resultado ("Nenhum dado encontrado no Apollo"), erro/limite de crédito (mensagem com o status do provedor e botão de tentar novamente). A qualificação continua funcionando normalmente em todos os casos.

## Detalhes técnicos

- `src/lib/integrations/apollo-enrich.server.ts` (novo): `resolveDomain()`, `apolloOrganizationEnrich()`, `apolloPeopleMatchByDomain()`, reaproveitando o padrão de chamada e tratamento de erro já existente em `enrichment-engine.server.ts`.
- `src/lib/prospecting/qualification-enrichment.functions.ts` (novo): server fn `enrichLeadForQualification({ leadId, force })` com `requireSupabaseAuth`; lê lead + empresa vinculada, roda a cascata, registra `enrichment_jobs`/`credit_ledger` (como o fluxo atual) e retorna `{ lead: {...}, company: {...}, contact: {...}, domain, source }` normalizado por chave de coluna.
- Cache: coluna/campo de metadados no lead com o payload e timestamp da última consulta; `force: true` ignora o cache.
- `src/components/prospecting/qualification-entity-fields.tsx`: aceita `suggestions` e aplica em campos vazios, expõe selo/ação "Usar" por campo (mantendo os estados de loading/empty/erro atuais e os tokens do design system).
- `src/components/prospecting/qualification-panel.tsx`: dispara a query de enriquecimento ao montar (uma vez por lead), exibe o status e o botão "Enriquecer novamente".
- Sem alteração em RLS, autenticação ou nas regras de decisão da qualificação.

## Como validar

1. Abrir um lead com nome e empresa preenchidos e mover para "Qualificado".
2. Observar o chip de enriquecimento e os campos vazios preenchidos com selo "Apollo".
3. Alterar um campo manualmente e reabrir: o valor manual é preservado.
4. Sem `APOLLO_API_KEY`: apenas o aviso de integração não configurada, sem quebrar a qualificação.
