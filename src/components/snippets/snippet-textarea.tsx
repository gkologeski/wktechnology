// Wrapper de <Textarea>/<Input> com autocompletar de snippets via /atalho.
// Reutiliza `useSnippetTrigger` e o `SnippetPicker` para renderizar sugestões.
import { forwardRef, useImperativeHandle, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useSnippetTrigger } from "@/hooks/use-snippet-trigger";
import { SnippetPicker } from "./snippet-picker";

type BaseProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  rows?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement | HTMLInputElement>;
};

export const SnippetTextarea = forwardRef<HTMLTextAreaElement, BaseProps>(function SnippetTextarea(
  { value, onChange, placeholder, className, disabled, id, name, rows, onKeyDown, ...rest },
  fwdRef,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(fwdRef, () => ref.current!, []);
  const trigger = useSnippetTrigger({ ref, value, onChange });
  return (
    <>
      <Textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          trigger.onKeyDown(e);
          if (!e.defaultPrevented) onKeyDown?.(e);
        }}
        onBlur={() => setTimeout(trigger.close, 150)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        aria-label={rest["aria-label"]}
      />
      {trigger.active && (
        <SnippetPicker
          anchor={trigger.anchor}
          results={trigger.results}
          activeIdx={trigger.activeIdx}
          onHoverIdx={trigger.setActiveIdx}
          onPick={trigger.pick}
        />
      )}
    </>
  );
});

export const SnippetInput = forwardRef<HTMLInputElement, BaseProps>(function SnippetInput(
  { value, onChange, placeholder, className, disabled, id, name, ...rest },
  fwdRef,
) {
  const ref = useRef<HTMLInputElement>(null);
  useImperativeHandle(fwdRef, () => ref.current!, []);
  const trigger = useSnippetTrigger({ ref, value, onChange });
  return (
    <>
      <Input
        ref={ref}
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={trigger.onKeyDown}
        onBlur={() => setTimeout(trigger.close, 150)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        aria-label={rest["aria-label"]}
      />
      {trigger.active && (
        <SnippetPicker
          anchor={trigger.anchor}
          results={trigger.results}
          activeIdx={trigger.activeIdx}
          onHoverIdx={trigger.setActiveIdx}
          onPick={trigger.pick}
        />
      )}
    </>
  );
});
