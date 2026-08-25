# Correções: gate de qualificação, associações do contato e registro na timeline

## 1. Etapa "Oportunidade" abrindo a tela de qualificação

Verificado: o funil "Funil de Leads" tem as etapas `Novo`, `Em Contato`, `Qualificado`
(type `open`), `Oportunidade` (type **won**) e `Desqualificado` (type `lost`).
O gate no detalhe do lead abre o questionário quando `stage.value === "qualified"`
**ou** `stage.type === "won"` — por isso "Oportunidade" também dispara o modal.

Correção: o gate passa a considerar apenas a etapa de qualificação (valor/etapa
`qualified`), sem depender do tipo `won`. Mover para "Oportunidade" grava a etapa
direto, sem abrir o questionário. Se o lead ainda não tiver qualificação concluída
ao ir para "Oportunidade", nada é bloqueado (comportamento aditivo).

## 2. Associações do contato não mostram o lead (nem a empresa)

Verificado: nas associações de Contato são renderizados Empresa, Negócios, Chamados,
Tarefas, E-mails e Anexos — **não existe card de Leads**. Por isso o lead de origem
nunca aparece no contato.

Correção:

- Novo card "Leads" nas associações de Contato (leads cujo `converted_contact_id`
  é o contato) e de Empresa (leads com `company_id` da empresa), com link para o
  lead, etapa atual e empty state padrão.
- Sobre a empresa: o contato `Tatiana Peruzzo` **tem** empresa vinculada
  (Sebrae/PR) e o card de Empresa existe para a entidade contato, então a ausência
  não foi reproduzida. Primeiro passo da implementação: reproduzir a tela do contato
  e conferir carregamento/permissão do card; corrigir conforme o que for observado
  (e não antes de confirmar a causa).

## 3. Qualificação sem registro na timeline

Verificado: `saveQualification` grava em `prospecting_qualifications` e lança o score,
mas **não cria nenhuma atividade**. A timeline do lead `tperuzzo@pr.sebrae.com.br`
retorna vazia porque não há atividade correspondente.

Correção: ao concluir a qualificação (decisão diferente de pendente), registrar uma
atividade do tipo pesquisa vinculada ao lead/contato, com:

- assunto "Qualificação — <nome do questionário>";
- corpo com decisão (Qualificado / Desqualificado / Nutrição / Agendado), score e
  percentual do máximo, e motivo quando houver;
- vínculos (`related_lead_id` / `related_contact_id`, empresa quando existir) para
  aparecer também nas entidades associadas;
- idempotente por qualificação: reeditar atualiza a mesma atividade em vez de duplicar.

Rascunhos (sem decisão) não geram atividade, para não poluir a timeline.

## Detalhes técnicos

- `src/routes/_authenticated/leads.$id.tsx`: condição do gate deixa de usar
  `stage.type === "won"`.
- `src/components/record/associations/lead-cards.tsx` (+ registro em
  `associations-panel.tsx`): card `LeadsForContactCard` / `LeadsForCompanyCard`
  usando os primitivos existentes (`AssocCard`, `Empty`, `ViewAllFooter`).
- `src/lib/prospecting/qualifications.functions.ts`: helper server-side que faz
  upsert da atividade (`type: 'survey'`, `owner_id`/`workspace_id` do lead) após
  gravar a qualificação; chave de idempotência pelo id da qualificação.
- Invalidação das queries de timeline/atividades após salvar no painel de
  qualificação e no modal de pesquisa.
- Sem mudança de schema, RLS, autenticação ou regras de decisão.

## Como validar

1. Mover um lead para "Oportunidade": a etapa muda sem abrir o questionário;
   mover para "Qualificado" continua exigindo o questionário.
2. Abrir o contato Tatiana Peruzzo: card Leads mostra o lead de origem; card Empresa
   mostra Sebrae/PR.
3. Concluir a qualificação de um lead: nova entrada na timeline com decisão e score;
   reabrir e salvar de novo não duplica a entrada.
