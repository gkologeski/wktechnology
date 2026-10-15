# Lia: resposta sempre no formato certo + retomada (follow-up) que realmente dispara

## 1. Caso Aline — a IA nunca pode devolver resposta em formato não reconhecido

Hoje a Lia pede a resposta num formato estruturado, mas, quando ela usa ferramentas (agenda, CRM, catálogo) no mesmo pedido, o modelo às vezes responde com texto solto. Existe só uma nova tentativa; se falhar de novo, a conversa trava.

O que muda:
- **Resposta final por "ferramenta de resposta" obrigatória.** A Lia passa a entregar a resposta ao cliente chamando uma ferramenta própria (`responder_cliente`) com os campos fixos (reply, intent, offer_keys, material_ids, answers, handoff_reason). O formato é validado pelo provedor, não por leitura de texto.
- **Etapa final sem ferramentas.** Se ainda vier texto solto, o sistema faz uma chamada final só de formatação, sem ferramentas, usando o texto já gerado e o formato obrigatório.
- **Último recurso automático.** Se mesmo assim falhar, o sistema aproveita o texto puro como `reply` (passando pelos mesmos filtros de preço, links, horários e repetição) em vez de travar. Só vai para Supervisão se não houver texto utilizável.
- **Diagnóstico.** Registrar no histórico técnico (sem dados sensíveis) qual etapa resolveu, para medir se o problema sumiu.

## 2. Caso Andressa — retomada agendada para depois que a janela do WhatsApp fecha

Conferido no banco: a última mensagem dela foi às 17:01 de 14/10; a retomada está marcada para 17:01:52 de 15/10, ou seja, **6 segundos depois do fim da janela de 24 h**. Quando a rotina rodar, a janela já estará fechada e a retomada é descartada como "janela fechada". Não é falta de recurso: o prazo da retomada está mal calculado.

O que muda:
- **Prazo da retomada limitado à janela.** A retomada nunca é marcada depois do fim da janela; fica no menor valor entre o prazo configurado e o fim da janela menos uma margem (ex.: 1 h), respeitando o horário de atendimento da Lia (8h–18h). Se o horário possível cair fora do expediente, antecipa para o último horário de expediente dentro da janela.
- **Fora da janela, template aprovado.** Se a janela já fechou, a retomada usa um template aprovado configurado no agente (opção nova em Configuração do agente › Retomada). Sem template configurado, registra "janela fechada — sem template" de forma visível na Supervisão, em vez de sumir.
- **Andressa agora.** Recalcular a retomada dela (dentro da janela, amanhã no expediente), com seu aceite, já que é uma mensagem real a cliente.
- A retomada continua usando a cota diária e o horário de prospecção já existentes, e para se o cliente responder.

## 3. Uma pergunta por mensagem

A resposta da Aline teve duas perguntas. Adicionar verificação: se a resposta tiver mais de uma pergunta, a Lia reescreve uma vez (mesmo mecanismo da reescrita de preço/repetição).

## Testes e verificação
- Testes automáticos: texto solto → ferramenta de resposta; falha na ferramenta → etapa de formatação; último recurso com texto puro; prazo da retomada nunca após a janela; ajuste ao expediente; fora da janela com e sem template; duas perguntas → reescrita.
- Rodar testes do agente, typecheck, lint e build e reportar resultados reais.
- Nada publicado e nenhuma mensagem enviada sem seu aceite.

## Detalhes técnicos
- `agent.server.ts`: adicionar tool `respond` com o `AGENT_OUTPUT_SCHEMA`; `tool_choice: "required"` na etapa final; chamada de formatação sem `tools` com `response_format` strict; fallback `{ reply: content }` com intent neutra.
- `ingest.server.ts` / `actions.server.ts` / `worker.server.ts`: função única `computeFollowUpAt(lastInboundAt, delay, serviceHours)` com teto `last_inbound_at + 24h - margem`; `scheduleFollowUps` usa template de `tool_config`/playbook quando fora da janela via envio de template já validado no servidor.
- `policy.ts`: `countQuestions(reply) > 1` vira aviso de reescrita.
- Atualizar `src/lib/prospecting/sdr/AGENTS.md` com a regra da retomada limitada à janela.
