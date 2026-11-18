import { getSchema, Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

// The editor's document schema, mirrored on the server so it can read and
// write the collaborative (Yjs) copy of a doc. Keep in step with
// apps/web/src/components/docs/docEditor.ts: a node or mark missing here is
// dropped when the server converts a doc.

/** Highlights text that has a comment thread; `commentId` links to it. */
export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el: { getAttribute(name: string): string | null }) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs: { commentId?: string | null }) => (attrs.commentId ? { "data-comment-id": attrs.commentId } : {}),
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

export const docSchemaExtensions = () => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, undoRedo: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  CommentMark,
];

export const docSchema = getSchema(docSchemaExtensions());
