---
module_key: crm
slug: criar-gerenciar-paginas-agendamento
title: Criar e gerenciar páginas de agendamento
summary: Definir horários, vincular o calendário e compartilhar um link público de reservas.
article_type: howto
route_pattern: /settings/booking
min_permission: system.booking.view.workspace
audience: internal
sort_order: 314
version: 1
is_published: true
---
# Criar e gerenciar páginas de agendamento
**Para que serve:** Criar links para clientes reservarem horários.
**Quem pode fazer:** Gestor+ ou `system.booking.view.workspace`/`.manage.workspace`; criar, alterar, excluir e cancelar seguem `system.booking`.
**Onde fica:** Menu > TechSales > Relacionar > Reuniões > Agendamentos (`/settings/booking`).
**Antes de começar:** Defina duração e disponibilidade. Conecte um calendário para gerar evento e Meet.

## Passo a passo
1. Clique em "Nova página".
2. Preencha "Título *" e "Slug *".
3. Informe "Descrição" e "Duração (min)".
4. Defina "Buffer antes", "Buffer depois", "Antecedência mínima (h)" e "Antecedência máxima (dias)".
5. Confira "Fuso horário".
6. Escolha "Conta de calendário (Google Agenda + Meet)".
7. Em "Criar como", escolha "Lead" ou "Contato".
8. Preencha "Cor", "Local / link" e "Disponibilidade semanal".
9. Clique em "Salvar".
10. Copie o link ou abra a página pública pelos ícones.
11. Use o olho para ver "Reservas".
12. Edite pelo lápis; exclua pela lixeira ("Excluir página?").
<!-- screenshot: formulário de página de agendamento -->

## Resultado esperado
"Página salva". Endereço público: `/book/<slug>`.

## Regras e limites
- Título 1–160; slug 2–80 (letras, números, hífen).
- Duração 5–480 min; buffers 0–240 min.
- Antecedência mínima 0–720 h; máxima 1–365 dias.
- Até 8 intervalos por dia.
- Sem calendário, não gera evento nem Meet.

## Erros comuns
- "Sem calendário": vincule uma conta.
- "Nenhuma reserva ainda." / "Nenhuma página criada ainda.".

## Relacionados
- [Conectar e gerenciar calendários](/ajuda/crm/conectar-gerenciar-calendarios)
