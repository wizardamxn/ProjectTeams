import { type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import type { RichDoc } from "@/api/types";
import { docExtensions } from "./docEditor";

/* ---------------- Toolbar ---------------- */

function Btn({ on, label, onClick, children, disabled }: { on?: boolean; label: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the selection
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm transition-colors disabled:opacity-30 ${
        on ? "bg-emerald-500/15 text-emerald-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-white/10" />;

export function Toolbar({ editor }: { editor: Editor }) {
  // Re-render on selection/format changes so active states are right.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link to", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url === "https://") return c().extendMarkRange("link").unsetLink().run();
    if (!/^(https?:|mailto:)/i.test(url.trim())) return; // no javascript: links
    c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
      <Btn label="Bold (Ctrl+B)" on={s.bold} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Italic (Ctrl+I)" on={s.italic} onClick={() => c().toggleItalic().run()}><i className="font-serif">I</i></Btn>
      <Btn label="Strikethrough" on={s.strike} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
      <Btn label="Inline code" on={s.code} onClick={() => c().toggleCode().run()}><code className="text-xs">{"</>"}</code></Btn>
      <Btn label="Link" on={s.link} onClick={setLink}><span className="text-xs underline">link</span></Btn>
      <Sep />
      <Btn label="Heading 1" on={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}><span className="text-xs font-bold">H1</span></Btn>
      <Btn label="Heading 2" on={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><span className="text-xs font-bold">H2</span></Btn>
      <Btn label="Heading 3" on={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><span className="text-xs font-bold">H3</span></Btn>
      <Sep />
      <Btn label="Bulleted list" on={s.bullet} onClick={() => c().toggleBulletList().run()}><span className="text-xs">• —</span></Btn>
      <Btn label="Numbered list" on={s.ordered} onClick={() => c().toggleOrderedList().run()}><span className="text-xs">1.</span></Btn>
      <Btn label="Checklist" on={s.task} onClick={() => c().toggleTaskList().run()}><span className="text-xs">☑</span></Btn>
      <Btn label="Quote" on={s.quote} onClick={() => c().toggleBlockquote().run()}><span className="font-serif text-base">“</span></Btn>
      <Btn label="Code block" on={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}><span className="font-mono text-xs">{"{}"}</span></Btn>
      <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}><span className="text-xs">―</span></Btn>
      <Sep />
      <Btn label="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={() => c().undo().run()}><span className="text-xs">↶</span></Btn>
      <Btn label="Redo (Ctrl+Shift+Z)" disabled={!s.canRedo} onClick={() => c().redo().run()}><span className="text-xs">↷</span></Btn>
    </div>
  );
}

export function RichEditorContent({ editor }: { editor: Editor | null }) {
  return <EditorContent editor={editor} />;
}

/** Read-only rendering (version previews). */
export function RichPreview({ content }: { content: RichDoc }) {
  const editor = useEditor(
    { extensions: docExtensions(""), content: content as JSONContent, editable: false, immediatelyRender: true },
    [JSON.stringify(content)],
  );
  return <EditorContent editor={editor} />;
}
