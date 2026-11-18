import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export const NOTIFICATION_TYPES = ["mention", "thread_reply", "doc_comment"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  type: NotificationType;
  actorId: Types.ObjectId;
  /** Chat notifications point at a message… */
  conversationId?: Types.ObjectId;
  messageId?: Types.ObjectId;
  /** …doc comment notifications at a doc and comment thread. */
  docId?: Types.ObjectId;
  commentId?: Types.ObjectId;
  /** For thread replies: the root, so the UI can open the thread. */
  threadRootId?: Types.ObjectId;
  preview: string;
  readAt?: Date;
  createdAt: Date;
}

export type NotificationDoc = HydratedDocument<INotification>;

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    messageId: { type: Schema.Types.ObjectId, ref: "Message" },
    docId: { type: Schema.Types.ObjectId, ref: "Document" },
    commentId: { type: Schema.Types.ObjectId, ref: "DocComment" },
    threadRootId: { type: Schema.Types.ObjectId, ref: "Message" },
    preview: { type: String, maxLength: 200 },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, workspaceId: 1, _id: -1 });
// Old read notifications clean themselves up after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600, partialFilterExpression: { readAt: { $exists: true } } });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
