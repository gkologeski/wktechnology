# Sequência de teste: limpar descadastro, incluir Guilherme e espera mínima de 1 minuto

Estimativa: porte M, cerca de 1h30 a 2h.

## 1. Limpar o descadastro do contato de teste (cerca de 10 min)
- Remover a marcação de descadastro de Guilherme Kologeski (guilherme@wktechnology.com.br / +5548991104003): a inscrição SDR marcada como descadastrada na campanha "Teste 007" e o registro de descadastro de e-mail, se houver.
- Afeta só esse contato. O histórico de mensagens fica como está.

## 2. Espera mínima de 1 minuto entre etapas (cerca de 1h)
- Hoje a espera só aceita horas ou dias úteis, com mínimo de 1 hora. Vou adicionar a unidade "minutos", com mínimo de 1 minuto, em quatro pontos:
  - no editor da sequência (seletor de unidade e validação);
  - na validação do servidor ao salvar e ao criar a versão;
  - no banco: verificações e o cálculo da próxima etapa no agendador, convertendo minutos em intervalo real;
  - nos testes da regra de espera: 1 minuto é aceito, 0 é recusado, horas e dias continuam funcionando igual.
- O agendador roda a cada 2 minutos. Por isso, na prática, uma espera de 1 minuto pode levar até cerca de 2 minutos.
- Versões já criadas não mudam, porque são imutáveis.

## 3. Atualizar a sequência de teste (cerca de 20 min)
- Na sequência "Outsourcing TI — Gestores de TI (teste)", mudar todas as esperas para 1 minuto.
- Criar uma nova versão imutável e cancelar a reserva de público anterior, que não teve disparos.
- Reservar o público de novo, já com Guilherme e Arthur, e confirmar que nenhum dos dois aparece como bloqueado.
- Não vou iniciar os disparos. Você clica em "Iniciar inscrição selecionada" quando quiser.

## 4. Validação
- Rodar a checagem de permissões, os testes da regra de espera e o lint.
- Abrir a tela de sequências no navegador e conferir o seletor de minutos e a reserva com os 2 contatos.

## Fora deste lote
- Publicação: só faço com seu pedido explícito. Depois deste lote, posso publicar tudo de uma vez.
