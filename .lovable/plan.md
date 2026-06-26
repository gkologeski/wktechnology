## Escopo

Ao editar uma atividade do tipo **tarefa** na timeline (`src/components/activity-timeline.tsx`), permitir:

1. Trocar o **responsável** (usuários do workspace, já carregados em `team`).
2. Alterar a **data de vencimento** com presets rápidos.

Aplica-se somente ao modo de edição de `a.type === "task"`. Não afeta outros tipos, criação de tarefas, schema, RLS, server functions ou regras de negócio. `owner_id` e `due_date` já existem em `activities` e são gravados na criação — apenas estendemos o `saveEdit`.

## Mudanças (apenas `src/components/activity-timeline.tsx`)

### 1. Novos estados de edição
```ts
const [editingAssigneeId, setEditingAssigneeId] = useState<string | null>(null);
const [editingDueDate, setEditingDueDate] = useState<string | null>(null); // ISO
```

### 2. `startEdit(a)`
Inicializa os novos campos quando a atividade for tarefa:
```ts
setEditingAssigneeId(a.type === "task" ? (a.owner_id ?? null) : null);
setEditingDueDate(a.type === "task" ? (a.due_date ?? null) : null);
```

### 3. `saveEdit(a)`
Para tarefas, incluir os dois campos no `update`:
```ts
const patch: Record<string, unknown> = { body: editingBody || null, attachments: finalAttachments };
if (a.type === "task") {
  patch.owner_id = editingAssigneeId ?? user?.id;
  patch.due_date = editingDueDate ? new Date(editingDueDate).toISOString() : null;
}
```
Reset dos novos states após salvar/cancelar.

### 4. UI dentro do bloco de edição (`editingId === a.id` e `a.type === "task"`)
Adicionar uma linha de controles compactos acima da barra "Anexar / Salvar / Cancelar":

- **Responsável**: `Select` (shadcn) listando `team` (Você + membros do workspace), label "Responsável".
- **Data de vencimento**: dois controles lado a lado:
  - `Select` de preset com opções na ordem pedida:
    - Personalizada
    - Hoje
    - Amanhã
    - Semana que vem (próxima segunda-feira)
    - Mês que vem (mesmo dia do próximo mês)
    - Daqui 3 meses (mesmo dia +3 meses)
  - `DatePicker` (Popover + Calendar shadcn já usados no projeto), visível quando preset = "Personalizada" e também como controle auxiliar para qualquer preset (mostra a data calculada e permite ajuste fino). A hora atual (HH:mm do `due_date` original ou agora) é preservada.
- Botão "Limpar" pequeno para zerar a data (`null`).

Regras de cálculo dos presets (em local time, preserva HH:mm atual):
- Hoje: `startOfToday + horário`.
- Amanhã: `+1 dia`.
- Semana que vem: próxima segunda-feira (`day = 1`); se hoje for segunda, +7 dias.
- Mês que vem: `addMonths(base, 1)`, com clamp do dia para o último dia do mês destino.
- Daqui 3 meses: `addMonths(base, 3)` com mesmo clamp.

Selecionar um preset atualiza `editingDueDate` imediatamente; selecionar "Personalizada" apenas abre o calendário sem alterar a data.

### 5. Acessibilidade e UX
- Labels visíveis em texto pequeno (`text-xs text-muted-foreground`).
- Mantém o mesmo grid/espacamento do bloco de edição já existente.
- Funciona em light/dark mode (usa tokens semânticos).

## Verificação manual

1. Na timeline de um negócio, editar uma tarefa: trocar responsável, escolher cada preset e confirmar que a data exibida no card ("Vence …") muda após salvar.
2. Escolher "Personalizada" e selecionar uma data no calendário; salvar e validar.
3. Limpar a data e salvar; o rótulo "Vence …" deve sumir.
4. Editar uma nota/e-mail/reunião: os novos controles **não** devem aparecer.

## Fora de escopo

- Criação de tarefas (já tem assignee + data).
- Edição de outros tipos.
- Notificações/automação por mudança de responsável ou prazo.
- Schema, RLS, server functions.
