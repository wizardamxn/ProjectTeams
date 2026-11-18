import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import socket from "../../utils/socket";

/* ================== THUNKS ================== */
// The server knows who you are from your session cookie, so these only send
// who you are talking to. Sender id/name are never trusted from the client.

export const joinChat = (targetUserId: string) => () => {
  socket.emit("joinChat", { targetUserId });
};

export const sendMessage = (payload: { targetUserId: string; text: string }) => () => {
  socket.emit("sendMessage", payload);
};

let isListening = false;

// listen for incoming messages (register ONCE)
export const listenToMessages = () => (dispatch) => {
  if (isListening) return;
  isListening = true;
  socket.on("messageReceived", ({ chatId, message }) => {
    dispatch(addMessage({ chatId, message }));
  });
};

/* ================== SLICE ================== */

interface ChatState {
  activeChatId: string | null;
  messages: any[];
}

const initialState: ChatState = {
  activeChatId: null,
  messages: [],
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    // Only messages for the conversation on screen are kept, so a message
    // from another chat can never show up in this one.
    addMessage: (state, action: PayloadAction<{ chatId: string; message: any }>) => {
      if (!state.activeChatId || String(action.payload.chatId) !== state.activeChatId) return;
      state.messages.push(action.payload);
    },
    setActiveChat: (state, action: PayloadAction<string | null>) => {
      state.activeChatId = action.payload;
    },
    setHistory: (state, action: PayloadAction<any[]>) => {
      state.messages = action.payload;
    },
    leaveChat: (state) => {
      state.activeChatId = null;
      state.messages = [];
    },
  },
});

/* ================== EXPORTS ================== */

export const { addMessage, setActiveChat, setHistory, leaveChat } = chatSlice.actions;
export default chatSlice.reducer;
