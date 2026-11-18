// Shapes returned by the API. Dates arrive as ISO strings.

export interface User {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  /** False for accounts that only sign in with Google. */
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Role = "owner" | "admin" | "member";

export interface WorkspaceSummary {
  _id: string;
  name: string;
  role: Role;
}

/** GET /api/me */
export interface Me {
  user: User;
  workspace: { _id: string; name: string } | null;
  role: Role | null;
  workspaces: WorkspaceSummary[];
}

export interface Member {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  joinedAt: string;
}

/** Everyone in the workspace except you. */
export type TeamMember = Member;

export interface Invite {
  _id: string;
  url: string;
  role: "admin" | "member";
  email: string | null;
  expiresAt: string;
  maxUses: number | null;
  uses: number;
  createdAt: string;
}

export interface InvitePreview {
  workspace: { name: string; memberCount: number };
  invitedBy: string | null;
  role: "admin" | "member";
  emailRestricted: boolean;
}

export interface Doc {
  _id: string;
  title: string;
  /** Editor JSON; only present when a single doc is fetched. */
  contentJson?: RichDoc;
  /** Plain text (an excerpt in lists). */
  content: string;
  summary: string;
  tags: string[];
  folderId: string | null;
  createdBy: string;
  lastEditedBy: string | null;
  teamId: string;
  author: { name: string; avatar?: string };
  /** Starred by you (stars are personal). */
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Tiptap / ProseMirror document JSON. */
export interface RichDoc {
  type: "doc";
  content?: unknown[];
  [key: string]: unknown;
}

export interface Folder {
  _id: string;
  name: string;
  docCount: number;
}

export interface DocVersionSummary {
  _id: string;
  title: string;
  savedAt: string;
  editedBy: { _id: string; fullName: string } | null;
  preview: string;
}

export interface DocVersion {
  _id: string;
  title: string;
  contentJson: RichDoc;
  savedAt: string;
}

export interface DocInput {
  title: string;
  contentJson?: RichDoc;
  summary?: string;
  tags?: string[];
  folderId?: string | null;
  starred?: boolean;
}

/* ---- Chat ---- */

export type ConversationType = "channel" | "dm" | "group";

export interface Person {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

export interface Conversation {
  _id: string;
  type: ConversationType;
  name: string | null;
  topic: string | null;
  isPrivate: boolean;
  isDefault: boolean;
  /** DMs and groups: everyone except you. */
  members: Person[];
  memberCount: number;
  unreadCount: number;
  mentionCount: number;
  lastMessageAt: string;
}

export interface BrowseChannel {
  _id: string;
  name: string;
  topic: string | null;
  memberCount: number;
}

export interface Attachment {
  fileName: string;
  mimeType: string;
  size: number;
  url: string | null;
}

/** What the upload endpoint returns; sent back when posting the message. */
export interface UploadedAttachment {
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface Message {
  _id: string;
  conversationId: string;
  sender: Person;
  text: string;
  threadRootId: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  mentions: string[];
  attachments: Attachment[];
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
}

export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
}

export interface Thread {
  root: Message;
  replies: Message[];
}

export interface AppNotification {
  _id: string;
  type: "mention" | "thread_reply";
  conversationId: string;
  conversationName: string;
  messageId: string;
  threadRootId: string | null;
  actor: Person;
  preview: string;
  read: boolean;
  createdAt: string;
}

export type RagStatus = "uploaded" | "processing" | "ready" | "failed";

export interface RagDoc {
  _id: string;
  fileName: string;
  /** Short-lived signed URL, or null if signing failed. */
  fileUrl: string | null;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  teamId: string;
  uploadedBy: string;
  ragStatus: RagStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RagChunk {
  _id: string;
  chunkIndex: number;
  text: string;
}

export interface AskSource {
  n: number;
  type: "doc" | "file" | "chat";
  title: string;
  snippet: string;
  score: number;
  docId: string | null;
  fileId: string | null;
  conversationId: string | null;
  messageId: string | null;
}

export interface AskAnswer {
  answer: string;
  sources: AskSource[];
}

export interface KnowledgeStats {
  docs: number;
  files: number;
  channels: number;
}

export interface SearchResults {
  docs: { _id: string; title: string; snippet: string; updatedAt: string }[];
  files: { _id: string; fileName: string; ragStatus: RagStatus }[];
  messages: {
    _id: string;
    conversationId: string;
    threadRootId: string | null;
    where: string;
    sender: string;
    snippet: string;
    createdAt: string;
  }[];
}
