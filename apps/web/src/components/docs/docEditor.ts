import { useEffect, useRef } from "react";
import { useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import type { RichDoc } from "@/api/types";

/** The extensions every doc uses; read-only previews must match. */
export const docExtensions = (placeholder = "Start writing… use # for headings, - for lists, [ ] for tasks") => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({ placeholder }),
];

/* ---------------- Editor ---------------- */

export function useDocEditor({
  content,
  editable = true,
  onChange,
}: {
  content: RichDoc | undefined;
  editable?: boolean;
  onChange?: (json: RichDoc) => void;
}) {
  // Always call the latest onChange without recreating the editor.
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const editor = useEditor(
    {
      extensions: docExtensions(),
      content: (content as JSONContent | undefined) ?? "",
      editable,
      immediatelyRender: true,
      editorProps: { attributes: { class: "rich-text focus:outline-none", spellcheck: "true" } },
      // Only real edits count (setEditable and selection changes also emit "update").
      onUpdate: ({ editor: e, transaction }) => {
        if (transaction.docChanged) changeRef.current?.(e.getJSON() as RichDoc);
      },
    },
    // Recreate only when switching between docs/versions, not on every save.
    [],
  );

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  return editor;
}

