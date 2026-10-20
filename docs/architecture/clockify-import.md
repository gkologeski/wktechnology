# Migração Clockify → TechProjects

Guia do importador. Ele lê o Clockify somente com consultas, guarda tudo num staging privado, mostra uma prévia e só grava no TechProjects depois que um admin confere e confirma.

- **Tela:** `/projects/settings/imports/clockify`. No menu do TechProjects: Configurações › Importar do Clockify. Também aparece em Configurações › Importar dados.
- **Quem usa:** admin ativo do workspace ativo. O servidor confere isso em toda chamada. O papel de teste do "Ver como" fica bloqueado para gravar.

## 1. Conexão

1. No Clockify, gere a chave em *Profile settings › API*. Use a conta de um administrador do workspace de origem. Workspace com subdomínio exige a chave gerada no próprio subdomínio.
2. Na tela, cole a chave no campo de senha e escolha a região (Global, euc1, use2, euw2, apse2). Informe o subdomínio, se houver.
3. Salve. A chave é cifrada no servidor com AES-GCM (`AI_KEYS_ENCRYPTION_KEY`, o mesmo padrão das chaves de IA). Ela fica em `clockify_connections`, que não tem GRANT para `authenticated`: o navegador só vê `••••1234`.
4. Clique em **Testar** (faz só `GET /user` e `GET /workspaces`) e escolha o workspace de origem. O destino é sempre o workspace ativo do ERP.

Nunca peça a chave no chat nem a grave em código, secrets compartilhados ou logs.

## 2. Segurança da origem

- **Hosts aceitos:** só os oficiais `api.clockify.me`, `reports.api.clockify.me`, `{região}.clockify.me` e `{subdomínio}.clockify.me`. O subdomínio é validado e nomes reservados são recusados. Redirecionamentos são bloqueados, então a chave não segue para outro host.
- **Métodos:** só GET, numa lista fixa de caminhos. A única exceção é `POST /reports/summary`, que é consulta de relatório (leitura). Nenhum POST, PUT, PATCH ou DELETE altera dados no Clockify.
- **IDs externos:** validados como hexadecimal de 24 caracteres no servidor e no banco (CHECK).
- **Ritmo de requisições:** Free 30 por hora (120 s entre chamadas), planos pagos 20/s, Enterprise 50/s, e 5/s quando o plano é desconhecido. Em 429 o importador respeita `Retry-After`. Esperas longas viram `waitUntil` no checkpoint e a execução continua depois.
- **Paginação:** cabeçalho `Last-Page`. Quando ele falta, uma página incompleta encerra. Página repetida também encerra, por proteção. O parâmetro é `page-size` (não `pageSize`), conforme cada endpoint documentado.

## 3. Inventário por capacidade

| Dado | Endpoint | Destino |
| --- | --- | --- |
| Workspace (plano, moedas, configurações) | `GET /workspaces/{id}` | staging |
| Usuários, inclusive inativos e limitados, com vínculos | `GET /users?status=ALL&memberships=ALL` e `account-statuses=LIMITED` | staging + mapeamento |
| Grupos | `GET /user-groups` | staging (sem equivalente) |
| Clientes, inclusive arquivados | `GET /clients?archived=false/true` | staging + sugestão de empresa |
| Projetos, inclusive arquivados (`hydrated`) | `GET /projects` | `projects` |
| Tarefas | `GET /projects/{id}/tasks` | `project_tasks` |
| Etiquetas | `GET /tags` | staging; os ids ficam no vínculo do apontamento |
| Campos personalizados | `GET /custom-fields` | staging; os valores ficam no vínculo |
| Aprovações | `GET /approval-requests` (PENDING, APPROVED, WITHDRAWN_APPROVAL) | staging; a metadata original fica separada da aprovação comercial do ERP |
| Despesas, faturas, feriados, políticas de folga | GET correspondentes | staging (sem equivalente) |
| Apontamentos de todas as pessoas | `GET /user/{id}/time-entries` | `project_time_entries` |
| Cronômetros abertos | `GET /time-entries/status/in-progress` | diagnóstico |
| Conciliação | `POST /reports/summary` (USER, fuso UTC, blocos de 1 ano) | relatório |

