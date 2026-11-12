# CONECTOR-IMPORTA — Jibble, Clockify e ClickUp como conectores com importação periódica

Porte: G (fatiado em 3 pacotes M). Estimativa total: 2 a 3 dias de trabalho.
- Pacote 1 (conectores em Configurações): 4–6h
- Pacote 2 (agendamento periódico + execução automática): 1 dia
- Pacote 3 (Ajuda, permissões, testes ponta a ponta): 4–6h

## O que o usuário verá
1. Em Configurações › Integrações aparecem três cartões: Jibble, Clockify e ClickUp, com status (não configurado, conectado, sincronizando, falha, pausado).
2. Ao abrir um conector: dados da conexão (chave/credencial guardada só no servidor), botão "Testar conexão", e a importação que já existe (tela atual de TechProjects passa a ser aberta a partir daqui; o caminho antigo continua funcionando).
3. Nova seção "Importação contínua":
   - Ligar/desligar.
   - Frequência escolhida pelo usuário: a cada 1h, 6h, 12h, diária (com horário), semanal (dia + horário).
   - Janela incremental: só busca o que mudou desde a última execução bem-sucedida.
   - Histórico das execuções (início, fim, itens novos, atualizados, retidos para revisão, erro).
   - Botão "Executar agora".

## Regras de segurança dos dados (mantidas)
- Execução automática segue as mesmas regras do importador atual: nunca sobrescreve edição feita no ERP, não duplica (vínculos idempotentes), não dispara workflows, horas continuam vindo só do Clockify/Jibble (ClickUp nunca traz horas).
- O que hoje exige revisão humana (sobreposição entre fontes, pessoas sem vínculo confirmado, agrupamento novo de listas do ClickUp) NÃO é gravado automaticamente: fica pendente na fila de revisão e gera aviso para o responsável.
- Desfazer continua disponível por execução.

## Permissões
- Novas chaves: `system.integrations_import.view`, `.manage` (conectar, agendar, executar agora). Concedidas a ninguém automaticamente; owner/admin via bypass existente.
- Agendamento verificado no servidor e no banco (RLS por workspace, membership ativo, deny prevalece). Testes dos 5 cenários.

## Detalhes técnicos
- Tabela nova `import_connector_schedules` (workspace, provider, enabled, frequência, horário, fuso, next_run_at, last_success_at, created_by) + `import_connector_runs` (histórico). GRANT + RLS na mesma migração.
- Credenciais: reutilizar o armazenamento cifrado já usado pelos importadores (sem mudar a forma de guardar).
- Agendador: um cron a cada 2 min chama rota pública protegida por segredo (padrão do `clockify-import-tick`), seleciona agendas vencidas com trava (`FOR UPDATE SKIP LOCKED`), executa o modo incremental de cada importador e calcula o próximo horário (função pura testada).
- Modo incremental: Clockify/Jibble por data de alteração desde `last_success_at` com margem; ClickUp por `date_updated`.
- Cartões entram no catálogo de integrações existente (`integrations-catalog-page`), detalhe via `settings/integrations/$slug`.
- Ajuda: artigo novo "Importação contínua de Jibble, Clockify e ClickUp" + atualização dos três artigos de importação.

## Dependência / pendência
- Frequências menores que 1h não serão oferecidas (limite de chamadas das APIs de origem).
- Primeira execução automática só depois de uma importação manual completa ter sido feita.
