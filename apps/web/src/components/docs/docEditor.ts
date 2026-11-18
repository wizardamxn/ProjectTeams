import { useEffect, useState } from "react";
import { Mark, mergeAttributes } from "@tiptap/core";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { SocketProvider, type SyncStatus } from "./collabProvider";

// Keep the schema in step with the API's lib/docSchema.ts.

/** Highlights text that has a comment thread. */
export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs) => (attrs.commentId ? { "data-comment-id": attrs.commentId } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "doc-comment" }), 0];
  },
});

const DEFAULT_PLACEHOLDER = "Start writing… use # for headings, - for lists, [ ] for tasks";

/** The extensions every doc uses; read-only previews use the same set without live editing. */
export const docExtensions = (placeholder = DEFAULT_PLACEHOLDER, { collab = false } = {}) => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
    // Live editing brings its own (per-person) undo history.
    ...(collab ? { undoRedo: false as const } : {}),
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({ placeholder }),
  CommentMark,
];

/** Removes a thread's highlight from the doc (everyone sees it go, like any edit). */
export const removeCommentMark = (editor: Editor | null, commentId: string) => {
  if (!editor || editor.isDestroyed) return;
  const { state } = editor;
  const type = state.schema.marks.comment;
  if (!type) return;
  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type === type && mark.attrs.commentId === commentId) tr.removeMark(pos, pos + node.nodeSize, mark);
    }
  });
  if (tr.docChanged) editor.view.dispatch(tr);
};

/* ---------------- Who's editing ---------------- */

const COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316"];
export const colorFor = (id: string) => COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]!;

export interface Collaborator {
  clientId: number;
  name: string;
  color: string;
  userId?: string;
}

/* ---------------- Live editor ---------------- */

interface Session {
  ydoc: Y.Doc;
  provider: SocketProvider;
}

/**
 * An editor bound to the doc's live (shared) state. Text appears once the
 * server's copy has loaded; until then the editor is read-only.
 */
export function useLiveDocEditor({ docId, user }: { docId: string; user: { _id: string; fullName: string } }) {
  // Created in an effect (not during render) so StrictMode's mount/unmount/mount
  // ends up with exactly one live connection.
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [people, setPeople] = useState<Collaborator[]>([]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new SocketProvider(docId, ydoc);
    setSession({ ydoc, provider });
    setStatus(provider.status);
    const off = provider.onStatus(setStatus);
    const readPeople = () => {
      const list: Collaborator[] = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        const u = state.user as { name?: string; color?: string; userId?: string } | undefined;
        if (clientId !== ydoc.clientID && u?.name) list.push({ clientId, name: u.name, color: u.color ?? "#888", userId: u.userId });
      });
      // One avatar per person, even with several tabs open.
      setPeople(list.filter((p, i) => !p.userId || list.findIndex((q) => q.userId === p.userId) === i));
    };
    provider.awareness.on("change", readPeople);
    return () => {
      off();
      provider.awareness.off("change", readPeople);
      provider.destroy();
      ydoc.destroy();
      setSession(null);
      setPeople([]);
    };
  }, [docId]);

  const editor = useEditor(
    {
      extensions: session
        ? [
            ...docExtensions(DEFAULT_PLACEHOLDER, { collab: true }),
            Collaboration.configure({ document: session.ydoc, field: "default" }),
            CollaborationCaret.configure({
              provider: session.provider,
              user: { name: user.fullName, color: colorFor(user._id), userId: user._id },
            }),
          ]
        : docExtensions(""),
      editable: false,
      immediatelyRender: true,
      editorProps: { attributes: { class: "rich-text focus:outline-none", spellcheck: "true" } },
    },
    [session],
  );

  // Editable once the real content is in (typing into an empty copy first would duplicate it).
  const loaded = Boolean(session) && (status === "synced" || session?.provider.status === "synced");
  const [everLoaded, setEverLoaded] = useState(false);
  useEffect(() => {
    if (loaded) setEverLoaded(true);
  }, [loaded]);
  // After the first load, keep editing while offline: changes sync on reconnect.
  const editable = Boolean(session) && everLoaded && status !== "error";
  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  return { editor, status, people, loaded: everLoaded };
}
