# Por que o enriquecimento gastou 1 crédito e não trouxe dados

## Diagnóstico (verificado nos dados reais)

O lead `Luiz Feitosa` / `Frequencia Inteligência` tem:

- e-mail `profeitosa@yahoo.com.br` (provedor gratuito)
- empresa vinculada sem `website` e sem `domain`

O cache gravado no lead mostra o resultado real da consulta:
`domain: null`, `companies: {}`, `warnings: []`, e as sugestões de lead/contato contendo apenas `first_name: "Luiz"` e o próprio e-mail que já estava no lead.

Ou seja, a cascata se comportou assim:

```text
1) domínio pelo site/domínio da empresa  -> vazio (empresa sem site)
2) domínio pelo e-mail                   -> descartado (yahoo.com.br é provedor gratuito)
3) domínio por nome da empresa (Apollo)  -> nenhum resultado, sem erro
4) organizations/enrich                  -> não executado (sem domínio)
5) people/match por e-mail               -> Apollo respondeu 200 com uma "pessoa"
                                            que só ecoa o que enviamos
```

Consequências:

- o `people/match` é a chamada cobrada: o Apollo debita o crédito mesmo quando devolve um registro sem dados novos (só o eco do e-mail enviado);
- como havia algo em `lead`, o resultado foi marcado como `found: true` e ficou em cache por 30 dias, então a tela mostra "enriquecido" sem nenhum campo novo;
- `warnings` vazio confirma que não houve erro de crédito/permissão — foi realmente "nenhum dado".

Detalhe adicional encontrado: a busca de domínio por nome (`/api/v1/mixed_companies/search`) é enviada como POST com os filtros na **query string** e corpo vazio. Esse endpoint espera os filtros no corpo, o que explica um resultado vazio silencioso mesmo para empresas que o Apollo conhece.

## Correções propostas

1. **Não chamar `people/match` quando não há sinal útil**
   Exigir pelo menos um destes antes de gastar crédito: LinkedIn da pessoa, e-mail corporativo (domínio não gratuito), ou nome + domínio resolvido. Nome + apenas nome de empresa e e-mail de provedor gratuito passam a ser "sem sinal suficiente" — retorna aviso explicativo, sem chamada paga.

2. **Corrigir a busca de domínio por nome**
   Enviar `q_organization_name`, `page` e `per_page` no corpo do POST de `mixed_companies/search` (mantendo o mesmo tratamento de erro). Isso aumenta a chance de resolver o domínio e, com domínio, o `people/match` fica muito mais preciso.

3. **Considerar "vazio" o resultado que só ecoa a entrada**
   Descartar sugestões cujo valor é igual ao que já existe no lead/empresa/contato antes de calcular `found`. Sem campo novo, `found: false`.

4. **Não cachear resultado sem ganho**
   Só gravar o cache quando houver pelo menos um campo novo; assim uma nova tentativa (após preencher o site da empresa, por exemplo) não fica bloqueada por 30 dias.

5. **Mensagem clara na tela de qualificação**
   Quando não houver sinal suficiente, mostrar aviso curto do tipo "Sem dados suficientes para enriquecer: informe o site da empresa, um e-mail corporativo ou o LinkedIn do contato" no lugar de um estado que parece sucesso.

## Detalhes técnicos

- `src/lib/integrations/apollo-enrich.server.ts`: filtros no corpo do POST em `apolloFindDomainByName`; nova checagem de pré-requisitos em `runApolloCascade` antes de chamar `apolloPeopleMatch`, adicionando aviso quando o sinal é insuficiente.
- `src/lib/prospecting/qualification-enrichment.functions.ts`: comparar as sugestões com os valores atuais do lead/empresa/contato, calcular `found` apenas com campos novos e só gravar o cache nesse caso.
- `src/components/prospecting/qualification-panel.tsx`: exibir o aviso de "sinal insuficiente" e manter o botão "Enriquecer novamente".
- Sem mudança de schema, RLS, autenticação ou regras de qualificação.

## Como validar

1. Reabrir a qualificação deste lead: nenhuma chamada paga, aviso de sinal insuficiente.
2. Preencher o site da empresa `Frequencia Inteligência` e clicar "Enriquecer novamente": a cascata resolve o domínio, enriquece a empresa e só então tenta a pessoa.
3. Lead com LinkedIn ou e-mail corporativo: fluxo atual mantido, com dados novos e cache gravado.
