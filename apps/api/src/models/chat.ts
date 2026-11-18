import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export interface IMessage {
  _id: Types.ObjectId;
  senderId: Types.ObjectId;
  senderName: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChat {
  _id: Types.ObjectId;
  /** DMs belong to a workspace; the same two people get a separate chat per workspace. */
  workspaceId?: Types.ObjectId;
  participants: Types.ObjectId[];
  pairKey?: string;
  // Still embedded; Phase 4 moves messages to their own paginated collection.
  messages: Types.DocumentArray<IMessage>;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatDoc = HydratedDocument<IChat>;

const messageSchema = new Schema<IMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true },
);

const chatSchema = new Schema<IChat>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace" },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    // "<workspaceId>:<idA>:<idB>" (ids sorted); unique so two users opening their chat at once get one chat.
    // Sparse because chats created before this field have none.
    pairKey: { type: String, unique: true, sparse: true },
    messages: [messageSchema],
  },
  { timestamps: true },
);

chatSchema.index({ workspaceId: 1, participants: 1 });

export const Chat = mongoose.model<IChat>("Chat", chatSchema);
