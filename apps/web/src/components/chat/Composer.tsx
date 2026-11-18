import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Send, X, FileText } from "@/components/icons";
import { uploadAttachment, useSendMessage } from "@/api/chat";
import { sendTyping } from "@/api/realtime";
import type { Person, UploadedAttachment } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { Avatar } from "./Avatar";
import { fileSize } from "./format";

const MAX_FILES = 5;
const MAX_TEXT = 4000;

interface Props {
  conversationId: string;
  threadRootId?: string;
  placeholder: string;
  /** People who can be @mentioned (the conversation's members, minus you). */
  people: Person[];
  autoFocus?: boolean;
}

/** Text box with @mentions, file attachments and "typing…" signals. Enter sends, Shift+Enter adds a line. */
export function Composer({ conversationId, threadRootId, placeholder, people, autoFocus }: Props) {
  const send = useSendMessage();
  const [text, setText] = useState("");
  const [mentioned, setMentioned] = useState<Person[]>([]);
  const [files, setFiles] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [query, setQuery] = useState<string | null>(null); // text after "@" while picking
  const [pick, setPick] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Drafts don't carry over between conversations.
  useEffect(() => {
    setText("");
    setMentioned([]);
    setFiles([]);
    setQuery(null);
  }, [conversationId, threadRootId]);

  // Grow with the content, up to ~8 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return people.filter((p) => p.fullName.toLowerCase().includes(q)).slice(0, 6);
  }, [query, people]);

  const updateQuery = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const match = /(?:^|\s)@([\p{L}\p{N} .'-]{0,30})$/u.exec(before);
    setQuery(match ? match[1]! : null);
    setPick(0);
  };

  const insertMention = (person: Person) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@[^@]*$/, `@${person.fullName} `);
    const next = before + text.slice(caret);
    setText(next);
    setMentioned((m) => (m.some((p) => p._id === person._id) ? m : [...m, person]));
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  };

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const chosen = Array.from(list).slice(0, MAX_FILES - files.length);
    if (list.length > chosen.length) toast.error(`Up to ${MAX_FILES} files per message`);
    for (const file of chosen) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 10 MB`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const uploaded = await uploadAttachment(conversationId, file);
        setFiles((f) => [...f, uploaded]);
      } catch (err) {
        toast.error(errorMessage(err, `Couldn't upload ${file.name}`));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submit = () => {
    const body = text.trim();
    if ((!body && files.length === 0) || uploading > 0 || send.isPending) return;
    // Only mentions still present in the text count.
    const mentions = mentioned.filter((p) => body.includes(`@${p.fullName}`)).map((p) => p._id);
    send.mutate(
      { conversationId, threadRootId, text: body, mentions, attachments: files },
      {
        onSuccess: () => {
          setText("");
          setMentioned([]);
          setFiles([]);
        },
        onError: (err) => toast.error(errorMessage(err, "Message not sent")),
      },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setPick((p) => (p + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[pick]!);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = (text.trim().length > 0 || files.length > 0) && uploading === 0 && !send.isPending;

  return (
    <div className="relative">
      {suggestions.length > 0 && (
        <ul role="listbox" aria-label="Mention someone" className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-2xl">
          {suggestions.map((p, i) => (
            <li key={p._id}>
              <button
                type="button"
                role="option"
                aria-selected={i === pick}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(p);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${i === pick ? "bg-white/[0.06] text-white" : "text-zinc-300"}`}
              >
                <Avatar person={p} size="xs" showPresence />
                {p.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-white/10 bg-zinc-900 focus-within:border-emerald-500/40">
        {(files.length > 0 || uploading > 0) && (
          <div className="flex flex-wrap gap-2 border-b border-white/[0.06] p-2">
            {files.map((f, i) => (
              <span key={f.storagePath} className="flex items-center gap-1.5 rounded-md bg-zinc-800 py-1 pl-2 pr-1 text-xs text-zinc-300">
                <FileText className="h-3.5 w-3.5 text-zinc-500" />
                <span className="max-w-[10rem] truncate">{f.fileName}</span>
                <span className="text-zinc-500">{fileSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
                  className="rounded p-0.5 text-zinc-500 hover:text-white"
                  aria-label={`Remove ${f.fileName}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {uploading > 0 && (
              <span className="flex items-center gap-1.5 px-2 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
              </span>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 p-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={files.length >= MAX_FILES}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
            aria-label="Attach files"
            title="Attach files"
          >
            <Plus className="h-5 w-5" />
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              updateQuery(e.target.value, e.target.selectionStart);
              if (e.target.value.trim()) sendTyping(conversationId);
            }}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              if (e.clipboardData.files.length) {
                e.preventDefault();
                void addFiles(e.clipboardData.files);
              }
            }}
            maxLength={MAX_TEXT}
            rows={1}
            autoFocus={autoFocus}
            placeholder={placeholder}
            aria-label={placeholder}
            className="max-h-[200px] min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600"
            aria-label="Send"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <p className="mt-1 hidden px-1 text-[11px] text-zinc-600 sm:block">
        <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for a new line · <kbd>@</kbd> to mention
      </p>
    </div>
  );
}
