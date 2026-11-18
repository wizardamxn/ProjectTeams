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

/** A teammate in the chat list (everyone but you). */
export interface TeamMember extends Member {
  lastMessage: string | null;
}

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

export interface ChatMessage {
  _id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface Chat {
  _id: string;
  participants: string[];
  messages: ChatMessage[];
}

/** A message as it is held in the chat store (history and live messages alike). */
export interface ChatEvent {
  chatId: string;
  message: {
    _id?: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp?: string;
  };
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
