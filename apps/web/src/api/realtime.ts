import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import socket from "@/utils/socket";
import { useAppSelector } from "@/store/hooks";
import { keys } from "./queryClient";
import { useRefreshSession } from "./workspaces";
import { patchConversation, upsertThreadMessage, upsertTimelineMessage, type Typist } from "./chat";
import type { AppNotification, Conversation, Message } from "./types";

/** The conversation on screen; its messages are read as they arrive. */
let activeConversationId: string | null = null;
export const setActiveConversation = (id: string | null) => {
  activeConversationId = id;
};

const TYPING_SHOWN_MS = 4000;

/**
 * Wires socket events into the React Query cache. Mounted once, in the app
 * layout. Every change still comes from the REST API; the socket only tells
 * this client about it.
 */
export function useRealtime() {
  const qc = useQueryClient();
  const myId = useAppSelector((s) => s.user.user?._id);
  const navigate = useNavigate();
  const refreshSession = useRefreshSession();
  const refreshRef = useRef(refreshSession);
  refreshRef.current = refreshSession;

  useEffect(() => {
    const requestPresence = () =>
      socket.emit("presence:list", (ids: string[]) => qc.setQueryData(keys.chat.presence, new Set(ids)));

    const onConnect = () => {
      requestPresence();
      // Catch up on anything missed while disconnected.
      qc.invalidateQueries({ queryKey: keys.chat.conversations });
      qc.invalidateQueries({ queryKey: ["chat", "messages"] });
      qc.invalidateQueries({ queryKey: ["chat", "thread"] });
      qc.invalidateQueries({ queryKey: keys.notifications });
    };

    const onMessageNew = ({ conversationId, message }: { conversationId: string; message: Message }) => {
      if (message.threadRootId) {
        upsertThreadMessage(qc, message);
        return; // the root's reply count arrives as message:updated
      }
      upsertTimelineMessage(qc, message);

      const known = qc.getQueryData<Conversation[]>(keys.chat.conversations)?.some((c) => c._id === conversationId);
      if (!known) {
        // Someone started a DM or added you to a channel.
        qc.invalidateQueries({ queryKey: keys.chat.conversations });
        return;
      }
      const fromSomeoneElse = message.sender._id !== myId;
      const unseen = fromSomeoneElse && (conversationId !== activeConversationId || document.hidden);
      patchConversation(qc, conversationId, (c) => ({
        ...c,
        lastMessageAt: message.createdAt,
        unreadCount: unseen ? c.unreadCount + 1 : c.unreadCount,
      }));
    };

    const onMessageUpdated = ({ message }: { message: Message }) => {
      upsertTimelineMessage(qc, message);
      upsertThreadMessage(qc, message);
    };

    const onNotification = (n: Omit<AppNotification, "read" | "conversationName">) => {
      qc.invalidateQueries({ queryKey: keys.notifications });
      if (n.type === "doc_comment") {
        if (window.location.pathname === `/editor/${n.docId}` && !document.hidden) return;
        toast(`${n.actor.fullName} commented on a doc`, {
          description: n.preview || undefined,
          action: { label: "Open", onClick: () => navigate(`/editor/${n.docId}?comment=${n.commentId}`) },
        });
        return;
      }
      if (n.type === "mention" && n.conversationId) {
        patchConversation(qc, n.conversationId, (c) => ({ ...c, mentionCount: c.mentionCount + 1 }));
      }
      // No toast if you're already looking at it.
      if (n.conversationId === activeConversationId && !document.hidden) return;
      toast(n.type === "mention" ? `${n.actor.fullName} mentioned you` : `${n.actor.fullName} replied in a thread`, {
        description: n.preview || undefined,
        action: {
          label: "Open",
          onClick: () => navigate(`/chat/${n.conversationId}${n.threadRootId ? `?thread=${n.threadRootId}` : ""}`),
        },
      });
    };

    const onTyping = ({ conversationId, userId, fullName }: { conversationId: string; userId: string; fullName: string }) => {
      const key = keys.chat.typing(conversationId);
      const until = Date.now() + TYPING_SHOWN_MS;
      qc.setQueryData<Typist[]>(key, (list = []) => [...list.filter((t) => t.userId !== userId), { userId, fullName, until }]);
      setTimeout(() => {
        qc.setQueryData<Typist[]>(key, (list = []) => list.filter((t) => t.until > Date.now()));
      }, TYPING_SHOWN_MS + 50);
    };

    const onPresence = ({ userId, online }: { userId: string; online: boolean }) => {
      qc.setQueryData<Set<string>>(keys.chat.presence, (prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    // Someone deleted a workspace you're in: drop its data and reload where you are.
    const onWorkspaceDeleted = ({ name, by }: { workspaceId: string; name: string; by: string }) => {
      if (by === myId) return; // the owner's own tab handles this itself
      toast(`${name} was deleted by its owner`);
      void refreshRef.current().catch(() => undefined);
      navigate("/dashboard", { replace: true });
    };

    socket.on("connect", onConnect);
    socket.on("workspace:deleted", onWorkspaceDeleted);
    socket.on("message:new", onMessageNew);
    socket.on("message:updated", onMessageUpdated);
    socket.on("notification:new", onNotification);
    socket.on("typing", onTyping);
    socket.on("presence:update", onPresence);
    if (socket.connected) requestPresence();

    return () => {
      socket.off("connect", onConnect);
      socket.off("workspace:deleted", onWorkspaceDeleted);
      socket.off("message:new", onMessageNew);
      socket.off("message:updated", onMessageUpdated);
      socket.off("notification:new", onNotification);
      socket.off("typing", onTyping);
      socket.off("presence:update", onPresence);
    };
  }, [qc, myId, navigate]);
}

/** Lets the server tell the others you're typing (it throttles too). */
let lastTypingAt = 0;
export const sendTyping = (conversationId: string) => {
  const now = Date.now();
  if (now - lastTypingAt < 2000) return;
  lastTypingAt = now;
  socket.emit("typing", { conversationId });
};
