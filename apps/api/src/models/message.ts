import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export interface IAttachment {
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  senderId: Types.ObjectId;
  text: string;
  /** Set on replies: the message that started the thread. */
  threadRootId?: Types.ObjectId;
  /** On thread roots. */
  replyCount: number;
  lastReplyAt?: Date;
  /** Everyone who has replied in the thread (roots only), for notifications. */
  threadParticipants: Types.ObjectId[];
  mentions: Types.ObjectId[];
  attachments: IAttachment[];
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageDoc = HydratedDocument<IMessage>;

const attachmentSchema = new Schema<IAttachment>(
  {
    storagePath: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "", maxLength: 4000 },
    threadRootId: { type: Schema.Types.ObjectId, ref: "Message" },
    replyCount: { type: Number, default: 0 },
    lastReplyAt: { type: Date },
    threadParticipants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
    attachments: { type: [attachmentSchema], default: [] },
    editedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

// Main timeline (top-level messages, newest first) and thread replies.
messageSchema.index({ conversationId: 1, threadRootId: 1, _id: -1 });
messageSchema.index({ threadRootId: 1, _id: 1 });
messageSchema.index({ text: "text" }, { name: "message_text" });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
