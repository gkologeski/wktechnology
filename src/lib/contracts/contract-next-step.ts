// PROXIMO-PASSO-CONTRATO — regra única "qual é o próximo passo" da ficha do contrato.
// Função pura: só decide texto/destino; as ações reais continuam nos painéis existentes.

export type ContractDetailTab = "overview" | "document" | "approvals" | "amendments" | "history";

export type NextStepTarget = { kind: "tab"; tab: ContractDetailTab } | { kind: "measurements" };

export type NextStepAction = {
  label: string;
  target: NextStepTarget;
  disabledReason?: string;
};

export type NextStepInput = {
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  totalValue: number;
  hasBody: boolean;
  canUpdate: boolean;
  canTransition: boolean;
  canActivate: boolean;
  today: Date;
};

export type NextStep = {
  stageIndex: number;
  headline: string;
  explanation: string;
  primary: NextStepAction | null;
  secondary: NextStepAction[];
  checklist: { label: string; done: boolean }[];
};

export const CONTRACT_STAGES = [
  "Rascunho",
  "Revisão e aprovação",
  "Assinatura",
  "Ativo",
  "Renovação ou encerramento",
] as const;

export const RENEWAL_WARNING_DAYS = 30;
const NO_PERMISSION = "Sem permissão";

function daysUntil(iso: string | null, today: Date): number | null {
  if (!iso) return null;
  const end = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function fmt(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const tab = (t: ContractDetailTab): NextStepTarget => ({ kind: "tab", tab: t });

export function contractNextStep(input: NextStepInput): NextStep {
  const { status } = input;
  const amendment: NextStepAction = {
    label: "Adicionar aditivo",
    target: tab("amendments"),
    disabledReason: input.canUpdate ? undefined : NO_PERMISSION,
  };

  if (status === "draft" || status === "in_negotiation") {
    const checklist = [
      { label: "Vigência (início e fim)", done: !!input.startsAt && !!input.endsAt },
      { label: "Valor total", done: input.totalValue > 0 },
      { label: "Corpo do contrato", done: input.hasBody },
    ];
    const missing = checklist.filter((c) => !c.done).length;
    const blocked = !input.canTransition
      ? NO_PERMISSION
      : missing > 0
        ? "Conclua os itens pendentes"
        : undefined;
    return {
      stageIndex: 0,
      headline: "Revise os dados e envie para aprovação",
      explanation:
        missing > 0
          ? `Falta${missing > 1 ? "m" : ""} ${missing} item${missing > 1 ? "s" : ""} antes de enviar. Depois da aprovação, o contrato segue para assinatura.`
          : "Tudo pronto. Depois da aprovação, o contrato segue para assinatura.",
      primary: {
        label: "Enviar para aprovação",
        target: tab("approvals"),
        disabledReason: blocked,
      },
      secondary: [{ label: "Revisar documento", target: tab("document") }],
      checklist,
    };
  }

  if (status === "in_review") {
    return {
      stageIndex: 1,
      headline: "Aguardando aprovações",
      explanation:
        "Acompanhe quem já aprovou. Com todas as aprovações, o contrato segue para assinatura.",
      primary: { label: "Ver aprovações pendentes", target: tab("approvals") },
      secondary: [],
      checklist: [],
    };
  }

  if (status === "awaiting_signature") {
    return {
      stageIndex: 2,
      headline: "Aguardando assinatura",
      explanation: "Quando todos assinarem, ative o contrato para iniciar os serviços.",
      primary: { label: "Acompanhar assinatura", target: tab("approvals") },
      secondary: [
        {
          label: "Ativar contrato",
          target: tab("overview"),
          disabledReason: input.canActivate && input.canUpdate ? undefined : NO_PERMISSION,
        },
      ],
      checklist: [],
    };
  }

  if (status === "active") {
    const left = daysUntil(input.endsAt, input.today);
    const nearEnd = left != null && left <= RENEWAL_WARNING_DAYS;
    const explanation =
      left == null
        ? "Sem data de término. Registre medições ou crie um aditivo se o escopo mudar."
        : left < 0
          ? `O término (${fmt(input.endsAt)}) já passou. Renove ou encerre o contrato.`
          : `Em vigor até ${fmt(input.endsAt)} (faltam ${left} dias). Registre medições ou crie um aditivo se o escopo mudar.`;
    const renew: NextStepAction = {
      label: "Renovar",
      target: tab("overview"),
      disabledReason: input.canTransition && input.canUpdate ? undefined : NO_PERMISSION,
    };
    return {
      stageIndex: 3,
      headline: nearEnd ? "Contrato perto do fim" : "Contrato em vigor",
      explanation,
      primary: nearEnd ? renew : { label: "Registrar medição", target: { kind: "measurements" } },
      secondary: nearEnd
        ? [{ label: "Registrar medição", target: { kind: "measurements" } }, amendment]
        : [amendment, renew],
      checklist: [],
    };
  }

  if (status === "renewing") {
    return {
      stageIndex: 4,
      headline: "Renovação em andamento",
      explanation: "Atualize a vigência e, se houver mudanças, registre um aditivo.",
      primary: {
        label: "Atualizar vigência",
        target: tab("overview"),
        disabledReason: input.canUpdate ? undefined : NO_PERMISSION,
      },
      secondary: [amendment],
      checklist: [],
    };
  }

  return {
    stageIndex: 4,
    headline: status === "terminated" ? "Contrato rescindido" : "Contrato encerrado",
    explanation: "Nenhuma ação pendente. O histórico continua disponível.",
    primary: null,
    secondary: [{ label: "Ver histórico", target: tab("history") }],
    checklist: [],
  };
}
