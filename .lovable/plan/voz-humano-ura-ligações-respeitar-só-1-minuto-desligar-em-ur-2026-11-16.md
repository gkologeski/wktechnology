# VOZ-HUMANO-URA — Ligações: respeitar "só 1 minuto", desligar em URA e não conversar com caixa postal

Porte: P/M · Estimativa: 1h30 a 2h (código + testes + Ajuda). Publicação separada, depois da sua aprovação.

## O que muda para você
1. **Pedido de tempo do cliente é respeitado.** Se a pessoa disser "só 1 minuto", "rapidinho", "estou ocupado", a IA resume a proposta em uma frase, faz uma única pergunta e oferece retornar depois. Não emenda o roteiro completo.
2. **URA (menu automático "digite 1...") = desligar na hora.** A IA não tenta conversar com a URA; encerra sem falar e a chamada fica marcada como "URA".
3. **Caixa postal = desligar sem conversar.** Frases como "deixe sua mensagem após o sinal", "não está disponível", "a ligação será encaminhada", mesmo pela metade, são tratadas como atendimento automático, não como resposta do cliente.
4. **Só continua com humano.** A IA só segue o roteiro depois de uma fala que pareça de pessoa (cumprimento, "alô", "quem fala?", resposta à pergunta). Na dúvida, pergunta uma vez "Alô, é a Elga?" e desliga se vier gravação.
5. **Pergunta "Você ainda está aí?"** deixa de ser repetida duas vezes seguidas logo depois da própria IA falar (no caso da Elga ela repetiu sem dar tempo); passa a uma vez, e encerra educadamente se continuar em silêncio.

Vale para Lia, Bruna e qualquer roteiro, em campanhas e em cadências.

## Detalhes técnicos
- `src/lib/prospecting/calls/voice-conversation-rules.ts`: novas regras fixas no prompt (pedido de tempo, detecção humano × URA × caixa postal, uso obrigatório da função de encerrar sem falar) + lista de frases típicas de URA/caixa postal em PT-BR; `idleMessageMaxSpokenCount` 2 → 1.
- Exportar `voiceVoicemailDetection` (detecção de caixa postal do provedor, PT-BR, encerra sem deixar recado) e aplicar nos dois pontos que montam o assistente: `src/lib/prospecting-vapi-call.server.ts` e `src/lib/prospecting/sequences/voice.server.ts` (este último também ganha as `endCallPhrases`, hoje ausentes).
- Resumo pós-ligação já classifica "pessoa, URA, caixa postal"; mantido.
- Testes em `voice-conversation-rules.test.ts`: regras presentes no prompt, idle = 1, detecção de caixa postal presente nos dois montadores.
- Ajuda: atualizar artigo de ligações/campanhas (bump de versão). Permissões: sem tela/ação nova — classificação "só comportamento", contrato de permissão atualizado com hash.

## Limites honestos
- Detecção é por IA + provedor: reduz bastante, mas não garante 100% (ex.: secretária humana muito robótica). Só dá para validar com ligações reais após publicar.
- Não altera banco nem permissões.
