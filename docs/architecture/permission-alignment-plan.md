# Alinhamento de autorização do TechERP

Iniciado por autorização do usuário em 23/10/2026. Abrange TechSales, TechHire,
TechPeople, TechContracts, TechProjects, TechFinance e áreas compartilhadas.
`techservice` é namespace legado, não um sétimo módulo.

## Status consolidado e recalibração — 24/10/2026

Percentuais gerenciais estimados, arredondados; não medem cobertura de telas,
rotas ou testes. Nenhuma das seis etapas está integralmente concluída.

| Etapa | Avanço estimado | Execução restante estimada |
|---|---:|---:|
| 1. Matriz oficial de permissões | 60% | 1–2h |
| 2. Correções dos riscos críticos | 70% | 1–2h |
| 3. Servidor e banco | 40% | 6–10h |
| 4. Telas, ações e campos | 40% | 3–5h |
| 5. Validação dos cargos e aceite | 40% | 2–4h |
| 6. Prevenção de novas lacunas | 20% | 1–2h |

Base desta revisão: 416 declarações de rota, 32 regras e 53 contratos de
operação. O catálogo normativo ainda contém estados históricos de aceite que
precisam ser reconciliados; não derivar percentuais da contagem desses estados.
As frentes até 0207 têm evidências de aplicação/publicação nos relatórios
anteriores. Isso não comprova revisão integral dos seis módulos.

Sete blocos principais somam 8h06 de execução registrada nos turnos. Seis têm
estimativas comparáveis; a mediana de tempo registrado/ponto médio previsto é
aproximadamente 1/3. Não existe medição individual confiável dos sublotes do
turno que reuniu 0195–0203 e recuperação de ambiente. Em configurações de
entrevista, 49min registrados coexistem com quase 8h de intervalo corrido; a
causa integral dessa diferença não foi comprovada. Não confundir execução
registrada, espera e prazo de entrega. Lotes iniciais 0193/0194 terminaram com
publicação pendente, confirmada posteriormente.

Previsão restante recalibrada: **14–25 horas de execução**, equivalentes a
aproximadamente **2,5–4,5 dias de 6h efetivas**, sem prazo externo garantido para
sessões, aprovação ou publicação. Horas por etapa distribuem o trabalho, sem
somar novamente o mesmo lote de backend/UI/aceite. Recalibrar após cada lote e
se aparecerem novos defeitos no aceite.

Novas frentes: 30–60min pequenas, 1–2h semelhantes às últimas entregas, 2–4h com
maior incerteza. O fator observado não é redutor universal para módulos ainda
não revisados. A previsão antiga de 3–5 dias não definiu horas/dia nem cobertura
suficiente; não é base para calcular desvio percentual de prazo final.

Próxima sequência: pendências de RH/LGPD, Finance, Contracts/Projects,
Sales/integrações, revisão transversal, aceite geral e gate de prevenção.
Aceite da sessão real da Priscila em produção permanece pendente; ambiente
local recuperado não é bloqueio atual. CI técnica existente não equivale a gate
completo de cobertura de autorização.

Evidência detalhada: no projeto ChatGPT, arquivo
`outputs/permission-status-recalibration-2026-10-24/status.json`, com os IDs dos
turnos, previsões originais, durações registradas e intervalos corridos.

## Fontes e estados

- `docs/security/permission-alignment.json`: decisões normativas das 32 regras
  levantadas e contratos explícitos das operações já tratadas.
- `docs/security/permission-route-inventory.csv`: 416 declarações de rota do
  inventário estático. Inclui layouts, APIs, retornos e redirecionamentos; não é
  contagem de telas distintas nem prova de enforcement.
- Código/SQL aplicados e testes de comportamento demonstram implementação;
  presença de uma chave em mapa/importação não demonstra autorização.
- Uma regra não fica concluída por código escrito. Distinguir preparado,
  testado, aplicado no banco, publicado e aceito no ambiente real.

## Decisão comum

Ator autenticado → membership ativo → workspace correto → permissão efetiva da
AÇÃO (deny prevalece) → escopo real da LINHA → proteção de CAMPOS → regras do
PROCESSO (alçada, estado, versões, período fechado, idempotência, consentimento).

Own é chave + vínculo de titularidade. Team é chave + equipe efetiva. Workspace
não ultrapassa tenant. Admin não é substituto genérico da ação e não deve anular
uma negativa explícita. Políticas permissivas se combinam por OR; a regra antiga
não pode continuar oferecendo uma alternativa que contorne a nova.

Exceções técnicas, pessoais, públicas por token, de plataforma e de serviço
precisam declarar identidade, alcance, validade e teste de negação. Não conceder
chaves novas a todos os cargos/workspaces como forma de fazer o teste passar.

## Sequência e estimativas iniciais

1. Matriz oficial incremental: inventário e sete contratos do primeiro lote
   registrados; ainda em andamento para as demais ações.
2. Riscos críticos: primeiro lote SQL (0191) aplicado e testado. Lote 0192 de configurações de pagamentos, NFS-e e reuniões aplicado, publicado e testado;
   evidências registradas no relatório do lote.
3. Servidor/RLS por módulo: priorizar TechPeople/TechHire, depois os demais;
   consolidar políticas, eliminar atalhos por owner/admin e escopos incorretos.
4. Interface e ações: menus/URL/abas/botões, projeção de campos, exportações,
   falhas de resolução e referências ausentes no catálogo.
5. Aceite dos cargos: permitido, sem chave, deny explícito, equipe/workspace
   diferente, inativo e URL/API direta. A sessão real de onboarding de Priscila
   não foi declarada validada pelos testes isolados.
6. Prevenção: checks automáticos da matriz e catálogo e cobertura obrigatória
   das novas funcionalidades na integração contínua.

Previsão inicial comunicada: primeira entrega em 60–90 minutos; conjunto em
3–5 dias de trabalho, dependente da quantidade de fluxos que precisarem ser
reconstruídos e do aceite real. São estimativas, não cronograma garantido nem
execução agendada em segundo plano. Cada nova frente exige sua própria previsão.

## Lote 0191 — aplicado

- Get entity field catalog é SECURITY INVOKER, autentica membro ativo no
  workspace selecionado e vincula p_owner_id ao ator. Service_role é exceção
  técnica explícita para filtros de campanhas. Retorna somente metadados e
  opções canônicas de enum/boolean, nunca amostras de linhas de negócio.
  Choices canônicos de pipelines/cadastros continuam no consumidor existente.
  Campos de texto sem cadastro canônico deixam de inferir opções por amostras.
- Anonimização nega ator NULL, inativo, workspace incorreto e View As somente
  leitura; exige compliance.delete.workspace E update de candidato em workspace
  ou próprio comprovado. Revoga consentimentos e registra auditoria atômica.
- Cinco helpers internos perdem EXECUTE para PUBLIC/anon/authenticated/API
  subject. Seus gatilhos SECURITY DEFINER preservam a execução como proprietário;
  service_role mantém o acesso de serviço.
- O teste do gatilho Silver Medalists revelou variável pool_id ambígua com
  plpgsql.variable_conflict=error. A variável local foi renomeada para v_pool_id,
  preservando a transição e ON CONFLICT. Correção necessária para validar o fluxo.

## Evidências e limites

101 verificações PostgreSQL passaram: 44 de RLS de RH, 15 de FK/salvamento e
42 de RPCs críticas. A fixture reproduziu as exposições anônimas antes da mudança
com dados sintéticos e rollback; depois confirmou bloqueios, escopos, denies,
registro de auditoria, recálculos de negócio/pagamento, seed de três modelos e
pool de recrutamento. Usa corpos reais selecionados dos helpers e triggers, mas
não é clone integral nem aceite de navegador/GoTrue/PostgREST.

Após aplicar, conferir EXECUTE, invoker/definer, hash da migração e hashes dos
overrides/memberships. Estes últimos permaneceram idênticos. Não houve publicação
de frontend: neste lote não há mudança de aplicação; a proteção SQL já está ativa.

Backups das definições/ACLs estão nos artefatos locais da auditoria. Em regressão,
priorizar correção progressiva ou contenção da porta afetada; nunca restaurar
EXECUTE anônimo para recuperar disponibilidade. Script de contenção:
`docs/security/0191-emergency-containment.sql` (não foi executado em produção).


## Lote 0192 — aplicado e publicado: configurações de pagamentos, NFS-e e reuniões

Seis chaves próprias (view/manage por recurso) no catálogo. Consultar exige view;
alterar exige view E manage; deny sempre prevalece. Nenhum grant de cargo/preset
é criado. A UI verifica a mesma chave para menu e URL, oferece leitura sem edição
e não monta o formulário em erro de autorização. Erro de carga impede gravação.
O servidor usa o cliente autenticado, seleciona o workspace do perfil e delega a
autorização às RPCs; não usa service_role para as seis operações de configuração.

As três colunas JSON de workspaces perderam SELECT/INSERT/UPDATE diretos para
PUBLIC/anon/authenticated/API subject. As demais colunas mantêm os privilégios
anteriores limitados pelas RLS existentes. Novas colunas de workspaces precisam
de concessão explícita por migração; consumidores devem selecionar apenas as
colunas necessárias, nunca SELECT *. A cobrança autorizada lê o gateway por
service_role como exceção interna; não concede reconfiguração ao operador.

As RPCs validam membro ativo, workspace selecionado, chave efetiva, View As de
leitura, campos permitidos, tipos e limites. Alterações registram ator, seção e
nomes dos campos alterados, sem copiar valores para o log. Save idempotente não
cria outro evento. RPC auxiliar não pode ser invocada diretamente pelo usuário.
Nenhum valor de configuração é alterado pela migração.

61 verificações novas de PostgreSQL (162 somadas às anteriores), 17 testes de
helper/UI e suíte completa passaram. Aceite SQL na base ativa passou (leitura/idempotência do owner, bloqueio de membro sem chave e acesso direto/fora do workspace). Aceite visual com sessão real ainda não
realizado. Estados de aplicação/publicação e hashes constam no relatório do lote.

Publicação confirmada em 23/10/2026 nos domínios app.wktechnology.com.br e
wktechnology.lovable.app, ambos com entrada /assets/index-CCqjsmv4.js. Os três
chunks de configurações publicados contêm o guard, os recursos específicos e o
bloqueio após falha de carga. Commit da aplicação: 628e207678de8fbc7607dcbe9996d88a54459aa9.
Hashes das três configurações e das tabelas de overrides, presets e memberships
permaneceram iguais aos da captura anterior. A aplicação de 0192 não alterou
valores existentes nem concedeu novas permissões a cargos de negócio.


## Etapa 3 — primeiro lote (0193)

Escopo: CRUD de pessoas e candidatos e modelos/planos/tarefas de onboarding e
offboarding. Aplicado e testado; publicação registrada nas evidências
do lote. Não conclui toda a etapa 3 nem o aceite de cargos da etapa 5.

- Quatro políticas permissivas por tabela substituem os caminhos antigos por
  owner/admin, simples membership e a ponte específica de cargo do onboarding.
  As políticas restritivas existentes continuam. Usa chaves efetivas de ação,
  membro ativo e workspace selecionado; não cria permissões nem grants de cargo.