Cada item recebe uma situação: coletado, sem registros, sem permissão, indisponível no plano/API, falhou ou não coletado. Um 403 nunca vira "zero" silencioso.

**Fora desta versão:**
- Pedidos de folga: a leitura no Clockify é por POST de consulta.
- Presença (attendance): só existe como relatório.
- Logins e senhas: não são transferíveis.
- Papéis de admin do Clockify: não são replicados.

## 4. Mapeamento

- **Pessoas:** e-mail normalizado contra membros do workspace (qualquer status). Membro inativo continua inativo e preserva a autoria.
  - Vão para revisão: e-mail repetido na origem, e-mail em mais de um membro, ou dois usuários do Clockify apontando para o mesmo membro.
  - Sem vínculo, as horas ficam no staging. Elas nunca são atribuídas a quem importa.
  - Opcional, por ação explícita do admin: "Identidade histórica". Segue o mesmo modelo dos responsáveis do HubSpot: conta banida e membro `inactive`. Não envia convite e não copia papéis.
- **Clientes:** nome igual é só sugestão. O vínculo com uma empresa exige escolha manual. Sem vínculo, o nome do cliente fica em `projects.metadata.clockify`.
- **Projetos:** cada projeto vira um projeto novo por padrão. Nome igual a um projeto do ERP aparece só como sugestão, porque nome não é chave única. Arquivado → `done` com `metadata.clockify.archived = true`.
  - O dono (`owner_id`, obrigatório) é o admin que importou. O responsável pode ser trocado depois.
- **Tarefas:** sempre criadas no projeto de destino, rastreadas pelo vínculo. Clockify `DONE` → `done`. Responsáveis só entram quando a pessoa está mapeada.
- **Membros do projeto:** vêm das memberships do projeto. Os valores-hora entram só quando estão na moeda alvo (padrão BRL).

## 5. Horas

- **Fonte da verdade:** os instantes UTC e os segundos. `started_at` e `stopped_at` guardam os instantes de cada trecho. O vínculo guarda `source_seconds`, `source_start_utc`, `source_end_utc`, `source_timezone`, `local_date` e a duração total da entrada.
- **Divisão por dia:** usa o fuso IANA da pessoa no Clockify (padrão `America/Sao_Paulo`, ajustável). A virada do dia termina em `24:00:00`, valor aceito pelo tipo `time`. A soma dos trechos é igual ao total.
  - A validação do banco (fim > início no mesmo dia e sem sobreposição) continua ligada.
- **DST:** quando o relógio local não bate com os segundos reais, o trecho é gravado sem horários, com a duração real em minutos. O vínculo marca `dst_wallclock_mismatch`.
- **Minutos no ERP:** a tela arredonda por linha. Os relatórios do importador somam segundos.
  - Trechos menores que 30 s (0 minuto, recusado pelo `hours > 0`) ficam no staging e entram na conciliação.
- **Cronômetro aberto (fim nulo):** fica no staging. O importador não inventa fim nem para o cronômetro.
- **Sobreposições:** dentro do Clockify ou com horas já lançadas no ERP, vão para revisão com o diagnóstico. Nada é removido ou ajustado em silêncio.
- **Pausa, feriado e folga** (`type` diferente de REGULAR): ficam no staging como "sem equivalente".
- **Valores:** a taxa histórica do apontamento (em centavos → unidades) é preservada no vínculo. `hourly_rate` só é preenchido na moeda alvo. A prévia soma valores por moeda e nunca mistura moedas.
- **Situação no ERP:** `locked` por padrão (histórico, `approved_at` nulo, fora da cobrança) ou `draft`. Workflows e atualizações automáticas são suprimidos durante a gravação (`app.clockify_import` + gatilho em `workflow_events` e `project_updates`). Nenhum convite, cobrança ou notificação é disparado.

## 6. Idempotência e reexecução

