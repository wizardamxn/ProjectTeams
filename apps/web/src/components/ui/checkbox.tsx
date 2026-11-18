import { Check } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Styled replacement for <input type="checkbox">. It's a real button with
 * role="checkbox", so Space toggles it, and a wrapping <label> click toggles it too.
 */
export function Checkbox({
  checked,
  onChange,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-600 bg-zinc-900 hover:border-zinc-500",
        className,
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  );
}

/** On/off toggle (role="switch"), same props as Checkbox. */
export function Switch({
  checked,
  onChange,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
}: Parameters<typeof Checkbox>[0]) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-emerald-500" : "bg-zinc-700",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
