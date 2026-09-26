# Seletores de data e hora das atividades no padrão HubSpot

## Objetivo

Substituir os controles nativos de data e hora das atividades por uma experiência consistente com as referências enviadas: calendário visual, data e hora separadas, atalhos relativos de vencimento e lista de horários em intervalos de 15 minutos.

## Escopo

Aplicar o novo padrão em todas as ações manuais de atividades:

- criação de nota, ligação, reunião, WhatsApp e tarefa pela timeline;
- edição de tarefas e atividades nas janelas flutuantes;
- controles editáveis nos cartões da timeline;
- tarefa de acompanhamento criada junto de outra atividade;
- repetição de tarefa, inclusive data final;
- criação rápida de tarefa;
- agendamento de reunião, com início e fim;
- criação de atividades em massa.

Não alterar seletores de datas de contratos, finanças, projetos ou outros fluxos que não sejam atividades.

## Experiência proposta

### Data e hora

- Exibir data e hora como controles separados, mantendo visualmente uma única linha quando houver espaço.
- A data abre um calendário em PT-BR com mês, navegação, dia atual, seleção destacada e ações **Hoje** e **Limpar** quando o campo for opcional.
- A hora abre uma lista compacta com intervalos de 15 minutos, destacando o horário escolhido.
- Em telas estreitas, calendário e horário devem caber sem sair da janela; a lista de horas será rolável.
- Preservar foco visível, navegação por teclado, rótulos acessíveis e fechamento previsível após a seleção.

### Vencimento de tarefas

- O seletor principal oferecerá atalhos relativos no padrão das referências: **Hoje**, **Amanhã**, **Em 2 dias úteis**, **Em 3 dias úteis**, **Em 1 semana**, **Em 2 semanas**, **Em 1 mês** e **Data personalizada**.
- Cada opção mostrará a data ou o dia da semana correspondente quando aplicável.
- **Data personalizada** abrirá o calendário e o horário, sem perder o valor já escolhido.
- A hora padrão existente de cada fluxo será preservada; não haverá mudança silenciosa nas regras de vencimento.

### Reuniões e repetição

- Reuniões manterão validação de fim posterior ao início, usando os mesmos controles para ambos.
- A data final de repetição usará o calendário padronizado, sem mudar frequência, intervalo ou limite de ocorrências.
- Lembretes continuarão habilitados somente quando houver vencimento.

## Implementação técnica

- Criar componentes compartilhados e controlados para:
  - data única com calendário;
  - horário em intervalos de 15 minutos;
  - combinação de data e hora;
  - vencimento relativo de tarefas.
- Centralizar conversões entre data local e ISO para evitar deslocamentos de fuso horário.
- Reutilizar o calendário e os componentes oficiais do sistema, com tokens semânticos e suporte a temas claro/escuro.
- Migrar os pontos inventariados sem alterar as mutações, o formato salvo, rascunhos, recorrência, lembretes, permissões ou integrações de calendário.
- Adicionar testes para atalhos em dias úteis, combinação data/hora, limpeza, horários de 15 minutos, conversão local/ISO e validação de reunião.

## Validação

- Conferir criação, edição, acompanhamento, repetição, reunião e ação em massa em desktop e celular.
- Confirmar que os popovers aparecem acima das janelas flutuantes e permanecem interativos.
- Validar temas claro e escuro, teclado, foco, textos em PT-BR e ausência de estouro horizontal.
- Executar testes específicos, checagem de tipos, lint e build da prévia.
- Revisar o resultado visual contra as três referências enviadas.

## Resultado esperado

Todas as atividades terão uma linguagem única de data e hora, próxima ao HubSpot, sem depender dos seletores nativos diferentes de cada navegador e sem mudar regras de negócio ou dados existentes.
