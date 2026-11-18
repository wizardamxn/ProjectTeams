import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

// Styled, promise-based replacements for window.confirm() and window.prompt().
// <DialogHost /> is mounted once in App; call sites just `await confirmDialog(...)`.

interface ConfirmOptions {
  title: string;
  body?: string;
  /** Label of the confirm button, e.g. "Delete". */
  action?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  body?: string;
  defaultValue?: string;
  placeholder?: string;
  action?: string;
}

type Request =
  | ({ kind: "confirm"; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (value: string | null) => void } & PromptOptions);

let enqueue: ((r: Request) => void) | null = null;

export const confirmDialog = (opts: ConfirmOptions) =>
  new Promise<boolean>((resolve) => (enqueue ? enqueue({ kind: "confirm", ...opts, resolve }) : resolve(false)));

/** Resolves to the entered text, or null if cancelled. */
export const promptDialog = (opts: PromptOptions) =>
  new Promise<string | null>((resolve) => (enqueue ? enqueue({ kind: "prompt", ...opts, resolve }) : resolve(null)));

export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const [text, setText] = useState("");
  const current = queue[0];

  useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r]);
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (current?.kind === "prompt") setText(current.defaultValue ?? "");
  }, [current]);

  const finish = (ok: boolean) => {
    if (!current) return;
    if (current.kind === "confirm") current.resolve(ok);
    else current.resolve(ok ? text : null);
    setQueue((q) => q.slice(1));
  };

  return (
    <DialogPrimitive.Root open={!!current} onOpenChange={(open) => !open && finish(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[18vh] z-[80] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl outline-none"
          onOpenAutoFocus={(e) => {
            // Prompts focus their input; confirms focus Cancel so Enter can't destroy by accident.
            if (current?.kind === "confirm") {
              e.preventDefault();
              (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-cancel]")?.focus();
            }
          }}
        >
          {current && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                finish(true);
              }}
            >
              <DialogPrimitive.Title className="text-base font-semibold text-white">{current.title}</DialogPrimitive.Title>
              {current.body ? (
                <DialogPrimitive.Description className="mt-1.5 text-sm text-zinc-400">{current.body}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{current.title}</DialogPrimitive.Description>
              )}
              {current.kind === "prompt" && (
                <input
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={current.placeholder}
                  aria-label={current.title}
                  className="mt-4 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
                />
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  data-cancel
                  onClick={() => finish(false)}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-300 outline-none hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cn(
                    "rounded-lg px-3.5 py-2 text-sm font-semibold text-white outline-none hover:opacity-90 focus-visible:ring-2",
                    current.kind === "confirm" && current.danger
                      ? "bg-red-600 focus-visible:ring-red-500/50"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600 focus-visible:ring-emerald-500/50",
                  )}
                >
                  {current.action ?? "OK"}
                </button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
