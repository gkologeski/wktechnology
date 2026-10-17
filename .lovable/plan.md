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
