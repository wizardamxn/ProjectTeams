import { io } from "socket.io-client";


const socketURL = import.meta.env.VITE_SOCKET_URL;


const socket = io(socketURL, {
    withCredentials: true,
    transports: ["websocket"],
    autoConnect: true,
});

export default socket;
