import { ActivityDateTimePicker } from "@/components/activity/activity-date-time-picker";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { fieldDateKind } from "@/lib/field-date-kind";

/** Editors of SQL catalogue values must not truncate timestamps to a day. */
export function EntityDatePicker({
  field,
  value,
  onChange,
  id,
  name,
  disabled,
  className,
}: {
  field: { label: string; dataType?: string; required?: boolean };
  value?: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  const kind = fieldDateKind(field.dataType);
  if (kind === "timestamp") {
    return (
      <ActivityDateTimePicker
        id={id}
        name={name}
        ariaLabel={field.label}
        value={value}
        valueFormat={field.dataType === "timestamp without time zone" ? "local" : "iso"}
        optional={!field.required}
        disabled={disabled}
        className={className}
        onChange={onChange}
      />
    );
  }
  return (
    <IsoDatePicker
      id={id}
      name={name}
      ariaLabel={field.label}
      value={value}
      required={field.required}
      disabled={disabled || !kind}
      placeholder={kind ? undefined : "Atualize a página para editar a data"}
      className={className}
      onChange={onChange}
    />
  );
}
