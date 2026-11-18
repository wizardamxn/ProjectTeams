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
  participants: Types.ObjectId[];
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
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    messages: [messageSchema],
  },
  { timestamps: true },
);

chatSchema.index({ participants: 1 });

export const Chat = mongoose.model<IChat>("Chat", chatSchema);
