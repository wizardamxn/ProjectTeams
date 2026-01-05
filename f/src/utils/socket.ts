import { io } from "socket.io-client";

const socket = io("/", {
    withCredentials: true,
    transports: ["websocket"],
    autoConnect: true,
});

export default socket;
