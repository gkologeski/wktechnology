# Vários termos no mesmo filtro "contém" (Público WhatsApp)

## O que muda
- Nos operadores **contém** e **não contém**, o campo de valor vira uma caixa de pills: você digita um termo e aperta Enter (ou escolhe um valor sugerido), e ele vira uma pill. Dá para adicionar vários termos no mesmo filtro.
- Cada pill tem um "x" para remover; Backspace com a caixa vazia remove a última pill. Termos repetidos não entram duas vezes.
- Regras:
  - **contém** "comput", "soft" = o campo contém **qualquer um** dos termos (como um IN do SQL, mas com pedaços de texto).
  - **não contém** "comput", "soft" = o campo **não contém nenhum** dos termos (campo vazio também conta).
- Vale tanto para campos com sugestão de valores (ex.: Setor) quanto para campos de texto simples.
- A contagem ao vivo e o resumo de excluídos continuam como hoje.
- Filtros, campanhas e segmentos já salvos, com um único termo, continuam funcionando sem mudança.
