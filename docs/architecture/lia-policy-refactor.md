# Agente SDR — linguagem na configuração publicada, controles no código

Refatoração de 22/10/2026 (base `0ae8a6997`). Objetivo: a Lia obedece à persona
PUBLICADA (`sdr_agent_versions`, status `published`). O código guarda só o
contrato técnico, validações de efeito e controles configurados.

## Divisão

| Fica no código (técnico) | Vem da configuração publicada |
| --- | --- |
| Formato JSON, ferramentas expostas, ids permitidos | Descrição, objetivo, coleta, transferência, instruções, exemplos, expressões a evitar, tom/formalidade/calor/concisão/emojis |
| Autorização, workspace, lease, versão da conversa, `sdr_commit_turn` (agora também com CAS do estado) | Estratégia comercial, ordem das perguntas, encerramentos, indicação, procedência |
| Descadastro explícito determinístico e permanente | Recusa comercial (encerra sem bloqueio permanente) |
| Janela 24 h/template, cota só de retomada, disjuntor, repetição, envio incerto | Limite de perguntas e proibição de valores (`guardrails.max_questions`, `guardrails.no_pricing`) |
| Agenda real, reserva exclusiva, confirmação só com `status=confirmed`, e-mail escrito pelo cliente | Estratégia após recusa de horários (`scheduling.after_rejection`) |
| Validadores de efeito falso (reunião, material, horário não consultado) | Automação "pergunta sobre IA + silêncio" (`tool_config.automations`, desligada) |

## Montagem do prompt (`agent.server.ts › buildPrompt`)

Seções na ordem: contrato técnico → precedência → persona publicada (na íntegra,
rotulada) → controles do agente → orientações complementares
(`qualification_prompt`, abaixo da persona) → contexto verificável (empresa,
agente, origem com campanha/modelo reais, procedência registrada ou "não
registrada", cadastro, estado registrado, fatos do turno, catálogo ativo,
materiais aprovados, questionário). O trace devolve as mesmas seções.

## Estado explícito (`conversation-state.ts`, migração 0184)

`sdr_enrollments.conversation_state` + `conversation_state_version`. A IA emite
`situation` estruturada; o servidor valida (nome só se escrito pelo cliente;
decisor/reunião recusada/procedência só com `evidence_message_id` de mensagem do
cliente; telefone só se legível no turno atual) e grava pelo commit atômico com
compare-and-set. Itens que dependem da nossa mensagem (`referral_asked`,
`awaiting_referral`, `closed`) guardam `job_id` e só valem se o turno foi
enviado. Encerramentos antigos são lidos do `cancel_reason` existente — sem
backfill, nenhum dado alterado.

## Pipeline único (`turn.ts › decideTurn`)

Produção (`processJob`) e teste do estúdio (`testSdrAgent`) chamam a mesma
função. Diferenças só nos adaptadores: produção usa banco/Google/WhatsApp; teste
usa memória, agenda falsa, nenhuma escrita, IA marcada `sdr_agente_teste`. O
teste pode usar a persona do editor (rascunho) ou a versão publicada.

## Conflitos resolvidos

1. "REGRAS FIXAS" 1–10/5a–5n no prompt (contradiziam a persona) → removidas.
2. `stripStockOpener`, `fixVocative`, `dedupeRepeatedWords` reescreviam a resposta → removidos; `toneIssues` só como telemetria (expressões e limite configurados).
3. Reescritas por decisor já identificado → removidas (estado `decision_maker_confirmed` no prompt).
4. Preço e nº de perguntas fixos no worker → só controles configurados; uma nova geração; preço persistente bloqueia envio automático.
5. `REFERRAL_THANKS` ("vou entrar em contato") → removido; texto da IA.
6. `CONTACT_SOURCE_REPLY` (bases públicas sem prova) → procedência real ou "não registrada".
7. `POST_CLOSE_REPLY` fixo para qualquer "?" → conversa reabre para a IA interpretar; `closed_no_reply_needed` volta a pausar sem enviar.
8. `outOfIcpRole` (dev/estagiário/suporte) → removido.
9. `MATERIAL_HANDOFF_REPLY` ("em instantes") → removido; promessa sem anexo regenera e, se persistir, bloqueia envio automático.
10. Contato errado encerrava direto → a persona decide (pergunta uma vez); encerramento pela situação.
11. "Não é o momento", reunião recusada + orçamento, nome corrigido → orientados pela persona e pelo estado.
12. Transferência após 30 min da pergunta sobre IA → automação opcional, versionada, desligada.
13. Opt-out "não quero"/"não tenho interesse"/palavras soltas no meio do texto → só pedido explícito; palavras únicas configuradas valem como mensagem inteira.
14. Agenda: recusa sem data devolvia `ask_preference` forçado → nova consulta com até 3 outras opções em ordem cronológica (`after_rejection` configurável).
15. Reserva sem e-mail → `email_required`; e-mail precisa estar escrito pelo cliente.
16. Lista fixa "WK Sob Medida" no código → removida; o catálogo ativo do workspace é a fonte.
17. Instruções conversacionais dentro dos resultados de ferramentas → trocadas por fatos.
18. Reabertura após encerramento criava turno com versão antiga da conversa → versão relida após trocar o dono.

## Limites conhecidos

- Obediência ao prompt não é garantida; os controles cobrem efeitos, não estilo.
- Em modo supervisionado (rascunho), o encerramento só pausa o atendimento após o envio pelo worker; quando um humano aprova o rascunho, o estado é gravado mas a pausa não é aplicada automaticamente (já era assim).
- A transferência continua sem mensagem automática ao cliente (rascunho guardado para o humano).
- Equivalência com LLM real não comprovada por fixtures; testes usam saídas programadas.

## Reversão

- Código: reverter os arquivos do SDR para `0ae8a6997`.
- Banco (0184): aditivo. A função `sdr_commit_turn` antiga ignora as chaves novas; para voltar, reaplicar o corpo de `0061_sdr_commit_turn_answers_cas.sql`. As colunas novas podem ficar (sem uso) — não remover dados.
