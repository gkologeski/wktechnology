import { lazy, Suspense, forwardRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export type { WordEditorHandle } from "@/components/word-editor";
import type { WordEditorHandle } from "@/components/word-editor";

// O editor carrega ~20 pacotes do TipTap/ProseMirror. Só baixamos esse código
// quando uma tela realmente renderiza o editor.
const WordEditorImpl = lazy(() =>
  import("@/components/word-editor").then((m) => ({ default: m.WordEditor })),
);

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  editable?: boolean;
};

export const WordEditor = forwardRef<WordEditorHandle, Props>(function LazyWordEditor(props, ref) {
  const minHeight = props.minHeight ?? 360;
  return (
    <Suspense
      fallback={
        <div className="space-y-2 rounded-md border p-3" aria-busy="true" aria-live="polite">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="w-full" style={{ height: minHeight }} />
          <span className="sr-only">Carregando editor…</span>
        </div>
      }
    >
      <WordEditorImpl ref={ref} {...props} />
    </Suspense>
  );
});