- Own: perfil/responsável da pessoa ou responsável do candidato; planos usam
  responsável/perfil da pessoa, tarefas também reconhecem o executor. Team exige
  grupo do workspace ou gestor da pessoa (inclui manager_id armazenado como ID
  de pessoa com profile_id correspondente). Permissão team sozinha não basta.
- Plano exige pessoa consultável e relações de pessoa/template/plano no mesmo
  workspace; o modelo deve ter o mesmo tipo (admissão/desligamento). Não é
  possível mover registros para outro tenant, trocar a pessoa/tipo do plano ou
  mover tarefa para outro plano. Executor com chave own pode atualizar andamento
  da tarefa, sem reconfigurá-la ou atribuir a conclusão a outra pessoa.
- Servidor separa create de update, usa a verificação SQL por registro, não usa
  privilégio administrativo como fallback e verifica se a edição afetou linha.
  Promoção de candidato exige leitura dele e criação de pessoa; o tenant vem do
  workspace selecionado, não da autoria do candidato. Arquivar exige update.
- Plano e tarefas são criados em uma RPC SECURITY INVOKER transacional. Falha
  numa tarefa desfaz o conjunto. Automação usa workspace_id real da pessoa e
  lock transacional com reaproveitamento de plano existente. Modelos continuam
  selecionados pela regra atual de cargo/tipo de contratação.
- Escrita de pessoa informa explicitamente workspace, autoria e responsável;
  o trigger normaliza workspace copiado para responsável apenas em nova pessoa.
  Não altera defaults nem reescreve registros históricos. Serviços internos
  conservam o acesso já existente como exceção técnica explícita.

112 verificações novas de PostgreSQL e 162 anteriores passaram (274). A suíte
completa passou com 1.534 testes (19 novos), incluindo handlers executados e
contratos de isolamento entre módulos. A fixture reproduz o bypass anterior de
candidatos, mas não é clone integral nem aceite real de navegador/GoTrue.

Continuam pendentes: dados sensíveis e seus campos, helpers de avaliações/metas,
políticas de vagas, LGPD por escopo, documentos/benefícios/alocações/incidentes e
restante dos módulos. A implementação não declara essas lacunas resolvidas.

Aceite SQL na base ativa usando auth.uid de Priscila passou: gravar e editar
pessoa, criar onboarding/offboarding e tarefa, concluir tarefa e excluir registros
de teste; registro inexistente e ator sem membership foram negados. A transação
inteira terminou em rollback. Não foi utilizada uma sessão real do navegador.

A resposta de liveness já pública (/api/public/health/) inclui o header estático
X-TechERP-Access-Revision: hr-actions-0193 para confirmar a revisão do servidor.
É uma exceção operacional pública: continua sem autenticação, consulta de dados
de negócio, credenciais ou PII. Não concede acesso a ações de RH. A confirmação
pelo header não substitui o aceite real no navegador.

Publicação do lote 0193 informada pelo usuário em 23/10/2026. O projeto já
está sincronizado com 45f813981a0558a54901909c24bfe4cdb2b319ef, informa
is_published=true e contém o marcador de revisão no código. A liveness pública
responde HTTP 200/status ok em ambos os domínios. O header de revisão não foi
observado na resposta pública: a confirmação de publicação se baseia no relato
humano e no estado do projeto, não em comprovação independente da revisão servida.

O bloqueio anterior (queue_paused/server_error) fica registrado como histórico
da tentativa anterior. Não é mantido como bloqueio atual com base em informação
antiga. As regras 15/21/26 e os 20 contratos deste lote passam a aplicado,
publicado conforme confirmação do usuário e testado SQL. O aceite funcional no
navegador permanece pendente; o restante da etapa 3 continua aberto.


## Etapa 4 — primeiro lote (0194)

Escopo deste lote: menus/URLs de pessoas, candidatos, onboarding, offboarding e
modelos; ações dos cadastros principais de pessoa/candidato e checklists.
Não conclui toda a etapa 4 nem as frentes restantes de servidor/RLS da etapa 3.

- `HrScreenAccess` barra o carregamento por URL sem view efetivo, durante carga,
  falha da resolução ou ausência de workspace. `HrRecordAccess` exige também o
  predicado de leitura da linha. Menu de desligamento deixa de reutilizar a chave
  de admissão; os cinco menus deste lote não usam fallback por cargo/admin.
- `hr_record_capabilities` consulta os predicados já aplicados em 0193. Retorna
  somente booleanos do próprio chamador, até 200 UUIDs por chamada. Não aceita
  outro usuário/workspace nem abre acesso a linhas. SECURITY INVOKER e EXECUTE
  apenas authenticated; helper não concede permissões aos cargos.
- Criação exige create (não update); edição/exclusão consultam a linha. Seleção
  múltipla só oferece ação quando todos os selecionados permitem a ação. Kanban
  de pessoas verifica cada card; candidato só pode ser arrastado se puder editar.
- Plano: criar, alterar andamento, excluir e criar tarefas são independentes.
  Tipo admissão/desligamento só aparece com as respectivas chaves. Troca do tipo
  limpa o modelo anterior. Executor pode alterar andamento da tarefa, mas editar
  configurações exige update do plano e exclusão usa sua própria permissão.
- Cache de dados tocados e capacidades inclui workspace; formulários são
  desmontados na troca de workspace/registro. Falhas não são apresentadas como
  lista vazia ou carregamento infinito. Não cria nova entrada de data/telefone/
  e-mail; preserva os componentes de validação já existentes.

Validação: 15 cenários SQL novos + 274 anteriores (289); 25 testes novos de
interface/menu/borda + suíte integral (1.559). O gate verify passou. Teste SQL
no banco ativo confirmou Priscila/Head RH lendo e editando por capacidades,
registro ausente e não membro negados e anon sem EXECUTE. Não emite sessão de
usuário: isso é simulação de identidade SQL, não aceite no navegador. Hashes de
186 pessoas, 14 candidatos, quatro planos, tarefas/modelos vazios, 927 overrides,
6.653 presets e 244 memberships preservados. Migração 0194 aplicada.

Permanecem fora deste lote: granularidade por linha/ação das demais abas da
ficha (documentos, metas, 1:1, avaliações, alocações, benefícios, psicossocial,
incidentes), ações de comunicação/pools/vagas/LGPD do candidato e demais módulos.
Não interpretar a proteção de perfil/onboarding como aceite desses painéis.
Aceite funcional real com sessão autenticada continua pendente (etapa 5).
Estado final de build/sincronização/publicação fica nas evidências deste lote.


## Continuação integral solicitada — lote 0195 em preparação

O usuário autorizou concluir todas as pendências em 23/10/2026. Não reduzir o
objetivo a este lote: as 32 regras e seis etapas continuam sendo o controle de
conclusão. Estimativa comunicada: conjunto em 3–5 dias; próximo lote 90–150 min.

0195 trata documentos, benefícios, alocações/rateios, metas, 1:1, avaliações,
psicossocial, incidentes e eventos. Servidor e banco verificam recurso/ação/linha;
a criação é vinculada à pessoa e não decorre de update. Novas escritas informam
workspace explicitamente. Sem alteração de defaults. Autoria/tenant/pessoa são
imutáveis; rateios precisam de empresa no mesmo workspace. Eventos de auditoria
não recebem mutações de usuários comuns. Modelos de campo sensível ainda serão
tratados separadamente: não declarar a regra 24 concluída por este lote.

Os painéis de pessoa deixam de usar people.update ou can_view_person_sensitive
como autorização genérica para as outras abas. Cada botão de criar/editar/excluir
usa a capacidade do respectivo recurso/linha. Arquivos: upload novo exige criar
no alvo; substituição exige editar o documento e o mesmo person_id; download
verifica leitura do documento antes do uso do assinador privilegiado.

A falha geral de consultas de módulo/licença foi identificada e corrigida no
código: ausência de dados, erro e carga não significam unrestricted. Falhas de
permissão em cache também deixam de habilitar botões Can. Consulta privilegiada
de licença só ocorre após membership ativa no workspace selecionado.

Validação técnica e aplicação/publicação serão registradas por lote nas
evidências. O Docker local estava sem resposta e a aplicação/auth local estavam
paradas; abrir Docker Desktop foi tentado. Isso não impede as correções e testes
SQL/servidor, mas não deve ser contado como aceite de navegador.


### Revisão e correções do lote 0195

Migração 0195 aplicada. A checagem ativa revelou que o gatilho compartilhado
sync_responsible copia o owner legado (workspace) para assigned_to. O teste
isolado mínimo ainda não incluía esse gatilho. A fixture foi corrigida para
reproduzi-lo e a migração progressiva 0196 normaliza apenas esse caso determinístico
no INSERT para o usuário real. O arquivo 0195 aplicado não foi alterado. Novas
escritas do servidor também informam o responsável onde a coluna existe.

Depois da correção, 21 operações SQL de criar/editar/excluir em sete recursos
foram aprovadas com auth.uid de Priscila e ROLE authenticated na base ativa.
Tudo terminou com rollback. Não equivale a sessão real de navegador.

112 novos cenários de filhos + 289 anteriores = 401 verificações SQL; o gatilho
legado é reproduzido antes da correção. 219 casos de capacidades comparam os
resultados do caminho otimizado e dos predicados canônicos para filhos, pais,
pessoas, candidatos, modelos, planos/tarefas, outra empresa, IDs ausentes,
usuário comum com deny e Ver como somente leitura.

O ensaio de 200 documentos revelou 11.846,70 ms para o cálculo por linha. A
migração 0197 carrega uma vez as chaves efetivas do chamador e aplica o caminho
constante apenas quando as permissões workspace bastam para decidir as ações;
misturas de own/team conservam o predicado canônico. Valida membro ativo,
workspace selecionado, existência e vínculos antes de retornar somente booleanos.
Depois da correção, o mesmo ensaio retornou 200 linhas permitidas em 52,69 ms.
É uma medição dessa RPC, não de toda a aplicação. Sem novos grants por essa
migração. A autorização de dados continua independente no servidor/RLS.

Próximas frentes ainda obrigatórias: dados sensíveis (0198+; implantação em duas
fases para não quebrar os SELECTs existentes), restante de TechHire e módulos,
contratos de todas as URLs/ações, prevenção em CI e aceite de navegador. A ordem
das frentes pode mudar para resolver bloqueios ou regressões encontradas nos
testes, sem reduzir o objetivo de concluir as seis etapas.


### Publicação 0195–0197 e próxima frente de dados privados

O commit 01b9f30d3 foi integrado ao main e publicado. Ambos os domínios servem
index-C7zHbZrV.js; entry, ficha de pessoa, módulo e guard HR conferidos byte a byte
com o build testado. Verify (typecheck/lint/1588 testes) e build completos, com
mesmo source_hash e source_changed=false. Aceite de navegador continua pendente:
usuário informou Docker Desktop fechado ou sem iniciar.

0198/0199 estão em validação técnica, ainda não aplicados neste registro.
0198 prepara a RPC hr_private_fields e 18 chaves independentes de view/update
own/team/workspace para people_sensitive, one_on_ones_private e
allocations_financial. Somente o Head RH da WK recebe overrides conforme
solicitação prévia; defaults, outros cargos/workspaces e denies preservados.

