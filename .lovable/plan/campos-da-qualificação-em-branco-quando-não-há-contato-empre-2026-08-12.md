# Campos da qualificação em branco quando não há contato/empresa vinculados

## Diagnóstico (verificado)

O questionário "Questionário Padrão" tem um bloco salvo assim:

```text
título: "Dados do Lead"   entidade: contacts   posição: antes
campos: LinkedIn (linkedin_url)
```

O lead `Ana Marques` tem `company_id` preenchido, mas `converted_contact_id` vazio.
Como o bloco é da entidade **Contato** e não existe contato vinculado, a tela mostra
"Nenhum registro de contato vinculado a este lead" e nenhum campo é renderizado —
e o enriquecimento do Apollo também não aplica nada, porque as sugestões só são
aplicadas quando existe registro carregado para aquela entidade.

Ou seja: não é falha do Apollo (o domínio `arcelormittalgonvarri.com.br` foi resolvido);
é o bloco depender de um vínculo que o lead ainda não tem.

## Correção

Blocos de Empresa e Contato passam a sempre exibir os campos, mesmo sem registro
vinculado. O registro é criado e vinculado ao lead no momento em que a qualificação
é salva (rascunho ou conclusão):

- **Contato**: criado a partir do lead (nome, sobrenome, e-mail, telefone, cargo,
  empresa vinculada) mais os campos preenchidos/enriquecidos do bloco; o lead recebe
  `converted_contact_id`.
- **Empresa**: se o lead não tiver `company_id`, a empresa é criada usando o
  `company_name` do lead (ou o nome vindo do Apollo) mais os campos do bloco; o lead
  recebe `company_id`.
- Se não houver nenhum dado útil (nem no bloco, nem no lead, nem no Apollo), nada é
  criado — sem registros vazios.
- Um aviso curto no bloco informa: "Será criado e vinculado ao salvar" enquanto o
  vínculo não existir.

O enriquecimento do Apollo passa a aplicar sugestões também para entidades ainda sem
registro, para que LinkedIn, telefone, cargo, setor etc. já apareçam preenchidos.

Complemento no configurador de campos: ao trocar a entidade do bloco, o título é
ajustado automaticamente (ex.: "Dados do Contato") em vez de manter um título que não
corresponde à entidade — foi o que gerou a confusão aqui.

## Detalhes técnicos

- `src/components/prospecting/qualification-entity-fields.tsx`
  - `useQualificationEntityFields`: renderizar/editar valores de blocos sem registro
    (estado inicial vazio em vez de ser ignorado); `applySuggestions` e
    `missingRequired` deixam de exigir `data[entity]`.
  - `saveAll` recebe o lead atual e passa a criar Empresa/Contato faltantes
    (insert + update do `company_id`/`converted_contact_id` no lead), respeitando
    `owner_id`/`assigned_to` do lead como os demais fluxos de criação já fazem.
  - `QualificationEntityBlocks`: substituir a mensagem de "nenhum registro vinculado"
    por nota informativa e renderizar os inputs.
- `src/components/prospecting/qualification-panel.tsx`: efeito de sugestões deixa de
  depender de `entityFields.records`; invalidação das queries do lead/empresa/contato
  após o salvamento (já existente) mantida.
- `src/components/prospecting/qualification-field-layout-dialog.tsx`: ao mudar a
  entidade, ajustar o título padrão do bloco.
- Sem mudança de schema, RLS, autenticação ou regras de decisão da qualificação.
- Design system: mantidos os tokens semânticos, estados de carregando/erro e labels
  acessíveis já usados no bloco.

## Como validar

1. Abrir o lead Ana Marques e mover para "Qualificado": o campo LinkedIn aparece,
   preenchido pelo Apollo quando houver dado.
2. Concluir a qualificação: um contato é criado com os dados do lead + LinkedIn e fica
   vinculado ao lead (visível no detalhe do lead).
3. Reabrir a qualificação: o bloco já carrega o contato vinculado e edita o registro
   existente, sem duplicar.
4. Lead sem empresa vinculada com bloco de Empresa: empresa criada e vinculada ao salvar.
