# Plano: ICP 012 + distribuição nos formulários

Estimativa total: 1h45–2h15 (porte M). Parte 1 é P (10–15 min); parte 2 é M (1h30–2h).

## Parte 1 — Devolver para a fila os contatos da ICP 012 barrados pela Meta
A "ICP 012" está pausada: 399 enviados, 324 pendentes, 5 pulados. Entre os "enviados", a Meta recusou:
- **35 com erro 131031 "Business Account locked"** (restrição da conta, 22:25–22:35 UTC). **Esses voltam para "pendente".**
- 26 com 131026 (sem WhatsApp), 26 com 131049 (limite de engajamento) e 3 com 130472 (experimento). **Ficam como estão**: já estão bloqueados por 90/7 dias e seriam recusados de novo.
- Nenhum 131048 ("Spam Rate limit") apareceu nesta campanha.

Passos: voltar os 35 para pendente limpando mensagem, data e erro (a mensagem recusada fica no histórico); conferir 359 pendentes / 364 enviados; campanha continua pausada. Antes de retomar, confira na Meta Business Suite se a conta foi desbloqueada.

## Parte 2 — Distribuição das inscrições de formulário igual às campanhas de WhatsApp
Hoje toda inscrição fica com o dono do formulário. O cadastro do formulário já tem espaço guardado para a regra, mas nada usa.

Nova seção "Distribuição" no editor do formulário, com as mesmas 4 opções das campanhas:
- Central de Distribuição (padrão)
- Membro específico
- Dividir entre membros da equipe (rodízio)
- Desatribuídas

Na inscrição:
- Lead/Contato **novo** recebe o responsável pela regra; a nota na timeline e o aviso vão para esse responsável.
- Lead/Contato **já existente** mantém o responsável atual (não sobrescreve).
- Membros inativos são pulados no rodízio; se ninguém estiver disponível, cai na Central de Distribuição.

Permissão: alterar a regra exige a mesma permissão de editar formulários; o servidor confere membership ativo e workspace.

## Detalhes técnicos
- Reusar `campaign-assignment.ts` (`AssignmentInput`, `normalizeAssignment`) e a lógica de `campaign-assignment.server.ts`, extraindo um resolvedor genérico se necessário; reusar `campaign-assignment-section.tsx` na tela do formulário.
- Colunas `forms.assignment_mode/assignment_member_ids/assignment_cursor` já existem; avanço do cursor de forma atômica (função no banco, como nas campanhas) — migration só se a função atual não aceitar formulários.
- `forms.functions.ts`: salvar e validar a regra; `api/public/forms/$slug.submit.ts`: resolver o responsável antes de criar Lead/Contato e usar em `assigned_to` da atividade e da notificação.
- Testes: rodízio, membro único, inativo, existente sem sobrescrita; permissões (permitido, sem chave, deny, outro workspace, inativo) e contrato em `permission-contracts.json`.
- Valida no preview; produção depende de publicar.