Novos leitores projetam somente colunas públicas e compõem dados privados via
RPC limitada a 200 IDs. Novos gravadores preservam campos omitidos e valores
ocultos em branco, rejeitando mudanças privadas sem autorização. UI diferencia
leitura e edição privada. Relatórios não tratam custo oculto como zero.
Importação em lote exige todas as operações envolvidas e utiliza o cliente do
usuário para dados; storage elevado recebe checagem do documento/pessoa antes.
Folha exige acesso a custos/benefícios e view/create/update de recorrências
financeiras, sem estender permissões financeiras ao Head RH por consequência.

A ativação 0199 é posterior à publicação dos consumidores de 0198. Ela habilita
os gatilhos para INSERT/UPDATE com alteração privada, muda o wrapper legado
can_view_person_sensitive para a nova chave e retira SELECT direto das colunas
privadas e da view legada people_total_cost. Serviços internos sem JWT são uma
exceção explícita. O catálogo e suas políticas globais de hidden/masked/readonly
continuam sendo outra frente; este lote não representa a conclusão da regra 5.


0198 aplicada (hash d5c9acd07e9b5168d4f1033749b2e8228f7bbdf635071ffd88066aaa87c3519b;
journal when 1792795456235, id 202). As duas primeiras tentativas foram
rejeitadas e revertidas: terminador da definição legada copiada e INSERT SELECT
text para enums perm_action/perm_scope. O teste foi ajustado para composição de
múltiplas instruções e tipos exatos do catálogo ativo. Nenhuma alteração parcial
persistiu. Depois da correção, verify 1597 testes e build completos no mesmo
fingerprint, sem alteração de fontes durante os gates.

A simulação SQL de identidade da Priscila retornou view/update privados para
as 186 pessoas visíveis. Isso confirma o cálculo de capacidades, não é uma
operação de edição nem aceite de navegador. Contagens e fingerprints de dados,
defaults, memberships, outros overrides e denies preservados; somente catálogo
e Head RH da WK receberam as 18 chaves planejadas (1703→1721 e 546→564).
Consumidores ainda precisam publicar; ativação 0199 continua bloqueada até a
verificação da publicação, conforme a ordem técnica deste rollout.


### Ativação 0199 de dados privados

Consumidores do commit ab1c5fe128423f730818e8ec7e56f2423e3a61e2 publicados em
ambos os domínios, entry index-BXZ35Hoh.js e ficha people._id-DhImt435.js
conferidos byte a byte com o build testado. Só depois dessa prova foi aplicada
0199 (hash d1cf1af3670566f35a65ac54ca1e66226f70b0126fc2167f44e325d10f4d6109,
when 1792797293002, id 203).

Três gatilhos privados ativos. Leitura direta de bank, private_notes e cost_rate
pela role authenticated retorna sem privilégio, inclusive para Head RH; leitura
permitida passa pela RPC com as chaves individuais. A simulação SQL de Priscila
criou e editou uma pessoa sintética com dados fictícios, confirmou leitura privada
pela RPC, negou SELECT direto e confirmou campos públicos acessíveis. Identidade
sem membership não leu nem editou. Transação integralmente revertida, zero pessoas
sintéticas remanescentes. Não equivale a sessão real de navegador.

RPC privada: 186 linhas em 49,16 ms (medição só da RPC). O primeiro ensaio de
1730,81 ms incluía a consulta dos IDs sob RLS; não deve ser interpretado como
latência da RPC. Os 18 novos grants estão apenas no Head RH da WK. A matriz geral
de hidden/masked/readonly, outras ações/módulos e o aceite no navegador seguem
frentes pendentes do plano de seis etapas.


### Próxima frente: vagas do TechHire (0200, preparada)

Estimativa comunicada: 2–3 horas. O lote alinha CRUD e helper can_access_ats_job
à ação efetiva e vínculo real de owner/responsável/gestor/recrutador ou grupo do
workspace. Remove políticas permissivas de owner/membership, preserva fences
restritivas e valida o registro antigo antes de permitir edição. Workspace e
autoria são imutáveis; responsável continua editável conforme update efetiva.
Publicação exige sua chave específica. Sem novos grants ou alterações de defaults.

UI de URL direta e ações usam as mesmas capacidades. O campo legado Proprietário
da vaga passa a exibir Criado por sem edição, coerente com a autoria já documentada
no gravador; o Responsável usa a permissão de edição real. Configuração LinkedIn
deixa de gravar com admin após simples leitura. Copiloto não usa fallback admin e
exige leitura da vaga e view/create do próprio recurso. Exportações do servidor
exigem chaves de export, incluindo candidatos quando contêm seus dados pessoais.

O estado persistido de publicação em provedores torna-se somente leitura para
APIs de usuário: alterações só pelos handlers guardados ou worker interno assinado.
Os novos upserts informam workspace explicitamente e falhas do provedor não viram
sucesso. A conta de integração, publisher e os demais gravadores de importação
continuam uma frente própria da regra 9; este lote não os certifica.

Listar vagas em modo somente leitura não cria/promove pipeline. O catálogo de
pipelines usado no board/picker é uma exceção explícita de metadados compartilhados
do workspace, autorizada por pipelines.view ou jobs.view. Criação/promoção exige
separadamente create/update de pipelines. O CRUD/RLS completo de pipelines ainda
deve ser auditado. Vagas/pipelines/notificações criados pelo workflow usam
ctx.workspaceId do registro de origem. API pública por chave continua uma exceção
a auditar: tenant fixado na chave, feature flag e contrato de status precisam
revisão separada; não é validação de navegador.

11 grupos SQL de vagas, incluindo reprodução prévia do bypass e da negativa
indevida ao Head, passaram. Foram repetidas as equivalências de capacidades de RH
após estender os helpers. 26 testes de handlers + 3 de origem de workspace do
workflow passaram; tipos sem erro. Aplicação, publicação e gates completos ainda
precisam ser registrados.


0200 aplicada (hash 4b465b491183ba8286356cd77463ab22badc24a145c387af4060fe4af14fa22d,
when 1792799590341, id 204). Verify 1626 testes/tipos/lint e build completos no
mesmo fingerprint, sem mudança de fonte durante os gates. Simulação SQL de
Priscila confirmou criar/ler/editar/excluir uma vaga sintética em rascunho e as
capacidades correspondentes; mudança de autoria negada; usuário não membro sem
leitura. Estado de provedor não editável diretamente por authenticated, inclusive
Head; serviço preservado. Rollback integral e zero vagas sintéticas restantes.

Contagens/fingerprints de vagas (5), publicações (4), pipeline (1), defaults
(6653), memberships (244), overrides (971) e catálogo (1721) permaneceram idênticos.
Nenhum grant novo neste lote. Interface ainda precisa ser publicada e conferida;
aceite com sessão real no navegador permanece pendente do ambiente.


### Funis do TechHire (0201)

Estimativa comunicada: 1–2 horas. Remove bypass de membership/owner/admin
no CRUD dos pipelines; ações independentes por registro e escopo real, selected
workspace e membro ativo. Autoria e workspace imutáveis. Definir ou retirar
padrão exige update.workspace, pois pode alterar outra linha do workspace.
Gatilho protege exclusão do padrão e de funis vinculados a vagas, inclusive
quando a vaga não é visível ao solicitante. Defaults/grants existentes preservados.

Catálogo compartilhado usado pelas vagas permanece exceção somente leitura;
/pipelines e ações de edição exigem permissões próprias. Tela não cria/promove
funis sem as chaves necessárias; criação de cópia não é sobrescrita pela seleção
automática. Testes SQL cobrem own, team, workspace, deny, inativo, outro tenant,
ViewAs, padrão, vínculos e equivalência das capacidades. Aceite autenticado no
navegador segue dependente do ambiente local.


Publicação 0200 confirmada: commit c666c7b44f2fd206b47adefc716c206012078605
entregue nos dois domínios, entry index-BzS7WDJV.js e chunks de vagas/listagem/
capacidades conferidos byte a byte contra o build testado. Não substitui o aceite
autenticado em navegador; este continua pendente. A consulta SQL de Priscila
confirmou leitura das cinco vagas (uma de outro criador) e quatro publicações.

0201 aplicada: hash 2c5180d1f0ecd443578aeb6996ecd3d58a29f98cce703d9300fea6acb5e5a0e1,
when 1792800721831, id 205. Verify com 1634 testes, tipos/lint e build completos
no mesmo fingerprint c95c8b543e7a919e5671add95ca88f5c63ccb2c6f1e804e2410197c681513614,
sem mudança de fonte. Dez grupos SQL de funis e regressões de vagas/capacidades
aprovados. Simulação SQL de Priscila confirmou CRUD sintético e acesso ao funil
de outro criador, autoria imutável e não membro sem leitura. Rollback integral,
zero resíduos. Pipeline existente/defaults/overrides/memberships/catálogo intactos.
O construtor da primeira vaga cria funil sem promover padrão quando só possui
create; o teste dessa borda também passou. Interface aguarda publicação.


Publicação 0201 confirmada no commit b9422963b409fdda28c83075dece2c7e0b121f57,
entry index-DTLzrL_v.js e chunks de funis/capacidades conferidos byte a byte nos
dois domínios. Aceite autenticado no navegador continua pendente do Docker.

### Candidaturas e timeline (0202, preparada)

Estimativa comunicada: 2–3 horas. Candidatura é parte do agregado de candidato: usa
as chaves existentes de candidatos, sem novo catálogo/grants, mas exige leitura
do candidato E da vaga. Remove bypass de membership/owner. Create separado de
update, atribuição requer assign; autoria, workspace e pais imutáveis. Relações
de grupo reais no escopo team. Cascatas de exclusão seguem o pai já autorizado.

Timeline deixa de ser leitura geral de workspace. Exige candidatura visível, pais
consistentes e ator real; anexação por ação específica, sem UPDATE/DELETE de
usuário. Serviços confiáveis mantêm logs. A timeline ainda registra ações de
serviço/aplicação; não se declara prova forense de toda transição de negócio.

UI de arrastar e ações em massa usa capacidade por registro, exportação exige
chave própria e avaliação sua chave de score. Quadro usa etapas configuradas,
com bucket visual de compatibilidade para etapas históricas, sem regravar dados.
Portal público usa workspace para vagas e branding, exige módulo habilitado e
vaga publicada; mantém o portal padrão legado no host compartilhado. Repetir
candidatura não reabre nem sobrescreve processo; novas escritas e intake stage
usam o tenant/pipeline reais. Worker LinkedIn também usa esse tenant e não escolhe
candidato ambíguo; erro preserva página para retry sem fingir sucesso. Conta e
publisher da integração continuam na frente da regra 9.

13 grupos SQL de candidaturas/timeline passaram, incluindo autoria, ambos os
pais, own/team, deny/inativo/ViewAs, metadados e cascatas com workspace legado
nulo. A fixture preservou inclusive o deny de update.workspace do Head deixado
por um teste anterior; o novo caso usa uma linha efetivamente editável. Em
produção, as 12 chaves de candidatos da Priscila foram conferidas como permitidas.
Entrevistas, respostas de avaliação, alçadas de contratação/ofertas e regras
globais de campo/API seguem contratos posteriores, ainda não concluídos.

