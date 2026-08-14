# Enriquecimento imediato no modal de qualificar lead

Hoje o enriquecimento Apollo roda ao abrir o modal, mas os campos só aparecem depois de abrir/fechar outro modal. Além disso, os dados só vão para o banco quando o usuário salva o rascunho ou qualifica, e a cascata devolve um conjunto reduzido de campos.

## O que muda

1. **Atualização imediata na tela**
   - Causa: os valores dos blocos de Lead/Empresa/Contato são recarregados dos registros quando a consulta dos registros chega e sobrescrevem o que o enriquecimento já preencheu; o preenchimento automático não roda de novo. Ao fechar outro modal, a invalidação global refaz o ciclo na ordem "certa" e os valores aparecem — daí a impressão de precisar perder o foco.
   - Correção: aplicar as sugestões no mesmo passo em que os registros são sincronizados (registro → sugestão), com marcação do que já foi aplicado por lead/consulta, para que a ordem de chegada (registros antes ou depois do Apollo) não afete o resultado. Campos preenchidos pelo usuário continuam intactos.

2. **Gravação automática no banco ao terminar o enriquecimento**
   - Assim que a cascata retorna dados novos, eles são gravados no lead e nos registros de Empresa/Contato vinculados (somente campos vazios; nada é sobrescrito), e as consultas da tela são invalidadas — os campos aparecem preenchidos sem recarregar.
   - Empresa/Contato ainda não vinculados continuam com a regra atual: são criados no salvamento; até lá os valores ficam no formulário.
   - Um selo "Apollo · gravado" indica que os dados já foram persistidos; o botão "Enriquecer" continua forçando nova consulta (ignora cache).

3. **Mais campos retornados (mesma ordem de busca)**
   - A cascata segue igual: site/e-mail corporativo → busca por nome (domínio) → `organizations/enrich` → `people/match` (LinkedIn > e-mail > nome + domínio).
   - Passam a ser mapeados todos os campos que têm coluna correspondente:
     - Empresa: nome, domínio, site, setor, tamanho, telefone, endereço, cidade, estado, país, CEP, LinkedIn, Facebook, Twitter, receita anual, descrição, fuso.
     - Contato: nome, sobrenome, e-mail, telefone, celular, cargo, LinkedIn, Twitter, cidade, estado, país, endereço, CEP, site, empresa.
     - Lead: nome, sobrenome, e-mail, telefone, nome da empresa.
   - Campos sem coluna equivalente não são inventados; ficam no histórico do enriquecimento (`custom_fields.apollo_enrichment`).

## Detalhes técnicos

- `src/lib/integrations/apollo-enrich.server.ts`: ampliar `ApolloCompanyData`/`ApolloPersonData` e `mapOrg`/`apolloPeopleMatch` com os campos adicionais da resposta do Apollo (`street_address`/`raw_address`, `postal_code`, `facebook_url`, `twitter_url`, `founded_year`, `seniority`, `departments` quando aplicável). Sem mudança na sequência da cascata nem no tratamento de erros/avisos.
- `src/lib/prospecting/qualification-enrichment.functions.ts`: expandir `LEAD_KEYS`/`COMPANY_KEYS`/`CONTACT_KEYS` conforme as colunas reais; `enrichLeadForQualification` passa a aceitar `persist` e, quando verdadeiro, aplicar as sugestões (reusando a mesma lógica de `applyQualificationEnrichment`, sem sobrescrever valores existentes) e devolver `applied` no retorno.
- `src/components/prospecting/qualification-entity-fields.tsx`: unificar a sincronização de registros com `applySuggestions` (efeito único + ref de assinatura já aplicada) e expor `suggestionsApplied`.
- `src/components/prospecting/qualification-panel.tsx`: no `onSuccess` do enriquecimento, invalidar `["qualification-entity-records", entityId]`, `["lead", entityId]` e `["leads"]`; ajustar o selo de status; manter `persistEnrichment` no salvar/qualificar como rede de segurança.
- Sem alteração de schema, RLS, permissões ou regras de decisão da qualificação.

## Como validar

1. Abrir um lead com empresa/site preenchidos e mover para "Qualificado": o selo mostra "Enriquecendo..." e, ao concluir, os campos vazios aparecem preenchidos com o selo Apollo, sem precisar de outro modal.
2. Recarregar a página: os valores gravados permanecem (vieram do banco).
3. Alterar um campo manualmente e clicar em "Enriquecer": o valor manual é preservado e só os vazios são preenchidos.
4. Sem Apollo configurado ou sem créditos: o aviso aparece e a qualificação continua funcionando.
