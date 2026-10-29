# Lentidão e quedas do banco — diagnóstico e otimização

Porte M — estimativa 1h30 a 2h30. Dependência: banco estável durante as medições.

## O que já foi verificado (agora, 13:57)

- Saúde do banco: no ar, 0 reinícios, memória 61%, disco 47%, 30/90 conexões, sem alertas de esgotamento em 48h. 4.848 transações desfeitas desde o último reinício (inclui os cancelamentos por tempo). Neste momento não há falta de capacidade; as quedas parecem vir de consultas longas, não do tamanho do servidor.
- Alterações recentes: 0270, 0272 e anteriores estão no banco. O índice da 0271 não existe, mas isso é esperado: a 0272 o removeu de propósito e trocou por quatro índices por status, que existem.
- Um arquivo antigo (`0267_service_agent_technical_rate`) não consta na lista oficial de alterações, porém o conteúdo dele está no banco (índice e função existem). Nada faltando; só a lista está desalinhada.

## Consultas mais pesadas (ranking por tempo total)

| # | Tela / uso | Média | Pior | Observação |
|---|---|---|---|---|
| 1 | TechPeople — lista de pessoas por status, com contagem | 6,1 s | 7,7 s | Tabela pequena; o custo está na regra de acesso por pessoa |
| 2 | Chat interno — mensagens das conversas | 2,3 s | 5,2 s | Mesma suspeita: regra de acesso por mensagem |
| 3 | Painéis de vendas (leads/negócios por período, estágio, valor) | 0,25–0,45 s | 0,9 s | ~8 consultas parecidas por carregamento |
| 4 | Listagem completa de contatos com contagem | 4,0 s | — | Sem filtro de workspace |
| 5 | Chat: membros/conversas; WhatsApp: marcar como lido e mensagens; Lia: inscrições por status | 0,1–0,5 s | — | Chamadas frequentes |

A causa exata de 1 e 2 ainda não está confirmada; o primeiro passo é confirmá-la.

## Passos

1. Confirmar causas com `EXPLAIN` (sem executar escritas) para as consultas 1, 2, 3, 4 e as do item 5, usando a sessão do Guilherme.
2. Pessoas (1): se confirmado, fazer a checagem de acesso uma vez por consulta (e não por linha) e/ou índice `(workspace_id, status)`. Não muda quem vê o quê.
3. Chat (2): idem — checagem de membro da conversa calculada uma vez; índice de membros por usuário/conversa se faltar.
4. Painéis de vendas (3): índices por `(workspace_id, created_at)` em leads e `(workspace_id, stage, closed_at)` em negócios, se o plano mostrar varredura.
5. Contatos (4): localizar a tela que pede contatos sem filtro e paginar/filtrar por workspace.
6. Item 5: índices pontuais apenas onde o plano indicar varredura (ex.: inscrições da Lia por workspace+status).
7. Medir antes/depois com a mesma sessão; recolocar o ranking de consultas lentas.
8. Alinhar a lista oficial de alterações com o arquivo `0267_service_agent_technical_rate` (sem reaplicar nada).

## Fora do escopo

- Não alterar quem pode ver cada registro, dados ou publicação.
- Não aumentar o servidor: os números atuais não justificam.

## Detalhes técnicos

- Funções suspeitas: `hr_people_access(...)` na política `hr_view` de `people`; `shared_chat_access(conversation_id)` em `chat_messages`; views `shared_fields_*` com `shared_field_context()`.
- Padrão de correção: envolver chamadas estáveis em `(select ...)` para virar initplan, ou criar função `security definer` que devolve o conjunto de ids permitidos; índices simples via migração (sem CONCURRENTLY).
- Validação: `permissions:check`, testes de acesso existentes de people/chat (permitido, sem chave, deny, outro workspace, inativo), Playwright nas telas Pessoas e Chat.