0202 aplicada: hash 31fdfbd79e31ea5cb035de7e1ec0744c21aa1d9ea09b22cf62e9098c7d099247,
when 1792802324945, id 206. Verify: 1647 testes/tipos/lint e build completos no
mesmo fingerprint 393fd8d1fe4faa54c0aaca5d729f4aac2e2e188bde54437c679a4d5bfcf05ccd,
sem mudança de fonte. Simulação SQL de Priscila confirmou cinco candidaturas
reais legíveis e editáveis; todas são de sua autoria, portanto o teste de edição
de outro criador foi feito com dados sintéticos em transação revertida. CRUD
próprio e de outro criador, capacidade por registro, autoria imutável, timeline
anexada e sem edição, cascata e não membro sem leitura passaram. Zero resíduos.
Candidatos (14), candidaturas (5), eventos (13), seus fingerprints, catálogo (1721),
memberships, defaults e overrides preservados. Interface aguarda publicação.


Publicação 0202 confirmada no commit 9a62553f85ba911c068b82da8da9f3c471f79b5c.
Entry index-i-5wxdCI.js e chunks de vaga, carreiras e capacidades conferidos byte
a byte nos dois domínios. Aceite autenticado no navegador segue pendente.

### Entrevistas, respostas e anotações de IA (0203, aplicada e publicada)

Estimativa comunicada: 90–150 minutos. Entrevistas exigem leitura da candidatura
real e chave própria de visualização; agendamento e pontuação são independentes.
Remove gates antigos que usavam owner_id como workspace e atalhos de membership.
Pais, autoria, workspace e avaliador imutáveis. Participantes, kit, pool, reunião
e referência de reagendamento pertencem ao tenant e contexto corretos. Cancelar
substitui DELETE direto de histórico; cascata do pai já autorizado é preservada.
Modelos com respostas não podem apagar histórico por cascata de exclusão do modelo;
devem ser desativados. CRUD de modelos e kits segue a próxima frente.

Resposta usa score, sem herdar edição do candidato. Total ponderado é calculado
no banco, com critérios conhecidos, notas 0–5 e modelo ligado à vaga correta.
Edição de resposta de outro criador preserva seu avaliador. Campos de análise de
IA exigem score e view/create de copiloto; transcrição humana usa score. UI nega
por registro/erro/carregamento/ViewAs antes de montar formulário e seus loaders.
Notetaker protege URL e usa provedor do workspace; não exige chave global da
Lovable quando outro provedor está configurado e não inventa ai_model. Gerar
anotações emite notes_generated; completed só na transição real para done.

As duas portas públicas de autoagendamento verificam token, validade e horário
ofertado futuro. Atualização condicional por token e pending_candidate admite
apenas um vencedor concorrente e só então registra sucesso/evento. Isso protege
a mesma convocação; não é certificação de disponibilidade cruzada de todas as
agendas. Calendário/slots/pools e integrações ainda precisam dos contratos próprios.
A porta legada usa kind video válido, tenant do pai e expiração de sete dias.

Treze grupos SQL e regressões anteriores passaram, incluindo 200 metadados iguais
às regras canônicas, mistura de escopos e ações, autoria, denies, inativo, ViewAs,
modelos/pais de outro tenant e cascatas. Caminho amplo valida todos os pais e
reaproveita chaves efetivas; own/team misto permanece na referência canônica.
Não é medição de desempenho geral nem aceite de navegador/provedor real.

0203 aplicada: hash 47412b87ca8bb00c7bd366048a3ef127701fddf3a9f581bc02677f13d44bd413,
when 1792804741329, id 207. Verify: 1672 testes/tipos/lint e build completos no
mesmo fingerprint 07a1eb6f248431b1e172a51eed42e2592ae6c221beb32429aa7ecab0eea11477,
sem mudança de fonte. A revisão final também oculta dados antigos após negativa
de acesso, limpa leituras com erro e impede uma resposta lenta de outra entrevista
de preencher a seleção atual. A limpeza global existente por troca de identidade
foi conferida e preservada.

Simulação SQL de Priscila confirmou criar entrevista/avaliação, editar as de outro
criador, preservar avaliador/autoria, calcular 3,67 a partir dos critérios, negar
DELETE de histórico, consultar capacidades e manter cascata de exclusão do pai.
Não membro sem leitura. Transação revertida, zero resíduos. Nenhum convite, email,
chamada de IA ou provider externo foi executado por esse ensaio. Sem entrevistas
ou respostas reais anteriores (ambos zero); modelo existente (1), seus dados,
catálogo (1721), defaults, memberships e overrides permaneceram intactos.
Metadados de 200 registros no teste isolado: referência canônica 1942,606 ms,
lote 12,229 ms com resultados iguais; não é medição do ERP em produção.
Publicação confirmada no commit 2812408acc33297f96bcf560e3a07514d9fef5e1.
Entry index-Dmydshuk.js e os chunks de vaga, notetaker, autoagendamento e
capacidades foram conferidos byte a byte nos dois domínios públicos.
Aceite no navegador com sessão real permanece pendente.

### Etapa 5 — ambiente recuperado e primeiro aceite autenticado de RH

Docker Desktop recuperado após encerramento normal e SIGTERM não resolverem um
backend antigo travado. Não havia VM ativa; foi necessário encerrar apenas esse
backend e reabrir o aplicativo. Engine 29.8.2 voltou a responder, sem exclusão de
volumes. O ambiente anterior foi preservado.

Uma segunda stack local, techerp-permissions-20261023, usa API 127.0.0.1:54521
e cópia descartável da aplicação na porta 5175. Estrutura extraída do catálogo
atual: 418 tabelas, 2230 políticas, 506 funções; catálogos globais de 1721 chaves
e sete namespaces de módulos (inclui namespace legado). Nenhum dado de cliente,
segredo ou sessão de produção foi importado. Ações HTTP externas/cron ficaram
inertes; as contas e registros são sintéticos. A extração não foi feita pela
reaplicação do histórico de migrations.

Nove testes com login real do GoTrue, JWT e SDK/PostgREST passaram: Head RH
fictício como membro sem admin, criação/edição de pessoa, criação/edição de plano,
bloqueios de usuário sem chave, membro inativo e outro workspace, e limpeza com
cascata. O perfil fictício recebe todas as chaves TechPeople/TechHire apenas no
tenant de teste; não é uma reprodução integral dos grants ou da sessão da
Priscila em produção.

Chrome em perfil temporário confirmou cadastro de pessoa e onboarding pela UI,
persistência após recarregar, negação de tela sem chave de RH e negação da ficha
para administrador de outro workspace, sem montar formulário de edição. Nenhum
pageerror no fluxo positivo. As tentativas anteriores do roteiro foram corrigidas
para aguardar hidratação, aceitar os parâmetros da URL, tolerar redirecionamentos
e usar o link Abrir da linha; não foram contadas como aceites aprovados.

Todos os registros de pessoa/onboarding desses ensaios foram removidos via
sessão autenticada local. Nenhum convite, chamada de IA ou integração externa
foi acionado. Evidências e prints no relatório local
outputs/permission-alignment-completion-2026-10-23/aceite-rh-ambiente-recuperado.html
(no diretório do projeto ChatGPT; não no repositório).

Este lote remove o bloqueio de infraestrutura e aprova esses caminhos locais.
Não conclui o aceite de todos os cargos/ações, a sessão real de Priscila em
produção nem as demais frentes de servidor, interface e CI do plano.


### Modelos, kits, pools e disponibilidade (0204–0205)

Estimativa comunicada: 2–4 horas. Fronteira inclui banco, servidor, ações de UI,
uso de metadados de agenda e preservação do histórico. Em validação final;
aplicação/publicação serão registradas após os respectivos comprovantes.

Administração de scorecards e kits reutiliza suas chaves CRUD existentes. Pools
de entrevistadores e janelas semanais recebem vinte chaves específicas (não se
confundem com pools de sourcing nem com a permissão ampla de scheduling). Grants
novos só para Head RH da WK, ON CONFLICT DO NOTHING preservando denies. Nenhum
preset ou override de outro cargo/workspace é modificado. Administração por own
usa criador; janela própria usa entrevistador real, nunca o criador intermediário.
Team exige grupo real no tenant. Tenant, autoria e vínculos de membros são imutáveis.

O catálogo de uso é exceção só de leitura: view+schedule de entrevistas permite
usar kits, pools e disponibilidade; view+score permite ler critérios de avaliação.
Isso não concede administração nem leitura de candidatos/entrevistas. Páginas de
administração exigem view próprio do recurso e botões consultam a ação por linha.
Scheduling mantém o acesso de tela legado, mas não transforma scheduling.view em
CRUD dos novos recursos. Falha/alteração de permissão limpa ou remonta a tela;
URL direta é protegida antes de montar carregadores e formulários.

Critérios de modelo com respostas e perguntas de kit com entrevistas não podem
ser reescritos/excluídos: há duplicação para nova versão e desativação para novos
usos, preservando o histórico. Novas respostas/entrevistas bloqueiam o modelo em
leitura para serializar contra alteração concorrente. Kit padrão é salvo em RPC
invoker transacional; mudar o padrão exige view/update.workspace, usa lock do
contexto e valida unicidade mesmo por SQL direto. Falha não desmarca o anterior.

Consultas de agenda retornam apenas entrevistador e intervalos ocupados limitados
ao período, incluindo painéis e entrevistas de candidatos invisíveis ao agendador.
Sem nomes, notas, IDs de entrevistas ou candidatos. Alvos precisam ser membros
ativos do tenant; período máximo31dias, máximo8pessoas. Janelas recorrentes usam
fuso IANA real e intervalo UTC; erro de leitura nunca vira disponibilidade livre.
Rotação usa lock no pool e atestação protegida por transação, sem GUC forjável.
Reservas por qualquer porta, inclusive confirmação por token público, serializam
no painel real e rejeitam sobreposição com mensagem sem dados de outro candidato.
Não consulta calendários externos: a disponibilidade deste contrato é das
entrevistas e janelas mantidas no TechHire.

Testes locais: 17 novos testes de servidor/fuso; 8 grupos SQL de configuração,
regressões anteriores e 219 comparações de capacidades preservadas; 17 grupos
com GoTrue/JWT/PostgREST reais, incluindo concorrência de rotação e de reserva,
modelo usado, default atômico e agenda sem PII. Chrome: Head RH não admin cria
modelo/kit/pool e desativa modelo; agendador abre agenda sem criar pool nem
administrar scorecards/kits por URL. Fixtures removidas. A revisão final completa
os gates com o mesmo fingerprint antes de aplicar/publicar.

0204 e 0205 aplicadas em transação única, ids 208 e 209, when 1792842993108 e
1792842993109. Hashes 325d025ab28973f6c0929f2f32dab72f8567902a4bc30ec12214d20c1e08bbb5
e 3b2ad5a0257e02e9f4b706f79761cd1e1fa2537a3c74cc074e07ba426b5fc611.
Verify: 1689 testes, tipos e lint; build completo; mesmo source_hash
944dcb1db55c7c0e843c23493059d2d43f983ed1ec78afb60566ccad6e24ae3c,
source_changed=false. Publicação da interface ainda será conferida.


Publicação 0204–0205 confirmada em 24/10/2026 no commit
693db716b5b80dc1a219ecc1d52fd7b0fd318040. Ambos os domínios servem
index-Ch_qjEQv.js e os chunks scorecards-C3h39lmF.js, interview-kits-DI66DQ4i.js,
scheduling-DF18ExGE.js e hr-access-c0chLe-S.js, conferidos byte a byte com o build.
O aceite de navegador incluiu também criar disponibilidade semanal do próprio
entrevistador: cinco fluxos aprovados, zero pageerrors e limpeza das fixtures.