- **Chave única:** `(workspace, workspace de origem, entidade, id externo, trecho)` em `clockify_import_links`. No ERP, `external_id = clockify:{id}:{trecho}`.
- Sem mudança na origem: nada acontece.
- Mudança na origem com a linha do ERP igual ao que foi gravado: atualiza.
- Linha editada no ERP: conflito `manual_edit_conflict`, nunca sobrescreve.
- Linha excluída no ERP: `erp_deleted`, nunca recria.
- Entrada que mudou de dia na origem: `segments_changed`, vai para revisão. O importador nunca apaga trechos.
- Itens que sumiram da origem aparecem como "não vistos nesta execução" e não são excluídos.

## 7. Execução retomável

- **Ordem:** conectar → escolher origem → prévia (inventário paginado → mapeamentos → plano) → revisar mapeamentos → recalcular → confirmar → importar (projetos → membros → tarefas → apontamentos) → relatório.
- **Cada chamada:** trabalha cerca de 18 s, salva o checkpoint e devolve o controle. Uma trava (`lease_until`) impede processamento simultâneo. Só existe uma execução ativa por workspace.
- **Controles:** pausar, retomar e cancelar. O cancelamento acontece ao fim do lote atual. O que já foi gravado fica salvo e uma nova execução não duplica.
- **Pré-requisitos da importação:**
  - a prévia mais recente, concluída e confirmada;
  - o mesmo workspace de origem;
  - nenhum mapeamento alterado depois da prévia.
- **Tela aberta:** a execução avança enquanto a tela está aberta. A rota `/api/public/hooks/clockify-import-tick` (Bearer `CRON_SECRET`) avança execuções já iniciadas, mas **ainda não está agendada**. Agendar depende de publicação aprovada.

## 8. Testes

- `src/lib/integrations/clockify/clockify.test.ts` (31 testes, fixtures sem rede):
  - `Last-Page` e página incompleta;
  - 429 curto e longo (retomada);
  - ritmo do plano Free entre chamadas;
  - só GET + relatório;
  - redirecionamento bloqueado;
  - chave fora de URL e erros;
  - hosts, regiões e IDs;
  - pessoa desconhecida e e-mail duplicado, sem ativação automática;
  - projeto arquivado;
  - segundos, meia-noite e DST;
  - timer aberto;
  - sem projeto;
  - pausa;
  - trecho curto;
  - sobreposição;
  - moedas mistas;
  - conciliação;
  - reexecução (insert, skip, update, edição manual, exclusão no ERP, mudança de dia, trecho faltante).
- `src/lib/integrations/clockify/clockify-engine.test.ts` (3 testes, banco em memória):
  - fluxo completo prévia → importação → reexecução sem duplicar → mudança de campo → edição manual preservada;
  - outro workspace intacto;
  - sobreposição com hora existente;
  - cancelamento.
- `tests/sql/clockify-importer-isolated.sql` (Postgres descartável local com as migrations 0157/0158 e o gatilho real de validação):
  - RPC sem workflows;
  - virada com `24:00:00`;
  - sobreposição e `hours > 0` preservados;
  - DST;
  - usuário, projeto e vínculo de outro workspace recusados;
  - chave idempotente;
  - uma execução ativa;
  - RLS: só admin ativo lê; conexão e RPC inacessíveis ao navegador.

## 9. Limitações conhecidas

- **Contagens reais:** nada foi lido do Clockify real. Contagens e cobertura reais só existem depois da conexão.
- **Plano Free:** com 30 requisições por hora, um workspace grande leva horas. A tela mostra a espera.
- **Valores monetários:** o Clockify envia em centavos. Isso foi validado só pela documentação e precisa ser conferido na primeira prévia real.
- **Relatório resumido:** pode não incluir cronômetros abertos ou pessoas sem acesso. As diferenças aparecem por pessoa.
- **Tela de horas do ERP:** ainda não exibe o selo de origem nem `24:00`. A tela de edição existente não aceita "24:00", mas linhas `locked` não são editáveis.
