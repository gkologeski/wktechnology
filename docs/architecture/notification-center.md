# NOTIFICA-CENTRAL — pacote 3: central e preferências

## Escopo

Base local: `0f7fc770b` (catálogo e destinatários). Entrega local na branch
`codex/notifica-central-center`, sem push, merge, aplicação em produção ou publicação.
A migração 0392 deve ser aplicada antes de publicar o código dependente dela numa
implantação posteriormente autorizada. As migrações anteriores permanecem imutáveis.

O pacote entrega `/notifications` como área pessoal no shell ERP e integra o sino
à mesma fronteira. A identidade visual vem dos componentes e tokens do White Label;
não há cores, fontes ou logotipos de um workspace fixados no código. A configuração
global anterior em `/settings/notifications` permanece como base de compatibilidade.

Não cria outro motor de eventos ou scheduler. Regras, modelos, ledger multicanal,
envio de resumo externo, opt-in WhatsApp e piloto pertencem às próximas entregas.

## Recurso × ação × escopo

| Superfície | Ação | Controle |
|---|---|---|
| Central, contador e detalhe | Ler | Sessão, workspace selecionado, membership ativo, próprio destinatário e RLS atual da origem |
| Histórico sem contexto | Ler | Mesma identidade/membership; somente metadados pessoais e conteúdo neutro, sem destino presumido |
| Leitura / não lida | Atualizar | Mesmos controles; lote limitado a IDs explícitos e cutoff da consulta; sessão somente leitura negada |
| Adiar / cancelar | Atualizar estado pessoal | Mesmos controles; somente 0, 60 ou 1440 minutos; nenhuma alteração da obrigação |
| Preferências no workspace | Ler / atualizar próprias | Ator derivado da sessão, workspace ativo e membership; CAS e bloqueio de escrita somente leitura |
| Proveniência | Criar internamente | Trigger privado para novos avisos, tabela de origem literal e workspace real |
| Despacho do Workflow | Criar | Fronteira de serviço do pacote 2, agora consultando o overlay do workspace/evento |

São operações pessoais: não exigem uma nova chave de negócio para abrir a própria
central. Isso não remove as permissões de origem nem autoriza ler caixas de terceiros.
Não são concedidas permissões a cargos ou workspaces. A negação de uma permissão de
origem continua sendo comprovada por testes reais; não se usa um teste de sessão vazia
como evidência de membro inativo.

## Contexto, histórico e acesso direto

`notification_workspace_context` registra uma prova somente para novos INSERTs,
quando a entidade é reconhecida e pertence ao workspace declarado. Não há backfill,
nem dedução por título, link, dono ou default antigo de workspace. A prova registra
origem; não concede acesso. Listagem e leitura direta revalidam o acesso atual sob RLS.

Avisos sem prova permanecem preservados, separados no histórico pessoal e com texto
neutro. O payload antigo não é retornado nem usado para busca nessa visão; procurar
por texto não pode revelar conteúdo mascarado pela existência de um resultado.

A política restritiva na tabela fecha a leitura direta e o realtime para contexto
não confirmado, workspace não selecionado e origem sem acesso. Mutações diretas da
tabela são revogadas para o cliente autenticado; leitura e adiamento passam por RPCs.
As tabelas novas são privadas. As consultas da central usam um helper privado de leitura do ator atual, com papel
sem BYPASSRLS e sem gravar sessões ou alterar claims, compatível com GET readonly
do PostgREST. O dispatcher de terceiros mantém os bridges do pacote 2, que restauram
claims e recusam contexto aninhado.

## Paginação, leitura e adiamento

Lista por `(created_at, id)`, 30 itens por página e cutoff retornado pelo servidor.
O cursor da API nova exige o mesmo cutoff. No endpoint legado, um cliente antigo
que envia somente cursor usa sua data como corte conservador e continua consultando
apenas itens mais antigos. Filtros são limitados e validados nas bordas e no SQL.
O contador usa a mesma identidade, scope, categoria e busca, ignora cursor/estado
de leitura e é limitado a 100 elegíveis; a UI apresenta `99+` sem afirmar total exato.

