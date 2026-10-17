# Lia: tratar "saí da empresa" e "número de outra pessoa"

## Casos reais (16/10)
- **Andre Luiz Bachmann:** "não sei te dizer, pois já faz uns 5 anos que saí da Opentech". A Lia pediu o contato de TI mesmo assim; ele respondeu "perdi o contato do pessoal de lá".
- **Rafael Rodrigues:** "Esse telefone não é de Rafael". A Lia não perguntou se quem atendeu conhece o Rafael ou o responsável de TI da empresa.

Hoje a regra de contato errado só reconhece frases como "número errado" ou "não conheço ninguém com esse nome", e nesses casos encerra direto. Ela não reconhece "saí da empresa" nem "esse telefone não é de X".

## Regra única, com uma tentativa de indicação
1. **Novos sinais reconhecidos:**
   - **Saiu da empresa:** "saí da X", "não trabalho mais lá/aí", "faz N anos que saí", "não faço mais parte", "mudei de empresa", "me aposentei".
   - **Número de outra pessoa:** "esse telefone/número não é de X", "não é o X", "aqui não é o X", "você ligou para a pessoa errada".
2. **Primeira resposta:** a Lia pede desculpas e faz **uma única pergunta**: se a pessoa conhece o X ou quem responde pela TI da empresa e se pode passar o contato.
   - Exceção: se a mesma mensagem já recusa ("não sei", "perdi o contato", "não conheço ninguém de lá"), a Lia só agradece e encerra, sem perguntar.
3. **Depois da pergunta:**
   - Se a pessoa passar nome ou telefone, a Lia agradece, registra a indicação na conversa e no CRM como observação, e não manda nada ao indicado sozinha.
   - Se a resposta for negativa ou vaga, a Lia agradece, pede desculpas pelo incômodo e encerra. Ela não pergunta de novo.
4. **Encerramento:** a conversa fecha como "contato não trabalha mais na empresa" ou "número de outra pessoa". Isso não conta como pedido de parar e não gera novas retomadas.
5. A regra fica no prompt da Lia e também tem garantia no servidor. Se a IA tentar insistir uma segunda vez, a mensagem é trocada pelo agradecimento e encerramento.
6. Quem disser "não sou o Rafael, mas cuido da TI" continua a conversa normalmente.

## Guardar no TechERP o contato indicado (caso Danilo Aguiar, 15/10)
7. Quando a pessoa indicar alguém, por texto ("fala com a Ana, 48 99999-0000") ou por **cartão de contato compartilhado** do WhatsApp, a Lia guarda esse contato no TechERP:
   - O telefone é normalizado para o padrão do WhatsApp brasileiro. Se esse número já existir num Contato ou Lead do workspace, a Lia usa o registro que já existe e não cria outro.
   - Se não existir, ela cria um **Lead** com o nome, o celular, a empresa de origem e a observação "Indicado por <quem indicou> via Lia em <data>", com o mesmo responsável da conversa.
   - Se houver mais de um registro possível, ela não escolhe sozinha. Deixa a indicação registrada na conversa para você escolher.
   - A indicação também aparece na linha do tempo do contato que indicou.
8. A Lia agradece a indicação. Ela **não envia mensagem ao indicado** sozinha: o primeiro contato continua sendo por campanha ou modelo aprovado, pela regra das 24 horas do WhatsApp.
9. O cartão do Danilo (+55 15 98144-1500) já está gravado na conversa. Com o seu aceite, posso cadastrá-lo pela mesma regra, sem enviar mensagem.

## Conversas do Andre e do Rafael
As duas estão com "Humano atendendo". Não envio nada a elas sem sua ordem.

## Validação
- Testes automáticos com as mensagens exatas dos dois casos, mais variações. Também confiro que "não é o momento" e "sou eu quem cuida da área" continuam sem encerrar.
- Teste simulado no painel de teste da Lia, checagem de tipos, checagem de código e compilação, com os resultados reais.
- Nada será publicado sem o seu aceite.

## Detalhes técnicos
- `policy.ts`: `detectNotTarget(text)` → `left_company` | `not_this_person` | null; `declinesReferral(text)`; ampliar `WRONG_CONTACT_RE` com "telefone/numero nao e (de|do|da) X".
- `worker.server.ts` (só jobs `reply`): no primeiro sinal sem recusa, uma pergunta fixa de indicação, com a marca `referral_asked` no enrollment/metadados. Na próxima resposta, ou com recusa imediata, faz o encerramento cordial com o motivo. Se vier um telefone, ele é guardado como observação.
- `agent.server.ts`: regra no prompt.
- Sem migration. O estado fica nos metadados existentes do enrollment.

## Não fazer perguntas de qualificação a quem não é o responsável (caso Danilo, 15/10)
- Depois que alguém diz que o número não é do responsável, a Lia fala com essa pessoa **só sobre a indicação**: se conhece o responsável e se pode passar o contato. Ela não pergunta qual é a necessidade, o projeto ou o desafio de TI, e não tenta qualificar quem atendeu.
- Se essa pessoa perguntar por que a WK entrou em contato, a Lia explica numa frase curta, sem perguntar nada sobre demandas, e volta ao pedido de indicação ou encerra.
- A conversa fica marcada como "falando com terceiro". Nesse estado, o servidor bloqueia as perguntas de qualificação. Se a IA gerar uma, a resposta é reescrita uma vez e, se ainda assim falhar, vira o agradecimento e o encerramento.
- Teste automático com as mensagens exatas do Danilo: "Posso saber qual a necessidade de TI do responsável?" e "Você gostaria de falar sobre algum desafio..." devem ser bloqueadas.
