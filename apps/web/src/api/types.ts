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
  content: string;
  summary?: string;
  tags: string[];
  createdBy: string;
  teamId: string;
  author: { name: string; avatar?: string };
  starred: boolean;
  versions: { _id?: string; content: string; updatedAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface DocInput {
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
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

export interface AskAnswer {
  answer: string;
  sources: { documentId: string; score: number }[];
}
