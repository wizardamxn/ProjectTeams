import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

// Radix reserves "" for "no value", so an "All"/"None" option uses this instead.
const EMPTY = "__empty__";
const toRadix = (v: string) => (v === "" ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? "" : v);

/** Styled, keyboard-accessible replacement for a native <select>. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <SelectPrimitive.Root value={toRadix(value)} onValueChange={(v) => onChange(fromRadix(v) as T)} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 text-left text-sm text-zinc-100 outline-none transition-colors hover:border-white/20 focus-visible:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-zinc-500",
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-[60] max-h-[min(18rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-xl"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={toRadix(o.value)}
                className="relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-7 pr-3 text-sm text-zinc-300 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-zinc-800 data-[state=checked]:text-white data-[highlighted]:text-white data-[disabled]:opacity-40"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 flex items-center">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
