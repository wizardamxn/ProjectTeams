import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export const CONVERSATION_TYPES = ["channel", "dm", "group"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const GENERAL_CHANNEL = "general";

export interface IConversation {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  type: ConversationType;
  /** Channels only: lowercase, a-z 0-9 and dashes ("design-team"). */
  name?: string;
  topic?: string;
  /** Channels only: private channels are invisible to non-members. */
  isPrivate: boolean;
  /** The workspace's #general: everyone is in it and nobody can leave. */
  isDefault: boolean;
  /** DMs and groups: sorted member ids joined with ":", so each set of people has one conversation. */
  dmKey?: string;
  createdBy: Types.ObjectId;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationDoc = HydratedDocument<IConversation>;

const conversationSchema = new Schema<IConversation>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    type: { type: String, enum: CONVERSATION_TYPES, required: true },
    name: { type: String, trim: true, lowercase: true, maxLength: 40 },
    topic: { type: String, trim: true, maxLength: 250 },
    isPrivate: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    dmKey: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastMessageAt: { type: Date },
  },
  { timestamps: true },
);

// One channel per name, one DM/group per set of people, one #general — per workspace.
conversationSchema.index(
  { workspaceId: 1, name: 1 },
  { unique: true, partialFilterExpression: { type: "channel" } },
);
conversationSchema.index(
  { workspaceId: 1, dmKey: 1 },
  { unique: true, partialFilterExpression: { dmKey: { $type: "string" } } },
);
conversationSchema.index(
  { workspaceId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

export const Conversation = mongoose.model<IConversation>("Conversation", conversationSchema);

/** Who is in a conversation, and how far they've read. */
export interface IConversationMember {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  lastReadAt: Date;
  createdAt: Date;
}

const conversationMemberSchema = new Schema<IConversationMember>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastReadAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

conversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationMemberSchema.index({ workspaceId: 1, userId: 1 });

export const ConversationMember = mongoose.model<IConversationMember>("ConversationMember", conversationMemberSchema);
