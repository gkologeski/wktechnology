# Presets de outsourcing para todos os cargos

## O que verifiquei

- A tabela de **Produtos não existe mais** no banco. Ela foi removida na migração para Serviços, junto com os vínculos de produto nos itens de negócio. Não há como "reimportar produtos": eles não estão mais lá.
- Já existe o preset **Desenvolvedor Java Senior** (Outsourcing de TI, R$ 18.000/mês), além de Delphi Senior, React Senior e dois de .NET C# Senior (um deles duplicado, com "(cópia)" no nome). São só **5 presets** no total.
- Existem **249 cargos** cadastrados; apenas 12 têm senioridade e 117 têm linha de serviço.
- O histórico de preços por cargo sobrevive nos **itens dos negócios já lançados** (ex.: "Desenvolvedor Java Senior" de R$ 18.000 a R$ 27.000; "Desenvolvedor Delphi Senior" até R$ 22.000). Essa é a única fonte de valor que restou dos antigos produtos.
- Todos os itens de negócio já estão classificados por serviço (nenhum item sem serviço).

## O que será feito

### 1. Presets para todos os cargos

Criar um preset de contratação para cada um dos 249 cargos ativos, em lote:

- **Nome do preset**: nome do cargo (mais a senioridade quando ela for definida).
- **Linha de serviço**: a do cargo quando já existir; quando não existir, definida por regra — cargos de TI vão para **Outsourcing de TI**, cargos administrativos/financeiros para **BPO Administrativo/Financeiro**, cargos de RH para **Recursos Humanos (BPO)**.
- **Unidade**: mês (padrão de outsourcing).
- **Preço sugerido**: o **maior valor já praticado** para aquele cargo no histórico de negócios. Cargo sem histórico fica com preço em branco, para ser preenchido depois.
- **Senioridade**: quando o histórico traz o cargo com senioridade explícita (Júnior/Pleno/Sênior), criar um preset por senioridade encontrada, cada um com o maior valor daquela senioridade. Isso vale para os cargos de desenvolvimento, QA, análise etc.

### 2. Limpeza leve

- Desativar o preset duplicado "Desenvolvedor .NET C# (cópia)".
- Não sobrescrever nem duplicar os 5 presets que já existem: os valores atuais são preservados; se o histórico indicar valor maior, isso aparece apenas como sugestão na tela, sem alteração automática.

### 3. Uso no dia a dia

Com os presets criados, o comportamento volta a ser o de antes: no item de linha do negócio, ao escolher o serviço, o seletor de preset já lista "Desenvolvedor Java Senior" e afins, e ao escolher o preset o cargo, a senioridade, a unidade e o valor entram preenchidos — tudo editável.

Nenhuma tela nova é necessária: a tela de **Configurações → Catálogo → Presets de contratação** já existe para revisar e ajustar tudo depois, e o seletor de preset já está no item de linha e no vínculo de serviço do contrato.

## Detalhes técnicos

- Uma única operação de dados (sem migration, sem mudança de schema, RLS ou permissão): `INSERT INTO public.contracting_presets` a partir de `job_profiles`, com `LEFT JOIN` no agregado `max(unit_price)` de `deal_line_items` casando por nome (nome do cargo, e nome do cargo + senioridade em português para as variantes por senioridade).
- Classificação de serviço reaproveita as regras já existentes em `src/lib/catalog/line-item-classify.ts` (palavras-chave de TI / administrativo-financeiro / RH), aplicadas em SQL na inserção.
- Inserção idempotente: nada é criado quando já existe preset ativo com o mesmo `job_profile_id` + `seniority` no workspace.
- `workspace_id`, `owner_id` e `currency` herdados do cargo de origem; `active = true`.
- Sem alteração de código de aplicação; opcionalmente reaproveito `job_profiles.default_unit_price` quando estiver preenchido e o histórico não tiver o cargo.

## Como validar

1. Abrir Configurações → Catálogo → Presets de contratação e conferir a lista (deve passar de 5 para ~250+).
2. Em um negócio, adicionar item de linha com serviço "Outsourcing de TI" e abrir o seletor de preset: "Desenvolvedor Java Senior" deve aparecer e preencher cargo, senioridade, unidade e valor.
3. Conferir por amostragem que os valores conferem com o maior valor já vendido daquele cargo.
