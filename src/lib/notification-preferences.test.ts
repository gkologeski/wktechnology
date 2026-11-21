import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  applyNotificationPrefsPatch,
  normalizeNotificationPrefs,
  notificationPrefsDiff,
  notificationInterruption,
  notificationPrefsPatchSchema,
  type NotificationPrefs,
} from "./notification-preferences";

const QUIET = { inapp: true, email: false, sound: false, shake: false };
const SILENT = { toast: false, sound: false, shake: false };
const LEGACY_DEFAULTS = {
  mention: { inapp: true, email: true, sound: true, shake: true },
  assignment: { inapp: true, email: true, sound: true, shake: true },
  deal_stage: QUIET,
  ticket: { inapp: true, email: true, sound: true, shake: true },
  task: { inapp: true, email: false, sound: true, shake: false },
  sla: { inapp: true, email: true, sound: true, shake: true },
  message: { inapp: true, email: false, sound: true, shake: true },
};

describe("preferências de notificação compatíveis", () => {
  it("does not add workspace-only WhatsApp choices to legacy global profile settings", () => {
    expect(notificationPrefsPatchSchema.safeParse({ task: { whatsapp: false } }).success).toBe(
      false,
    );
    expect(Object.hasOwn(normalizeNotificationPrefs(null).task, "whatsapp")).toBe(false);
  });
  it("preserva os sete padrões legados e adiciona seis grupos silenciosos", () => {
    const prefs = normalizeNotificationPrefs(null);
    expect(prefs).toEqual({
      ...LEGACY_DEFAULTS,
      workflow: QUIET,
      approval: QUIET,
      hiring: QUIET,
      form: QUIET,
      portfolio: QUIET,
      platform: QUIET,
    });
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("não muda escolhas falsas, nem preenche campos ausentes com valores de outra categoria", () => {
    const prefs = normalizeNotificationPrefs({
      mention: { inapp: false, email: false, sound: false, shake: false },
      task: { email: true, sound: false },
      workflow: { sound: true },
    });
    expect(prefs.mention).toEqual({ inapp: false, email: false, sound: false, shake: false });
    expect(prefs.task).toEqual({ inapp: true, email: true, sound: false, shake: false });
    expect(prefs.workflow).toEqual({ ...QUIET, sound: true });
    expect(prefs.assignment).toEqual(LEGACY_DEFAULTS.assignment);
  });

  it.each([undefined, null])("usa padrões para preferências ainda não configuradas %j", (raw) =>
    expect(normalizeNotificationPrefs(raw)).toEqual(DEFAULT_NOTIFICATION_PREFS),
  );

  it.each([false, true, "false", 1, [], ["mention"]])(
    "desliga canais para JSON raiz corrompido %j",
    (raw) => {
      for (const channels of Object.values(normalizeNotificationPrefs(raw))) {
        expect(channels).toEqual({ inapp: false, email: false, sound: false, shake: false });
      }
    },
  );

  it.each([null, "false", [], 0])(
    "desliga canais quando a categoria inteira está corrompida %j",
    (category) => {
      expect(normalizeNotificationPrefs({ task: category }).task).toEqual({
        inapp: false,
        email: false,
        sound: false,
        shake: false,
      });
      expect(normalizeNotificationPrefs({ workflow: category }).workflow).toEqual({
        inapp: false,
        email: false,
        sound: false,
        shake: false,
      });
    },
  );

  it.each([null, undefined, "true", "false", 0, 1, [], {}, [true]])(
    "desliga canal presente com valor inválido %j sem coerção nem fallback habilitado",
    (invalid) => {
      const raw = { inapp: invalid, email: invalid, sound: invalid, shake: invalid };
      expect(normalizeNotificationPrefs({ mention: raw }).mention).toEqual({
        inapp: false,
        email: false,
        sound: false,
        shake: false,
      });
      expect(normalizeNotificationPrefs({ workflow: raw }).workflow).toEqual({
        inapp: false,
        email: false,
        sound: false,
        shake: false,
      });
    },
  );

  it("distingue canal ausente de canal presente inválido dentro da mesma categoria", () => {
    expect(normalizeNotificationPrefs({ mention: { sound: "true" } }).mention).toEqual({
      inapp: true,
      email: true,
      sound: false,
      shake: true,
    });
  });

  it("não usa propriedades herdadas como preferências salvas", () => {
    const inherited = Object.create({ mention: { inapp: false, sound: false } });
    inherited.task = Object.create({ email: true, sound: false });
    const prefs = normalizeNotificationPrefs(inherited);
    expect(prefs.mention).toEqual(LEGACY_DEFAULTS.mention);
    expect(prefs.task).toEqual(LEGACY_DEFAULTS.task);
  });

  it("retorna cópias independentes sem permitir mutar padrões globais", () => {
    const first = normalizeNotificationPrefs(null);
    first.workflow.sound = true;
    first.mention.email = false;
    const next = normalizeNotificationPrefs(null);
    expect(next.workflow).toEqual(QUIET);
    expect(next.mention).toEqual(LEGACY_DEFAULTS.mention);
    expect(DEFAULT_NOTIFICATION_PREFS.workflow).toEqual(QUIET);
  });

  it("aplica patch parcial sem apagar categorias ou campos futuros armazenados", () => {
    const stored = Object.freeze({
      mention: Object.freeze({
        inapp: false,
        email: false,
        sound: false,
        shake: true,
        future: "keep",
      }),
      task: Object.freeze({ sound: false, future_channel: { enabled: true } }),
      future_category: { digest: "daily" },
      schema_version: 2,
    });
    expect(applyNotificationPrefsPatch(stored, { mention: { shake: false } })).toEqual({
      ...stored,
      mention: { ...stored.mention, shake: false },
    });
    expect(applyNotificationPrefsPatch(stored, {})).toEqual(stored);
    expect(stored.mention.shake).toBe(true);
  });

  it("aceita o formato completo dos clientes antigos sem zerar as novas preferências", () => {
    const stored = { workflow: { sound: true }, future_category: { inapp: false } };
    const next = applyNotificationPrefsPatch(stored, LEGACY_DEFAULTS);
    expect(next).toEqual({ ...stored, ...LEGACY_DEFAULTS });
    expect(normalizeNotificationPrefs(next).workflow.sound).toBe(true);
  });

  it("ignora valores undefined de clientes parciais sem apagar escolhas armazenadas", () => {
    const stored = {
      task: { inapp: false, email: true, sound: false, future_channel: { enabled: false } },
      mention: { shake: false },
      future_category: { digest: "daily" },
    };
    expect(
      applyNotificationPrefsPatch(stored, {
        task: { inapp: undefined, sound: undefined },
        mention: undefined,
      }),
    ).toEqual(stored);
    expect(
      applyNotificationPrefsPatch(stored, {
        task: { sound: undefined, email: false },
      }),
    ).toEqual({ ...stored, task: { ...stored.task, email: false } });
  });

  it.each([
    { future_category: { inapp: true } },
    { task: { digest: "daily" } },
    { mention: { inapp: "false" } },
    { mention: { email: 1 } },
    { workflow: { sound: null } },
    { task: [] },
    { task: "disabled" },
    null,
    [],
    "{}",
    JSON.parse('{"__proto__":{"sound":true}}'),
    JSON.parse('{"constructor":{"sound":true}}'),
    JSON.parse('{"task":{"__proto__":{"enabled":true}}}'),
  ])("rejeita campos recebidos desconhecidos ou inválidos %j", (patch) => {
    expect(notificationPrefsPatchSchema.safeParse(patch).success).toBe(false);
    expect(() => applyNotificationPrefsPatch({ task: { sound: false } }, patch)).toThrow();
  });
});

describe("diferença de preferências para salvamento parcial", () => {
  it("não envia defaults de novas categorias ao salvar preferências antigas sem mudanças", () => {
    const before = { mention: { sound: false }, task: { email: true } };
    expect(notificationPrefsDiff(before, normalizeNotificationPrefs(before))).toEqual({});
  });

  it("envia somente canais alterados, inclusive transições para false", () => {
    const before = normalizeNotificationPrefs(null);
    const after = normalizeNotificationPrefs(before);
    after.mention.sound = false;
    after.workflow.sound = true;
    expect(notificationPrefsDiff(before, after)).toEqual({
      mention: { sound: false },
      workflow: { sound: true },
    });
    expect(before.mention.sound).toBe(true);
    expect(before.workflow.sound).toBe(false);
  });

  it("preserva alterações concorrentes de outros campos na aplicação do patch da tela", () => {
    const screenSnapshot = normalizeNotificationPrefs(null);
    const editedScreen = normalizeNotificationPrefs(screenSnapshot);
    editedScreen.mention.sound = false;
    const concurrentStored = {
      mention: { ...screenSnapshot.mention, email: false },
      hiring: { ...screenSnapshot.hiring, shake: true },
      future_category: { digest: "weekly" },
    };
    const patch = notificationPrefsDiff(screenSnapshot, editedScreen);
    expect(patch).toEqual({ mention: { sound: false } });
    expect(applyNotificationPrefsPatch(concurrentStored, patch)).toEqual({
      ...concurrentStored,
      mention: { ...concurrentStored.mention, sound: false },
    });
  });

  it("não restaura canal inválido normalizado para false ao salvar outra preferência", () => {
    const before = { mention: { sound: "true", inapp: false }, task: { email: false } };
    const after = normalizeNotificationPrefs(before);
    after.task.email = true;
    expect(notificationPrefsDiff(before, after)).toEqual({ task: { email: true } });
  });
});

describe("interrupções do sino por evento e preferência", () => {
  it("keeps a canonical record quiet by default and permits only explicit effective workspace sounds", () => {
    const row = { type: "workflow", eventKey: "contracts.contract.expiring" };
    const prefs = normalizeNotificationPrefs({ task: { sound: true, shake: true } });
    expect(notificationInterruption(row, prefs, "/contracts")).toEqual({
      toast: true,
      sound: false,
      shake: false,
    });
    expect(
      notificationInterruption(row, prefs, "/contracts", {
        inapp: true,
        email: false,
        sound: true,
        shake: false,
      }),
    ).toEqual({ toast: true, sound: true, shake: false });
    expect(
      notificationInterruption(
        { ...row, eventKey: "shared.approval.pending" },
        prefs,
        "/contracts",
        {
          inapp: true,
          email: false,
          sound: true,
          shake: true,
        },
      ),
    ).toEqual(SILENT);
  });
  it.each(["sla.first_response_breach", "sla.resolution_breach", "sla.at_risk"])(
    "aplica a preferência de SLA ao alias exato %s",
    (type) => {
      const prefs = normalizeNotificationPrefs({ sla: { sound: false, shake: false } });
      expect(notificationInterruption({ type, entity: "ticket" }, prefs, "/deals")).toEqual({
        toast: true,
        sound: false,
        shake: false,
      });
      prefs.sla.inapp = false;
      expect(notificationInterruption({ type }, prefs, "/tickets")).toEqual(SILENT);
    },
  );

  it.each([undefined, null, "", "unknown", "sla.future_breach", "__proto__", "constructor"])(
    "não interrompe por tipo não cadastrado %j",
    (type) =>
      expect(notificationInterruption({ type }, normalizeNotificationPrefs(null), "/")).toEqual(
        SILENT,
      ),
  );

  it("não usa os padrões ruidosos enquanto preferências do usuário não carregaram", () => {
    expect(notificationInterruption({ type: "mention" }, null, "/deals")).toEqual(SILENT);
  });

  it("tolera preferência antiga em memória sem categorias novas e mantém grupos conhecidos", () => {
    const oldRuntimePrefs = LEGACY_DEFAULTS as unknown as NotificationPrefs;
    expect(notificationInterruption({ type: "workflow" }, oldRuntimePrefs, "/")).toEqual(SILENT);
    expect(
      notificationInterruption({ type: "hiring_formalization" }, oldRuntimePrefs, "/"),
    ).toEqual(SILENT);
    expect(notificationInterruption({ type: "mention" }, oldRuntimePrefs, "/")).toEqual({
      toast: true,
      sound: true,
      shake: true,
    });
  });

  it("não lança erro nem habilita canais de preferências parciais ou inválidas em memória", () => {
    expect(notificationInterruption({ type: "mention" }, {} as NotificationPrefs, "/")).toEqual(
      SILENT,
    );
    const invalidInapp = {
      mention: { inapp: "true", sound: true, shake: true },
    } as unknown as NotificationPrefs;
    expect(notificationInterruption({ type: "mention" }, invalidInapp, "/")).toEqual(SILENT);
    const partial = { mention: { inapp: true, sound: "true" } } as unknown as NotificationPrefs;
    expect(notificationInterruption({ type: "mention" }, partial, "/")).toEqual({
      toast: true,
      sound: false,
      shake: false,
    });
  });

  it("não interrompe quando o usuário desabilitou no app mesmo com som e tremor ligados", () => {
    const prefs = normalizeNotificationPrefs({
      mention: { inapp: false, sound: true, shake: true },
    });
    expect(notificationInterruption({ type: "mention" }, prefs, "/")).toEqual(SILENT);
  });

  it.each([
    "workflow",
    "approval",
    "role_profile",
    "form_submission",
    "portfolio_conflict",
    "platform_alert",
  ])("exibe aviso de compatibilidade %s sem habilitar som ou tremor por padrão", (type) =>
    expect(notificationInterruption({ type }, normalizeNotificationPrefs(null), "/")).toEqual({
      toast: true,
      sound: false,
      shake: false,
    }),
  );

  it.each(["/inbox", "/inbox/whatsapp", "/inbox/email", "/inbox/linkedin"])(
    "evita interrupção duplicada da Inbox na rota %s",
    (pathname) => {
      const prefs = normalizeNotificationPrefs(null);
      expect(
        notificationInterruption(
          { type: "message", entity: "inbox_conversation" },
          prefs,
          pathname,
        ),
      ).toEqual(SILENT);
      expect(
        notificationInterruption(
          { type: "message", link: "/inbox/whatsapp?conversation=demo" },
          prefs,
          pathname,
        ),
      ).toEqual(SILENT);
    },
  );

  it("continua avisando comentários de atividade enquanto o usuário está na Inbox", () => {
    expect(
      notificationInterruption(
        {
          type: "message",
          entity: "deal",
          link: "/deals/demo",
        },
        normalizeNotificationPrefs(null),
        "/inbox/whatsapp",
      ),
    ).toEqual({
      toast: true,
      sound: true,
      shake: true,
    });
  });

  it.each(["/inbox-other", "/deals", "/settings/notifications"])(
    "mensagem real da Inbox continua avisando fora da Inbox em %s",
    (pathname) =>
      expect(
        notificationInterruption(
          {
            type: "message",
            entity: "inbox_conversation",
            link: "/inbox/whatsapp",
          },
          normalizeNotificationPrefs(null),
          pathname,
        ),
      ).toEqual({ toast: true, sound: true, shake: true }),
  );

  it("não trata prefixo de rota parecido nem origem de outro tipo como mensagem Inbox", () => {
    const prefs = normalizeNotificationPrefs(null);
    expect(
      notificationInterruption({ type: "message", link: "/inbox-other" }, prefs, "/inbox"),
    ).toEqual({
      toast: true,
      sound: true,
      shake: true,
    });
    expect(
      notificationInterruption(
        {
          type: "mention",
          entity: "service_agent_session",
          link: "/inbox/whatsapp?conversation=demo",
        },
        prefs,
        "/inbox/whatsapp",
      ),
    ).toEqual({ toast: true, sound: true, shake: true });
  });
});
