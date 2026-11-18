import { useTheme } from "next-themes";
import { Moon, Sun } from "@/components/icons";

/** Icon button: flips between light and dark. */
export function ThemeToggle({ className = "", label }: { className?: string; label?: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={className}
    >
      {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
      {label}
    </button>
  );
}

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

/** Segmented control for the profile page. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-white/10 bg-zinc-900 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => setTheme(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            theme === o.value ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
