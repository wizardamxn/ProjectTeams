// Shapes returned by the API. Dates arrive as ISO strings.

export interface User {
  _id: string;
  fullName: string;
  email: string;
  teamCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  _id: string;
  fullName: string;
  email: string;
  lastMessage: string | null;
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