“Marcar visíveis” envia no máximo 100 IDs carregados e o cutoff da página. Não há
UPDATE irrestrito de toda a caixa. O SQL valida o lote inteiro antes de atualizar;
falha não vira sucesso visual. Marcar novamente como lida preserva o instante original.
Ler ou adiar não aprova, não conclui tarefa e não prorroga prazo. Adiamentos vencidos
voltam à lista pelo predicado de tempo, sem produzir outra ocorrência ou scheduler.

Os endpoints legados de listagem e leitura individual passam pela fronteira nova.
O endpoint antigo de marcação em massa exige IDs/cutoff explícitos; clientes antigos
sem esse contexto recebem orientação de usar a central, em vez de marcar itens não
vistos. As funções globais de preferências preservam seu contrato de patch/CAS.

## Preferências e rotina

`notification_user_preferences` guarda overlay por `(workspace_id, user_id)`, revisão
e atualização. A ordem é padrão → perfil global legado → grupo do workspace → evento
legado exato. `false` explícito é preservado. Patches não materializam os defaults;
`null` remove um override de grupo/canal e restaura a herança. Campos futuros já
armazenados são preservados, mas campos desconhecidos recebidos são rejeitados.
Eventos `planned` do catálogo não são produtores ou destinos ativos de preferência.

O gateway do passo `Enviar notificação` aplica `inapp` efetivo de `legacy.workflow`
antes de gravar. Os demais produtores legados continuam com suas regras próprias;
o sino consulta as preferências efetivas antes de interromper. Não se promete que um
controle pessoal apague ou interrompa todas as gravações de produtores existentes.

Silêncio suprime pop-up, som e animação do sino, mantendo a central e seus prazos.
Usa fuso IANA e minutos locais: início inclusivo, fim exclusivo; admite cruzar a
meia-noite e não usa offset fixo. Início e fim iguais são inválidos quando habilitado.
O resumo diário/semanal organiza os itens carregados na central, sem envio externo.

## Navegação, cache e falhas

Cache e referências de realtime incluem usuário e workspace. Trocar contexto
remonta a área e descarta seleção, cursores e rascunhos anteriores. Um request traz
o workspace esperado e o servidor o compara ao contexto autenticado. O payload do
realtime não é usado diretamente para mostrar texto: a UI reconsulta o gateway.
Sem preferências carregadas ou em falha de autorização, o sino permanece silencioso.

Destinos passam pelo helper compartilhado com rotas internas comprovadas. Protocolos
externos, caminhos desconhecidos, travessia, barras invertidas e parâmetros de
redirecionamento são recusados. A rota de destino mantém suas permissões próprias.
Sem dados de prazo, prioridade, canal ou motivo, o detalhe não inventa essas informações.

## Validação e limites do aceite

Validar componentes, isolamento de contexto, conflitos CAS, silêncio/DST, herança,
filtros, links e ações com falhas. PostgreSQL e HTTP/JWT locais devem executar as
funções reais, políticas representativas, cinco cenários de origem e bloqueios de
acesso direto, além de paginação, cutoff, estado, histórico e deduplicação do pacote 2.

O navegador local com fixtures pode comprovar interação, layout e White Label dos
componentes reais. Ele não representa login GoTrue, dados de produção ou aceite após
implantação. O relatório final separa esses alcances. Ajuda atualizada nas fontes e
catálogo; aplicação editorial autenticada permanece para a entrega autorizada.

## Compatibilidade de produtores

Menções, atribuições, comentários e lembretes de atividade passam a gravar o workspace
explícito e a atividade como origem, mesmo quando ela está associada a um negócio.
Os avisos no app não copiam assunto/comentário privados; a leitura da atividade é
revalidada após a entrega. E-mails legados preservam seu caminho anterior. Aprovações
genéricas de Workflow preservam o título/nota no registro de decisão e enviam somente
aviso neutro, ligado à origem real; abrir a origem não decide nem substitui a etapa.

Aliases canônicos de vaga, minutas e revisão SDR usam suas políticas atuais, incluindo
permissões e nomeações próprias, sem presumir acesso ao contrato pai ou à configuração
do Workflow. Avisos de plataforma sem origem comprovada permanecem no histórico neutro.
