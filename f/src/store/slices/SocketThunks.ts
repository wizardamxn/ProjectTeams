import { createSlice } from "@reduxjs/toolkit";
import socket from "../../utils/socket";

/* ================== THUNKS ================== */

// join chat room
export const joinChat = (userId, targetUserId) => () => {
  socket.emit("joinChat", { userId, targetUserId });
};

export const sendMessage = (payload) => () => {
  socket.emit("sendMessage", payload);
};

// listen for incoming messages (register ONCE)
export const listenToMessages = () => (dispatch) => {
  socket.on("messageReceived", ({ chatId, message }) => {
    dispatch(addMessage({ chatId, message }));
  });
};

/* ================== SLICE ================== */

const chatSlice = createSlice({
  name: "chat",
  initialState: {
    messages: [],
  },
  reducers: {
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setHistory: (state, action) => {
      state.messages = action.payload;
    },
    leaveChat: (state,action) => {
      state.messages = []
    }
  },
});

/* ================== EXPORTS ================== */

export const { addMessage, setHistory } = chatSlice.actions;
export default chatSlice.reducer;
