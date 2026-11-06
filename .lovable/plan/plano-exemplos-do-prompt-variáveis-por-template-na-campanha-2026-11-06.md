# Plano: exemplos do prompt + variáveis por template na campanha

Porte: M. Estimativa: 2h30–3h30 (prompt ~30 min; templates ~2h–3h).

## 1. Prompts Bruna/Lia (só prompt)
- Trocar os exemplos de resposta por versões que já tragam a frase do motivo do contato antes de qualificar (ex.: "eu mesmo" → reconhecer que ele é o responsável, explicar o motivo do contato e só então perguntar sobre demanda).
- Publicar novas versões (Bruna v5, Lia v21). Sem código, migration ou envio ao Gustavo. Você valida no simulador.

## 2. Variáveis dos templates extras (ICP 012)
Causa confirmada no código: a tela só monta campos de variáveis para o template principal; os templates adicionados na rotação reaproveitam as variáveis pela posição, então nenhum campo aparece para eles.
- Todos os templates adicionados aparecem na tela, cada um com o seu próprio quadro de variáveis ({{1}}..{{N}} lidos daquele template aprovado, pois a quantidade e o significado mudam por template), com os mesmos seletores de campos da campanha. O usuário escolhe as variáveis de cada um separadamente.
- Salvar o mapeamento por template na rotação; o disparo usa as variáveis do template sorteado para aquele destinatário.
- Servidor recusa salvar se faltar variável ou se o template não estiver APROVADO na Meta.
- Campanhas antigas continuam funcionando (sem mapeamento próprio = usa o do principal).
- Atualizar o artigo da Ajuda de campanhas WhatsApp.

## Detalhes técnicos
- `campaigns.whatsapp.tsx`: estado `variables` por item de `template_rotation`.
- `whatsapp-campaigns.functions.ts`: validação zod + checagem de status aprovado.
- `whatsapp-campaign-tick.ts`: resolver variáveis pelo template fixado do destinatário.
- Coluna jsonb existente `template_rotation` guarda o mapeamento (sem migration, se confirmado na implementação).
- Testes: variáveis por template, fallback ao principal, rejeição sem aprovação. Sem disparos reais; ICP 012 continua pausada.
