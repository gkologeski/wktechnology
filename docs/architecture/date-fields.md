# Campos de data (skill date-picker-br)

Toda entrada de **data única** do TechERP usa o mesmo controle. Intervalos
continuam com `DateRangePicker`/`IsoDateRangePicker`/`DateRangeFilter`.

## Qual componente usar

| Caso                                                               | Componente                                                                   | Valor                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------- |
| Dia em coluna `date`, formulário, filtro de um dia                 | `IsoDatePicker` (`@/components/iso-date-picker`)                             | `"YYYY-MM-DD"` ou `null`                      |
| Dia como `Date` em memória                                         | `DatePicker` (`@/components/date-picker`)                                    | `Date`                                        |
| Data **com hora** (agenda, envio, ocorrência, vencimento com hora) | `ActivityDateTimePicker` (`@/components/activity/activity-date-time-picker`) | `local` (`YYYY-MM-DDTHH:mm`), `iso` ou `date` |
| Intervalo / período                                                | `DateRangePicker`, `IsoDateRangePicker`, `DateRangeFilter`                   | `{ from, to }`                                |

`ActivityDateTimePicker` usa `DatePickerPanel` (mesma seleção de dia, com os
atalhos); trocar o dia preserva a hora, e a hora não muda de fuso.

## Regras do controle

- pt-BR, `dd/MM/yyyy`; atalhos **Personalizado → Ontem → Hoje → Amanhã**.
  "Personalizado" não altera o valor e mantém aberto; os outros aplicam e fecham.
- Calendário de 1 mês, um clique escolhe e fecha; dia em `startOfDay`; listas
  de mês e ano para saltar rápido (nascimento, admissão, prazos distantes).
- `min`/`max` limitam calendário **e** atalhos (atalho fora do limite fica desativado).
- Opcional: "Limpar" devolve `null` (só aparece com valor). `required`: sem "Limpar"
  (mesmo se `onClear` for passado), `aria-required`. Campo vazio nunca recebe "Hoje" sozinho.
- Dentro de `<form>`: com `required`, `name`, `min` ou `max`, um `<input>` espelho
  (fora da tabulação) participa da validação nativa — obrigatório vazio ou valor
  salvo fora dos limites impede o envio, o foco vai ao gatilho (se for o 1º
  campo inválido) e a mensagem PT-BR aparece no campo e em `role="alert"`
  ligado por `aria-describedby`. `name` envia `"YYYY-MM-DD"` no `FormData`.
  Data impossível salva aparece vazia, mas nada a apaga por efeito.
- Sem `min`/`max` não há limite de ano: as listas de mês/ano mostram uma janela
  que acompanha o mês exibido e o valor (130 anos antes, 100 depois), então
  1880, 2200 e além abrem no próprio valor e as setas seguem navegando.
- `id` vai no gatilho (use `<Label htmlFor>`); sem rótulo visível, passe `ariaLabel`.
  `invalid` → `aria-invalid` + borda de erro; `disabled`/`readOnly` não abrem.
- Abre acima de janelas e gavetas (`z-[180]`), sem passar da largura da tela.
- Conversão em `@/lib/iso-date`: nunca `new Date("YYYY-MM-DD")` (UTC) nem
  `toISOString().slice(0, 10)` para "hoje" (vira amanhã à noite em UTC-3);
  data impossível (31/02, 29/02 fora de bissexto) é vazia, nunca outro dia.
- Edição em massa de datas grava `"YYYY-MM-DD"` (todas as colunas atuais são
  `date`); antes ia data-hora UTC e podia virar o dia seguinte.

## Verificação automática

`src/lib/date-field-guard.test.ts` analisa a árvore do TypeScript (não linhas),
então pega atributos em várias linhas e tipos indiretos. Falha quando:

- `type="date"` / `type={"date"}` aparece em qualquer elemento;
- em `<input>`/`<Input>`, o `type` dinâmico pode resultar em `"date"`
  (ternários, `??`, `||`, constantes do arquivo) **ou** vem de metadado sem
  prova (ex.: `type={f.type ?? "text"}`);
- o texto `"datetime-local"` aparece no código;
- o calendário base é importado fora dos componentes compartilhados.

Prova aceita de não-data: literais, `nativeInputType(x)` (`@/lib/native-input-type`,
que no tipo exige o ramo de data antes e em execução nunca devolve data) ou
repasse de prop de um invólucro (os usos do invólucro são checados).
Esquemas (`{ type: "date" }`) e comparações não são entradas e não são barrados.
Limite conhecido: `createElement("input", …)` e props espalhadas (`{...p}`) não
são analisados. Exceção nova precisa de motivo no teste e aqui.
Testes: `src/components/date-picker.test.ts` (jsdom: atalhos, limites, formulário
com obrigatório/FormData/foco/erro, 1880/2200, navegação), `src/components/date-field-editors.test.ts`
(filtro avançado, edição em massa, formulário público, `nativeInputType`) e
`src/lib/iso-date.test.ts` (7 fusos, horário de verão, bissexto, limites, data-hora).

## Exceções justificadas (sem mudança)

| Onde                                                                                                             | Motivo                                                            |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `DateRangePicker`, `IsoDateRangePicker`, `DateRangeFilter` (25 arquivos) e filtros de grade "… entre"            | intervalo, não data única                                         |
| `projects/billing/profitability-panel.tsx`, `measurements-panel.tsx`, `billing-config-card.tsx` (`type="month"`) | mês/ano de competência                                            |
| `settings.booking.tsx`, `projects/quick-time-entry-dialog.tsx` (`type="time"`)                                   | horário isolado                                                   |
| `workflows/builder/step-forms/data-forms.tsx` ("Formato")                                                        | texto de formato (`yyyy-MM-dd`), não data                         |
| `book.$slug.tsx`, `schedule.$token.tsx`                                                                          | calendário de disponibilidade (horários livres), não campo        |
| `projects.lists.$id.tsx` (`CalendarView`)                                                                        | visualização de tarefas no calendário                             |
| `prospecting/list-builder.tsx`, `lib/whatsapp/campaign-audience.ts`                                              | filtros relativos/período ("últimos 30 dias")                     |
| `workflows/builder/conditions-editor.tsx` em modo token                                                          | valor é expressão `{{…}}`                                         |
| `lib/import/document-source.ts`                                                                                  | lê HTML de documento importado                                    |
| `lib/native-input-type.ts`                                                                                       | lista os tipos de data que o auxiliar exclui                      |
| `grid/grid-filter-panel.tsx`, `workflows/builder/conditions-editor.tsx` (`type="number"`)                        | ramo de data (intervalo / `IsoDatePicker`) retorna antes          |
| `grid/bulk-edit-fields-dialog.tsx` campo `expires_at`                                                            | timestamp; já usava `DatePicker` (início do dia)                  |
| `proposals/proposal-wizard.tsx`                                                                                  | já usava `DatePicker`                                             |
| `ActivityDueDatePicker` ("Quando você fará?")                                                                    | atalhos de acompanhamento da atividade; o dia usa o painel padrão |

## Inventário da padronização (23/10/2026)

Rodada 1 (a0056dbb8): 89 controles em 61 arquivos de tela: 81 → `IsoDatePicker`
(73 `type="date"`, 7 dinâmicos, 1 edição em massa) e 8 `datetime-local` →
`ActivityDateTimePicker`.
Rodada 2 (revisão independente): +7 controles dinâmicos que ainda caíam no
`<input type="date">` por metadado (tabela abaixo), em 5 arquivos (4 novos no
inventário). **Total: 96 controles em 65 arquivos de tela.** Após a rodada 2
há 87 `<IsoDatePicker>`, 3 `<DatePicker>` e 17 `<ActivityDateTimePicker>` em 74
arquivos (inclui componentes que já usavam o padrão antes). 28 cálculos de "hoje" em UTC trocados por dia local
nas telas convertidas (dois cálculos feitos em UTC de propósito mantidos).

