# Contratação integrada — etapa 4

## Entrega

Admissão por candidatura governada, reaproveitamento explícito da pessoa, entidade WK e vigências; cargo aprovado → modelo versionado → convite específico; alocação e revogação por origem. Reutiliza People, contratos, alocações, pacotes de permissão, assinatura comercial e gates das etapas 2/3. Não gera cobrança nem assina documentos.

## Uso

1. Em TechHire → vaga → Demanda e aprovações, escolher o **cargo para modelo de acesso**. A alteração participa da revisão e exige nova aprovação do gestor/CEO.
2. Em Configurações → Permissões → Modelos de acesso por cargo, administrador com gestão de cargos revisa as chaves, escolhe o cargo e ativa o modelo para novas admissões. Os modelos sugeridos começam em rascunho; nenhuma concessão nasce dessa configuração sozinha.
3. Depois do desfecho Contratado e das autorizações da demanda/contrato, no diálogo Contratar candidato registrar a admissão integrada: candidatura, pessoa nova ou existente, modelo do cargo aprovado, entidade WK, data efetiva de admissão e vigência do vínculo. Hunting não cria vínculo interno.
4. Em Pessoa → Alocações → Contratação integrada e acessos, reutilizar contrato de compra coerente ou criar rascunho, revisar pelo fluxo normal do TechContracts e então alocar no projeto existente. O papel de compra é `client`; prestação ao cliente é `provider`.
5. Administrador prepara convite do vínculo; não há envio automático. Conta existente entra com sua autenticação; conta nova se registra pelo token e depois autentica. Aceite exige o e-mail do destinatário e capacidade válida, sem acrescentar o cargo Vendedor.
6. Revisar modelo no vínculo cria concessão nova rastreada e revoga apenas o pacote anterior da mesma origem. Encerrar alocação não revoga outras; encerrar vínculo encerra apenas suas alocações/concessões, sem desligar pessoa/membership ou cancelar contratos/pagamentos.

## Regras de segurança e dados

- Nova admissão exige candidatura Contratado, demanda governada com aprovação vigente, cargo explícito e modelo ativo do mesmo cargo. Cliente exige origem comercial assinada; interno/gestão compartilhada não exige negócio fictício.
- Regime vem da demanda aprovada. Pessoa existente mantém seus dados e regime; divergência de empregador/contratante ou regime exige revisão, não conversão automática. Não há merge por nome/e-mail. Duplicidade de vínculos exatos do candidato exige seleção explícita.
- Entidade WK é FK da pessoa/vínculo e do contrato de compra, herdada do contrato comercial para cliente. CNPJs próprios de cliente/prestador não são substituídos pelo CNPJ WK. Projeto de outra entidade não é aceito silenciosamente, inclusive em gestão compartilhada.
- Data real de admissão não é copiada da vigência comercial. Alocação não começa antes da admissão e precisa caber no vínculo e contratos. Período reduzido exige justificativa; ampliação fora do contrato exige revisão contratual e aprovação. Alterações são auditadas.
- A criação do contrato produz rascunho com origem estável. Workflows preservam título/modelo renderizado/valor configurado quando autorizados, mas não o ativam. Valores continuam sujeitos às políticas de campo existentes. Repetir/concorrer não duplica pessoa, vínculo, contrato ou alocação.
- Modelo é snapshot explícito de chaves; o cargo identifica o modelo, sem herdar seus presets comerciais implicitamente. As concessões usam pacotes privados por vínculo, imutáveis; mudanças geram versão e trilha. Pacotes manuais e outros vínculos não são apagados.
- Membership ativo e deny continuam no resolvedor canônico. O cargo referenciado pelo modelo contribui com denies e restrições de campos atuais, sem acrescentar seus presets/grants; essas restrições permanecem enquanto a origem estiver ativa, até encerramento ou revisão explícita. Pacotes de contratação expirados, revogados, de pessoa inativa/arquivada ou incompatíveis com o cargo aprovado não são efetivos. Remover uma atribuição manualmente registra sua revogação.
- Modelo por alocação aceita apenas leitura de projetos/tarefas alocados, horas próprias e dados próprios. Políticas restritivas de projeto/tarefa/apontamento e verificação de data no apontamento impedem usar a chave de leitura workspace fora das alocações. O conjunto dos workspaces gerenciados é calculado como subconsulta, preservando o caminho das RLS originais para usuários não gerenciados.
- Convite exige administrador ativo e gestão IAM; aceite revalida sua autoridade, destinatário, vigência, pessoa e demanda. Não muda senha nem desbloqueia conta existente. Membership inativo exige reativação explícita. A nova conta não recebe acesso durante o mero registro.
- Permissões novas: `techpeople.employment.view/manage.workspace` e `system.hiring_access.view/manage.workspace`. Operações acumulam escopo HR, ATS, contrato e projeto aplicáveis. Leitura da seleção de cargo exige permissões da demanda. Os convites públicos usam token opaco e expiração; sua conclusão exige sessão autenticada do destinatário.

## Compatibilidade e rollout

Migrações 0311–0315 aditivas. A 0315 inclui denies e restrições de campos do cargo do modelo, sem herdar seus grants implícitos. A 0314 preserva nomes únicos e histórico na reemissão de convite após revogação. A 0313 alinha a autoria do contrato à FK real de auth.users, sem mudar a convenção dos catálogos IAM. Vagas, pessoas, alocações, contratos importados e concessões manuais não são convertidos em massa. A nova FK de origem profissional é excluída do fingerprint jurídico, preservando hashes comerciais anteriores. A regra de admissão é opt-in por workspace; ativar somente WK após publicar e verificar a mesma versão. Desligar a flag não apaga histórico ou concessões já emitidas; revogar vínculo/atribuição é operação própria.

Convites comerciais genéricos preservam seu fluxo. O arquivo compartilhado passou a exigir membership ativo e IAM nos comandos administrativos; a seleção de responsáveis continua disponível aos membros ativos, com nomes e sem e-mail/telefone/convites pendentes sem IAM view.

Revisão de preços, assinatura real, escolha dos cargos/modelos e admissões reais são atos de negócio do usuário, não testes automáticos. Dois modelos iniciais — Desenvolvedor de Outsourcing e Assistente Financeiro — permanecem em rascunho até revisão/ativação. As etapas 5–7 continuam responsáveis por provisão/faturamento, ciclo de vida/conciliação e aceite integral.

## Validação

PostgreSQL descartável executa migrations e funções de produção com scaffold de identidade/RLS: cinco cenários de permissão, concorrência entre conexões, reutilização, CNPJ/regime/datas, Hunting/interno, snapshots, expiração/deny, convite/autoridade, revogação isolada, histórico e hash antes/depois da migração. Isso não equivale a login GoTrue. Testes do handler público verificam que registro de conta não altera senha existente nem concede cargo/acesso antes da autenticação; testes do worker barram efeitos legados quando a porta integrada nega.

Gate final: permissões → tipos → lint → suíte completa → build → performance → CI → hash realmente servido nos dois domínios, seguido de leitura autenticada. Não realizar contratação ou assinatura real em produção para testar. Evidências e limitações ficam no relatório privado da execução.
