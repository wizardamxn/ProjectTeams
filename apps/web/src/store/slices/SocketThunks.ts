import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import socket from "@/utils/socket";
import type { ChatEvent } from "@/api/types";
import type { AppDispatch } from "../store";

/* ================== SOCKET ACTIONS ================== */
// The server knows who you are from your session cookie, so these only send
// who you are talking to. Sender id/name are never sent from the client.

export const joinChat = (targetUserId: string) => {
  socket.emit("joinChat", { targetUserId });
};

export const sendMessage = (payload: { targetUserId: string; text: string }) => {
  socket.emit("sendMessage", payload);
};

let isListening = false;

/** Registers the incoming-message listener once for the app's lifetime. */
export const listenToMessages = (dispatch: AppDispatch) => {
  if (isListening) return;
  isListening = true;
  socket.on("messageReceived", (event: ChatEvent) => {
    dispatch(addMessage(event));
  });
};

/* ================== SLICE ================== */

interface ChatState {
  activeChatId: string | null;
  messages: ChatEvent[];
}

const initialState: ChatState = { activeChatId: null, messages: [] };

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    // Only messages for the conversation on screen are kept, so a message
    // from another chat can never show up in this one.
    addMessage: (state, action: PayloadAction<ChatEvent>) => {
      if (!state.activeChatId || String(action.payload.chatId) !== state.activeChatId) return;
      state.messages.push(action.payload);
    },
    setActiveChat: (state, action: PayloadAction<string | null>) => {
      state.activeChatId = action.payload;
    },
    setHistory: (state, action: PayloadAction<ChatEvent[]>) => {
      state.messages = action.payload;
    },
    leaveChat: (state) => {
      state.activeChatId = null;
      state.messages = [];
    },
  },
});

export const { addMessage, setActiveChat, setHistory, leaveChat } = chatSlice.actions;
export default chatSlice.reducer;
