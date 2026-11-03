# Sequência de teste — cópia de "Outsourcing TI — Gestores de TI"

Porte P, cerca de 15–20 min. Só dados, sem mudar código.

## O que será feito
1. Criar um novo rascunho de sequência, **"Outsourcing TI — Gestores de TI (teste)"**, copiando os 6 passos da original: e-mails 1 e 2, WhatsApp 1 e 2, ligação 1 e 2. Os textos, remetentes, modelos e o agente Lia continuam os mesmos.
2. Mudar todas as esperas entre as atividades para **1 minuto**, em vez de 2 dias úteis. A regra do que fazer quando a pessoa responde continua a mesma de cada passo.
3. Trocar o público pelos dois contatos:
   - Guilherme Kologeski — guilherme@wktechnology.com.br
   - Arthur Wolf Kologeski — **arthur.awkologeski@gmail.com**. O endereço que você enviou ("arthur@awkologeski@gmail.com") não é um e-mail válido. Este é o único contato com nome parecido que encontrei.
4. A sequência original não muda. A cópia fica como rascunho desligada: ninguém recebe nada até você iniciá-la.
5. Abrir /prospecting/sequences com a sua conta para confirmar que a cópia aparece com os 6 passos, as esperas de 1 minuto e os 2 contatos.

## Fique atento
- Os WhatsApps usam modelos que ainda precisam estar aprovados pela Meta. Se não estiverem, esses passos vão falhar.
- Pode ser que a sequência só aceite esperas em minutos se a unidade "minutos" existir. Se não existir, eu aviso antes de usar outra unidade.
- A rotina automática roda a cada 2 minutos. Por isso, na prática, cada passo deve sair com 1 a 3 minutos de intervalo.

## Detalhes técnicos
- Inserir uma nova linha em `prospecting_sequence_drafts` no mesmo `workspace_id`, com um `definition` copiado da original (id d28cd47a…). Gerar novos ids para os passos, trocar os passos `wait` para `duration: 1` com unidade em minutos (depois de conferir as unidades aceitas no validador das sequências) e trocar o público para a lista explícita de contatos a5337630… e e08230aa….
