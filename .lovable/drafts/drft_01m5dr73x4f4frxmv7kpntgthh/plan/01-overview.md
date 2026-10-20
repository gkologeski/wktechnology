# Campanhas no Painel de vendas (TechSales)

Hoje o painel de vendas (`/dashboard`) mostra pipeline, reuniões, contatos por dia e funil de negócios, mas nada sobre os envios de campanhas. A proposta é adicionar uma seção **"Campanhas e prospecção"**. Ela usa os mesmos filtros de período e de escopo (Meus / Equipe) que o painel já tem.

## Gráficos sugeridos

1. **Faixa de indicadores (5 cartões)**: Disparados, Entregues, Respondidos (taxa), Atendidos por humano e Reuniões agendadas. Cada cartão traz a comparação com o período anterior.
2. **Funil de campanhas** (barras horizontais decrescentes): Disparado → Entregue → Lido/Aberto → Respondido → Qualificado → Passado a humano → Reunião agendada → Negócio criado. Cada etapa mostra a quantidade e a conversão em relação à etapa anterior. Um seletor de canal (Todos / WhatsApp / E-mail) altera o funil.
3. **Envios por dia por canal** (barras empilhadas, no mesmo padrão de "Contatos por dia"), com uma linha sobreposta para as respostas recebidas.
4. **Comparativo por canal** (barras agrupadas WhatsApp × E-mail): taxas de entrega, resposta e agendamento lado a lado.
5. **Ranking de campanhas** (tabela compacta, top 10): nome, canal, disparados, % de resposta, reuniões e falhas. Cada linha abre a campanha.
6. **Falhas e bloqueios** (rosca): falha de envio, número inválido ou fixo, descadastro, bloqueado por contato recente e bloqueado por negociação aberta ou cliente ativo. Responde à pergunta "por que não chegou?".
7. **Lia × humano** (barras empilhadas 100%): proporção das conversas resolvidas pela Lia e das passadas a um humano, com o tempo médio até a primeira resposta humana.

## Regras de leitura

- Um indicador sem dado aparece como "sem cobertura", nunca como zero. Isso segue a regra do painel de vendas.
- Uma etapa que o canal não informa (por exemplo, "lido" no WhatsApp quando o provedor não confirma) aparece marcada como "não rastreado", sem inventar o número.
- A visibilidade respeita as permissões atuais: a tela só lê dados do workspace ativo e dentro do escopo do usuário.

## Fora de escopo

Não haverá alteração de banco, de permissões nem do comportamento das campanhas, e nenhum envio será feito. A página de Prospecção continua igual.
