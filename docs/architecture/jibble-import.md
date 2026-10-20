# Importador Jibble → TechProjects

Tela: **TechProjects › Configurações › Importar do Jibble** (`/projects/settings/imports/jibble`),
também na central `/projects/settings/imports`. Só administradores ativos do workspace; "Ver como"
é somente leitura.

## Fonte (validada em docs.api.jibble.io, coleção pública)

| Uso                                                              | Endpoint                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Token OAuth `client_credentials`                                 | `POST https://identity.prod.jibble.io/connect/token`                                                             |
| Organização                                                      | `GET workspace.prod.jibble.io/v1/Organizations`                                                                  |
| Pessoas (sem filtro de papel/status)                             | `GET workspace…/v1/People`                                                                                       |
| Cargos, grupos, clientes, projetos, atividades, locais, jornadas | `Positions`, `Groups`, `Clients`, `Projects` (`$expand=client,location`), `Activities`, `Locations`, `Schedules` |
| Aprovações                                                       | `workspace…/v1/PayPeriodDefinitions`, `time-attendance…/v1/PayPeriodSummary`                                     |
| Ausências e feriados                                             | `workspace…/v1/TimeOffPolicies`, `Calendars`, `CalendarDays`; `time-tracking…/v1/TimeOffOverview`                |
| Eventos de ponto                                                 | `time-tracking…/v1/TimeEntries` por mês (`belongsToDate ge/lt`)                                                  |
| Lançamentos de horas                                             | `time-tracking…/v1/HourEntries` por mês                                                                          |
| Timesheets                                                       | `time-attendance…/v1/TimesheetsSummary?period=Custom` por mês                                                    |
| Capturas (só inventário, sem `url`)                              | `time-tracking…/v1/Screenshots` por mês                                                                          |

Paginação `$top=500&$skip`, seguindo `@odata.nextLink` só se o host for oficial. Exportação
assíncrona (`Prefer: respond-async`) implementada no cliente: só trata como export quando a
resposta é **202** com `statusUrl` (relativo, no mesmo host); **303** `Location` é baixado sem
`Authorization`; o export de origem nunca é excluído. Endpoint que responde 400/403/404 é marcado
como "recusado/indisponível" no inventário e a execução segue.

Credenciais: o proprietário cria em **Organization Settings › API Credentials** no Jibble. Ficam
cifradas no servidor (`AI_KEYS_ENCRYPTION_KEY`); a tela mostra só os 4 últimos do Client ID.

## Fluxo

1. Salvar credenciais → **Testar** (token + organização + papel de quem criou as credenciais).
2. **Confirmar a organização** pelo ID exibido; exige papel Owner/Admin legível na API.
3. **Prévia** (somente leitura): inventário completo → mapeamentos → reconstrução por pessoa →
   conciliação → relatório. "Recalcular" refaz a partir do staging sem nova leitura.
4. Conferir e **confirmar a prévia**; resolver pessoas, projetos e duplicidades.
5. **Importar**: cria projetos marcados "criar", tarefas por atividade, membros que faltam e
   apontamentos (`status` travado, `billable=false` por padrão). Pendências ficam em revisão.
6. **Desfazer**: remove só o que aquela execução criou e que continua intacto no ERP.

Mudança em mapeamentos/duplicidades depois da prévia exige recalcular antes de importar.
Retomada: checkpoint por fase/página/pessoa; 429/5xx com Retry-After/backoff; espera longa vira
pausa com horário de retomada. O agendador `clockify-import-tick` avança Clockify e Jibble
(não agendado enquanto o app não for publicado; a tela aberta avança a cada 3 s).

## Regras de reconstrução

- Ordem por instante UTC; empate: Out → pausa → In → desconhecido, depois id.
- In com intervalo aberto = troca de projeto/atividade. Out sem aberto = "saída órfã".
- Pausa (`type=Break` ou Out com `isBreak`/`breakId`) fecha o trabalho e abre pausa paga/não
  paga. **Os campos de pausa não aparecem na coleção pública** (só In/Out); são aceitos se
  existirem e precisam ser confirmados com dados reais.
- Sem saída: intervalo aberto no staging, sem fim inventado. > 16 h ou sem projeto: revisão.
- Divisão por dia civil no fuso IANA da pessoa (DST tratado; soma de segundos preservada) ou,
  sem fuso, pelo deslocamento do evento de entrada. `belongsToDate` fica no vínculo.
- Conciliação por dia do Jibble: trabalho + pausas pagas + HourEntries × `tracked` do timesheet
  (tolerância 60 s). Timesheets nunca entram como horas.

## Duplicidade entre fontes

Antes de gravar, cada trecho é comparado com apontamentos da mesma pessoa no ERP (Clockify,
manual, cronômetro): "exato" (início/fim ±120 s) ou "sobreposição". Fica pendente até decisão:
"mesmo evento" registra vínculo de proveniência (`matched_existing`) sem novo apontamento;
"diferentes" libera a gravação — o gatilho de sobreposição do ERP continua valendo e recusa se
houver choque (erro visível, nada contornado).

## Não importado (preservado no staging privado)

Selfies/biometria (não documentado na API), arquivos de captura (só inventário), geolocalização,
horas extras/regulares/aprovações, jornadas/feriados/ausências, tarifas e lançamentos de horas
sem relógio (usados só na conciliação). Nada ativa ponto, folha, biometria, e-mail ou fatura.

## Alternativa sem API

Exportações CSV/XLSX do Jibble ("Timesheets list", "Time entries list", "Tracked time report")
têm colunas úteis, mas não contêm todas as entidades. Não há importador de planilha nesta versão.
