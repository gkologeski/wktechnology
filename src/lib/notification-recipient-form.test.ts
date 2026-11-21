// @vitest-environment jsdom
import { act, createElement, Fragment, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const state = vi.hoisted(() => ({
  members: [{ user_id: "11111111-1111-4111-8111-111111111111", full_name: "Membro de teste" }],
  loading: false,
  error: false,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "aaaaaaaa-1111-4111-8111-111111111111",
    isLoading: false,
    isError: false,
    canAny: () => true,
  }),
}));
vi.mock("@/hooks/use-workspace-members", () => ({
  useWorkspaceMembers: () => ({
    data: state.members,
    isLoading: state.loading,
    isError: state.error,
  }),
}));
// Exercise form targeting and edits without portal positioning, token search or network.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) =>
    createElement(
      "select",
      {
        value,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange(event.target.value),
      },
      children,
    ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
  SelectItem: ({
    value,
    disabled,
    children,
  }: {
    value: string;
    disabled?: boolean;
    children: ReactNode;
  }) => createElement("option", { value, disabled }, children),
}));
vi.mock("@/components/workflows/token-input", () => ({
  TokenInput: ({
    value,
    onValueChange,
    ...props
  }: {
    value: string;
    onValueChange: (value: string) => void;
  }) =>
    createElement("input", {
      ...props,
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value),
    }),
  TokenTextarea: ({
    value,
    onValueChange,
    ...props
  }: {
    value: string;
    onValueChange: (value: string) => void;
  }) =>
    createElement("textarea", {
      ...props,
      value,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
        onValueChange(event.target.value),
    }),
}));
vi.mock("@/components/workflows/builder/step-forms/pickers", () => ({
  UserPicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    state.members.length
      ? createElement(
          "select",
          {
            "aria-label": "Membro do workspace",
            value,
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
          },
          createElement("option", { value: "" }, "Escolha um membro"),
          ...state.members.map((m) =>
            createElement("option", { key: m.user_id, value: m.user_id }, m.full_name),
          ),
        )
      : createElement("input", {
          placeholder: "UUID do usuário",
          value,
          onChange: () => undefined,
        }),
}));

import { NotificationForm } from "@/components/workflows/builder/step-forms/notification-form";
import type { WorkflowAction, WorkflowEntity } from "./workflows/types";

type Action = Extract<WorkflowAction, { type: "send_notification" }>;
let host: HTMLDivElement;
let root: Root;
const change = vi.fn();
let current: Action;

