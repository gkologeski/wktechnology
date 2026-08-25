# Diagnóstico: busca "teste 001" retornou 0 prospects

## O que foi verificado

Reproduzi a busca exata gravada no banco (`prospecting_searches`, registro "teste 001", status `completed`, `result_count = 0`, sem erro) chamando a API do Apollo com os mesmos parâmetros salvos em `apollo_query`.

Resultado da reprodução:

```text
consulta completa salva na busca ............................ 0 resultados
só person_titles=[CTO] + person_locations=[Florianópolis] .... 102 resultados
+ organization_num_employees_ranges (4 faixas) ............... 18 resultados
+ organization_industry_keywords (3 setores) ................. 102 (filtro ignorado)
+ q_keywords="desenvolvimento software" ...................... 0 resultados
```

## Causa

O campo **Palavras-chave** é o que zera a busca. O código concatena todas as palavras-chave em uma única string (`q_keywords: "desenvolvimento software"`) e o Apollo trata isso como texto livre em português que precisa casar (AND) com o perfil/empresa. Nenhum registro do Apollo — base majoritariamente em inglês — casa "desenvolvimento software" junto com cargo CTO em Florianópolis.

Fatores agravantes encontrados na mesma reprodução:

1. `organization_industry_keywords` **não é um parâmetro válido** do endpoint de people search do Apollo — ele é aceito e silenciosamente ignorado (102 resultados com e sem o filtro). Ou seja, o filtro "Setor/Indústria" hoje não filtra nada. O parâmetro correto é `organization_industry_tag_ids` (IDs de indústria) ou `q_organization_keyword_tags`.
2. Cargos em português ("Head de TI", "Diretor de TI") praticamente não existem na base do Apollo; só "CTO" trouxe volume.
3. Combinar 4 faixas de porte reduziu de 102 para 18 — restringe muito quando somado aos demais filtros.
4. Quando o Apollo devolve 0, a busca grava `status = completed` sem nenhuma mensagem, então a tela mostra "0 prospects" sem explicar o motivo.

O enriquecimento (`GET /api/v1/people/{id}`) foi testado e funciona corretamente — não é a causa.

## Correções propostas

### 1. Tratamento das palavras-chave (`src/lib/prospecting.functions.ts`)

- Deixar de concatenar os termos numa string única com AND implícito.
- Enviar palavras-chave como termos separados via `q_organization_keyword_tags[]` (OR entre tags) em vez de `q_keywords`, ou manter `q_keywords` apenas quando o usuário digitar um único termo.

### 2. Filtro de setor realmente funcional

- Substituir `organization_industry_keywords` por parâmetro suportado pelo Apollo (`organization_industry_tag_ids` a partir da taxonomia já existente em `src/lib/prospecting-options.ts`, ou `q_organization_keyword_tags` como alternativa).

### 3. Feedback ao usuário quando o retorno é 0

- Gravar em `prospecting_searches.error` (ou novo campo de aviso) uma mensagem do tipo "O Apollo retornou 0 pessoas para estes filtros" com o `total_entries` devolvido.
- Exibir na aba "Busca de prospects" um estado vazio explicativo com sugestão de remover filtros (palavras-chave, porte, cargos em português).

### 4. Ajustes de UX no formulário de busca

- Aviso no campo Palavras-chave de que ele restringe bastante e funciona melhor em inglês.
- Aviso/placeholder nos cargos indicando usar termos em inglês (CTO, Head of IT, IT Director).

## Fora do escopo

- Alterar RLS, schema de permissões ou outras abas da Suíte de Prospecção.
- Trocar de provedor de dados.

## Como validar depois

1. Reabrir "teste 001", remover as palavras-chave e rodar → deve retornar prospects.
2. Rodar com os filtros originais → deve mostrar mensagem explicativa em vez de "0" silencioso.
3. Rodar com filtro de setor → verificar no `apollo_query` gravado que o parâmetro enviado é o suportado pelo Apollo.
