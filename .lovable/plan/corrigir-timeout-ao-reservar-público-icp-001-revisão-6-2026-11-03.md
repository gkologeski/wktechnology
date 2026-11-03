# Corrigir timeout ao reservar público (ICP 001, Revisão 6)

Porte P/M — estimativa 1h30–2h30 (diagnóstico confirmado + migração + teste real da reserva).

## Diagnóstico (provável, a confirmar no 1º passo)
A reserva roda numa única operação do banco limitada a 8 s. Na rotina de reserva, a busca de duplicados em Leads e Contatos compara telefones aplicando "remover tudo que não é dígito" em cada telefone de cada registro da base (dezenas de milhares de linhas, 3 telefones cada), além de comparar e-mails com `lower(btrim(...))`. Isso impede o uso de índices e varre a base inteira; com um público grande como o do ICP 001 passa dos 8 s.

## Passos
1. Confirmar: medir o tamanho do público da Revisão 6 e rodar o plano de execução (EXPLAIN) das buscas de Leads/Contatos com os candidatos reais, identificando o trecho que estoura.
2. Migração nova (sem alterar migrações antigas) recriando `prospecting_sequence_cohort_prepare` com o mesmo resultado:
   - montar uma vez as listas de e-mails e telefones (só dígitos) dos candidatos;
   - comparar telefones pelas colunas já normalizadas em E.164 (`whatsapp_e164`, `mobile_phone`, `phone` normalizados na varredura E.164) usando índices de expressão `regexp_replace(...)`/`lower(btrim(email))` por workspace, criados na mesma migração;
   - trocar `OR` grandes por `UNION` de buscas indexadas.
   - Regras de bloqueio, permissões, trava e mensagens permanecem idênticas.
3. Se ainda passar do limite, ajustar o `statement_timeout` só desta função (ex.: 30 s), mantendo a operação atômica.
4. Validar: reservar o público da Revisão 6 – ICP 001 pela tela (Playwright) e comparar contagens de elegíveis/bloqueados com uma prévia calculada antes da mudança; rodar `enrollment.server.test.ts` e `permissions:check`.

## Fora do escopo
Nenhuma mudança de tela, regra de exclusão ou permissão. Nada é publicado sem seu pedido; a reserva não dispara mensagens.
