# Telefones no padrão E.164

Todo telefone de cadastro é gravado como E.164 (`+` DDI + número nacional, até
15 dígitos — ITU-T E.164). A forma `^\+[1-9]\d{1,14}$` é só sintaxe; a
validação de plano de numeração usa `libphonenumber-js/max`. Nenhuma das duas
comprova que o número existe, tem WhatsApp ou pertence à pessoa.

## Peças

| Peça                                | Papel                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/phone/e164.ts`             | Fonte única (navegador + servidor): `normalizePhone`, `normalizePhoneField`, `isValidE164`, `formatPhoneDisplay`, `telHref`, `maskPhone`.                                                                                                                                                                                                           |
| `src/lib/phone/phone-boundary.ts`   | Bordas de gravação: `humanPhone` (digitado/API, país do workspace, erro 422 `invalid_phone` sem ecoar o número), `humanPhoneForRow` (valor legado não editado passa intacto), `sourcePhone` (integrações/importações: país só com evidência da fonte; o que não for lido fica como veio), `workflowPhone`, `zHumanPhone`, `countryFromRecordField`. |
| `src/components/ui/phone-input.tsx` | Campo único: seletor de país visível, colagem normalizada, ramal opcional, erro PT-BR no blur, `inputMode=tel`, valor antigo mostrado e só trocado se o usuário digitar (ou confirmar a sugestão). `validatePhoneValue` no envio.                                                                                                                   |
| `PhoneCountryProvider`              | País padrão do workspace (`workspaces.default_phone_country`, padrão `BR`) para números novos sem +DDI. Configurável em Configurações › Telefones.                                                                                                                                                                                                  |
| `whatsapp-e164.ts`                  | Política do CANAL WhatsApp (só celular BR; formato antigo de 8 dígitos ganha o 9 só aqui). Recusa do canal ≠ telefone inválido.                                                                                                                                                                                                                     |
| Banco (0186)                        | `phone_ext` em contatos/leads/empresas; `phone_normalization_runs/items` (backup + revisão, leitura só admin ativo); guarda opcional `phone_e164_shape_guard` (forma apenas), desligada por `workspaces.phone_strict_e164`.                                                                                                                         |

## Regras

- Sem `+`: só com país de contexto. Digitação nova usa o país do workspace;
  dado histórico/integração só com evidência (Receita Federal → BR; campo País
  do próprio registro). Nunca usuário, navegador, nome, domínio ou empresa.
- Nunca se acrescenta/remove o 9º dígito, completa número incompleto, corta
  zero significativo (ex.: Itália) ou trunca acima de 15 dígitos.
- Ramal vai para `phone_ext` (contatos, leads, empresas) e `tel:+…;ext=`.
- Vários números num campo: `multiple` → revisão; nunca vira um E.164 só. O
  ramal do fim do texto sai ANTES da divisão ("…, ramal 22" é um número só).
- Até 4 dígitos no número (ramal fora; máscara, espaço e + ignorados) não é
  telefone: dado novo é recusado ("Telefone incompleto"); legado fica vazio.
  Ramal sozinho não vira telefone (`extension_only`).
- Artefatos limpos sem perder dígito: invisíveis, traços tipográficos,
  apóstrofo inicial de planilha, rótulo "Tel"/"Telefone"/"Fone"/"tel:".
- `+` só no início (admite "(+55)"). "00"/"0"/operadora só pelo país de
  contexto (BR exige "00"+operadora); sem país, "00…" fica como candidato.
- DDI repetido ("+55 55 11 …") só é corrigido com o País do próprio registro
  igual ao DDI, leitura literal inválida, leitura sem repetição única e sem
  "0" logo depois; senão `repeated_country_code` para revisão.
- E.164 válido não comprova linha ativa, titular nem WhatsApp.
- Campo opcional vazio → `null`; obrigatório vazio bloqueia.
- Provedores que exigem dígitos sem `+` convertem só no limite
  (`e164ToProviderDigits`). `wa_id`, `phone_number_id`, `vapi_phone_number_id`
  não são telefones E.164 do ERP.
- Exportação: E.164 puro não recebe apóstrofo anti-fórmula (`neutralizeCsvFormula`); XLSX grava como texto.

## Inventário (rota/componente → coluna → tratamento)

| Módulo      | Entrada                                                        | Coluna                                              | Tratamento                                                                              |
| ----------- | -------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| TechSales   | Criar Lead / Contato                                           | leads.phone, contacts.phone, whatsapp_e164          | PhoneInput + validatePhoneValue; WhatsApp pela política do canal                        |
| TechSales   | Fichas (PropertiesPanel, dois editores)                        | phone, mobile_phone, whatsapp_e164, phone_ext       | PhoneInput; legado não editado intacto                                                  |
| TechSales   | Edição em massa (grid e diálogo)                               | colunas de telefone                                 | PhoneInput + `humanPhone` no servidor                                                   |
| TechSales   | Importação CSV                                                 | phone, mobile_phone                                 | `sourcePhone` com País da linha ou país do workspace (aviso na tela); ramal → phone_ext |
| TechSales   | Prospecção (Apollo), Lusha, enriquecimento, webhook Apollo     | phone, mobile_phone, prospecting_results.phone      | `sourcePhone` sem país inventado; `apollo_phone_reveals` fica bruto                     |
| TechSales   | HubSpot (passos, importação, reconciliação, legado)            | phone, mobile_phone                                 | `sourcePhone` com País do próprio registro HubSpot                                      |
| TechSales   | Consulta CNPJ (BrasilAPI)                                      | companies.phone                                     | `sourcePhone(…, "BR")`                                                                  |
| TechSales   | Discagem por voz (Vapi) / discador                             | —                                                   | só disca E.164 válido                                                                   |
| TechSales   | WhatsApp: diálogo de envio                                     | destinatário                                        | PhoneInput; servidor aplica política do canal                                           |
| TechHire    | Criar/editar candidato, Carreiras, indicação pública e interna | ats_candidates.phone, ats_referrals.candidate_phone | PhoneInput + `humanPhone`/`humanPhoneForRow` (422 na API pública)                       |
| TechHire    | CV (texto/PDF), LinkedIn/Unipile                               | ats_candidates.phone                                | `sourcePhone`                                                                           |
| TechPeople  | Criar/editar pessoa, telefone de recado                        | people.phone, emergency_phone                       | PhoneInput + `humanPhoneForRow`                                                         |
| TechPeople  | Importação de formulários                                      | people.phone                                        | `sourcePhone` com país do workspace (importação do admin)                               |
| Core        | Convites, equipe, admin da plataforma                          | profiles.phone + metadados                          | PhoneInput + `zHumanPhone`                                                              |
| Core        | Agendamento público                                            | bookings.invitee_phone (+ lead/contato)             | PhoneInput + `humanPhone` (422)                                                         |
| Core        | Formulários públicos/embed, landing page                       | leads/contacts.phone                                | `humanPhone` por campo `tel` (422 com rótulo); embed com `inputmode=tel`                |
| Core        | Pesquisas (renderer novo e questionário)                       | respostas                                           | PhoneInput + `validateAnswers`/servidor exigem E.164                                    |
| Core        | Onboarding                                                     | phone (target_column)                               | PhoneInput + validação do passo                                                         |
| Integrações | API v1 leads/contatos, MCP create-lead, ferramentas do agente  | leads/contacts/companies.phone                      | `humanPhone`/`zHumanPhone`, 422 `invalid_phone`                                         |
| Integrações | Workflows (criar lead/contato/candidato, definir campo)        | phone                                               | `workflowPhone`: token copiado sem inventar país; texto fixo validado                   |

### Exceções justificadas (sem mudança)

- Cópias de valor já gravado (conversão Lead→Contato, negócio a partir do lead, candidato→pessoa, contratação por workflow): copiam o que existe.
- Canal WhatsApp/Inbox/Lia/campanhas: mantêm `whatsapp-e164.ts`; `whatsapp_conversations.contact_phone`, `whatsapp_campaign_recipients.phone`, `sdr_enrollments.contact_phone` são identidades de canal (já `+dígitos`) e não foram reescritas.
- `apollo_phone_reveals`, `form_submissions.data`, `property_history`, auditoria, contratos/documentos: registro bruto/histórico, não reescrito.
- PIX tipo telefone (`bank_payments.pix_key`): chave financeira do provedor, não alterada.
- Templates de contrato/token `{{contact.phone}}`: exibição do valor gravado.
- Telas só de exibição (grids, cartões, busca): mostram o valor gravado (E.164) sem máscara que esconda o país.

## Correção dos dados existentes (somente WK)

`scripts/phone-e164/` (export.sql → classify.ts → aplicação em lotes). Execução
`4c12009e-e1e5-4b82-8206-8e4327a399bd`, versão `e164-v1`, em 22/10/2026:

- Analisados 97.458 valores; 3.236 já estavam no padrão.
- Aplicados 76.972: 59.523 com +DDI explícito, 7.096 pelo País do próprio
  registro, 10.353 marcadores vazios ("--", "0") limpos.
- Em revisão (nada alterado): 17.250 — 10.651 curtos (um só dígito), 5.601
  inválidos (ex.: celular antigo sem o 9, prefixo inexistente), 628 sem país,
  210 com letras, 80 com vários números, 51 longos, 22 com + no lugar errado,
  6 ambíguos, 1 duplicidade de lead.
- Cada item guarda o valor original; só gravou onde o valor ainda era o da
  simulação; `scripts/phone-e164/rollback.sh` desfaz sem sobrescrever edição
  posterior. Automações, histórico e auditoria foram suprimidos pelo token de
  sessão `wk-phone-e164-v1` em `crm_is_derivation_backfill` (0 eventos).

### Correção posterior: até 4 dígitos + v2 (23/10/2026)

Execução `8b277703-f51b-42b4-90d3-aea7c5e1d268` (`e164-v2`, filha da
varredura): prévia `blank-short.ts`, lotes `batch-sql.ts` (compara o original,
filtra o workspace, idempotente, token `wk-phone-e164-v1`), migration 0187
(resolução da fila e WhatsApp não derivado em correção em lote).

- Em branco por terem até 4 dígitos: 10.671 (contatos · celular 10.636,
  empresas 19, contatos · telefone 15, leads 1); por dígitos: 0 → 4,
  1 → 10.642, 2 → 5, 3 → 4, 4 → 16.
- Padronizados com leitura única comprovada: 163 (DDI repetido + País do
  registro 153, +DDI explícito com artefato 8, País do registro BR 2).
- 10.834 itens da fila resolvidos; 6.416 seguem em revisão com motivo
  específico calculado na hora (ex.: celular antigo sem o 9 com candidato
  mascarado, nunca aplicado).
- 0 eventos de automação, auditoria, histórico ou notificação; WhatsApp
  derivado inalterado; `hs_raw`, mensagens e logs intactos.
- A tela usa a VARREDURA mais recente (sem `parent_run_id`) como base,
  nunca a última execução; "Em revisão" e a fila contam no banco os itens da
  base com `applied_at` e `resolved_at` vazios (`reconcilePhoneRuns`,
  `withLivePending`). O `applied_at` da varredura não é alterado: a trilha
  original fica como foi; a resolução aponta para a execução que gravou.
- Desfazer: `RUN=8b277703-… WS=… scripts/phone-e164/rollback.sh` (papel de
  escrita); itens da fila voltam a pendentes.

## Pendências

- Ligar `phone_strict_e164` (guarda do banco) depois que o código for publicado.
- Revisar a fila em Configurações › Telefones.