Conferência da base ativa: scorecard, kit (normalizado pela nova coluna is_active),
pool e disponibilidade preservam seus fingerprints. Presets, memberships e
overrides anteriores também permanecem iguais. Catálogo 1721→1741; somente 20
novos overrides do Head RH da WK. RPCs novas sem EXECUTE anônimo; atestação de
rotação sem leitura/escrita para authenticated e sem resíduos. Substituídas todas
as políticas permissivas antigas das cinco tabelas por suas ações específicas.

Simulação SQL com auth.uid de Priscila criou/editou/excluiu modelos, kit, pool,
membro e janela, consultou agenda/capacidades, rotacionou pool e negou troca de
autoria; não membro sem leitura. Transação revertida, zero resíduos, sem chamadas
externas. Isso não é aceite de uma sessão real da Priscila no navegador publicado.
Evidências/prints: outputs/permission-ats-configuration-2026-10-24/relatorio.html
no projeto ChatGPT. Lote concluído e publicado dentro do escopo descrito; não
conclui as seis etapas nem alçadas/ofertas, outros módulos, APIs ou campos globais.


### Ofertas, aprovação e confirmação de contratação (0206–0207)

Estimativa comunicada: 3–5 horas. Preparação e ativação separadas para publicar
os consumidores compatíveis antes de revogar leituras legadas. Este lote trata
as ações e seus estados; não conclui a revisão dos seis módulos.

A oferta passa por rascunho → solicitação → aprovação/reprovação da versão →
disponibilização para assinatura. Alterar título, corpo, remuneração ou início
invalida a aprovação anterior. Durante a revisão e após disponibilização, as
condições ficam bloqueadas. Documento de assinatura contém a versão e as
condições aprovadas; envio, aprovação e cancelamento serializam no registro e
produzem histórico. Sem exclusão física de ofertas com histórico.

Há 17 chaves novas: consulta/edição de condições de oferta e contratação nos
escopos own/team/workspace, disponibilização, cancelamento, confirmação de
contratação, reversão e reatribuição de oferta. Somente Head RH da WK recebe os
novos overrides; denies, presets e outros cargos/workspaces são preservados.
A aprovação existente `offers.approve.workspace` ganha uma operação real, em vez
de um evento indevidamente emitido ao enviar. Não foram inventados limites
monetários por cargo nem obrigatoriedade de segundo aprovador.

Metadados seguem visíveis com a chave base. Corpo e valores só saem pela
projeção de campos autorizada; a consulta direta dessas colunas e de
hiring_details não é concedida a authenticated. eSign genérico não permite
reescrever documentos vinculados à oferta nem obter o token do candidato.
Link público exige estado, tenant e validade corretos; assinatura e cancelamento
são concorrentes, com um vencedor. Aceite de todos os signatários marca apenas
a oferta: não confirma contratação nem move automaticamente o pipeline.

Contratar exige ação específica, além da edição da candidatura e visibilidade
dos pais reais. Alterar condições após contratar também exige aprovação;
reversão tem chave própria e avisa que Pessoas/Contratos/Financeiro já gerados
precisam de revisão separada. Histórico de contratação não é apagado fisicamente;
use reversão/anonimização autorizada. Workflows existentes continuam reagindo à
contratação confirmada, mas uma movimentação genérica de serviço não pode criar
contratação sem delegação. API exige chave ativa, escopo write e RBAC real do
proprietário, sem criar/expor sessão de usuário.

A tela usa o termo disponibilizar para assinatura: o mecanismo existente não
comprova entrega de e-mail. O operador pode copiar o link autorizado para seu
canal de envio. A página da oferta agora leva ao documento correspondente, em
vez de afirmar que um e-mail foi enviado.

Validação concluída: 16 grupos SQL (mais todas as regressões e 219
comparações de capacidades); 11 grupos com GoTrue/JWT/PostgREST reais locais;
quatro fluxos no Chrome com Head RH não administrador e conta sem a chave.
As verificações finais, hashes, aplicação e publicação constam a seguir.
Isso não equivale ao aceite da sessão real de Priscila no ambiente publicado.


Lote 0206–0207 aplicado e publicado em 24/10/2026. Código de interface:
`de20901c8a9b4d13ee71e80996d3b12322f232d9`; complemento da ativação protege o
identificador da candidatura contra desvinculação do histórico (`0395d33a6`).
Migrações 210/211 no journal: hashes
`c13ad2bd75f194b748d8ab06304e6b90df9d2b2424051f4dc88182d4b4dc0730` e
`72a32842a0a5ede448de1b1543e1869bd00538265c629a76dbe97b35c2976e40`;
when `1792845739194` e `1792845739195`. A ativação só foi aplicada após confirmar
os arquivos compatíveis nos dois domínios públicos.

Gates finais: 1699 testes em 216 arquivos, tipos e lint; build completo. Mesmo
source_hash `210c67006ca12ef833b90eaf2f0417ce5341b1961e32dc2837fabbf254b15da0`,
source_changed=false. 16 grupos SQL novos, regressões anteriores e 219
comparações de capacidades; 11 grupos reais de GoTrue/PostgREST e quatro fluxos
no Chrome. A prova dos arquivos publicados coincide byte a byte com o build:
`index-DjKmlSi8.js`, `offers-BIBlZ-9d.js`, `offer._token-xHZB7mE8.js`,
`jobs._id-BY7nRIr8.js` e `hr-access-B69a408U.js`, nos dois domínios.

Base ativa: catálogo 1741→1758, exatamente 17 overrides novos para Head RH da
WK; nenhum outro cargo/workspace recebe nova concessão. Presets, memberships,
overrides anteriores e dados de candidaturas/ofertas/eSign mantêm seus hashes.
RPCs públicas apenas para service_role; anonymous não executa projeção/transição;
authenticated não lê as quatro colunas privadas conferidas nem executa assinatura
pública/contratação de API. Zero atestações pendentes.

Checagem SQL na base ativa, com a identidade de Priscila, passou por elaborar,
solicitar/aprovar, disponibilizar, assinar sem contratar e confirmar contratação,
com auditoria e negação de exclusão/troca de ID. Tudo revertido; zero candidatos,
vagas e ofertas de QA remanescentes. Esta é simulação SQL, não uma sessão real da
Priscila no navegador publicado. Relatório/prints em
`outputs/permission-ats-offers-2026-10-24/relatorio.html` no projeto ChatGPT.
As demais frentes do plano de seis etapas continuam pendentes, inclusive a
revisão integral de módulos, integrações, logs/campos globais e aceite dos cargos.


## Ordem 1 — fechamento da frente RH/LGPD (0208–0209), 24/10/2026

Escopo desta entrega: regra 18, solicitações LGPD, consentimentos, retenção,
exportação e anonimização; reconciliar o aceite local com o aceite da sessão
real. Não significa certificar todos os caminhos de RH ou os seis módulos.
Estimativa anunciada: 1–2h. Tempo final e estado de publicação no relatório.

- Escopo por candidato e workspace ativo, sem filtro fixo pelo criador do pedido.
- View/create/update/export/delete separados, deny preservado e candidato visível.
- Solicitação, consentimento e tenant imutáveis; revogação preserva evidência.
- Exportação pela sessão do operador, sem hiring_details nem bearer de agenda;
  informa explicitamente que inclui somente dados autorizados, não dump privilegiado.
- Vínculo de DSAR e tipo verificados antes da ação; exportar/anonimizar e concluir
  a solicitação fazem parte da mesma transação. Falha impede confirmação parcial.
- Guards/RLS também protegem gravações diretas; retenção exige update do candidato
  e compliance.update. Trilhas DSAR/consentimento não têm exclusão física de usuário.
- /compliance exige view antes de montar; ações usam capacidades do banco;
  erros de consulta aparecem como falha, nunca como histórico vazio.
- Nenhuma chave ou concessão nova em produção. Dados existentes preservados.

9 grupos SQL novos mais regressões aprovados; 11 cenários reais de autenticação
local e 4 fluxos no Chrome local aprovados. Head RH sintético é membro comum.
A preparação 0208 foi aplicada; a ativação 0209 depende da publicação compatível.
Priscila: chaves efetivas conferidas; sessão real de produção ainda não aceita.
A sessão disponibilizada inicialmente era floripinova@gmail.com em outro workspace;
o usuário informou dificuldade para trocar a conta Google. Não tratar login de
outro usuário ou simulação SQL como aceite da Priscila.


### Fechamento técnico da Ordem 1 — aplicado e publicado

Código dbb91491f8b65ff6c6c2ef8361abab6a970bad3a; 0208/0209 aplicadas no
journal 212/213. Publicação confirmada byte a byte nos dois domínios:
index-DBzaLVIr.js, compliance-Bd2-Agnt.js e hr-access-B2HVkveD.js. A fila chegou
a pausar com server_error, mas a publicação foi posteriormente confirmada;
não é bloqueio de publicação atual.

Gates finais: 1705 testes/217 arquivos, tipos, lint e build completos, mesmo
source_hash 60f08c85b6c9869c38c914ce09dbe550c4fe98dcb18549663906506ec5ff9842,
source_changed=false. SQL: 9 grupos novos e todas as regressões anteriores;
11 cenários GoTrue/PostgREST e 4 fluxos Chrome locais aprovados. Ensaio adicional
com catálogo real local por rollback passou. Os registros sintéticos locais
foram removidos.

Na base ativa, a identidade SQL de Priscila criou/editou pessoa e onboarding,
consultou pedido de outro criador e executou retenção, consentimento/revogação,
exportação e anonimização com conclusão da solicitação. Negativa de não membro
passou. Rollback integral, zero pessoas/candidatos/planos/pedidos QA restantes.
Catálogo, defaults, overrides, memberships, candidatos, pessoas e planos
mantiveram seus hashes. Três guards ativos, seis políticas permissivas canônicas,
zero políticas permissivas legadas nas duas tabelas e nenhum EXECUTE anônimo
nas RPCs conferidas. Nenhuma permissão nova foi concedida em produção.

Priscila tem 363/363 chaves TechHire e 235/235 TechPeople efetivas. Isso é
configuração e aceite SQL, não comprovação de todas as telas da sessão real.
A Ordem 1 tem implementação técnica aplicada, testada e publicada; o único
item do aceite específico desta frente ainda pendente é o navegador com a
conta real de Priscila. O usuário relatou dificuldade para trocar a conta Google.
Não marcar a Ordem 1 como integralmente aceita até resolver esse item.

Estimativa inicial 1–2h. Até a confirmação final do banco, foram cerca de
37 minutos corridos desde o início do turno; duração ativa final do turno
não estava disponível nesse momento. A espera pelo aceite da usuária continua
separada. Relatório e evidências em outputs/permission-hr-compliance-2026-10-24
no projeto ChatGPT. As demais ordens e as seis etapas globais permanecem abertas.


### Aceite final da Ordem 1 — concluído em 24/10/2026

