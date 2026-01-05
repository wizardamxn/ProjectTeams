import { io } from "socket.io-client";

const socket = io("/api", {
    withCredentials: true,
    autoConnect: true,
});

export default socket;
