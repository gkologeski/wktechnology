import { useState } from "react";
import { MoreHorizontal, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageDraftPin } from "@/components/message-draft-pin";
import {
  ACTIONS_BY_KEY,
  type BarAction,
  type LogKind,
  type OrderState,
  type RelatedKey,
  STORAGE_KEY,
  actionKey,
  loadOrder,
} from "./timeline-shared";

/**
 * Barra de ações da timeline (estilo HubSpot).
 *
 * Responsabilidades isoladas aqui: ordem reorganizável das ações (persistida em
 * localStorage), drag-and-drop entre a barra fixa e o menu "Mais", busca no
 * menu e renderização dos botões. O comportamento é idêntico ao que existia
 * embutido em `activity-timeline.tsx`.
 */
export function TimelineActionBar({
  relatedKey,
  composerOpen,
  activeLogType,
  hasEmailDraft,
  hasWhatsAppDraft,
  onAction,
  trailing,
}: {
  relatedKey: RelatedKey;
  composerOpen: boolean;
  activeLogType: LogKind;
  hasEmailDraft: boolean;
  hasWhatsAppDraft: boolean;
  onAction: (a: BarAction) => void;
  /** Slot extra ao fim da barra (ex.: botão de sala de vídeo). */
  trailing?: React.ReactNode;
}) {
  const [order, setOrder] = useState<OrderState>(() => loadOrder());
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreQuery, setMoreQuery] = useState("");

  const persistOrder = (next: OrderState) => {
    setOrder(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const moveAction = (key: string, targetList: "pinned" | "more", targetIndex: number) => {
    const next: OrderState = { pinned: [...order.pinned], more: [...order.more] };
    const fromPinned = next.pinned.indexOf(key);
    const fromMore = next.more.indexOf(key);
    if (fromPinned >= 0) next.pinned.splice(fromPinned, 1);
    if (fromMore >= 0) next.more.splice(fromMore, 1);
    const dest = targetList === "pinned" ? next.pinned : next.more;
    const clamped = Math.max(0, Math.min(targetIndex, dest.length));
    dest.splice(clamped, 0, key);
    persistOrder(next);
  };

  const onDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData("text/x-action-key", key);
    e.dataTransfer.effectAllowed = "move";
    setDragKey(key);
  };
  const onDragEnd = () => setDragKey(null);
  const allowDrop = (e: React.DragEvent) => {
    if (dragKey || e.dataTransfer.types.includes("text/x-action-key")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };
  const dropOnItem = (e: React.DragEvent, list: "pinned" | "more", index: number) => {
    const key = e.dataTransfer.getData("text/x-action-key") || dragKey;
    if (!key) return;
    e.preventDefault();
    e.stopPropagation();
    moveAction(key, list, index);
    setDragKey(null);
  };
  const dropOnList = (e: React.DragEvent, list: "pinned" | "more") => {
    const key = e.dataTransfer.getData("text/x-action-key") || dragKey;
    if (!key) return;
    e.preventDefault();
    moveAction(key, list, (list === "pinned" ? order.pinned : order.more).length);
    setDragKey(null);
  };

  const handleBarClick = (a: BarAction) => {
    setMoreOpen(false);
    onAction(a);
  };

  const renderCircleButton = (a: BarAction, active: boolean, index: number) => {
    const key = actionKey(a);
    const isDragging = dragKey === key;
    return (
      <button
        key={key}
        type="button"
        draggable
        onDragStart={(e) => onDragStart(e, key)}
        onDragEnd={onDragEnd}
        onDragOver={allowDrop}
        onDrop={(e) => dropOnItem(e, "pinned", index)}
        onClick={() => handleBarClick(a)}
        disabled={a.kind === "create" && a.disabled}
        title={
          a.kind === "create" && a.disabled ? "Em breve" : `${a.label} (arraste para reordenar)`
        }
        className={`flex flex-col items-center gap-1.5 w-16 shrink-0 group cursor-grab active:cursor-grabbing ${
          a.kind === "create" && a.disabled ? "opacity-50 cursor-not-allowed" : ""
        } ${isDragging ? "opacity-40" : ""}`}
      >
        <MessageDraftPin
          show={
            a.kind === "create" &&
            ((a.value === "email" && hasEmailDraft) || (a.value === "whatsapp" && hasWhatsAppDraft))
          }
        >
          <span
            className={`flex items-center justify-center h-12 w-12 rounded-full border transition-all ${
              active
                ? "bg-primary/10 border-primary text-primary ring-2 ring-primary/30"
                : "bg-muted/60 border-border/60 text-foreground/80 group-hover:bg-muted group-hover:border-primary/40 group-hover:text-primary"
            }`}
          >
            {a.icon}
          </span>
        </MessageDraftPin>
        <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight line-clamp-2">
          {a.label}
        </span>
      </button>
    );
  };

  // Em empresas, o envio de "e-mail avulso" não é suportado — oculta a ação de criação de e-mail.
  const isCompanyContext = relatedKey === "related_company_id";
  const hideAction = (a: BarAction) =>
    isCompanyContext && a.kind === "create" && a.value === "email";
  const pinnedActions = order.pinned
    .map((k) => ACTIONS_BY_KEY[k])
    .filter((a): a is BarAction => Boolean(a) && !hideAction(a));
  const moreActions = order.more
    .map((k) => ACTIONS_BY_KEY[k])
    .filter((a): a is BarAction => Boolean(a) && !hideAction(a));
  const moreFiltered = moreActions
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.label.toLowerCase().includes(moreQuery.toLowerCase()));

  return (
    <div
      className="px-4 pt-4 pb-3 flex items-start gap-3 overflow-x-auto"
      onDragOver={allowDrop}
      onDrop={(e) => dropOnList(e, "pinned")}
    >
      {pinnedActions.map((a, i) =>
        renderCircleButton(a, composerOpen && a.kind === "log" && a.value === activeLogType, i),
      )}
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Mais"
            className="flex flex-col items-center gap-1.5 w-16 shrink-0 group"
          >
            <span
              className={`flex items-center justify-center h-12 w-12 rounded-full border transition-all ${
                moreOpen
                  ? "bg-primary/10 border-primary text-primary ring-2 ring-primary/30"
                  : "bg-muted/60 border-border/60 text-foreground/80 group-hover:bg-muted group-hover:border-primary/40 group-hover:text-primary"
              }`}
            >
              <MoreHorizontal className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight">
              Mais
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <div className="p-2 border-b">
            <Input
              value={moreQuery}
              onChange={(e) => setMoreQuery(e.target.value)}
              placeholder="Pesquisar"
              className="h-8"
            />
          </div>
          <div
            className="max-h-80 overflow-y-auto py-1"
            onDragOver={allowDrop}
            onDrop={(e) => dropOnList(e, "more")}
          >
            {moreFiltered.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                Nenhuma ação encontrada.
              </p>
            )}
            {moreFiltered.map(({ a, i }) => {
              const key = actionKey(a);
              const disabled = a.kind === "create" && a.disabled;
              const isDragging = dragKey === key;
              return (
                <div
                  key={`m-${key}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, key)}
                  onDragEnd={onDragEnd}
                  onDragOver={allowDrop}
                  onDrop={(e) => dropOnItem(e, "more", i)}
                  onClick={() => {
                    if (!disabled) handleBarClick(a);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 mx-1 rounded cursor-grab active:cursor-grabbing hover:bg-muted ${
                    disabled ? "opacity-50 cursor-not-allowed" : ""
                  } ${isDragging ? "opacity-40" : ""}`}
                  title="Arraste para reordenar ou para a barra"
                >
                  <span className="text-muted-foreground">{a.icon}</span>
                  <span className="flex-1 text-sm">{a.label}</span>
                  {disabled && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {trailing}
    </div>
  );
}