Após o usuário disponibilizar sua sessão guilherme@wktechnology.com.br, o
recurso normal do produto Ver como iniciou uma sessão DELEGADA real da
Priscila Alves do Nascimento (mode=user, não somente leitura), com as permissões
dela. Não foi login Google/senha da Priscila e não foram extraídos tokens nem
alteradas credenciais ou concessões.

Pela interface de produção foram aprovados: criar pessoa, editar o nome,
criar onboarding vazio, editar o status do plano e confirmar ambas as alterações
após recarregar a ficha. A pessoa e o plano ficaram com a autoria/responsabilidade
da Priscila, conferidas também por consulta restrita aos IDs de QA.

O usuário autorizou explicitamente excluir os dois registros fictícios. A
exclusão foi feita pela interface; zero pessoa/planos restantes nos IDs conferidos.
A sessão delegada foi encerrada e o acesso do Guilherme foi restaurado.

**Ordem 1 concluída nos critérios desta frente.** A pendência específica de
aceite pessoa/onboarding em produção está resolvida por sessão delegada. Isso
não certifica todas as telas do TechHire/TechPeople nem encerra as seis etapas.
LGPD conserva a combinação de testes SQL em produção e navegador/autenticação
locais; não alegar que todas as operações LGPD foram executadas visualmente em
produção. A dificuldade anterior de troca de conta Google não bloqueia mais o
aceite funcional desta frente.

Evidência detalhada e prints: no projeto ChatGPT,
outputs/permission-hr-compliance-2026-10-24/priscila-production-browser-acceptance.json.
Nenhuma alteração de código, esquema do banco ou concessão de permissões foi
necessária neste aceite; somente registros fictícios foram criados/editados e
removidos após a autorização específica do usuário.
A revisão técnica anterior e a publicação permanecem válidas.

## Ordem 2 — núcleo TechFinance (0210–0211), 24/10/2026

Estimativa inicial da frente financeira: 2–4h, incluindo correções, teste e
publicação. Este primeiro lote cobre lançamentos, baixas contábeis, parcelas,
recorrências e rateios; não conclui toda a Ordem 2.

A preparação 0210 foi aplicada no journal 214, when 1792873273590, hash
`d42fb3bb981318bfc051f94bec0514c580ef6323736ea0529e8bb222606bb8e0`.
A ativação 0211 será aplicada somente depois da interface compatível publicada.
Não há mudança de defaults, overrides de cargos ou memberships em produção.
Duas chaves entram no catálogo: cancelar lançamento e reatribuir lançamento;
as concessões continuam sendo decisões da matriz, sem grants em massa.

O responsável efetivo é assigned_to, com fallback para owner_id; team depende
de grupo real no tenant. Acesso exige workspace selecionado e membership ativo.
Owner sozinho não permite editar. Baixa tem view/create/delete próprios e não
exige entries.update. Saldo/status continuam derivados do trigger: não podem ser
forjados na edição. Baixas serializam no lançamento e não excedem seu saldo;
condições já baixadas exigem reversão antes de alteração destrutiva.
Reversão contábil não promete estorno bancário. Cancelamento exige sua ação e
não pode apagar o histórico de baixas. Tenant, origem e autoria são imutáveis.

Parcelas são criadas/excluídas em transação, conferindo todos os irmãos reais;
o pai permanece quando há parcelas que precisam ser preservadas. Recorrência
bloqueia a agenda e grava o lançamento junto com o cursor; duas execuções não
repetem a mesma ocorrência. Corrige competência ausente na geração. Cron usa
o tenant da origem e delegação do dono ativo; suspensão/revogação bloqueia novas
gerações. Agenda com histórico pode ser pausada, não apagada. Falhas/itens sem
permissão são informados no processamento, sem afirmar sucesso integral.

Rateios exigem edição do lançamento, centro ativo no mesmo tenant e soma dentro
do valor. Contexto de permissões é protegido e calculado uma vez por consulta,
sem refazer a matriz para cada uma das milhares de linhas financeiras.

Consumidores bancários foram adaptados ao saldo derivado: removida a segunda
soma após o trigger. Liquidação simulada identifica a autoria; conciliação de
extrato cria lançamento/baixa/vínculo em transação e serializa a transação do
extrato. Workspace bancário usa o selecionado, em vez do primeiro de uma lista.
Isso é compatibilidade do núcleo, não aceite integral de aprovação/provedores,
segredos, cancelamento bancário ou idempotência concorrente de todos os webhooks.

UI: consulta antes de montar, capacidades reais por linha, cache por workspace,
edição em massa limitada às datas revisadas, atribuição com ação própria,
exportação com autorização de servidor e ausência de histórico diferenciada de
falta de permissão. Na revisão foi corrigida a invalidação da lista após incluir
workspace na chave de cache. Fonte de verdade continua sendo o banco.

Validação até a preparação: 1711 testes/218 arquivos, tipos/lint/build completos,
mesmo source_hash `88207dd8e69b22a0512d014103f55f0ae4da1fd218842a98315eac2f3dbb9b3a`,
source_changed=false. Quinze grupos SQL no catálogo real isolado, 12 cenários
GoTrue/PostgREST reais e 3 de compatibilidade bancária sem provider externo.
Quatro fluxos de navegador aprovados; complemento de campos em massa em aceite.
Todas as regressões de RH/LGPD/settings/RPC anteriores passaram.

Pendências da Ordem 2: autorização bancária completa (inclusive tokens,
aprovação/execução, cancelamento e concorrência de liquidação); cadastros e
relatórios; faturamento/NFS-e/cobrança e integrações. Não foi encontrado controle
de fechamento de período nos fluxos avaliados: a matriz não substitui essa regra
de negócio. Não houve reconciliação/mudança automática de valores históricos.
Aplicação/versão publicada e encerramento do lote serão registrados abaixo.

Revisão final antes da ativação: os guards agora isentam somente postgres,
supabase_admin e service_role. Papéis técnicos não privilegiados que herdam
`authenticated` também passam pela validação de estado. Um caso SQL adicional
com papel sintético herdado prova a negativa; criação/grants desse papel foram
revertidos dentro da própria transação local. São 16 grupos SQL neste lote.
A 0210 aplicada permanece intacta; somente a 0211 ainda não aplicada foi reforçada.

Gates finais dessa revisão: 1711 testes/218 arquivos, tipos, lint e build;
mesmo source_hash `cc90f03341c38554543556bd7cdad8bf046429ab3f1c39fa203550ff33b02d11`,
source_changed=false. Cinco fluxos Chrome aprovados, incluindo edição em massa
limitada às datas e negação de entry.view mantendo outro acesso financeiro.
Fixtures locais zeradas e permissões locais anteriores restauradas.


### Ordem 2 — fechamento do lote financeiro central (24/10/2026)

Publicado e aplicado: código `478227332659f58e4badb66047f1ed94815173eb`, proteção final `48339fcc0fbd7ef4c05e666edb79eaf453119712`. Nos dois domínios públicos, o HTML referencia `/assets/index-C2HIv9f6.js` e os oito arquivos conferidos têm SHA-256 idêntico ao build validado. Não se usou apenas o status published do provedor como evidência.

0210 registrada no journal 214; 0211 ativada em transação após a publicação, journal 215, when 1792873273591, SHA-256 `cf84a1e08b62f0c267080f089dc4f6d60303897fa22cdd9c5c54f55cf20b2f1d`. Confirmadas 15 políticas canônicas e quatro triggers de proteção; restrições de Ver como preservadas. Helper de recálculo permanece sem execução para authenticated, anon e techerp_api_subject.

Aceite SQL de produção com identidade autenticada simulada: criar/editar, baixa parcial, rejeição de excesso e saldo forjado, imutabilidade de condições com baixa, rateios, reversão, cancelamento, parcelas atômicas, geração de recorrência sem repetição e bloqueio de não membro. Tudo revertido por rollback, zero resíduos fictícios. Esse teste não equivale a login de usuário financeiro não administrador no navegador de produção; os 5 fluxos visuais e os testes JWT foram locais. Contagens preservadas: 28.531 lançamentos, 26.035 baixas, 6.653 defaults e 1.008 overrides. Nenhuma concessão de cargo criada para as duas novas chaves.

Evidências: `outputs/permission-finance-core-2026-10-24/` no workspace da auditoria. Verify: 1.711 testes, tipos e lint aprovados; build aprovado; mesma fonte cc90f03341c38554543556bd7cdad8bf046429ab3f1c39fa203550ff33b02d11.

**Situação:** lote central concluído no escopo descrito. Ordem 2 e seis etapas globais continuam em andamento. Próximos lotes: permissionamento bancário (aprovação, execução, credenciais, cancelamento, webhooks), catálogos/relatórios e fiscal/cobrança. Não houve chamada a banco externo ou pagamento real.


### Ordem 2 — lote bancário 0212–0213 (em validação, 24/10/2026)

Estimativa inicial desta frente: 2–4 horas, incluindo testes, implantação e aceite. Escopo: substituir os bloqueios administrativos genéricos por ações de conexão, sincronização, conciliação, rascunho, aprovação, execução, cancelamento, emissão e simulação. A leitura banking.view.workspace é pré-requisito; não se concede acesso automaticamente a cargos. Os recursos novos têm rótulos em português na matriz de permissões.

Aprovar passa apenas a aprovar; Executar exige chave própria, confirmação e claim atômico de aprovado para processando. Não se reenvia um débito de resultado incerto automaticamente. Cancelamento local somente antes do envio. TED e provedores reais permanecem indisponíveis. Cobrança só é marcada cancelada depois da confirmação do adapter; emissão incerta preserva o identificador para apuração.

Tokens AES-GCM e estado OAuth não são selecionáveis pelo navegador, nem por administradores. Conclusão OAuth vinculada ao ator/state, com TTL e consumo único. Renovação possui lease antes da chamada externa e CAS na rotação; desconexão invalida tokens atomicamente. Webhook exige HMAC sobre corpo bruto e external_id compatível com origem; transição e baixa são uma única transação, com lock e proteção de saldo. Callback/cron não dependem do workspace do navegador. Não são permissões públicas: são exceções explícitas de serviço.

Conciliação mantém cliente do usuário e só altera estado/vínculo; impede vínculo a baixa invisível, de outro tenant, direção/valor incompatível ou já utilizada. Criação de lançamento por extrato exige também as permissões financeiras de criação/leitura. Indicadores não retornam logs globais do cron a um workspace, nem representam dados indisponíveis como zero.