| Módulo                      | Rota/componente                           | Arquivo                                                            | Antes                                     | Padrão aplicado                                                  | Campos                                                                            |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Core (atendimento)          | /tickets                                  | src/routes/\_authenticated/tickets.tsx                             | 1× datetime-local                         | ActivityDateTimePicker (hora/fuso preservados)                   | Vencimento                                                                        |
| Core (boas-vindas)          | componente: onboarding-wizard             | src/components/onboarding/onboarding-wizard.tsx                    | 1× input date dinâmico                    | 1× IsoDatePicker                                                 | id                                                                                |
| Core (configurações)        | /settings/custom-objects                  | src/routes/\_authenticated/settings.custom-objects.tsx             | 1× input date dinâmico                    | 1× IsoDatePicker                                                 | f.label                                                                           |
| Core (configurações)        | /settings/goals                           | src/routes/\_authenticated/settings.goals.tsx                      | 2× input date                             | 2× IsoDatePicker                                                 | Início, Fim                                                                       |
| Core (configurações)        | /settings/recurring                       | src/routes/\_authenticated/settings.recurring.tsx                  | 1× input date                             | 1× IsoDatePicker                                                 | Início                                                                            |
| Core (criação rápida)       | componente: quick-create-dialogs          | src/components/record/quick-create-dialogs.tsx                     | 1× input date                             | 1× IsoDatePicker                                                 | qc-d-close                                                                        |
| Core (edição em massa)      | componente: bulk-edit-fields-dialog       | src/components/grid/bulk-edit-fields-dialog.tsx                    | 1× datetime-local                         | 1× IsoDatePicker; ActivityDateTimePicker (hora/fuso preservados) | `bulk-${field.name                                                                |
| Core (formulários públicos) | componente: form-renderer                 | src/components/surveys/form/form-renderer.tsx                      | 1× input date; 1× datetime-local          | 1× IsoDatePicker; ActivityDateTimePicker (hora/fuso preservados) | id                                                                                |
| Core (formulários públicos) | componente: survey-form-fields            | src/components/surveys/survey-form-fields.tsx                      | 1× input date                             | 1× IsoDatePicker                                                 | fieldId                                                                           |
| Core (propriedades)         | componente: properties-panel              | src/components/properties-panel.tsx                                | 1× input date dinâmico; 1× datetime-local | 2× IsoDatePicker                                                 | p.label, def.label                                                                |
| Core (workflows)            | componente: conditions-editor             | src/components/workflows/builder/conditions-editor.tsx             |                                           | 1× IsoDatePicker                                                 | placeholder // "Data"                                                             |
| Core (workflows)            | componente: extra-fields-editor           | src/components/workflows/extra-fields-editor.tsx                   | 1× datetime-local                         | ActivityDateTimePicker (hora/fuso preservados)                   | field.label ?? field.name                                                         |
| Público (perfil de vaga)    | /role-profile/$token                      | src/routes/role-profile.$token.tsx                                 | 1× input date                             | 1× IsoDatePicker                                                 | id                                                                                |
| TechContracts               | /contracts/$id                            | src/routes/\_authenticated/contracts.$id.tsx                       | 2× input date                             | 2× IsoDatePicker                                                 | Início, Fim                                                                       |
| TechContracts               | /services/$id                             | src/routes/\_authenticated/services.$id.tsx                        | 2× input date                             | 2× IsoDatePicker                                                 | Início, Fim                                                                       |
| TechContracts               | componente: batch-import-contracts-dialog | src/components/contracts/batch-import-contracts-dialog.tsx         | 1× input date                             | 1× IsoDatePicker                                                 | `amd-date-${i.key                                                                 |
| TechContracts               | componente: contract-amendments-panel     | src/components/contracts/contract-amendments-panel.tsx             | 1× input date                             | 1× IsoDatePicker                                                 | amendment-date                                                                    |
| TechContracts               | componente: contract-field-input          | src/components/contracts/contract-form/contract-field-input.tsx    | 1× input date                             | 1× IsoDatePicker                                                 | id                                                                                |
| TechContracts               | componente: contracts-grouped-list        | src/components/contracts/contracts-grouped-list.tsx                | 2× input date                             | 2× IsoDatePicker                                                 | Início da vigência do contrato ${c.title}, Fim da vigência do contrato ${c.title} |
| TechContracts               | componente: import-contract-file-dialog   | src/components/contracts/import-contract-file-dialog.tsx           | 2× input date                             | 2× IsoDatePicker                                                 |                                                                                   |
| TechContracts               | componente: import-contract-wizard        | src/components/import-contract-wizard.tsx                          | 1× input date                             | 1× IsoDatePicker                                                 | Validade                                                                          |
| TechContracts               | componente: link-catalog-service-dialog   | src/components/services/link-catalog-service-dialog.tsx            | 2× input date                             | 2× IsoDatePicker                                                 | svc-start, svc-end                                                                |
| TechContracts               | componente: quick-create-service-dialog   | src/components/services/quick-create-service-dialog.tsx            | 2× input date                             | 2× IsoDatePicker                                                 | Início, Fim                                                                       |
| TechFinance                 | /finance/banking                          | src/routes/\_authenticated/finance.banking.tsx                     | 2× input date                             | 2× IsoDatePicker                                                 | Vencimento, Agendado para                                                         |
| TechFinance                 | /finance/recurrences                      | src/routes/\_authenticated/finance.recurrences.tsx                 | 2× input date                             | 2× IsoDatePicker                                                 | Início, Fim (opcional)                                                            |
| TechFinance                 | /invoices                                 | src/routes/\_authenticated/invoices.tsx                            | 1× input date                             | 1× IsoDatePicker                                                 | due                                                                               |
| TechFinance                 | componente: quick-create-entry-dialog     | src/components/finance/quick-create-entry-dialog.tsx               | 2× input date                             | 2× IsoDatePicker                                                 | Competência                                                                       |
| TechFinance                 | componente: register-payment-dialog       | src/components/finance/register-payment-dialog.tsx                 | 1× input date                             | 1× IsoDatePicker                                                 | Data                                                                              |
| TechHire                    | /scheduling                               | src/routes/\_authenticated/(ats)/scheduling.tsx                    | 2× input date                             | 2× IsoDatePicker                                                 | De, Até                                                                           |
| TechHire                    | componente: create-offer-dialog           | src/components/ats/create-offer-dialog.tsx                         | 1× input date                             | 1× IsoDatePicker                                                 | Data de início                                                                    |
| TechHire                    | componente: schedule-interview-dialog     | src/components/ats/schedule-interview-dialog.tsx                   | 1× datetime-local                         | ActivityDateTimePicker (hora/fuso preservados)                   | Data e horário                                                                    |
| TechPeople                  | /people                                   | src/routes/\_authenticated/people.index.tsx                        | 1× input date                             | 1× IsoDatePicker                                                 | p-hire                                                                            |
| TechPeople                  | /people/billing                           | src/routes/\_authenticated/people.billing.tsx                      | 1× input date                             | 1× IsoDatePicker                                                 | due-date                                                                          |
| TechPeople                  | componente: allocations-panel             | src/components/people/allocations-panel.tsx                        | 2× input date                             | 2× IsoDatePicker                                                 | Início, Fim (opcional)                                                            |
| TechPeople                  | componente: benefits-panel                | src/components/people/benefits-panel.tsx                           | 2× input date                             | 2× IsoDatePicker                                                 | Início, Fim                                                                       |
| TechPeople                  | componente: document-dialog               | src/components/people/document-dialog.tsx                          | 2× input date                             | 2× IsoDatePicker                                                 | Emissão, Validade                                                                 |
| TechPeople                  | componente: goals-panel                   | src/components/people/goals-panel.tsx                              | 2× input date                             | 2× IsoDatePicker                                                 | Início, Fim                                                                       |
| TechPeople                  | componente: hire-candidate-dialog         | src/components/people/hire-candidate-dialog.tsx                    | 1× input date                             | 1× IsoDatePicker                                                 | Data de início                                                                    |
| TechPeople                  | componente: incidents-panel               | src/components/people/incidents-panel.tsx                          | 1× datetime-local                         | ActivityDateTimePicker (hora/fuso preservados)                   | Ocorrido em                                                                       |
| TechPeople                  | componente: onboarding-panel              | src/components/people/onboarding-panel.tsx                         | 3× input date                             | 3× IsoDatePicker                                                 | Início, Prazo                                                                     |
| TechPeople                  | componente: one-on-ones-panel             | src/components/people/one-on-ones-panel.tsx                        | 1× datetime-local                         | ActivityDateTimePicker (hora/fuso preservados)                   | Data e hora                                                                       |
| TechPeople                  | componente: psychosocial-panel            | src/components/people/psychosocial-panel.tsx                       | 2× input date                             | 2× IsoDatePicker                                                 | Data, Follow-up                                                                   |
| TechPeople                  | componente: reviews-panel                 | src/components/people/reviews-panel.tsx                            | 2× input date                             | 2× IsoDatePicker                                                 | Início do período, Fim do período                                                 |
| TechPeople                  | componente: time-entry-dialog             | src/components/people/time-entry-dialog.tsx                        | 1× input date                             | 1× IsoDatePicker                                                 | te-date                                                                           |
| TechPeople                  | componente: timesheet-panel               | src/components/people/timesheet-panel.tsx                          | 2× input date                             | 2× IsoDatePicker                                                 | ts-start, ts-end                                                                  |
| TechProjects                | /projects/$id                             | src/routes/\_authenticated/projects.$id.tsx                        | 3× input date                             | 3× IsoDatePicker                                                 | Prazo, Data                                                                       |
| TechProjects                | componente: alert-act-dialog              | src/components/projects/dashboard/alert-act-dialog.tsx             | 1× input date                             | 1× IsoDatePicker                                                 | alert-until                                                                       |
| TechProjects                | componente: measurement-detail-dialog     | src/components/projects/billing/measurement-detail-dialog.tsx      | 1× input date                             | 1× IsoDatePicker                                                 | due                                                                               |
| TechProjects                | componente: project-approvers-card        | src/components/projects/time-governance/project-approvers-card.tsx | 2× input date                             | 2× IsoDatePicker                                                 | ap-from, ap-to                                                                    |
| TechProjects                | componente: project-update-dialog         | src/components/projects/project-update-dialog.tsx                  | 1× input date                             | 1× IsoDatePicker                                                 | pu-expected                                                                       |
| TechProjects                | componente: quick-create-project-dialog   | src/components/projects/quick-create-project-dialog.tsx            | 1× input date                             | 1× IsoDatePicker                                                 | Prazo                                                                             |
| TechProjects                | componente: quick-time-entry-dialog       | src/components/projects/quick-time-entry-dialog.tsx                | 1× input date                             | 1× IsoDatePicker                                                 | tt-date                                                                           |
| TechProjects                | componente: rates-panel                   | src/components/projects/billing/rates-panel.tsx                    | 3× input date                             | 3× IsoDatePicker                                                 | r-from, r-to, Data da mudança                                                     |
| TechProjects                | componente: task-details-sheet            | src/components/projects/task-details-sheet.tsx                     | 1× input date                             | 1× IsoDatePicker                                                 |                                                                                   |
| TechSales                   | /campaigns/email                          | src/routes/\_authenticated/campaigns.email.tsx                     | 1× datetime-local                         | ActivityDateTimePicker (hora/fuso preservados)                   | Data e hora do envio                                                              |
| TechSales                   | componente: create-deal-from-lead-dialog  | src/components/leads/create-deal-from-lead-dialog.tsx              | 1× input date                             | 1× IsoDatePicker                                                 | Previsão de fechamento                                                            |
| TechSales                   | componente: deal-detail-drawer            | src/components/deals/deal-detail-drawer.tsx                        | 1× input date                             | 1× IsoDatePicker                                                 |                                                                                   |
| TechSales                   | componente: profile-fields                | src/components/deals/role-profiles/profile-fields.tsx              | 1× input date                             | 1× IsoDatePicker                                                 | `${p                                                                              |
| TechSales                   | componente: qualification-entity-fields   | src/components/prospecting/qualification-entity-fields.tsx         | 1× input date dinâmico                    | 1× IsoDatePicker                                                 | id                                                                                |
| TechSales                   | componente: quote-wizard                  | src/components/deals/quote-wizard.tsx                              | 1× input date                             | 1× IsoDatePicker                                                 | Válida até                                                                        |
| TechSales                   | componente: scoring-page                  | src/components/prospecting/pages/scoring-page.tsx                  | 1× input date dinâmico                    | 1× IsoDatePicker                                                 | Valor da condição                                                                 |

Total da rodada 1: 61 arquivos.

### Rodada 2 — campos dinâmicos (revisão de a0056dbb8)

| Módulo                  | Rota/componente                                                      | Arquivo                                            | Antes                                                    | Padrão aplicado                                                                                   |
| ----------------------- | -------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Core (listas/filtros)   | `FilterBuilderDialog` (/settings/segments, `EntityList`)             | src/components/filter-builder-dialog.tsx           | `type={… "date" …}` em várias linhas                     | 1× IsoDatePicker por condição de data                                                             |
| TechSales (WhatsApp)    | `AudienceGroupsEditor` (/campaigns/whatsapp › Criar público)         | src/components/whatsapp/audience-groups-editor.tsx | `type={def?.kind === "date" ? "date" …}`                 | 1× IsoDatePicker ("Valor do filtro")                                                              |
| Core (edição em massa)  | `BulkEditDialog` (`GridBulkBar` sem entidade dinâmica, `EntityList`) | src/components/bulk-edit-dialog.tsx                | `type={f.type ?? "text"}` alcançava date                 | 1× IsoDatePicker; texto por `nativeInputType`                                                     |
| Core (listas genéricas) | `EntityList` › célula inline e janela de criação                     | src/components/entity-list.tsx                     | `type={fieldDef?.type ?? "text"}` / `{f.type ?? "text"}` | 2× IsoDatePicker (inline abre direto, escolher grava, Esc cancela; criação com `required`/`name`) |
| Core (propriedades)     | `PropertiesPanel` › "Todas as propriedades"                          | src/components/properties-panel.tsx                | `type={p.type ?? "text"}` (date e datetime)              | IsoDatePicker (date) e ActivityDateTimePicker `iso` (datetime); somente leitura preservado        |

Simplificados (não eram falta, o ramo de data retorna antes): `grid/grid-filter-panel.tsx`
(mín./máx. numéricos) e `workflows/builder/conditions-editor.tsx` (número) agora
usam `type="number"` literal.
No momento nenhuma tela passa campo `date` para `EntityList`; o ramo está
coberto por tipos e pela guarda, não por navegação.

## Limitações conhecidas

- Aviso de hidratação no `<html>` (`data-density` e variáveis `--radius`,
  `--font-*`) vem do White Label aplicando o tema antes da hidratação
  (`src/lib/branding.tsx`, desde 30/05/2026); não é dos campos de data.
- O diálogo "Todas as propriedades" grava data-hora em ISO (com fuso); o editor
  principal mantém o formato local que já usava.
