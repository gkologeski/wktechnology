# Ajustes na ligação da Lia/Bruna

Porte: P — cerca de 20 a 30 minutos.

## Problemas
0. **Erro ao salvar a voz do roteiro ("Expected object, received array").** Os dois roteiros piloto que eu criei gravaram as "variáveis" como uma lista vazia, mas a tela espera outro formato. Por isso o salvamento é recusado. A culpa é minha, não sua.
   - Correção: ajustar o formato nos dois roteiros e fazer o salvamento aceitar uma lista vazia, para o erro não voltar.
1. Ao ouvir "não tenho demanda", a Lia disse "posso enviar pelo WhatsApp... por aqui mesmo". Na ligação, "por aqui" é a própria chamada, então a frase fica confusa.
2. Depois da despedida, a chamada continuou aberta por muito tempo. Hoje a ligação não tem um comando para desligar. Ela só termina quando você desliga, quando fica muito tempo em silêncio ou quando chega ao limite de 4 minutos.

## O que será feito
1. **Instruções dos dois roteiros (Lia e Bruna):**
   - Nunca dizer "por aqui" ou "aqui mesmo" falando do WhatsApp. A frase certa é "vou te mandar no seu WhatsApp, nesse mesmo número".
   - Quando a pessoa disser que não tem demanda: agradecer, oferecer o material pelo WhatsApp em uma frase, se despedir e desligar.
   - Depois de qualquer despedida ("tchau", "até mais", "obrigada pelo seu tempo"), encerrar a chamada na hora, sem esperar.
2. **Como a ligação é montada:**
   - Ligar o comando de desligar, para a IA encerrar a chamada sozinha depois da despedida.
   - Cadastrar as frases de despedida que desligam a chamada automaticamente ("tenha um ótimo dia", "até mais", "tchau").
   - Reduzir o tempo de silêncio até desligar para uns 20 segundos.

## Como conferir
- Ler os roteiros de novo depois da alteração.
- Rodar a verificação de permissões e a checagem de tipos.
- O teste de verdade é seu: use "Ligar para teste agora", diga que não tem demanda e confira se a chamada cai logo depois da despedida.
- Para valer nas ligações, o app precisa ser publicado.

## Detalhes técnicos
- `src/lib/prospecting-vapi-call.server.ts`: incluir `endCallFunctionEnabled: true`, `endCallPhrases` (pt-BR) e `silenceTimeoutSeconds: 20` no assistente enviado à Vapi.
- Instruções dos roteiros "Lia — Ligação (piloto)" e "Bruna — Ligação (piloto)": alteradas com a ferramenta oficial de dados, sem migration de estrutura.
- Contrato de permissões: atualizar o hash do arquivo alterado (nenhuma ação nova).
