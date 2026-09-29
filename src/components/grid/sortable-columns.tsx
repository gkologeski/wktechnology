import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type Axis = "horizontal" | "vertical";

export function SortableColumns({
  keys,
  axis = "horizontal",
  onReorder,
  children,
}: {
  keys: string[];
  axis?: Axis;
  onReorder: (activeKey: string, overKey: string) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={keys}
        strategy={axis === "horizontal" ? horizontalListSortingStrategy : verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableColumnHeader({
  columnKey,
  label,
  children,
}: {
  columnKey: string;
  label: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey,
  });

  if (!isValidElement(children)) return <>{children}</>;

  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref: setNodeRef,
    style: {
      ...((children.props as { style?: object }).style ?? {}),
      transform: CSS.Translate.toString(transform),
      transition,
      position: "relative",
      zIndex: isDragging ? 20 : undefined,
    },
    className: cn(
      (children.props as { className?: string }).className,
      "touch-pan-y select-none",
      isDragging && "bg-muted opacity-80 shadow-sm",
    ),
    "data-column-key": columnKey,
    "aria-label": `Coluna ${label}. Arraste para reordenar.`,
    ...attributes,
    ...listeners,
  });
}

export function SortableListItem({
  itemKey,
  label,
  children,
}: {
  itemKey: string;
  label: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: itemKey,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded px-2 py-1.5 hover:bg-background",
        isDragging && "relative z-20 bg-background shadow-sm",
      )}
    >
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        aria-label={`Arrastar coluna ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}