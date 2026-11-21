// Destino do clique em uma notificação. Notificações de conversa do WhatsApp
// (inclusive antigas, gravadas só com "/inbox/whatsapp") abrem a conversa exata.
export type NotificationTarget = { to: string; search?: Record<string, string> };

const ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const detail = new RegExp(
  `^/(?:leads|contacts|companies|deals|tickets|tasks|candidates|people|projects|contracts|proposals|services|jobs|ats/jobs|finance/entries|contracts/drafts)/${ID}$`,
  "i",
);
const lists = new Set([
  "/tasks",
  "/workflows",
  "/settings/workflows",
  "/settings/quotes",
  "/settings/recurring",
  "/contracts",
  "/contracts/signatures",
  "/contracts/supplier-requests",
  "/contracts/contracting-flow",
  "/people",
  "/people/hiring-requests",
  "/people/my-team",
  "/projects",
  "/projects/tasks",
  "/projects/hours-review",
  "/finance/banking",
  "/invoices",
  "/inbox",
  "/inbox/whatsapp",
  "/inbox/email",
  "/inbox/chat",
  "/inbox/linkedin",
  "/jobs",
  "/ats/jobs",
  "/candidates",
  "/offers",
  "/leads",
  "/contacts",
  "/companies",
  "/deals",
  "/tickets",
  "/notifications",
]);
const queryKeys = new Set([
  "conversation",
  "taskId",
  "milestoneId",
  "applicationId",
  "interviewId",
  "offerId",
  "documentId",
  "fiscalDocumentId",
  "request",
  "tab",
  "view",
  "run",
  "workflow",
  "profile",
  "approval",
]);

export function notificationHref(n: {
  link: string | null;
  entity?: string | null;
  entity_id?: string | null;
}): NotificationTarget | null {
  if (!n.link) return null;
  // Only existing internal destinations. Never turn stored text into an external/open redirect.
  if (n.link.length > 2048 || /[\\\s#]/.test(n.link)) return null;
  const [path, query] = n.link.split("?");
  if (!lists.has(path) && !detail.test(path)) return null;
  if (
    ["/inbox/whatsapp", "/inbox/email", "/inbox/chat", "/inbox/linkedin"].includes(path) &&
    n.entity === "inbox_conversation" &&
    n.entity_id &&
    new RegExp(`^${ID}$`, "i").test(n.entity_id)
  ) {
    return { to: path, search: { conversation: n.entity_id } };
  }
  if (query) {
    const search = Object.fromEntries(new URLSearchParams(query));
    if (Object.entries(search).some(([key, value]) => !queryKeys.has(key) || value.length > 200))
      return null;
    return { to: path, search };
  }
  return { to: path };
}