Validação local: teste SDK persistente em scripts/isolated-db/banking-acceptance.mjs; ACL e papel técnico em tests/sql/banking-actions.sql; testes de cifra e autorização em src/lib/banking/*.test.ts. Aceite visual usa usuário não administrador e adapter mock; webhook HTTP local assinado também verificado. Gates finais e aplicação/publicação serão registrados após a conclusão.

Ordem 2 permanece aberta para catálogos/relatórios e fiscal/cobrança comercial. Este lote não implementa ou certifica um conector bancário real, estorno de dinheiro, TED ou regras de alçada que não existiam.


### Ordem 2 — lote bancário publicado e ativado (24/10/2026)

**Concluído no escopo descrito.** Commit `152395bd096b8a135f76afe60c82b4f8c7f70df8`. Verify: 1.720 testes / 220 arquivos, tipos e lint, 39.178ms. Build: 99.889ms. Ambos completos, source_changed=false e fingerprint `34b1f82ddc9d5b54b21f75ffad1348d997c698279f9955495b3f0546f3c6a34a`. Fonte permaneceu estável; tentativas anteriores durante alterações não foram aceitas como gate final.

Preparação 0212 aplicada no journal 216, when 1792873273592, SHA-256 `55916bec0b321e9eb71602ddafee2f2300c2e873a542f20e1f1428c34cd66987`. Publicação confirmada nos dois domínios: HTML referencia `/assets/index-BkWLzOxU.js`; root, banking.functions, duas rotas bancárias, hr-access e settings.permissions conferidos por SHA-256. Só então 0213 foi ativada em transação, journal 217, when 1792873273593, SHA-256 `683bf9800da0992d294d3dd1bfd9cd0b0b910209aa95556b65373bad1d02444d`. Não reaplicar essas migrações.

Aceite local: 20 cenários GoTrue/JWT/PostgREST, 5 fluxos de navegador/HTTP assinado, 2 grupos SQL bancários e 16 grupos de regressão financeira. Negação de URL direta, deny, outro tenant, inativo e Ver como testados. Zero erros de página no aceite final. Token cifrado confirmado após OAuth pelo formulário real. A renovação possui lease antes de chamar o provedor, além do CAS de armazenamento. Fixtures removidas e overrides locais restaurados.

Aceite de produção: simulação SQL de identidade com rollback; criar/aprovar/claim sem executar provedor, impedir replay/cancelamento após envio/DML direto, callback atômico e repetição idempotente, segredo/RPC protegidos e não membro negado. Zero resíduos de conexão, lançamento ou baixa fictícios. Não equivale a sessão financeira não administradora no navegador de produção ou aceite de banco real. Os testes visuais ocorreram no ambiente isolado.

Fotografias antes/depois: mesmos hashes e contagens de defaults (6.653), overrides (1.008), lançamentos (28.531) e baixas (26.035). Oito novas chaves, zero concessões em defaults/overrides. Tokens, metadata OAuth, UPDATE direto de bank_payments e callback de serviço indisponíveis para anon, authenticated e techerp_api_subject. Todas as cinco tabelas de dados bancários verificadas continuam vazias após rollback. Evidências externas: `outputs/permission-banking-2026-10-24/`.

**Pendências da Ordem 2:** catálogos (incluindo contas bancárias), relatórios/exportações e fiscal/cobrança comercial. Adapter real, TED, estorno bancário, execução automática de pagamentos futuros e alçadas novas continuam fora deste lote; somente Inter mock existe. As seis etapas globais não estão concluídas por este fechamento.


### Ordem 2 — fechamento de catálogos, relatórios e cobrança (0214–0215)

Estimativa inicial desta frente: 3–6h, incluindo implementação, regressões,
publicação e aceite. Estado atual: preparado, em testes isolados; ainda não
aplicado nem publicado. Os resultados intermediários com harness sem paginação
foram descartados: concessões sintéticas ficaram fora da limpeza, o perfil foi
restaurado e os testes serão repetidos com catálogo completo.

Escopo: categorias, contas, centros de custo, empresas/grupos, DRE/caixa/auditoria,
exportação, faturas compartilhadas Sales/Finance, histórico fiscal, modelos e
régua de cobrança, cron e fronteira pública dos gateways. A UI recebe guard antes
de consultas, ações por capacidade e cache separado por workspace. O servidor
usa o cliente do usuário, e o banco substitui permissivas legadas sem remover
restritivas, exige ação/escopo e protege autoria, tenant e vínculos. Catálogos sem
responsável não ganham escopo workspace por uma chave own/team. Referências de
outros módulos retornam apenas IDs, nomes e campos mínimos, sem saldos/segredos.

Quitação manual e cancelamento exigem ação específica e edição da fatura
visível. Campos do provedor e histórico de pagamentos/fiscal não são CRUD de
usuário. Contadores de fatura são concorrentes; grupos, empresa padrão e régua
usam transações; faturamento legado de horas preserva RLS e guards de medição,
criando fatura e vínculos juntos ou revertendo tudo. Exclusão não apaga histórico
nem desassocia silenciosamente registros em uso.

A régua revalida o responsável ativo e a delegação por canal no tenant de origem;
reserva cada passo antes do efeito, mantém resultado durável e pausa resultado
incerto. Não há retentativa automática de envio possivelmente realizado.
Segmentos ainda não executáveis são recusados explicitamente. Modelos de texto
de cobrança não equivalem a templates aprovados pela Meta: a janela/opt-out do
WhatsApp permanece no serviço do canal. O cron usa CRON_SECRET e referência de
Vault compatível com o agendador de recorrências, nunca uma chave pública.

Limite funcional encontrado: a emissão de Pix/boleto e NFS-e não tinha adaptador
real; gerava dados fictícios mesmo quando configurada como live. Produção tinha
uma fatura manual sandbox e nenhuma política de cobrança. A correção impede
emissão fictícia, desabilita esses botões com explicação e retorna indisponível.
O webhook de gateway não altera dados sem um adaptador verificado (503). Não
prometer emissão real, homologação de gateway, TED, estorno bancário, nova alçada
ou fechamento contábil, que não são entregas de alinhamento de permissões.
Nenhum cargo padrão ou override de produção será alterado automaticamente.


### Ordem 2 concluída no escopo de permissionamento — 24/10/2026

Implementação `0bb5537d61e7b91c9423a9cef413e3cdd783ad8b`. Migrações 0214/0215
aplicadas no journal 218/219, when 1792873273594/1792873273595. Hashes SHA-256:
`08f5d86ba99127b939a4a2315958dd4362fd1393b0e3dc19a4e1fe26638ed3c1` e
`24d8737984524c3edda1ff85fa0bc5afda2d113055121b49e9bc38a2ddb46334`.

Preparação antes da publicação; ativação somente após conferir o entrypoint e
13 assets byte a byte em app.wktechnology.com.br e wktechnology.lovable.app.
Deploy `ff9268b2-8b65-45af-b43c-5b1fb0eff157`. Gates finais: 1.727 testes em
221 arquivos, tipos e lint aprovados; verify 41.691 ms e build 99.452 ms,
ambos completos, sem alteração de fonte, hash
`e0323869a4ed7796b45953f0fbfaacfe835ed7a2cdd158b0ea0c1ebf53abb9ad`.

Aceite final: 26 casos GoTrue/JWT/PostgREST, 20 regressões bancárias, 5 fluxos
Chrome/HTTP, zero erros de página, 18 grupos SQL de regressão e roteiro adicional
de aceite ensaiado localmente. Concessões fictícias e registros de teste limpos;
rodadas anteriores com catálogo truncado foram descartadas e não contam como
aceite. Produção: identidade SQL autenticada com rollback validou cadastros,
grupos atômicos, padrão, quitação manual, proteção de provedor, imutabilidade de
fatura paga, segredos, fiscal protegido, régua, exportação e negação de não membro.
Zero resíduos em fatura, empresa, categoria, grupo ou régua de QA.

Os agendadores tinham uma referência de segredo ausente. Agora cada um usa
credencial privada própria no Vault, validada por RPC exclusiva de serviço;
as credenciais não são retornadas ao navegador nem registradas no relatório.
Horários e estado ativo preservados: banco */30, cobrança */15 e recorrências
06h05 no fuso do cron existente. A implementação não depende daquela referência
vazia e mantém compatibilidade com o CRON_SECRET do servidor. Não houve envio
real de cobrança, emissão fiscal ou chamada financeira a provedor no aceite.

Preservação de contagens E hashes: 28.531 lançamentos, 26.035 baixas, 1 fatura,
1 registro fiscal, 6.653 defaults e 1.008 overrides. Nove guards, 37 políticas
canônicas e quatro chaves específicas; nenhum grant novo para cargos. Histórico
original e dados reais não foram migrados, apagados ou reescritos.

Evidências: projeto ChatGPT, outputs/permission-finance-business-2026-10-24/.
Este aceite combina navegador/autenticação locais, SQL e metadados de produção;
não alegar teste visual de todos os cargos financeiros em produção. Integrações
reais de cobrança/NFS-e, TED, estorno bancário e fechamento contábil novo
continuam fora do escopo. Emissão fictícia foi removida e substituída por
indisponibilidade explícita. As outras ordens e seis etapas globais continuam
com seus próprios critérios: concluir Ordem 2 não encerra o plano inteiro.


### Ordem 3 — núcleo de Contratos e Projetos (primeiro lote)

Escopo deste lote: `contracts`, `projects` e `project_tasks`, seus acessos por URL,
menus, ações básicas e conjuntos de projetos/tarefas do dashboard. Não confundir
com o encerramento de toda a Ordem 3 ou das seis etapas globais.

A RLS passa a exigir membership ativo no workspace selecionado, chave efetiva
com deny e escopo próprio/equipe/workspace. O responsável de contrato/projeto é
`coalesce(assigned_to, owner_id)`; tarefa considera responsável principal e
`assignee_ids`. Autoria isolada, papel administrativo legado e mero pertencimento
ao workspace não substituem a chave. As antigas políticas restritivas de CRUD
que impediam equipe/colaboradores adicionais são substituídas com as permissivas;
as políticas `view_as_ro_*` permanecem. O contexto resolve também o tenant de uma
sessão API protegida, sem aceitar workspace do navegador como autorização.

Identidade e autoria são imutáveis; reatribuição exige chave específica e pessoa
ativa do mesmo workspace. Vínculos novos/alterados usam a RLS do chamador e não
podem cruzar tenants. Duas chaves novas (`techcontracts.contracts.assign.workspace`
e `techprojects.projects.assign.workspace`) entram apenas no catálogo, sem
concessão a cargos. A chave de tarefas existente é reutilizada. Gestor criador
é incluído atomicamente ao criar projeto, em vez de uma segunda gravação com
erro ignorado.

O dashboard usa o mesmo predicado puro e contexto materializado de RLS, inclusive
nos vínculos de negócios e na previsão. Referências mínimas para apontamento são
exceção explícita: usuário autorizado a apontar consulta apenas id/título/status
de tarefas de projeto realmente apontável. Permissão de criar tarefa continua
obrigatória para criar uma atividade a partir do apontamento. Rótulos mínimos
projeto/atividade são retornados apenas para apontamentos visíveis, sem conceder
leitura integral das fichas ou de seus valores financeiros. Horas, aprovação,
fechamento, medição e entrega de negócios mantêm suas portas e flags existentes.

Aceite isolado: 26 casos com GoTrue/JWT/PostgREST, seis fluxos Chrome, zero erros
de página e nenhum envio externo. Fixtures e overrides de teste são restaurados.
Migrações 0216 (aditiva) e 0217 (ativação após publicação); nenhuma alteração em
cargo padrão, pacote ou concessão de produção. Publicação e aceite de produção
serão registrados no fechamento deste lote.

Próximos lotes da Ordem 3: aprovações/assinatura e transições contratuais;
serviços, modelos, documentos e configurações; espaços/listas/marcos/membros e
filhos de tarefas; ações de configuração/importação/conciliação; exposição de
campos financeiros e exportação; revisão das delegações de automações e
integrações. Estes itens continuam pendentes e não são certificados por este lote.