function Harness({ initial, entity }: { initial: Action; entity: WorkflowEntity }) {
  const [action, setAction] = useState(initial);
  current = action;
  return createElement(NotificationForm, {
    action,
    entity,
    onChange: (next) => {
      if (next.type !== "send_notification") throw new Error("Unexpected action");
      change(next);
      setAction(next);
    },
  });
}
async function render(
  initial: Action = { type: "send_notification", title: "Aviso" },
  entity: WorkflowEntity = "deals",
) {
  await act(async () => root.render(createElement(Harness, { initial, entity })));
}
async function click(text: string) {
  const button = Array.from(host.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === text,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
async function choose(value: string, select = host.querySelector("select")) {
  expect(select).not.toBeNull();
  await act(async () => {
    select!.value = value;
    select!.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function title(value: string) {
  const input = host.querySelector<HTMLInputElement>("#notification-title")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.members = [{ user_id: USER, full_name: "Membro de teste" }];
  state.loading = state.error = false;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("destinatários de notificações no construtor", () => {
  it("limits professional preparation to the current named approver without rewriting the action on open", async () => {
    await render(
      { type: "send_notification", title: "Aviso", recipients: [{ kind: "pending_approvers" }] },
      "hiring_preparation_requests",
    );
    expect([...host.querySelector("select")!.options].map((option) => option.value)).toEqual([
      "pending_approvers",
    ]);
    expect(
      [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
        button.textContent?.includes("Adicionar destinatário"),
      )!.disabled,
    ).toBe(true);
    expect(host.querySelector('[aria-label="Membro do workspace"]')).toBeNull();
    expect(host.textContent).toContain("independentemente desta regra");
    expect(host.textContent).toContain("não remove esse aviso de processo");
    expect(change).not.toHaveBeenCalled();
  });
  it("preserves an incompatible legacy recipient until an explicit correction removes its user override", async () => {
    await render(
      { type: "send_notification", title: "Aviso", user_id: USER },
      "hiring_preparation_requests",
    );
    expect(change).not.toHaveBeenCalled();
    expect(current.user_id).toBe(USER);
    expect(host.querySelector('[aria-label="Membro do workspace"]')).toBeNull();
    await choose("pending_approvers");
    expect(current.recipients).toEqual([{ kind: "pending_approvers" }]);
    expect(current).not.toHaveProperty("user_id");
  });
  it("mostra o executor como padrão legado sem regravar a ação ao abrir", async () => {
    await render();
    expect(host.querySelector("select")?.value).toBe("workflow_owner");
    expect(change).not.toHaveBeenCalled();
    expect(current).not.toHaveProperty("recipients");
    expect(host.textContent).toContain("Somente membros ativos do mesmo workspace");
    expect(host.textContent).toContain("não aprova nem conclui");
    expect(host.textContent).toContain("aviso neutro");
  });

  it("preserva o usuário legado e usa as regras explícitas após uma escolha do usuário", async () => {
    await render({ type: "send_notification", title: "Aviso", user_id: USER });
    expect(host.querySelector("select")?.value).toBe("user");
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Membro do workspace"]')?.value).toBe(
      USER,
    );
    expect(change).not.toHaveBeenCalled();
    await choose("source_creator");
    expect(current).toEqual({
      type: "send_notification",
      title: "Aviso",
      user_id: USER,
      recipients: [{ kind: "source_creator" }],
    });
  });

  it.each([
    ["people", "area_manager"],
    ["deals", "area_manager"],
    ["ats_jobs", "area_manager"],
    ["contracts", "pending_approvers"],
    ["projects", "project_members"],
    ["project_tasks", "project_members"],
    ["project_milestones", "project_members"],
  ] as const)("oferece %s com o destino contextual %s", async (entity, kind) => {
    await render(undefined, entity);
    expect(
      Array.from(host.querySelectorAll("option")).some((option) => option.value === kind),
    ).toBe(true);
    await choose(kind);
    expect(current.recipients).toEqual([{ kind }]);
  });

  it("não oferece destino sem fonte contextual nem novos seletores de equipe, cargo ou seguidores", async () => {
    await render(undefined, "financial_entries");
    const offered = Array.from(host.querySelectorAll("option")).map((item) => item.value);
    expect(offered).toEqual(["workflow_owner", "user", "source_responsible", "source_creator"]);
  });

  it("preserva destinos avançados salvos sem pedir UUID ou apagá-los ao editar o título", async () => {
    const recipients: NonNullable<Action["recipients"]> = [
      { kind: "team", id: USER },
      { kind: "job_role", id: OTHER },
      { kind: "followers" },
      { kind: "area_manager" },
    ];
    await render({ type: "send_notification", title: "Antes", recipients }, "financial_entries");
    expect(change).not.toHaveBeenCalled();
    expect(host.querySelectorAll("option[disabled]")).toHaveLength(4);
    expect(host.textContent).toContain("Destino salvo preservado");
    expect(host.textContent).not.toContain(USER);
    expect(host.querySelector('[placeholder="UUID do usuário"]')).toBeNull();
    await title("Depois");
    expect(current.title).toBe("Depois");
    expect(current.recipients).toEqual(recipients);
  });

  it("limita a lista a dez regras e mantém pelo menos uma", async () => {
    await render();
    const removeFirst = host.querySelector<HTMLButtonElement>(
      '[aria-label="Remover destinatário 1"]',
    );
    expect(removeFirst?.disabled).toBe(true);
    for (let i = 0; i < 9; i++) await click("Adicionar destinatário");
    const add = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Adicionar destinatário",
    )!;
    expect(add.disabled).toBe(true);
    expect(current.recipients).toHaveLength(10);
    await act(async () => add.click());
    expect(current.recipients).toHaveLength(10);
    await act(async () =>
      host.querySelector<HTMLButtonElement>('[aria-label="Remover destinatário 2"]')!.click(),
    );
    expect(current.recipients).toHaveLength(9);
    expect(
      Array.from(host.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Adicionar destinatário",
      )?.disabled,
    ).toBe(false);
  });

  it.each(["empty", "loading", "error"])(
    "não cai no campo UUID quando a lista de membros está %s",
    async (status) => {
      state.members = [];
      state.loading = status === "loading";
      state.error = status === "error";
      await render({
        type: "send_notification",
        title: "Aviso",
        recipients: [{ kind: "user", id: USER }],
      });
      expect(host.querySelector('[placeholder="UUID do usuário"]')).toBeNull();
      expect(change).not.toHaveBeenCalled();
      expect(current.recipients).toEqual([{ kind: "user", id: USER }]);
      expect(host.querySelectorAll('[role="status"]').length).toBeGreaterThan(0);
    },
  );

  it("permite escolher um membro por nome sem aceitar UUID manual", async () => {
    await render();
    await choose("user");
    expect(current.recipients).toEqual([{ kind: "user", id: "" }]);
    expect(host.textContent).toContain("Selecione um membro antes de salvar");
    await choose(USER, host.querySelector<HTMLSelectElement>('[aria-label="Membro do workspace"]'));
    expect(current.recipients).toEqual([{ kind: "user", id: USER }]);
  });
});

it("explains exact canonical fiscal responsibility without treating the uploader as an approver", async () => {
  await render(
    { type: "send_notification", title: "Aviso", recipients: [{ kind: "workflow_owner" }] },
    "hiring_fiscal_documents",
  );
  const options = [...host.querySelector<HTMLSelectElement>("select")!.options].map(
    (option) => option.textContent,
  );
  expect(options).toContain("Responsável Financeiro da formalização");
  expect(options).toContain("Quem enviou a nota (escolha explícita)");
  expect(host.textContent).toContain("sem CEO ou substituto presumido");
  expect(host.textContent).toContain("envio não o torna aprovador");
  expect(current.recipients).toEqual([{ kind: "workflow_owner" }]);
  expect(change).not.toHaveBeenCalled();
});
