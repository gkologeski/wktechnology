# TEMPO-COTACAO — erro de tempo esgotado ao editar cotação publicada

Porte **M**, estimativa **3–4 h** (diagnóstico 1 h, correção 1–2 h, testes e Ajuda 1 h).

## O que já foi confirmado
- Os pedidos mais lentos do banco agora são leituras de **um único negócio** e dos **itens de linha do negócio** pelas visões que escondem campos protegidos (`shared_fields_deals`, `shared_fields_deal_line_items`, `shared_fields_contacts`): 1,2–1,5 s em média, até 2,4 s, buscando por id.
- A visão do negócio cruza a tabela inteira com as regras de campos. Abrir a edição da cotação faz várias dessas leituras ao mesmo tempo, e somadas passam do limite de tempo do banco.

## Causa provável (a confirmar no passo 1)
Por ser uma visão protegida, o banco não aplica o filtro "este negócio" antes de checar as permissões de cada linha; ele confere a permissão em milhares de negócios para devolver um.

## Passos
1. **Confirmar**: medir o plano de execução das três leituras como usuário real e identificar qual chamada da edição da cotação estoura.
2. **Corrigir no banco (migração aditiva)**: recriar as três visões mantendo exatamente as mesmas regras de ocultar/mascarar campos e as mesmas permissões, mas permitindo que o filtro por id/negócio seja aplicado primeiro (mesmo padrão já usado nas tabelas grandes do TechSales: contexto do usuário avaliado uma vez por consulta). Sem conceder acesso novo.
3. **Corrigir na tela**: a edição da cotação passa a carregar negócio, contato e itens em uma única leitura enxuta, com nova tentativa automática em falha transitória e mensagem em português, sem perder o que já foi digitado.
4. **Testar**: medir de novo (meta < 200 ms por leitura); abrir no sistema a edição de uma cotação publicada com o Playwright; conferir que quem não pode ver valores continua sem ver; rodar permissões, tipos e testes.
5. **Ajuda**: atualizar "Gerenciar cotações" se a tela mudar algo visível.

## Detalhes técnicos
- `pg_get_viewdef` mostrou `deals CROSS JOIN field_policy` com CTE MATERIALIZED; visões com `security_barrier` impedem empurrar predicados não leakproof.
- Opção preferida: manter `security_barrier` e trocar o CTE por subconsulta escalar `(SELECT shared_field_context() -> 'rules')` (InitPlan), checando o plano; alternativa: RPC SECURITY INVOKER por id.
- Políticas RLS das tabelas base não mudam; migrações antigas não são editadas.