Fechamento deste lote (24/10/2026): código `892ba53cc7873694eee7c6410315820771f62c3e`
publicado nos dois domínios, 12 assets idênticos ao build validado. A integração
retornou pending sem atualizar o site; a publicação foi concluída pelo botão
Publicar alterações no editor WK e confirmada por arquivos públicos e pela UI.
Preparação journal 220 / ativação 221, when 1792873273596 / 1792873273597.
SHA-256 das migrations: `43a152549a39ebe3355f7b55da00fd482d4aa0d50dc67b829cff03949a36671a`
e `2c307ad0c9a5db352d424ee7ced3ca1435fafbefe5b1cf4e61d741c0f043ebaa`.

Gates completos sobre a mesma fonte, sem alterações: 1.733 testes em 221 arquivos,
tipos e lint aprovados; verify 35.870 ms e build 89.746 ms; source_hash
`4eaff3e35b4e7d6c662e06b9b3642e3df6af4f3dd75fcac389f5a1038b661542`.
Aceite: 26 casos JWT/PostgREST, seis fluxos Chrome sem erros de página, 18 grupos
SQL financeiros e quatro verificações de contexto API com rollback. Consulta de
dashboard com 10 mil tarefas sintéticas: 1.103 ms; leitura direta RLS: 3.249 ms.
Medição isolada de uma consulta, não promessa de latência de tela ou comparação
com a versão anterior. SQL/API-context e volume usam identidade SQL local;
não confundir com testes ponta a ponta de uma chave API real.

Produção: 64 contratos, 172 projetos e 15.862 tarefas preservados; hashes de
defaults e overrides iguais à foto anterior; 12 políticas canônicas e nove
proteções Ver Como preservadas. Conjunto de projetos RLS/dashboard tem hash
`cdadf935d5174b056fa9e20e8c1096e4`; tarefas, `d69d66ccd313fe1deed17cff8fb96118`.
A conferência combinada perdeu a conexão e foi descartada: a prova final foi
obtida por consultas separadas, com a mesma identidade e workspace selecionado.
Capacidades por registro e recusa de não membro passaram. Função de capacidades
HTTP nos dois domínios recusou ausência/token inválido: protocolo TanStack
retorna HTTP 200 com erro serializado Unauthorized, sem dados; não alegar 401.
Nenhum cadastro real foi reescrito nem concessão de cargo ampliada. Não foram
executadas mutações nem envios externos em produção. Fixtures locais limpos.

Evidências: projeto ChatGPT, outputs/permission-work-core-2026-10-24/.
Este primeiro lote está concluído; os próximos lotes da Ordem 3 listados acima
continuam pendentes. Não declarar toda a Ordem 3 ou as seis etapas concluídas.

### Ordem 3 — fechamento dos lotes restantes (25/10/2026)

Implementação complementar em `0218_order3_completion_prepare.sql` e
`0219_order3_completion_activate.sql`. Abrange aprovações, transições e histórico
contratual; assinaturas e seus links públicos; modelos e arquivos privados;
serviços e cobrança; espaços, pastas, listas, campos e status; tarefas e seus
filhos; marcos e membros; horas, cronômetro e aprovação; tarifas, medições,
rentabilidade e exportação; configuração, importação, conciliação e delegações
de workflows e entrega de negócios. Os mapas de telas, ações e RPCs estão em
`docs/security/order3-*-map.json`.

A matriz efetiva, membership ativo, workspace de origem/selecionado, deny e
escopos reais governam as portas de usuário. Nomeação como gestor/aprovador não
substitui a permissão. As exceções operacionais são referências mínimas de
lista/tarefa/horas e padrões aplicados à criação; pausar ou descartar o próprio
cronômetro não cria horas. Configuração de importadores e conciliação conserva a
exigência adicional de administrador ativo. Links públicos de assinatura validam
o destinatário, prazo, sequência, selo e estado; não expõem os outros e-mails,
tokens nem assinaturas. Ofertas ATS mantêm sua porta específica.

Preço de venda do contrato/serviço e valor comercial de um marco continuam
parte do registro autorizado. Custo planejado e tarifas de membros exigem a
permissão de rentabilidade/tarifas; alterar esses campos exige gestão de custo ou
tarifas, além da edição do registro. Exportar rentabilidade exige ação própria
revalidada no servidor. O catálogo recebe chaves, sem concedê-las a cargos.

Validação da versão: 1.729 testes de código, verificação de tipos e lint;
122 cenários GoTrue/JWT/PostgREST; 13 cenários Chrome; ensaio integral das duas
migrações com rollback; regressão de configuração → medição → aprovação por
outro usuário → Financeiro, sem cobrança duplicada; regressões financeiras e de
contexto de API. Com 10 mil apontamentos, dashboard e RLS retornam os mesmos IDs
e 3 milhões de segundos. Nenhum envio externo foi realizado.

A liberação segue preparação aditiva → publicação da fonte validada → ativação
restritiva → aceite de produção. O fechamento operacional é comprovado pelo
relatório e pelas evidências em `outputs/permission-order3-completion-2026-10-25`
no workspace desta tarefa; sucesso local não substitui essa comprovação.

Complemento de aceite: as migrações 0220 e 0221 resolvem o contexto de leitura
uma vez por consulta, em initplans. A porta administrativa restritiva de 0219
continua exigindo administrador ativo e visualização da conciliação, com deny
prevalecendo. Ter acesso às horas não libera as tabelas de configuração e de
ocorrências. O dashboard continua SECURITY INVOKER e sob RLS; não há cache de
credenciais em GUC. A reprodução local agora inclui essa política restritiva,
que estava ausente de duas tabelas no baseline isolado. Os sete testes JWT
adicionais verificam também essa diferença e o isolamento por workspace.
Com 10 mil tarefas, apontamentos e ocorrências, o resumo levou 3,05 s; em
produção, 2,46 s, com 172 projetos e 162 apontamentos / 2.183.591 segundos.
Nenhum dado real foi inserido ou removido nesses testes de produção.


## Fechamento da Ordem 4 — TechSales e integrações (25/10/2026)

Ordem 4 concluída: 116 tabelas no catálogo e 528 operações inventariadas, com
controle por ação, registro, responsável atual, workspace e membership ativo.
Foram alinhados CRM/documentos, canais e campanhas, Lia/SDR, workflows e
aprovações, importação/sincronização, marketplace, exportações, pontuação, SLA,
histórico e notificações. A cobertura executável é por famílias de controle;
o inventário não representa 528 testes individuais de ponta a ponta.

Migrações aplicadas: 0222 (id354), 0223 (id355), 0224 (id388) 0225 (id389) e 0226 (id390).
A 0224 atribui somente as quatro assinaturas legadas WK a Guilherme Kologeski,
por decisão do usuário, sem conceder direitos ou reescrever a autoria histórica.
A 0225 corrige a descrição das três tabelas de vínculo com chave composta;
a operação dos vínculos continua autorizada pelos registros pais.

Validação: 1.761 testes de código, 282 cenários reais isolados, 116 consultas
HTTP anônimas de produção sem acesso a dados, ensaio SQL com privilégios
hospedados e rollback, TypeScript/lint/build/perf aprovados no mesmo hash.
As contagens das 120 tabelas acompanhadas e os hashes de defaults, overrides,
cargos e memberships permaneceram iguais após o rollout. Testes não dispararam
comunicações, convites ou operações financeiras reais.

Aceite de produção e detalhes em docs/security/order4-implementation-status.md;
relatório e screenshots na pasta local da tarefa permission-order4-2026-10-25.

Complemento de performance da Ordem 4: a 0226 mantém as decisões de permissão,
mas reduz o contexto processado por linha. Contagem autenticada de 20 mil
contatos: de timeout acima de 8 s para 564 ms no ensaio isolado; em produção,
51.150 contatos permitidos contados em 2,506 s. Não há bypass por cargo nem
cache de permissões controlável pelo chamador. Matriz e escopos foram
revalidados nas sete suítes reais, incluindo a entrega realtime autorizada e
bloqueio após revogação.

## Ordem 5 — revisão transversal e aceite final (25/10/2026)

A implementação cobre Arquivos/compartilhamento, mensageiro interno, objetos e
propriedades personalizados, branding, mídia, IA, configurações, módulos,
pesquisa/pins e proteção de campos estruturados. Workspace selecionado,
membership ativa, ação efetiva, deny e vínculo real são obrigatórios.
A matriz permite gerenciar regras de campo e sinaliza regras históricas para
campos inexistentes, preservando os registros globais e as concessões atuais.

Banco aplicado: 0227/id391 (preparação compartilhada), 0228/id392 (campos),
0229/id393 (ativação compartilhada), 0230/id394 (ACLs e portas de campos),
0231/id395 (indicador de documentos), 0232/id396 (Storage) e 0233/id397
(referências de mídia). As quatro políticas adicionais de Storage são
RESTRITIVAS, preservam as existentes e foram aplicadas pelo executor SQL oficial.
Nenhum proprietário foi trocado nem storage_admin concedido. A checagem inicial
de propriedade não comprovava incapacidade do executor oficial; a aplicação
real confirmou sua capacidade. O chat do Lovable continuou com server_error.

A fonte inicial foi publicada e ativada no hash
9355db23baf4bc4efc49722bb51d790a7140b6d7578a90a2301e0d2dd26c2efb.
O aceite encontrou timeout no indicador de documentos: 9.713ms pela consulta
canônica versus 37ms pelo agregado equivalente, no diagnóstico SQL em produção.
O agregado é finito e exige as permissões atuais da pessoa e do documento;
próprio/equipe/escopos mistos mantêm o predicado canônico. A leitura das tabelas
continua sob as políticas anteriores. Os indicadores são filtrados também pelo
workspace selecionado. CSV/PDF exigem a permissão própria de exportação no
servidor e revalidam os dados; modo usuário no Ver como respeita readOnly=false.

Mídias de WhatsApp são associadas pelo caminho literal extraído da URL assinada,
nunca por wildcard. Transferência da conversa/revogação remove a autorização
mesmo para o autor histórico do upload. Uploads ainda não enviados exigem dono,
permissão atual e prazo de uma hora. URLs de capacidade já emitidas duram até
expirar; branding/material publicado mantém sua política de duração longa.
Essas capacidades não prometem revogação instantânea de links já distribuídos.

Validação final da fonte: 1.767 testes de código, 127 cenários reais isolados
(67 compartilhados, 31 campos, 17 Home/exportação, 12 WhatsApp/Storage), tipos,
lint sem erros, build e ensaio SQL sem superusuário com rollback. Fonte validada:
adb056872a9acc01ab0b4cdbc496dceba2504cd3153152f4654e24b29192e84e.
Os cenários de aceite usam JWT real; o diagnóstico SQL de performance não é
contado como aceite de autenticação. Nenhum envio externo ocorreu nos testes.
Os registros sintéticos de negócio foram removidos e overrides restaurados.

A publicação desta última fonte e o aceite final autenticado ainda estão em
andamento. Não declarar conclusão até comprovar o hash nos dois domínios,
verificar a interface e repetir os hashes de defaults/overrides/cargos/memberships
/regras. A autorização explícita de publicação do código no repositório público
foi dada pelo usuário; a sincronização usa sua autenticação SSH já existente.
Estimativa inicial 4–7h, recalibrada para 8–12h totais; fechamento após autorização
estimado em 1–2h, com 30–45min previstos para a correção encontrada no aceite.
